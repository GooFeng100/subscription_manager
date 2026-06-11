import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdmin } from "../middleware/require-role.js";
import { rotationLogsCol, systemStateCol, upstreamsCol, usersCol } from "../lib/db.js";
import { recalculateAllUserLifecycle } from "../services/user-lifecycle.js";
import { bumpCurrentSubVersion, getCurrentSubVersion } from "../services/subscription-version.js";
import {
  buildCronDesc,
  computeNextRunAt,
  isScheduleExpired,
  normalizeRotationSchedule,
  type RotationScheduleRecord,
} from "../services/rotation-schedules.js";

const router = Router();

const executeSchema = z.object({
  reason: z.string().trim().min(2).max(200),
  confirmText: z.string().trim()
});
const scheduleCreateSchema = z.object({
  name: z.string().trim().min(1).max(64),
  mode: z.enum(["once", "monthly"]),
  once_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  day_of_month: z.coerce.number().int().min(1).max(31).optional().nullable(),
  hour: z.coerce.number().int().min(0).max(23),
  minute: z.coerce.number().int().min(0).max(59),
  note: z.string().trim().max(200).optional().nullable()
});
const rotationLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  reason: z.string().trim().min(1).max(200).optional(),
  result: z.enum(["success", "failed"]).optional()
});

const ROTATION_CONFIRM_TEXT = "ROTATE";
const ROTATION_SCHEDULES_KEY = "rotation_schedules";

function pageOffset(page: number, pageSize: number) {
  return (page - 1) * pageSize;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getRotationSchedules() {
  const state = await systemStateCol().findOne({ key: ROTATION_SCHEDULES_KEY });
  const payload = state?.payload as { items?: RotationScheduleRecord[] } | undefined;
  return Array.isArray(payload?.items) ? payload!.items : [];
}

async function saveRotationSchedules(items: RotationScheduleRecord[]) {
  await systemStateCol().updateOne(
    { key: ROTATION_SCHEDULES_KEY },
    { $set: { payload: { items }, updated_at: new Date() } },
    { upsert: true }
  );
}

async function refreshUserDisableAfterPolicy() {
  await recalculateAllUserLifecycle(new Date());
}

async function getNormalizedRotationSchedules(now = new Date()) {
  const items = await getRotationSchedules();
  const normalized = items.map((item) => normalizeRotationSchedule(item, now));
  const changed = normalized.some((item, idx) => {
    const raw = items[idx];
    return raw.enabled !== item.enabled || raw.next_run_at !== item.next_run_at;
  });
  if (changed) {
    const updatedAt = now.toISOString();
    await saveRotationSchedules(
      normalized.map((item) => ({
        id: item.id,
        name: item.name,
        mode: item.mode,
        once_date: item.once_date,
        day_of_month: item.day_of_month,
        hour: item.hour,
        minute: item.minute,
        cron_desc: item.cron_desc,
        next_run_at: item.next_run_at,
        enabled: item.enabled,
        note: item.note,
        created_at: item.created_at,
        updated_at: updatedAt
      }))
    );
  }
  return normalized;
}

router.get("/admin/rotation/status", requireAdmin, async (_req, res) => {
  const current = await getCurrentSubVersion();
  const activeUsers = await usersCol().countDocuments({ status: { $in: ["active", "grace"] } });
  const enabledUpstreams = await upstreamsCol().countDocuments({ enabled: true });
  return res.json({
    sub_version: current.version,
    active_user_count: activeUsers,
    enabled_upstream_count: enabledUpstreams,
    confirm_text: ROTATION_CONFIRM_TEXT
  });
});

router.get("/admin/rotation/logs", requireAdmin, async (req, res) => {
  const parsed = rotationLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params" });
  }
  const { page, pageSize, reason, result } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (reason) filter.reason = { $regex: escapeRegExp(reason), $options: "i" };
  if (result) filter.success = result === "success";

  const [total, logs] = await Promise.all([
    rotationLogsCol().countDocuments(filter),
    rotationLogsCol().find(filter).sort({ created_at: -1 }).skip(pageOffset(page, pageSize)).limit(pageSize).toArray()
  ]);
  return res.json({
    total,
    page,
    pageSize,
    items: logs.map((log) => ({
      id: String(log._id),
      from_version: log.from_version,
      to_version: log.to_version,
      reason: log.reason,
      operator_username: log.operator_username,
      impacted_user_count: log.impacted_user_count,
      success: log.success,
      message: log.message,
      created_at: log.created_at
    }))
  });
});

