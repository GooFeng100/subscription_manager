import crypto from "node:crypto";
import { systemStateCol } from "./db.js";
import { redis } from "./redis.js";
import { setCacheStepState, setUpstreamBatchState } from "./upstream-batch-state.js";

const NODE_POOL_KEY = "sm:sub:node-pool";
const NODE_POOL_META_KEY = "sm:sub:node-pool:meta";
const NODE_POOL_HYDRATE_LOCK_KEY = "sm:sub:node-pool:hydrate-lock";
const NODE_POOL_STATE_KEY = "node_pool";
const NODE_POOL_HYDRATE_LOCK_TTL_SECONDS = 60;
const NODE_POOL_HYDRATE_WAIT_MS = 250;
const NODE_POOL_HYDRATE_WAIT_ATTEMPTS = 80;
const nodePoolRecoveryTasks = new Map<string, Promise<NodePoolSnapshot | null>>();

function logNodePoolEvent(level: "log" | "warn" | "error", message: string, meta: Record<string, unknown> = {}) {
  const payload = { scope: "node-pool", ...meta };
  const line = `[node-pool] ${message} ${JSON.stringify(payload)}`;
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

export type NodePoolSnapshot = {
  version: string;
  text: string;
  nodeCount: number;
  nodeHash: string;
  updatedAt: string;
};

function normalizeNodeText(value: string) {
  return String(value || "").replace(/^\uFEFF/, "").trim();
}

function hashNodePoolText(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function countNodeLines(text: string) {
  return normalizeNodeText(text)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeNodeLabel(label: string) {
  const trimmed = String(label || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^(Traffic|Expire)\s*:/i.test(trimmed)) {
    return "";
  }

  const parts = trimmed
    .split(/\s*[|｜]\s*/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/\b(?:Traffic|Expire)\s*:\s*.*$/iu, "")
        .trim()
    )
    .filter(Boolean);

  return parts.join(" | ");
}

function sanitizeSubscriptionLine(line: string) {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^(Traffic|Expire)\s*:/i.test(trimmed)) {
    return "";
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex < 0) {
    return trimmed;
  }

  const head = trimmed.slice(0, hashIndex + 1);
  const fragmentRaw = trimmed.slice(hashIndex + 1);
  let fragment = fragmentRaw;
  try {
    fragment = decodeURIComponent(fragmentRaw);
  } catch {
    fragment = fragmentRaw;
  }

  const cleanedFragment = sanitizeNodeLabel(fragment);
  if (!cleanedFragment) {
    return head.slice(0, -1).trim();
  }

  return `${head}${cleanedFragment}`;
}

export function sanitizeNodePoolText(text: string) {
  const normalized = normalizeNodeText(text);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\r?\n/u)
    .map((line) => sanitizeSubscriptionLine(line))
    .filter(Boolean)
    .join("\n");
}

export async function clearNodePool() {
  await redis.del(NODE_POOL_KEY, NODE_POOL_META_KEY);
}

export async function getNodePoolText() {
  return normalizeNodeText((await redis.get(NODE_POOL_KEY)) || "");
}

export async function getNodePoolMeta(): Promise<Omit<NodePoolSnapshot, "text"> | null> {
  const raw = await redis.get(NODE_POOL_META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Omit<NodePoolSnapshot, "text">>;
    if (!parsed.version || !parsed.nodeHash) return null;
    return {
      version: String(parsed.version),
      nodeCount: Number(parsed.nodeCount || 0),
      nodeHash: String(parsed.nodeHash),
      updatedAt: String(parsed.updatedAt || new Date(0).toISOString())
    };
  } catch {
    return null;
  }
}

export async function getNodePoolCacheSnapshot(version: string): Promise<NodePoolSnapshot | null> {
  const [text, meta] = await Promise.all([getNodePoolText(), getNodePoolMeta()]);
  if (!text || !meta || meta.version !== version) {
    return null;
  }

  const nodeHash = hashNodePoolText(text);
  if (meta.nodeHash !== nodeHash) {
    return null;
  }

  return {
    version,
    text,
    nodeCount: meta.nodeCount,
    nodeHash,
    updatedAt: meta.updatedAt
  };
}

export async function setNodePoolText(text: string, version?: string) {
  const normalized = sanitizeNodePoolText(text);
  if (!normalized) {
    await clearNodePool();
    return;
  }
  await redis.set(NODE_POOL_KEY, normalized);
  if (version) {
    const meta: Omit<NodePoolSnapshot, "text"> = {
      version,
      nodeCount: countNodeLines(normalized),
      nodeHash: hashNodePoolText(normalized),
      updatedAt: new Date().toISOString()
    };
    await redis.set(NODE_POOL_META_KEY, JSON.stringify(meta));
  }
}

export async function appendNodePoolText(text: string) {
  const normalized = sanitizeNodePoolText(text);
  if (!normalized) {
    return;
  }
  const current = await getNodePoolText();
  const next = current ? `${current}\n${normalized}` : normalized;
  await redis.set(NODE_POOL_KEY, next);
}

