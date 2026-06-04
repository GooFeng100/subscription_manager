import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import {
  activationCodesCol,
  renewalLogsCol,
  adminsCol,
  usersCol,
  type ActivationCodeDoc,
  type ActivationCodeMode,
  type UserDoc
} from "../lib/db.js";
import { requireAdmin, requireUser } from "../middleware/require-role.js";
import { generateSubToken } from "../lib/utils.js";
import { deriveUserStatus, resolveDisableAfterForWrite, syncUserLifecycle } from "../services/user-lifecycle.js";
import { expireFixedActivationCodes } from "../services/activation-code-expiry.js";
import {
  addShanghaiDays,
  compareDateStrings,
  endOfShanghaiDay,
  formatShanghaiDate,
  isValidDateString,
  todayShanghaiDate
} from "../lib/shanghai-date.js";

const router = Router();

const listUsersQuerySchema = z.object({
  status: z.enum(["inactive", "active", "grace", "expired", "disabled"]).optional()
});

const updateUserStatusSchema = z.object({
  status: z.enum(["inactive", "active", "grace", "expired", "disabled"])
});

const updateUserSchema = z.object({
  password: z.string().min(8).max(128).optional(),
  contact: z.string().trim().max(120).optional().nullable(),
  expire_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  note: z.string().trim().max(200).optional().nullable()
});

const createUserSchema = z.object({
  username: z.string().min(8).max(64).regex(/^[A-Za-z][A-Za-z0-9]*$/),
  password: z.string().min(8).max(128),
  contact: z.string().trim().max(120).optional().nullable(),
  expire_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  note: z.string().trim().max(200).optional().nullable()
});

const createCodeSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(1),
  mode: z.enum(["add_days", "fixed_expire_date"]).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  durationDays: z.coerce.number().int().min(1).max(3650).optional(),
  fixedExpireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  graceDays: z.coerce.number().int().min(0).max(365).default(3),
  note: z.string().trim().max(200).optional()
});

const updateCodeSchema = z.object({
  mode: z.enum(["add_days", "fixed_expire_date"]).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  durationDays: z.coerce.number().int().min(1).max(3650).optional(),
  fixedExpireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  graceDays: z.coerce.number().int().min(0).max(365).optional(),
  note: z.string().trim().max(200).optional().nullable()
});

const listCodesQuerySchema = z.object({
  status: z.enum(["unused", "used", "revoked"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

const redeemSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9]{6}$/, "code must be 6 chars [A-Z0-9]")
});

const manualRenewSchema = z.object({
  durationDays: z.coerce.number().int().min(1).max(3650),
  graceDays: z.coerce.number().int().min(0).max(365).default(3)
});

function generateActivationCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[randomInt(0, chars.length)];
  }
  return out;
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function atStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isReservedAdminUsername(username: string) {
  return username.trim() === String(env.ADMIN_USERNAME || "").trim();
}

function computeNextDates(previousExpireAt: Date | null, durationDays: number, graceDays: number) {
  const now = new Date();
  const start = previousExpireAt && previousExpireAt > now ? previousExpireAt : now;
  const nextExpireAt = addDays(start, durationDays);
  const nextDisableAfter = addDays(nextExpireAt, graceDays);
  return { nextExpireAt, nextDisableAfter };
}

function resolveCodeMode(doc: Pick<ActivationCodeDoc, "mode" | "duration_days" | "fixed_expire_date">): ActivationCodeMode {
  return doc.mode === "fixed_expire_date" ? "fixed_expire_date" : "add_days";
}

function displayExpireRule(mode: ActivationCodeMode, days: number, fixedExpireDate: string | null | undefined) {
  if (mode === "fixed_expire_date") {
    return `固定到期 ${fixedExpireDate || "-"}`;
  }
  return `增加 ${days} 天`;
}

