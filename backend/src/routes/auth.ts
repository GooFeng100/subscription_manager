import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { adminsCol, usersCol } from "../lib/db.js";
import { generateSubToken, boolFromEnv } from "../lib/utils.js";
import { clearLoginFail, isLoginLocked, recordLoginFail } from "../services/login-guard.js";
import { verifyTurnstile } from "../services/turnstile.js";
import { checkRegisterIpLimit, recordRegisterIp } from "../services/register-guard.js";
import { writeAuthLog } from "../services/auth-log.js";
import { requireAdmin, requireAuth, requireUser } from "../middleware/require-role.js";
import { authLogsCol } from "../lib/db.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";

const router = Router();

const usernameSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Username must start with a letter and contain only letters or numbers");

const userAuthSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(128),
  turnstileToken: z.string().optional()
});
const adminAuthSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().optional()
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128)
});

function clientIp(ip?: string) {
  return ip || "unknown";
}

function userAgent(ua?: string) {
  return ua || "unknown";
}

router.post("/admin/login", async (req, res) => {
  const parsed = adminAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }

  const { username, password, turnstileToken } = parsed.data;
  const ip = clientIp(req.ip);
  const ua = userAgent(req.get("user-agent"));
  const locked = await isLoginLocked(username, ip);
  if (locked) {
    await writeAuthLog({
      username,
      ip,
      userAgent: ua,
      action: "admin_login",
      success: false,
      message: "login locked by rate limit"
    });
    return res.status(429).json({ message: "Too many failed logins, try later" });
  }

  const turnstile = await verifyTurnstile("admin_login", turnstileToken);
  if (!turnstile.ok) {
    await writeAuthLog({
      username,
      ip,
      userAgent: ua,
      action: "admin_login",
      success: false,
      message: turnstile.message || "turnstile failed"
    });
    return res.status(400).json({ message: turnstile.message });
  }

  const admin = await adminsCol().findOne({ username });
  const valid = admin ? await bcrypt.compare(password, admin.password_hash) : false;

  if (!admin || !valid || admin.status === "disabled") {
    await recordLoginFail(username, ip);
    await writeAuthLog({
      userId: admin?._id ? String(admin._id) : null,
      username,
      ip,
      userAgent: ua,
      action: "admin_login",
      success: false,
      message: "invalid credentials or disabled"
    });
    return res.status(401).json({ message: "Invalid username or password" });
  }

  await clearLoginFail(username, ip);
  await adminsCol().updateOne(
    { _id: admin._id },
    { $set: { last_login_at: new Date(), updated_at: new Date() } }
  );

  req.session.userId = String(admin._id);
  req.session.userType = "admin";
  req.session.username = admin.username;
  await writeAuthLog({
    userId: String(admin._id),
    username: admin.username,
    ip,
    userAgent: ua,
    action: "admin_login",
    success: true,
    message: "ok"
  });
  return res.json({ message: "ok" });
});

router.post("/register", async (req, res) => {
  const settings = await getRuntimeSettings();
  if (!settings.registration_enabled) {
    return res.status(403).json({ message: "Registration is disabled" });
  }
  const parsed = userAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  const { username, password, turnstileToken } = parsed.data;
  const ip = clientIp(req.ip);
  const ua = userAgent(req.get("user-agent"));
  const ipAllowed = await checkRegisterIpLimit(ip);
  if (!ipAllowed) {
    await writeAuthLog({
      username,
      ip,
      userAgent: ua,
      action: "register",
      success: false,
      message: "register ip limit exceeded"
    });
    return res.status(429).json({ message: "Too many registrations from this IP, try later" });
  }

  const turnstile = await verifyTurnstile("register", turnstileToken);
  if (!turnstile.ok) {
    await writeAuthLog({
      username,
      ip,
      userAgent: ua,
      action: "register",
      success: false,
      message: turnstile.message || "turnstile failed"
    });
    return res.status(400).json({ message: turnstile.message });
  }

  const exists = await usersCol().findOne({ username });
  if (exists) {
    await writeAuthLog({
      username,
      ip,
      userAgent: ua,
      action: "register",
      success: false,
      message: "username already exists"
    });
    return res.status(409).json({ message: "Username already exists" });
  }

  const now = new Date();
  const password_hash = await bcrypt.hash(password, 12);
  await usersCol().insertOne({
    username,
    password_hash,
    sub_token: generateSubToken(),
    status: "inactive",
    expire_at: null,
    disable_after: null,
    created_at: now,
    updated_at: now,
    last_login_at: null
  });
  await recordRegisterIp(ip);
  await writeAuthLog({
    username,
    ip,
    userAgent: ua,
    action: "register",
    success: true,
    message: "registered"
  });

  return res.status(201).json({ message: "registered" });
});