router.post("/admin/rotation/execute", requireAdmin, async (req, res) => {
  const parsed = executeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  if (parsed.data.confirmText !== ROTATION_CONFIRM_TEXT) {
    return res.status(400).json({ message: `confirmText must be ${ROTATION_CONFIRM_TEXT}` });
  }

  const current = await getCurrentSubVersion();
  const fromVersion = current.version;
  const impactedUserCount = await usersCol().countDocuments({ status: { $in: ["active", "grace"] } });
  const enabledUpstreams = await upstreamsCol().countDocuments({ enabled: true });
  const now = new Date();

  if (enabledUpstreams < 1) {
    await rotationLogsCol().insertOne({
      from_version: fromVersion,
      to_version: null,
      reason: parsed.data.reason,
      operator_user_id: new ObjectId(req.session.userId),
      operator_username: req.session.username || "admin",
      impacted_user_count: impactedUserCount,
      success: false,
      message: "no enabled upstream, rotation aborted",
      created_at: now
    });
    return res.status(400).json({ message: "no enabled upstream, rotation aborted" });
  }

  const toVersion = await bumpCurrentSubVersion(now);
  await rotationLogsCol().insertOne({
    from_version: fromVersion,
    to_version: toVersion.version,
    reason: parsed.data.reason,
    operator_user_id: new ObjectId(req.session.userId),
    operator_username: req.session.username || "admin",
    impacted_user_count: impactedUserCount,
    success: true,
    message: "rotation completed",
    created_at: now
  });
  return res.json({
    message: "rotation completed",
    from_version: fromVersion,
    to_version: toVersion.version,
    impacted_user_count: impactedUserCount
  });
});

router.get("/admin/rotation/schedules", requireAdmin, async (_req, res) => {
  const items = await getNormalizedRotationSchedules(new Date());
  return res.json({ items });
});

router.post("/admin/rotation/schedules", requireAdmin, async (req, res) => {
  const parsed = scheduleCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request payload" });
  if (parsed.data.mode === "once" && !parsed.data.once_date) {
    return res.status(400).json({ message: "once_date is required for once mode" });
  }
  if (parsed.data.mode === "monthly" && !parsed.data.day_of_month) {
    return res.status(400).json({ message: "day_of_month is required for monthly mode" });
  }
  const normalized = {
    mode: parsed.data.mode,
    once_date: parsed.data.mode === "once" ? parsed.data.once_date || null : null,
    day_of_month: parsed.data.mode === "monthly" ? parsed.data.day_of_month || 1 : null,
    hour: parsed.data.hour,
    minute: parsed.data.minute
  };
  const now = new Date().toISOString();
  const item: RotationScheduleRecord = {
    id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: parsed.data.name,
    mode: normalized.mode,
    once_date: normalized.once_date,
    day_of_month: normalized.day_of_month,
    hour: normalized.hour,
    minute: normalized.minute,
    cron_desc: buildCronDesc(normalized),
    next_run_at: computeNextRunAt(normalized, new Date()),
    enabled: parsed.data.mode === "once"
      ? !isScheduleExpired(
        {
          mode: "once",
          once_date: normalized.once_date,
          hour: normalized.hour,
          minute: normalized.minute
        },
        new Date()
      )
      : true,
    note: parsed.data.note || null,
    created_at: now,
    updated_at: now
  };
  const items = await getRotationSchedules();
  items.unshift(item);
  await saveRotationSchedules(items);
  await refreshUserDisableAfterPolicy();
  return res.status(201).json({ item: normalizeRotationSchedule(item, new Date()) });
});

router.post("/admin/rotation/schedules/:id/toggle", requireAdmin, async (req, res) => {
  const items = await getRotationSchedules();
  const idx = items.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: "Schedule not found" });
  const normalized = normalizeRotationSchedule(items[idx], new Date());
  if (normalized.locked) {
    return res.status(409).json({ message: "Schedule has expired and cannot be enabled" });
  }
  items[idx] = { ...items[idx], enabled: !items[idx].enabled, updated_at: new Date().toISOString() };
  await saveRotationSchedules(items);
  await refreshUserDisableAfterPolicy();
  return res.json({ item: normalizeRotationSchedule(items[idx], new Date()) });
});

router.delete("/admin/rotation/schedules/:id", requireAdmin, async (req, res) => {
  const items = await getRotationSchedules();
  const next = items.filter((x) => x.id !== req.params.id);
  if (next.length === items.length) return res.status(404).json({ message: "Schedule not found" });
  await saveRotationSchedules(next);
  await refreshUserDisableAfterPolicy();
  return res.json({ message: "deleted" });
});

export { getCurrentSubVersion };
export default router;
