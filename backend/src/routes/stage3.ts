import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdmin } from "../middleware/require-role.js";
import { upstreamsCol } from "../lib/db.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";
import { maskUrlForLog } from "../lib/subscription-conversion.js";
import { testUpstreamSource } from "../lib/upstream-testing.js";
import { getUpstreamBatchState } from "../lib/upstream-batch-state.js";
import { runUpstreamBatchRefresh } from "../services/upstream-batch-runner.js";

const router = Router();

const upstreamSchema = z.object({
  name: z.string().trim().min(1).max(64),
  provider: z.string().trim().min(1).max(64),
  sourceType: z.enum(["auto", "ss", "trojan", "vmess", "vless", "hysteria2", "tuic", "clash_yaml", "base64"]).default("auto"),
  sourceUrl: z.string().url(),
  fetchViaProxy: z.boolean().default(false)
});

const updateUpstreamSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  provider: z.string().trim().min(1).max(64).optional(),
  sourceType: z.enum(["auto", "ss", "trojan", "vmess", "vless", "hysteria2", "tuic", "clash_yaml", "base64"]).optional(),
  sourceUrl: z.string().url().optional(),
  fetchViaProxy: z.boolean().optional()
});

function maskUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.host;
    return `${parsed.protocol}//${host}/***`;
  } catch {
    return "***";
  }
}

function upstreamView(doc: {
  _id?: ObjectId;
  name: string;
  provider: string;
  source_type: string;
  source_url: string;
  fetch_via_proxy?: boolean;
  enabled: boolean;
  last_test_ok: boolean | null;
  last_test_status: number | null;
  last_test_error: string | null;
  last_test_type?: string | null;
  last_test_node_count?: number | null;
  last_test_message?: string | null;
  last_test_via_proxy?: boolean | null;
  last_test_at: Date | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    provider: doc.provider,
    source_type: doc.source_type || "auto",
    fetch_via_proxy: !!doc.fetch_via_proxy,
    enabled: doc.enabled,
    source_url: doc.source_url,
    source_url_masked: maskUrl(doc.source_url),
    last_test_ok: doc.last_test_ok,
    last_test_status: doc.last_test_status,
    last_test_error: doc.last_test_error,
    last_test_type: doc.last_test_type || null,
    last_test_node_count: doc.last_test_node_count || null,
    last_test_message: doc.last_test_message || null,
    last_test_via_proxy: doc.last_test_via_proxy ?? null,
    last_test_at: doc.last_test_at,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
}

router.get("/admin/upstreams", requireAdmin, async (_req, res) => {
  const docs = await upstreamsCol().find({}).sort({ created_at: -1 }).toArray();
  const batchState = await getUpstreamBatchState();
  return res.json({
    items: docs.map((d) => upstreamView(d)),
    batch_test_running: batchState.running,
    batch_test_ready: batchState.ready,
    batch_test_total: batchState.total,
    batch_test_success: batchState.success,
    batch_test_failed: batchState.failed,
    batch_test_node_count: batchState.nodeCount,
    batch_test_updated_at: batchState.updatedAt,
    batch_test_message: batchState.message,
    cache_state: {
      phase: batchState.phase,
      version: batchState.version,
      mongo_node_pool: batchState.mongoNodePool,
      redis_node_pool: batchState.redisNodePool,
      template: batchState.template
    }
  });
});

router.post("/admin/upstreams", requireAdmin, async (req, res) => {
  const parsed = upstreamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  const now = new Date();
  const doc = {
    name: parsed.data.name,
    provider: parsed.data.provider,
    source_type: parsed.data.sourceType,
    source_url: parsed.data.sourceUrl,
    fetch_via_proxy: parsed.data.fetchViaProxy ?? false,
    enabled: true,
    last_test_ok: null,
    last_test_status: null,
    last_test_error: null,
    last_test_at: null,
    created_at: now,
    updated_at: now
  };
  try {
    const result = await upstreamsCol().insertOne(doc);
    return res.status(201).json({ item: upstreamView({ ...doc, _id: result.insertedId }) });
  } catch {
    return res.status(409).json({ message: "Upstream name already exists" });
  }
});

router.patch("/admin/upstreams/:id", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid upstream id" });
  }
  const parsed = updateUpstreamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request payload" });
  }
  const update: Record<string, unknown> = { updated_at: new Date() };
  if (parsed.data.name !== undefined) {
    update.name = parsed.data.name;
  }
  if (parsed.data.provider !== undefined) {
    update.provider = parsed.data.provider;
  }
  if (parsed.data.sourceType !== undefined) {
    update.source_type = parsed.data.sourceType;
  }
  if (parsed.data.sourceUrl !== undefined) {
    update.source_url = parsed.data.sourceUrl;
  }
  if (parsed.data.fetchViaProxy !== undefined) {
    update.fetch_via_proxy = parsed.data.fetchViaProxy;
  }
  try {
    const doc = await upstreamsCol().findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!doc) {
      return res.status(404).json({ message: "Upstream not found" });
    }
    return res.json({ item: upstreamView(doc) });
  } catch {
    return res.status(409).json({ message: "Upstream name already exists" });
  }
});

