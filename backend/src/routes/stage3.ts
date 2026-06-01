import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdmin } from "../middleware/require-role.js";
import { upstreamsCol } from "../lib/db.js";

const router = Router();

const upstreamSchema = z.object({
  name: z.string().trim().min(1).max(64),
  provider: z.string().trim().min(1).max(64),
  sourceUrl: z.string().url()
});

const updateUpstreamSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  provider: z.string().trim().min(1).max(64).optional(),
  sourceUrl: z.string().url().optional()
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
  source_url: string;
  enabled: boolean;
  last_test_ok: boolean | null;
  last_test_status: number | null;
  last_test_error: string | null;
  last_test_at: Date | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    provider: doc.provider,
    enabled: doc.enabled,
    source_url_masked: maskUrl(doc.source_url),
    last_test_ok: doc.last_test_ok,
    last_test_status: doc.last_test_status,
    last_test_error: doc.last_test_error,
    last_test_at: doc.last_test_at,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  };
}

router.get("/admin/upstreams", requireAdmin, async (_req, res) => {
  const docs = await upstreamsCol().find({}).sort({ created_at: -1 }).toArray();
  return res.json({ items: docs.map((d) => upstreamView(d)) });
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
    source_url: parsed.data.sourceUrl,
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
  if (parsed.data.sourceUrl !== undefined) {
    update.source_url = parsed.data.sourceUrl;
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

  const now = new Date();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let ok = false;
  let status: number | null = null;
  let error: string | null = null;

  try {
    const resp = await fetch(doc.source_url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });
    status = resp.status;
    ok = resp.ok;
    if (!ok) {
      error = `HTTP ${resp.status}`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "request failed";
  } finally {
    clearTimeout(timeout);
  }

  await upstreamsCol().updateOne(
    { _id: id },
    {
      $set: {
        last_test_ok: ok,
        last_test_status: status,
        last_test_error: error,
        last_test_at: now,
        updated_at: now
      }
    }
  );

  if (!ok) {
    return res.status(400).json({
      message: "upstream test failed",
      status,
      error
    });
  }
  return res.json({
    message: "ok",
    status
  });
});

export default router;