function validateCodeRule(payload: {
  mode?: ActivationCodeMode;
  days?: number;
  durationDays?: number;
  fixedExpireDate?: string | null;
}, fallback?: Pick<ActivationCodeDoc, "mode" | "duration_days" | "fixed_expire_date">) {
  const mode = payload.mode ?? (fallback ? resolveCodeMode(fallback) : "add_days");
  const days = payload.days ?? payload.durationDays ?? fallback?.duration_days;
  const fixedExpireDate = payload.fixedExpireDate ?? fallback?.fixed_expire_date ?? null;

  if (mode === "add_days") {
    if (!Number.isInteger(days) || !days || days < 1 || days > 3650) {
      return { ok: false as const, message: "durationDays must be 1-3650" };
    }
    return {
      ok: true as const,
      mode,
      durationDays: days,
      fixedExpireDate: null
    };
  }

  if (!fixedExpireDate || !isValidDateString(fixedExpireDate)) {
    return { ok: false as const, message: "fixedExpireDate must be YYYY-MM-DD" };
  }
  if (compareDateStrings(fixedExpireDate, todayShanghaiDate()) < 0) {
    return { ok: false as const, message: "fixedExpireDate cannot be earlier than today" };
  }
  return {
    ok: true as const,
    mode,
    durationDays: days && Number.isInteger(days) ? days : 0,
    fixedExpireDate
  };
}

function activationCodeView(doc: ActivationCodeDoc) {
  const mode = resolveCodeMode(doc);
  const fixedExpireDate = doc.fixed_expire_date ?? null;
  return {
    id: String(doc._id),
    code: doc.code,
    mode,
    days: doc.duration_days,
    duration_days: doc.duration_days,
    fixedExpireDate,
    fixed_expire_date: fixedExpireDate,
    displayExpireRule: displayExpireRule(mode, doc.duration_days, fixedExpireDate),
    grace_days: doc.grace_days,
    status: doc.status,
    used_by_username: doc.used_by_username,
    used_at: doc.used_at,
    oldExpireAt: doc.old_expire_at ?? null,
    newExpireAt: doc.new_expire_at ?? null,
    created_at: doc.created_at,
    revoked_at: doc.revoked_at,
    revokeReason: doc.revoke_reason ?? null,
    note: doc.note
  };
}

function computeRedeemExpireAt(userExpireAt: Date | null, codeDoc: ActivationCodeDoc, now = new Date()) {
  const mode = resolveCodeMode(codeDoc);
  if (mode === "fixed_expire_date") {
    const fixedExpireDate = codeDoc.fixed_expire_date || "";
    return {
      mode,
      expireDate: fixedExpireDate,
      nextExpireAt: endOfShanghaiDay(fixedExpireDate)
    };
  }

  const baseDate = userExpireAt && userExpireAt > now
    ? formatShanghaiDate(userExpireAt)
    : todayShanghaiDate(now);
  const expireDate = addShanghaiDays(baseDate, codeDoc.duration_days);
  return {
    mode,
    expireDate,
    nextExpireAt: endOfShanghaiDay(expireDate)
  };
}

function userSafeView(user: UserDoc & { _id: ObjectId }) {
  return {
    id: String(user._id),
    username: user.username,
    status: user.status,
    expire_at: user.expire_at,
    disable_after: user.disable_after,
    sub_token: user.sub_token,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at
  };
}

router.get("/admin/users", requireAdmin, async (req, res) => {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params" });
  }
  const filter = parsed.data.status ? { status: parsed.data.status } : {};
  const users = await usersCol().find(filter).sort({ created_at: -1 }).toArray();
  const synced = await Promise.all(
    users.map((u) => syncUserLifecycle(u as UserDoc & { _id: ObjectId }))
  );
  return res.json({ items: synced.map((u) => userSafeView(u as UserDoc & { _id: ObjectId })) });
});