export async function saveNodePoolSnapshot(version: string, text: string) {
  const normalized = sanitizeNodePoolText(text);
  const snapshot: NodePoolSnapshot = {
    version,
    text: normalized,
    nodeCount: countNodeLines(normalized),
    nodeHash: hashNodePoolText(normalized),
    updatedAt: new Date().toISOString()
  };
  await systemStateCol().updateOne(
    { key: NODE_POOL_STATE_KEY },
    {
      $set: {
        payload: {
          version: snapshot.version,
          text: snapshot.text,
          node_count: snapshot.nodeCount,
          node_hash: snapshot.nodeHash,
          updated_at: snapshot.updatedAt
        },
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  return snapshot;
}

export async function getNodePoolSnapshot(version?: string): Promise<NodePoolSnapshot | null> {
  const state = await systemStateCol().findOne({ key: NODE_POOL_STATE_KEY });
  if (!state) return null;
  const payload = state?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  const snapshotVersion = String(payload.version || "");
  if (!snapshotVersion || (version && snapshotVersion !== version)) return null;
  const text = sanitizeNodePoolText(String(payload.text || ""));
  const nodeHash = String(payload.node_hash || "");
  const computedHash = hashNodePoolText(text);
  if (nodeHash && nodeHash !== computedHash) return null;
  return {
    version: snapshotVersion,
    text,
    nodeCount: Number(payload.node_count || countNodeLines(text)),
    nodeHash: nodeHash || computedHash,
    updatedAt: String(payload.updated_at || state.updated_at?.toISOString() || new Date(0).toISOString())
  };
}

async function acquireHydrateLock() {
  const token = `hydrate-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ok = await redis.call("set", NODE_POOL_HYDRATE_LOCK_KEY, token, "NX", "EX", String(NODE_POOL_HYDRATE_LOCK_TTL_SECONDS));
  return ok ? token : null;
}

async function releaseHydrateLock(token: string) {
  const current = await redis.get(NODE_POOL_HYDRATE_LOCK_KEY);
  if (current === token) {
    await redis.del(NODE_POOL_HYDRATE_LOCK_KEY);
  }
}

export async function hydrateNodePoolFromMongo(version: string) {
  const lockToken = await acquireHydrateLock();
  if (!lockToken) {
    logNodePoolEvent("warn", "hydrate lock busy", { version });
    return null;
  }
  try {
    const snapshot = await getNodePoolSnapshot(version);
    if (!snapshot || !snapshot.text) {
      logNodePoolEvent("error", "mongo snapshot missing", { version });
      await clearNodePool();
      return null;
    }
    await setNodePoolText(snapshot.text, snapshot.version);
    return snapshot;
  } finally {
    await releaseHydrateLock(lockToken);
  }
}

export async function ensureNodePoolCache(version: string) {
  const cached = await getNodePoolCacheSnapshot(version);
  if (cached) return cached;
  const hydrated = await hydrateNodePoolFromMongo(version);
  if (hydrated) return hydrated;
  for (let attempt = 0; attempt < NODE_POOL_HYDRATE_WAIT_ATTEMPTS; attempt += 1) {
    await sleep(NODE_POOL_HYDRATE_WAIT_MS);
    const next = await getNodePoolCacheSnapshot(version);
    if (next) return next;
  }
  return null;
}

export function triggerNodePoolCacheRecovery(version: string) {
  const existing = nodePoolRecoveryTasks.get(version);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    logNodePoolEvent("log", "redis node pool recovery started", { version });
    await setUpstreamBatchState({
      phase: "hydrating_redis",
      running: false,
      ready: false,
      version,
      message: "redis node pool recovery running"
    });
    await setCacheStepState("redisNodePool", {
      status: "running",
      ready: false,
      version,
      message: "redis node pool recovery running"
    });

    const snapshot = await ensureNodePoolCache(version).catch(() => null);
    if (!snapshot?.text) {
      logNodePoolEvent("error", "redis node pool recovery failed", { version });
      await setCacheStepState("redisNodePool", {
        status: "failed",
        ready: false,
        version,
        message: "redis node pool recovery failed"
      });
      await setUpstreamBatchState({
        phase: "failed",
        running: false,
        ready: false,
        version,
        message: "redis node pool recovery failed"
      });
      return null;
    }

    await setCacheStepState("mongoNodePool", {
      status: "ready",
      ready: true,
      total: 0,
      success: 0,
      nodeCount: snapshot.nodeCount,
      version,
      message: "mongo node pool ready"
    });
    await setCacheStepState("redisNodePool", {
      status: "ready",
      ready: true,
      total: 0,
      success: 0,
      nodeCount: snapshot.nodeCount,
      version,
      message: "redis node pool ready"
    });
    await setUpstreamBatchState({
      phase: "ready",
      running: false,
      ready: true,
      version,
      nodeCount: snapshot.nodeCount,
      message: "redis node pool ready"
    });
    logNodePoolEvent("log", "redis node pool recovery completed", { version, nodeCount: snapshot.nodeCount });
    return snapshot;
  })()
    .finally(() => {
      nodePoolRecoveryTasks.delete(version);
    });

  nodePoolRecoveryTasks.set(version, task);
  return task;
}
