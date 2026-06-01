import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { randomBytes } from "crypto";
import {
  activationCodesCol,
  renewalLogsCol,
  usersCol,
  type UserDoc
} from "../lib/db.js";
import { requireAdmin, requireUser } from "../middleware/require-role.js";
import { verifyTurnstile } from "../services/turnstile.js";

const router = Router();

const listUsersQuerySchema = z.object({
  status: z.enum(["inactive", "active", "grace", "expired", "disabled"]).optional()
});

const updateUserStatusSchema = z.object({
  status: z.enum(["inactive", "active", "grace", "expired", "disabled"])
});

const createCodeSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(1),
  durationDays: z.coerce.number().int().min(1).max(3650),
  graceDays: z.coerce.number().int().min(0).max(365).default(3),
  note: z.string().trim().max(200).optional()
});

const listCodesQuerySchema = z.object({
  status: z.enum(["unused", "used", "revoked"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

const redeemSchema = z.object({
  code: z.string().trim().min(8).max(64),
  turnstileToken: z.string().optional()
});

const manualRenewSchema = z.object({
  durationDays: z.coerce.number().int().min(1).max(3650),
  graceDays: z.coerce.number().int().min(0).max(365).default(3)
});

function generateActivationCode() {
  return `SM-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function computeNextDates(previousExpireAt: Date | null, durationDays: number, graceDays: number) {
  const now = new Date();
  const start = previousExpireAt && previousExpireAt > now ? previousExpireAt : now;
  const nextExpireAt = addDays(start, durationDays);
  const nextDisableAfter = addDays(nextExpireAt, graceDays);
  return { nextExpireAt, nextDisableAfter };
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
  return res.json({ items: users.map((u) => userSafeView(u as UserDoc & { _id: ObjectId })) });
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

  const { nextExpireAt, nextDisableAfter } = computeNextDates(
    user.expire_at,
    parsed.data.durationDays,
    parsed.data.graceDays
  );

  const now = new Date();
  await usersCol().updateOne(
    { _id: userId },
    {
      $set: {
        status: "active",
        expire_at: nextExpireAt,
        disable_after: nextDisableAfter,
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
    next_disable_after: nextDisableAfter,
    operator_user_id: new ObjectId(req.session.userId),
    operator_type: "admin",
    operator_username: req.session.username || "admin",
    source: "admin_manual",
    created_at: now
  });

  return res.json({
    message: "renewed",
    expire_at: nextExpireAt,
    disable_after: nextDisableAfter
  });
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
  const now = new Date();
  const docs = Array.from({ length: parsed.data.count }).map(() => ({
    code: generateActivationCode(),
    duration_days: parsed.data.durationDays,
    grace_days: parsed.data.graceDays,
    status: "unused" as const,
    used_by_user_id: null,
    used_by_username: null,
    used_at: null,
    revoked_at: null,
    note: parsed.data.note || null,
    created_at: now,
    updated_at: now
  }));
  await activationCodesCol().insertMany(docs, { ordered: false });
  return res.status(201).json({
    items: docs.map((d) => ({
      code: d.code,
      duration_days: d.duration_days,
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
  const filter = parsed.data.status ? { status: parsed.data.status } : {};
  const docs = await activationCodesCol().find(filter).sort({ created_at: -1 }).limit(parsed.data.limit).toArray();
  return res.json({
    items: docs.map((doc) => ({
      id: String(doc._id),
      code: doc.code,
      duration_days: doc.duration_days,
      grace_days: doc.grace_days,
      status: doc.status,
      used_by_username: doc.used_by_username,
      used_at: doc.used_at,
      created_at: doc.created_at,
      revoked_at: doc.revoked_at,
      note: doc.note
    }))
  });
});

router.post("/admin/codes/:id/revoke", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid code id" });
  }
  const now = new Date();
  const result = await activationCodesCol().findOneAndUpdate(
    { _id: new ObjectId(req.params.id), status: "unused" },
    { $set: { status: "revoked", revoked_at: now, updated_at: now } },
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
  const result = await activationCodesCol().deleteOne({ _id: new ObjectId(req.params.id) });
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
  const turnstile = await verifyTurnstile("redeem", parsed.data.turnstileToken);
  if (!turnstile.ok) {
    return res.status(400).json({ message: turnstile.message });
  }

  const userId = new ObjectId(req.session.userId);
  const user = await usersCol().findOne({ _id: userId });
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = new Date();
  const codeDoc = await activationCodesCol().findOneAndUpdate(
    { code: parsed.data.code, status: "unused" },
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

  const { nextExpireAt, nextDisableAfter } = computeNextDates(
    user.expire_at,
    codeDoc.duration_days,
    codeDoc.grace_days
  );

  await usersCol().updateOne(
    { _id: userId },
    {
      $set: {
        status: "active",
        expire_at: nextExpireAt,
        disable_after: nextDisableAfter,
        updated_at: now
      }
    }
  );

  await renewalLogsCol().insertOne({
    user_id: userId,
    username: user.username,
    activation_code_id: codeDoc._id || null,
    activation_code: codeDoc.code,
    duration_days: codeDoc.duration_days,
    grace_days: codeDoc.grace_days,
    previous_expire_at: user.expire_at,
    previous_disable_after: user.disable_after,
    next_expire_at: nextExpireAt,
    next_disable_after: nextDisableAfter,
    operator_user_id: userId,
    operator_type: "user",
    operator_username: user.username,
    source: "redeem",
    created_at: now
  });

  return res.json({
    message: "redeemed",
    expire_at: nextExpireAt,
    disable_after: nextDisableAfter
  });
});

export default router;
