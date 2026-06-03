import type { ObjectId } from "mongodb";
import { systemStateCol, usersCol, type UserDoc } from "../lib/db.js";
import { generateSubToken } from "../lib/utils.js";
import { computeDisableAfterFromSchedules } from "./rotation-schedules.js";

export type UserStatus = "inactive" | "active" | "grace" | "expired" | "disabled";
const ROTATION_SCHEDULES_KEY = "rotation_schedules";

function atStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function getScheduledDisableAfter(disableAt: Date | null, now = new Date()) {
  if (!disableAt) {
    return null;
  }
  const state = await systemStateCol().findOne({ key: ROTATION_SCHEDULES_KEY });
  const payload = state?.payload as {
    items?: Array<{
      enabled?: boolean;
      mode?: "once" | "monthly";
      once_date?: string | null;
      day_of_month?: number | null;
      hour?: number;
      minute?: number;
    }>;
  } | undefined;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return computeDisableAfterFromSchedules(items as Parameters<typeof computeDisableAfterFromSchedules>[0], disableAt, now);
}

export async function resolveDisableAfterForWrite(expireAt: Date | null, graceDays: number, now = new Date()) {
  if (!expireAt) {
    return null;
  }
  const scheduledDisableAfter = await getScheduledDisableAfter(expireAt, now);
  if (scheduledDisableAfter) {
    return scheduledDisableAfter;
  }
  return new Date(expireAt.getFullYear(), expireAt.getMonth(), expireAt.getDate() + graceDays);
}

export function deriveUserStatus(user: Pick<UserDoc, "status" | "expire_at" | "disable_after">, now = new Date()): UserStatus {
  if (user.status === "disabled") return "disabled";
  if (!user.expire_at) return "inactive";

  const today = atStartOfDay(now).getTime();
  const expireTs = atStartOfDay(user.expire_at).getTime();
  const disableTs = user.disable_after ? atStartOfDay(user.disable_after).getTime() : expireTs;

  if (today <= expireTs) return "active";
  if (today <= disableTs) return "grace";
  return "expired";
}

export async function syncUserLifecycle(user: UserDoc & { _id: ObjectId }, now = new Date()) {
  const scheduledDisableAfter = await getScheduledDisableAfter(user.expire_at, now);
  const effectiveDisableAfter = user.expire_at
    ? (scheduledDisableAfter ?? user.disable_after ?? user.expire_at)
    : null;
  const computed = deriveUserStatus({ status: user.status, expire_at: user.expire_at, disable_after: effectiveDisableAfter }, now);
  const normalizedDisableAfter = user.expire_at
    ? effectiveDisableAfter
    : null;
  const normalizedSubToken =
    (computed === "active" || computed === "grace")
      ? (user.sub_token || generateSubToken())
      : user.sub_token;

  const needUpdate =
    user.status !== computed ||
    ((user.disable_after?.getTime() ?? null) !== (normalizedDisableAfter?.getTime() ?? null)) ||
    user.sub_token !== normalizedSubToken;

  if (!needUpdate) {
    return { ...user, status: computed, disable_after: normalizedDisableAfter };
  }

  await usersCol().updateOne(
    { _id: user._id },
    {
      $set: {
        status: computed,
        disable_after: normalizedDisableAfter,
        sub_token: normalizedSubToken,
        updated_at: now
      }
    }
  );

  return {
    ...user,
    status: computed,
    disable_after: normalizedDisableAfter,
    sub_token: normalizedSubToken,
    updated_at: now
  };
}

export async function recalculateAllUserLifecycle(now = new Date()) {
  const users = await usersCol().find({}).toArray();
  const synced = await Promise.all(users.map((user) => syncUserLifecycle(user as UserDoc & { _id: ObjectId }, now)));
  return synced.length;
}