router.patch("/admin/users/:userId/status", requireAdmin, async (req, res) => {
  const parsed = updateUserStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  if (!ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  const userId = new ObjectId(req.params.userId);
  const now = new Date();
  const update: Partial<UserDoc> & { updated_at: Date } = { status: parsed.data.status, updated_at: now };
  if (parsed.data.status === "inactive" || parsed.data.status === "disabled") {
    update.expire_at = null;
    update.disable_after = null;
  }
  const result = await usersCol().findOneAndUpdate(
    { _id: userId },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({ item: userSafeView(result as UserDoc & { _id: ObjectId }) });
});

router.post("/admin/users/:userId/renew", requireAdmin, async (req, res) => {
  const parsed = manualRenewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  if (!ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  const userId = new ObjectId(req.params.userId);
  const user = await usersCol().findOne({ _id: userId });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const now = new Date();

  const { nextExpireAt } = computeNextDates(
    user.expire_at,
    parsed.data.durationDays,
    parsed.data.graceDays
  );
  const effectiveDisableAfter = (await resolveDisableAfterForWrite(nextExpireAt, parsed.data.graceDays, now))
    ?? addDays(atStartOfDay(nextExpireAt), parsed.data.graceDays);

  await usersCol().updateOne(
    { _id: userId },
    {
      $set: {
        status: "active",
        expire_at: nextExpireAt,
        disable_after: effectiveDisableAfter,
        sub_token: user.sub_token || generateSubToken(),
        updated_at: now
      }
    }
  );

  await renewalLogsCol().insertOne({
    user_id: userId,
    username: user.username,
    activation_code_id: null,
    activation_code: null,
    duration_days: parsed.data.durationDays,
    grace_days: parsed.data.graceDays,
    previous_expire_at: user.expire_at,
    previous_disable_after: user.disable_after,
    next_expire_at: nextExpireAt,
    next_disable_after: effectiveDisableAfter,
    operator_user_id: new ObjectId(req.session.userId),
    operator_type: "admin",
    operator_username: req.session.username || "admin",
    source: "admin_manual",
    created_at: now
  });

  return res.json({
    message: "renewed",
    expire_at: nextExpireAt,
    disable_after: effectiveDisableAfter
  });
});

router.post("/admin/users", requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }

  const trimmedUsername = parsed.data.username.trim();
  if (isReservedAdminUsername(trimmedUsername)) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const [exists, adminExists] = await Promise.all([
    usersCol().findOne({ username: trimmedUsername }),
    adminsCol().findOne({ username: trimmedUsername })
  ]);
  if (exists || adminExists) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const now = new Date();
  const expireAt = parsed.data.expire_at ? new Date(`${parsed.data.expire_at}T00:00:00.000Z`) : null;
  const disableAfter = await resolveDisableAfterForWrite(expireAt, 3, now);
  const status = deriveUserStatus({ status: "inactive", expire_at: expireAt, disable_after: disableAfter }, now);
  const subToken = status === "active" || status === "grace" ? generateSubToken() : null;
  const password_hash = await bcrypt.hash(parsed.data.password.trim(), 12);

  const result = await usersCol().insertOne({
    username: trimmedUsername,
    password_hash,
    contact: (parsed.data.contact ?? "").trim() || null,
    note: (parsed.data.note ?? "").trim() || null,
    sub_token: subToken,
    status,
    expire_at: expireAt,
    disable_after: disableAfter,
    created_at: now,
    updated_at: now,
    last_login_at: null
  });

  const created = await usersCol().findOne({ _id: result.insertedId });
  if (!created) {
    return res.status(500).json({ message: "User created but reload failed" });
  }
  return res.status(201).json({ item: userSafeView(created as UserDoc & { _id: ObjectId }) });
});

router.patch("/admin/users/:userId", requireAdmin, async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  if (!ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  const userId = new ObjectId(req.params.userId);
  const user = await usersCol().findOne({ _id: userId });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const now = new Date();
  const update: Partial<UserDoc> & { updated_at: Date } = { updated_at: now };
  if (parsed.data.contact !== undefined) {
    const v = (parsed.data.contact ?? "").trim();
    update.contact = v ? v : null;
  }
  if (parsed.data.note !== undefined) {
    const v = (parsed.data.note ?? "").trim();
    update.note = v ? v : null;
  }
  if (parsed.data.expire_at !== undefined) {
    if (!parsed.data.expire_at) {
      update.expire_at = null;
      update.disable_after = null;
      update.status = "inactive";
    } else {
      const expireAt = new Date(`${parsed.data.expire_at}T00:00:00.000Z`);
      update.expire_at = expireAt;
      update.disable_after = await resolveDisableAfterForWrite(expireAt, 3, now);
      update.status = deriveUserStatus({ status: user.status, expire_at: expireAt, disable_after: update.disable_after }, now);
      if ((update.status === "active" || update.status === "grace") && !user.sub_token) {
        update.sub_token = generateSubToken();
      }
    }
  }
  if (parsed.data.password && parsed.data.password.trim()) {
    update.password_hash = await bcrypt.hash(parsed.data.password.trim(), 12);
  }

  const updated = await usersCol().findOneAndUpdate(
    { _id: userId },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!updated) {
    return res.status(404).json({ message: "User not found" });
  }
  const synced = await syncUserLifecycle(updated as UserDoc & { _id: ObjectId }, now);
  return res.json({ item: userSafeView(synced as UserDoc & { _id: ObjectId }) });
});

router.delete("/admin/users/:userId", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  const userId = new ObjectId(req.params.userId);
  const result = await usersCol().deleteOne({ _id: userId });
  if (!result.deletedCount) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({ message: "deleted" });
});

