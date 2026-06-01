import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdmin } from "../middleware/require-role.js";
import { rotationLogsCol, systemStateCol, upstreamsCol, usersCol } from "../lib/db.js";

const router = Router();

const executeSchema = z.object({
  reason: z.string().trim().min(2).max(200),
  confirmText: z.string().trim()
});

const ROTATION_CONFIRM_TEXT = "ROTATE";
const SUB_VERSION_STATE_KEY = "subscription_version";

async function getCurrentSubVersion() {
  const state = await systemStateCol().findOne({ key: SUB_VERSION_STATE_KEY });
  if (!state) {
    const now = new Date();
    await systemStateCol().insertOne({
      key: SUB_VERSION_STATE_KEY,
      sub_version: 1,
      updated_at: now
    });
    return 1;
  }
  return state.sub_version;
}

router.get("/admin/rotation/status", requireAdmin, async (_req, res) => {
  const version = await getCurrentSubVersion();
  const activeUsers = await usersCol().countDocuments({ status: { $in: ["active", "grace"] } });
  const enabledUpstreams = await upstreamsCol().countDocuments({ enabled: true });
  return res.json({
    sub_version: version,
    active_user_count: activeUsers,
    enabled_upstream_count: enabledUpstreams,
    confirm_text: ROTATION_CONFIRM_TEXT
  });
});

router.get("/admin/rotation/logs", requireAdmin, async (_req, res) => {
  const logs = await rotationLogsCol().find({}).sort({ created_at: -1 }).limit(200).toArray();
  return res.json({
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

  const fromVersion = await getCurrentSubVersion();
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

  const toVersion = fromVersion + 1;
  await systemStateCol().updateOne(
    { key: SUB_VERSION_STATE_KEY },
    { $set: { sub_version: toVersion, updated_at: now } },
    { upsert: true }
  );
  await rotationLogsCol().insertOne({
    from_version: fromVersion,
    to_version: toVersion,
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
    to_version: toVersion,
    impacted_user_count: impactedUserCount
  });
});

export { getCurrentSubVersion };
export default router;