router.post("/login", async (req, res) => {
  const parsed = userAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }

  const { username, password, turnstileToken } = parsed.data;
  const ip = clientIp(req.ip);
  const ua = userAgent(req.get("user-agent"));
  const locked = await isLoginLocked(username, ip);
  if (locked) {
    await writeAuthLog({
      username,
      ip,
      userAgent: ua,
      action: "user_login",
      success: false,
      message: "login locked by rate limit"
    });
    return res.status(429).json({ message: "Too many failed logins, try later" });
  }

  const turnstile = await verifyTurnstile("user_login", turnstileToken);
  if (!turnstile.ok) {
    await writeAuthLog({
      username,
      ip,
      userAgent: ua,
      action: "user_login",
      success: false,
      message: turnstile.message || "turnstile failed"
    });
    return res.status(400).json({ message: turnstile.message });
  }

  const user = await usersCol().findOne({ username });
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !valid || user.status === "disabled") {
    await recordLoginFail(username, ip);
    await writeAuthLog({
      userId: user?._id ? String(user._id) : null,
      username,
      ip,
      userAgent: ua,
      action: "user_login",
      success: false,
      message: "invalid credentials or disabled"
    });
    return res.status(401).json({ message: "Invalid username or password" });
  }

  await clearLoginFail(username, ip);
  await usersCol().updateOne(
    { _id: user._id },
    { $set: { last_login_at: new Date(), updated_at: new Date() } }
  );

  req.session.userId = String(user._id);
  req.session.userType = "user";
  req.session.username = user.username;
  await writeAuthLog({
    userId: String(user._id),
    username: user.username,
    ip,
    userAgent: ua,
    action: "user_login",
    success: true,
    message: "ok"
  });
  return res.json({ message: "ok", status: user.status });
});

router.post("/change-password", requireUser, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  const { oldPassword, newPassword } = parsed.data;
  const ip = clientIp(req.ip);
  const ua = userAgent(req.get("user-agent"));

  const user = await usersCol().findOne({ _id: new ObjectId(req.session.userId) });
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const validOld = await bcrypt.compare(oldPassword, user.password_hash);
  if (!validOld) {
    await writeAuthLog({
      userId: String(user._id),
      username: user.username,
      ip,
      userAgent: ua,
      action: "user_change_password",
      success: false,
      message: "old password incorrect"
    });
    return res.status(400).json({ message: "Old password incorrect" });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await usersCol().updateOne(
    { _id: user._id },
    { $set: { password_hash: newHash, updated_at: new Date() } }
  );
  await writeAuthLog({
    userId: String(user._id),
    username: user.username,
    ip,
    userAgent: ua,
    action: "user_change_password",
    success: true,
    message: "password updated"
  });
  req.session.destroy(() => undefined);
  return res.json({ message: "password updated, please login again" });
});

router.post("/admin/change-password", requireAdmin, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  const { oldPassword, newPassword } = parsed.data;
  const ip = clientIp(req.ip);
  const ua = userAgent(req.get("user-agent"));
  const admin = await adminsCol().findOne({ _id: new ObjectId(req.session.userId) });
  if (!admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const validOld = await bcrypt.compare(oldPassword, admin.password_hash);
  if (!validOld) {
    await writeAuthLog({
      userId: String(admin._id),
      username: admin.username,
      ip,
      userAgent: ua,
      action: "admin_change_password",
      success: false,
      message: "old password incorrect"
    });
    return res.status(400).json({ message: "Old password incorrect" });
  }
  const newHash = await bcrypt.hash(newPassword, 12);
  await adminsCol().updateOne(
    { _id: admin._id },
    { $set: { password_hash: newHash, updated_at: new Date() } }
  );
  await writeAuthLog({
    userId: String(admin._id),
    username: admin.username,
    ip,
    userAgent: ua,
    action: "admin_change_password",
    success: true,
    message: "password updated"
  });
  req.session.destroy(() => undefined);
  return res.json({ message: "password updated, please login again" });
});

router.post("/logout", async (req, res) => {
  const ip = clientIp(req.ip);
  const ua = userAgent(req.get("user-agent"));
  if (req.session.username) {
    await writeAuthLog({
      userId: req.session.userId,
      username: req.session.username,
      ip,
      userAgent: ua,
      action: "logout",
      success: true,
      message: "ok"
    });
  }
  req.session.destroy(() => undefined);
  res.json({ message: "ok" });
});

router.get("/me", requireAuth, async (req, res) => {
  if (req.session.userType === "admin") {
    return res.json({
      userType: "admin",
      username: req.session.username,
      dashboard: "/admin"
    });
  }

  const user = await usersCol().findOne({ _id: new ObjectId(req.session.userId) });
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.json({
    userType: "user",
    username: user.username,
    dashboard: "/dashboard",
    status: user.status,
    expire_at: user.expire_at,
    disable_after: user.disable_after,
    sub_token: user.sub_token
  });
});

const authLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  username: z.string().trim().min(1).max(64).optional(),
  action: z.string().trim().min(1).max(64).optional(),
  success: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      if (value === "true") {
        return true;
      }
      if (value === "false") {
        return false;
      }
      return undefined;
    })
});

router.get("/admin/auth-logs", requireAdmin, async (req, res) => {
  const parsed = authLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params" });
  }

  const { limit, username, action, success } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (username) {
    filter.username = username;
  }
  if (action) {
    filter.action = action;
  }
  if (success !== undefined) {
    filter.success = success;
  }

  const docs = await authLogsCol()
    .find(filter)
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();

  return res.json({
    items: docs.map((doc) => ({
      id: String(doc._id),
      username: doc.username,
      action: doc.action,
      success: doc.success,
      message: doc.message,
      ip: doc.ip,
      created_at: doc.created_at
    }))
  });
});

export default router;