router.post("/admin/users/:userId/reset-token", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  const userId = new ObjectId(req.params.userId);
  const now = new Date();
  const result = await usersCol().findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        sub_token: generateSubToken(),
        updated_at: now
      }
    },
    { returnDocument: "after" }
  );
  if (!result) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({ item: userSafeView(result as UserDoc & { _id: ObjectId }) });
});

router.get("/admin/renew-logs", requireAdmin, async (_req, res) => {
  const docs = await renewalLogsCol().find({}).sort({ created_at: -1 }).limit(200).toArray();
  return res.json({
    items: docs.map((doc) => ({
      id: String(doc._id),
      username: doc.username,
      source: doc.source,
      duration_days: doc.duration_days,
      grace_days: doc.grace_days,
      previous_expire_at: doc.previous_expire_at,
      next_expire_at: doc.next_expire_at,
      next_disable_after: doc.next_disable_after,
      operator_username: doc.operator_username,
      created_at: doc.created_at
    }))
  });
});

router.post("/admin/codes", requireAdmin, async (req, res) => {
  const parsed = createCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  const rule = validateCodeRule(parsed.data);
  if (!rule.ok) {
    return res.status(400).json({ message: rule.message });
  }
  const now = new Date();
  const docs = Array.from({ length: parsed.data.count }).map(() => ({
    code: generateActivationCode(),
    mode: rule.mode,
    duration_days: rule.durationDays,
    fixed_expire_date: rule.fixedExpireDate,
    grace_days: parsed.data.graceDays,
    status: "unused" as const,
    used_by_user_id: null,
    used_by_username: null,
    used_at: null,
    revoked_at: null,
    revoke_reason: null,
    note: parsed.data.note || null,
    created_at: now,
    updated_at: now
  }));
  await activationCodesCol().insertMany(docs, { ordered: false });
  return res.status(201).json({
    items: docs.map((d) => ({
      code: d.code,
      mode: d.mode,
      days: d.duration_days,
      duration_days: d.duration_days,
      fixedExpireDate: d.fixed_expire_date,
      displayExpireRule: displayExpireRule(d.mode, d.duration_days, d.fixed_expire_date),
      grace_days: d.grace_days,
      status: d.status
    }))
  });
});

router.get("/admin/codes", requireAdmin, async (req, res) => {
  const parsed = listCodesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params" });
  }
  await expireFixedActivationCodes();
  const filter = parsed.data.status ? { status: parsed.data.status } : {};
  const docs = await activationCodesCol().find(filter).sort({ created_at: -1 }).limit(parsed.data.limit).toArray();
  return res.json({
    items: docs.map((doc) => activationCodeView(doc))
  });
});

router.patch("/admin/codes/:id", requireAdmin, async (req, res) => {
  const parsed = updateCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid code id" });
  }
  const id = new ObjectId(req.params.id);
  const code = await activationCodesCol().findOne({ _id: id });
  if (!code) {
    return res.status(404).json({ message: "Code not found" });
  }
  if (code.status !== "unused") {
    return res.status(409).json({ message: "Only unused codes can be edited" });
  }
  const rule = validateCodeRule(parsed.data, code);
  if (!rule.ok) {
    return res.status(400).json({ message: rule.message });
  }
  const now = new Date();
  const update: Partial<ActivationCodeDoc> & { updated_at: Date } = {
    mode: rule.mode,
    duration_days: rule.durationDays,
    fixed_expire_date: rule.fixedExpireDate,
    updated_at: now
  };
  if (parsed.data.graceDays !== undefined) {
    update.grace_days = parsed.data.graceDays;
  }
  if (parsed.data.note !== undefined) {
    const note = (parsed.data.note ?? "").trim();
    update.note = note || null;
  }
  const updated = await activationCodesCol().findOneAndUpdate(
    { _id: id, status: "unused" },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!updated) {
    return res.status(409).json({ message: "Only unused codes can be edited" });
  }
  return res.json({ item: activationCodeView(updated) });
});