router.post("/admin/upstreams/:id/enable", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid upstream id" });
  }
  const doc = await upstreamsCol().findOneAndUpdate(
    { _id: new ObjectId(req.params.id) },
    { $set: { enabled: true, updated_at: new Date() } },
    { returnDocument: "after" }
  );
  if (!doc) {
    return res.status(404).json({ message: "Upstream not found" });
  }
  return res.json({ item: upstreamView(doc) });
});

router.post("/admin/upstreams/:id/disable", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid upstream id" });
  }
  const doc = await upstreamsCol().findOneAndUpdate(
    { _id: new ObjectId(req.params.id) },
    { $set: { enabled: false, updated_at: new Date() } },
    { returnDocument: "after" }
  );
  if (!doc) {
    return res.status(404).json({ message: "Upstream not found" });
  }
  return res.json({ item: upstreamView(doc) });
});

router.delete("/admin/upstreams/:id", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid upstream id" });
  }
  const result = await upstreamsCol().deleteOne({ _id: new ObjectId(req.params.id) });
  if (!result.deletedCount) {
    return res.status(404).json({ message: "Upstream not found" });
  }
  return res.json({ message: "deleted" });
});

router.post("/admin/upstreams/:id/test", requireAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid upstream id" });
  }
  const id = new ObjectId(req.params.id);
  const doc = await upstreamsCol().findOne({ _id: id });
  if (!doc) {
    return res.status(404).json({ message: "Upstream not found" });
  }
  const runtimeSettings = await getRuntimeSettings();
  const now = new Date();
  const result = await testUpstreamSource({
    name: doc.name,
    provider: doc.provider,
    source_type: doc.source_type || "auto",
    source_url: doc.source_url,
    fetch_via_proxy: !!doc.fetch_via_proxy,
    upstream_fetch_proxy_url: runtimeSettings.upstream_fetch_proxy_url
  });
  const ok = result.ok;
  await upstreamsCol().updateOne(
    { _id: id },
    {
      $set: {
        last_test_ok: ok,
        last_test_status: result.status,
        last_test_error: result.error,
        last_test_type: result.type,
        last_test_node_count: result.nodeCount,
        last_test_message: result.message,
        last_test_via_proxy: result.usedProxy,
        last_test_at: now,
        updated_at: now
      }
    }
  );

  if (!ok) {
    return res.status(400).json({
      message: "upstream test failed",
      status: result.status,
      error: result.error,
      source_url_masked: maskUrlForLog(doc.source_url),
      type: result.type,
      nodeCount: result.nodeCount,
      fetchedAt: result.fetchedAt
    });
  }
  return res.json({
    message: "识别成功",
    status: result.status,
    type: result.type,
    nodeCount: result.nodeCount,
    usedProxy: result.usedProxy,
    fetchedAt: result.fetchedAt,
    source_url_masked: maskUrlForLog(doc.source_url)
  });
});

router.post("/admin/upstreams/test-all", requireAdmin, async (req, res) => {
  const currentBatchState = await getUpstreamBatchState();
  if (currentBatchState.running) {
    return res.status(409).json({ message: "batch test already running", state: currentBatchState });
  }
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.flushHeaders?.();
  const result = await runUpstreamBatchRefresh({
    trigger: "manual",
    reason: "manual upstream batch refresh",
    operatorUserId: req.session.userId ? new ObjectId(req.session.userId) : null,
    operatorUsername: req.session.username || "admin",
    onEvent: (event) => {
      res.write(`${JSON.stringify(event)}\n`);
    }
  });
  if (result.locked) {
    res.write(`${JSON.stringify({ kind: "summary", total: 0, success: 0, failed: 0, nodeCount: 0, ready: true, error: result.message })}\n`);
  }
  res.end();
});

export default router;