router.post("/admin/codes/:id/revoke", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid code id" });
  }
  const now = new Date();
  const result = await activationCodesCol().findOneAndUpdate(
    { _id: new ObjectId(req.params.id), status: "unused" },
    { $set: { status: "revoked", revoked_at: now, updated_at: now, revoke_reason: "manual" } },
    { returnDocument: "after" }
  );
  if (!result) {
    return res.status(409).json({ message: "Code cannot be revoked" });
  }
  return res.json({ message: "revoked" });
});

router.delete("/admin/codes/:id", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid code id" });
  }
  const id = new ObjectId(req.params.id);
  const code = await activationCodesCol().findOne({ _id: id });
  if (!code) {
    return res.status(404).json({ message: "Code not found" });
  }
  if (code.status === "used") {
    return res.status(409).json({ message: "Used code cannot be deleted" });
  }
  const result = await activationCodesCol().deleteOne({ _id: id });
  if (!result.deletedCount) {
    return res.status(404).json({ message: "Code not found" });
  }
  return res.json({ message: "deleted" });
});

router.post("/redeem", requireUser, async (req, res) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }

  const userId = new ObjectId(req.session.userId);
  const user = await usersCol().findOne({ _id: userId });
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = new Date();
  const codeDoc = await activationCodesCol().findOneAndUpdate(
    {
      code: parsed.data.code,
      status: "unused",
      $or: [
        { mode: { $ne: "fixed_expire_date" } },
        { fixed_expire_date: { $gte: todayShanghaiDate(now) } }
      ]
    },
    {
      $set: {
        status: "used",
        used_by_user_id: userId,
        used_by_username: user.username,
        used_at: now,
        updated_at: now
      }
    },
    { returnDocument: "after" }
  );

  if (!codeDoc) {
    return res.status(409).json({ message: "Code invalid or already used" });
  }

  const { mode, expireDate, nextExpireAt } = computeRedeemExpireAt(user.expire_at, codeDoc, now);
  const effectiveDisableAfter = (await resolveDisableAfterForWrite(nextExpireAt, codeDoc.grace_days, now))
    ?? addDays(atStartOfDay(nextExpireAt), codeDoc.grace_days);

  await usersCol().updateOne(
    { _id: userId },
    {
      $set: {
        status: "active",
        expire_at: nextExpireAt,
        disable_after: effectiveDisableAfter,
        sub_token: user.sub_token || generateSubToken(),
        updated_at: now
      }
    }
  );

  await activationCodesCol().updateOne(
    { _id: codeDoc._id },
    {
      $set: {
        old_expire_at: user.expire_at,
        new_expire_at: nextExpireAt,
        updated_at: now
      }
    }
  );

  await renewalLogsCol().insertOne({
    user_id: userId,
    username: user.username,
    activation_code_id: codeDoc._id || null,
    activation_code: codeDoc.code,
    mode,
    duration_days: codeDoc.duration_days,
    fixed_expire_date: codeDoc.fixed_expire_date ?? null,
    grace_days: codeDoc.grace_days,
    previous_expire_at: user.expire_at,
    previous_disable_after: user.disable_after,
    next_expire_at: nextExpireAt,
    next_disable_after: effectiveDisableAfter,
    operator_user_id: userId,
    operator_type: "user",
    operator_username: user.username,
    source: "redeem",
    created_at: now
  });

  return res.json({
    ok: true,
    status: "active",
    expireDate,
    message: `兑换成功，有效期至 ${expireDate}`,
    expire_at: nextExpireAt,
    expireAt: nextExpireAt,
    disable_after: effectiveDisableAfter
  });
});

export default router;
