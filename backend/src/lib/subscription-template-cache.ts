import { env } from "../config/env.js";
import { getRuntimeSettings } from "./runtime-settings.js";
import { redis } from "./redis.js";
import { createShortCacheKey } from "./subscription-conversion.js";
import { setCacheStepState, setUpstreamBatchState } from "./upstream-batch-state.js";
import { ensureNodePoolCache, getNodePoolCacheSnapshot, getNodePoolText, triggerNodePoolCacheRecovery, type NodePoolSnapshot } from "./node-pool.js";

const TEMPLATE_LOCK_TTL_SECONDS = 60;
const TEMPLATE_WAIT_MS = 250;
const TEMPLATE_WAIT_ATTEMPTS = 80;
export const DEFAULT_TEMPLATE_TARGETS = ["clash"] as const;
export const DEFAULT_TEMPLATE_TARGET_COUNT = DEFAULT_TEMPLATE_TARGETS.length;
const templateRecoveryTasks = new Map<string, Promise<string | null>>();

function logTemplateEvent(level: "log" | "warn" | "error", message: string, meta: Record<string, unknown> = {}) {
  const payload = { scope: "subscription-template", ...meta };
  const line = `[template] ${message} ${JSON.stringify(payload)}`;
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

function templateKey(version: string, target: string) {
  return `sm:sub:template:${version}:${normalizeTemplateTarget(target)}`;
}

function templateLockKey(version: string, target: string) {
  return `sm:sub:template-lock:${version}:${normalizeTemplateTarget(target)}`;
}

function normalizeTemplateTarget(target: string) {
  return target === "mihomo" ? "clash" : target;
}

function normalizeConverterTarget(target: string) {
  switch (target) {
    case "mihomo":
      return "clash";
    case "sing-box":
      return "singbox";
    default:
      return target;
  }
}

function applyEmojiPreservingParams(url: URL) {
  url.searchParams.set("emoji", "true");
  url.searchParams.set("add_emoji", "true");
  url.searchParams.set("remove_emoji", "false");
  url.searchParams.set("remove_old_emoji", "false");
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireTemplateLock(version: string, target: string) {
  const token = `template-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ok = await redis.call("set", templateLockKey(version, target), token, "NX", "EX", String(TEMPLATE_LOCK_TTL_SECONDS));
  return ok ? token : null;
}

async function releaseTemplateLock(version: string, target: string, token: string) {
  const current = await redis.get(templateLockKey(version, target));
  if (current === token) {
    await redis.del(templateLockKey(version, target));
  }
}

export async function clearSubscriptionTemplateCache(version?: string) {
  if (!version) return;
  const keys = await redis.keys(`sm:sub:template:${version}:*`);
  if (keys.length) {
    await redis.del(...keys);
  }
}

export async function getSubscriptionTemplate(version: string, target: string) {
  return redis.get(templateKey(version, target));
}

function recoveryTaskKey(version: string, target: string) {
  return `${version}:${normalizeTemplateTarget(target)}`;
}

async function convertTemplate(version: string, target: string, nodePoolText: string) {
  const settings = await getRuntimeSettings();
  const sourceCacheKey = createShortCacheKey();
  await redis.set(`sm:sub:source:${sourceCacheKey}`, nodePoolText, "EX", 300);

  const internalSourceUrl = new URL(`http://app:${env.PORT}/api/internal/converter-source/${sourceCacheKey}`);
  internalSourceUrl.searchParams.set("secret", env.CONVERTER_SOURCE_SECRET || "");
  internalSourceUrl.searchParams.set("format", "base64");

  const converterUrl = new URL(settings.converter_backend_url || "http://subconverter:25500/sub");
  converterUrl.searchParams.set("target", normalizeConverterTarget(target));
  converterUrl.searchParams.set("url", internalSourceUrl.toString());
  if (settings.converter_default_config_url) {
    converterUrl.searchParams.set("config", settings.converter_default_config_url);
  }
  converterUrl.searchParams.set("filename", `subscription_template_${version}_${normalizeTemplateTarget(target)}`);
  applyEmojiPreservingParams(converterUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.SUB_CONVERTER_TIMEOUT_MS);
  try {
    logTemplateEvent("log", "converter request started", { version, target: normalizeTemplateTarget(target) });
    const resp = await fetch(converterUrl.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "subscription-manager/1.0" }
    });
    const text = await resp.text();
    if (!resp.ok) {
      logTemplateEvent("error", "converter request failed", {
        version,
        target: normalizeTemplateTarget(target),
        status: resp.status
      });
      throw new Error(`converter failed HTTP ${resp.status}`);
    }
    if (!text.trim()) {
      logTemplateEvent("error", "converter returned empty payload", {
        version,
        target: normalizeTemplateTarget(target)
      });
      throw new Error("converter returned empty payload");
    }
    await redis.set(templateKey(version, target), text);
    logTemplateEvent("log", "template cached", { version, target: normalizeTemplateTarget(target), bytes: text.length });
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function warmSubscriptionTemplate(version: string, target: string, nodePoolText?: string) {
  const existing = await getSubscriptionTemplate(version, target);
  if (existing) return existing;

  const lockToken = await acquireTemplateLock(version, target);
  if (!lockToken) {
    logTemplateEvent("warn", "template lock busy, waiting for cache", { version, target: normalizeTemplateTarget(target) });
    for (let attempt = 0; attempt < TEMPLATE_WAIT_ATTEMPTS; attempt += 1) {
      await sleep(TEMPLATE_WAIT_MS);
      const warmed = await getSubscriptionTemplate(version, target);
      if (warmed) return warmed;
    }
    logTemplateEvent("error", "template warmup timed out waiting for cache", {
      version,
      target: normalizeTemplateTarget(target),
      waitMs: TEMPLATE_WAIT_MS * TEMPLATE_WAIT_ATTEMPTS
    });
    throw new Error("subscription template warmup timed out");
  }

  try {
    const afterLockExisting = await getSubscriptionTemplate(version, target);
    if (afterLockExisting) return afterLockExisting;
    const pool = nodePoolText || await getNodePoolText();
    if (!pool) {
      logTemplateEvent("error", "template warmup missing node pool", { version, target: normalizeTemplateTarget(target) });
      throw new Error("node pool is empty");
    }
    return await convertTemplate(version, target, pool);
  } finally {
    await releaseTemplateLock(version, target, lockToken);
  }
}

export async function warmDefaultSubscriptionTemplates(version: string, snapshot?: NodePoolSnapshot | null) {
  const nodePoolText = snapshot?.text || await getNodePoolText();
  await setCacheStepState("template", {
    status: "running",
    ready: false,
    total: DEFAULT_TEMPLATE_TARGETS.length,
    success: 0,
    nodeCount: snapshot?.nodeCount || 0,
    version,
    message: "template warmup running"
  });
  let success = 0;
  for (const target of DEFAULT_TEMPLATE_TARGETS) {
    await warmSubscriptionTemplate(version, target, nodePoolText);
    success += 1;
    await setCacheStepState("template", {
      status: "running",
      ready: false,
      total: DEFAULT_TEMPLATE_TARGETS.length,
      success,
      nodeCount: snapshot?.nodeCount || 0,
      version,
      message: `template warmup ${success}/${DEFAULT_TEMPLATE_TARGETS.length}`
    });
  }
  await setCacheStepState("template", {
    status: "ready",
    ready: true,
    total: DEFAULT_TEMPLATE_TARGETS.length,
    success,
    nodeCount: snapshot?.nodeCount || 0,
    version,
    message: "template cache ready"
  });
  await setUpstreamBatchState({ phase: "ready", ready: true, running: false, version });
}

export async function ensureSubscriptionTemplate(version: string, target: string) {
  const existing = await getSubscriptionTemplate(version, target);
  if (existing) return existing;

  const snapshot = await ensureNodePoolCache(version);
  if (!snapshot?.text) {
    await setCacheStepState("template", {
      status: "failed",
      ready: false,
      version,
      message: "node pool is not ready"
    });
    return null;
  }

  await setUpstreamBatchState({ phase: "warming_templates", running: false, ready: false, version });
  try {
    const warmed = await warmSubscriptionTemplate(version, target, snapshot.text);
    const defaultTargetsReady = await Promise.all(DEFAULT_TEMPLATE_TARGETS.map((item) => getSubscriptionTemplate(version, item)));
    if (defaultTargetsReady.every(Boolean)) {
      await setCacheStepState("template", {
        status: "ready",
        ready: true,
        total: DEFAULT_TEMPLATE_TARGET_COUNT,
        success: DEFAULT_TEMPLATE_TARGET_COUNT,
        nodeCount: snapshot.nodeCount,
        version,
        message: "template cache ready"
      });
      await setUpstreamBatchState({ phase: "ready", ready: true, version });
    }
    return warmed;
  } catch (error) {
    await setCacheStepState("template", {
      status: "failed",
      ready: false,
      version,
      message: error instanceof Error ? error.message : "template warmup failed"
    });
    await setUpstreamBatchState({ phase: "failed", ready: false, version, message: "template warmup failed" });
    return null;
  }
}

export async function hasReadySubscriptionTemplate(version: string, target: string) {
  const existing = await getSubscriptionTemplate(version, target);
  return Boolean(existing);
}

export function triggerSubscriptionTemplateRecovery(version: string, target: string) {
  const key = recoveryTaskKey(version, target);
  const existingTask = templateRecoveryTasks.get(key);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    await setUpstreamBatchState({
      phase: "warming_templates",
      running: false,
      ready: false,
      version,
      message: "subscription template recovery running"
    });
    await setCacheStepState("template", {
      status: "running",
      ready: false,
      total: DEFAULT_TEMPLATE_TARGET_COUNT,
      success: 0,
      version,
      message: "template recovery running"
    });

    let snapshot = await getNodePoolCacheSnapshot(version);
  if (!snapshot?.text) {
      logTemplateEvent("warn", "template recovery waiting for redis node pool", { version, target: normalizeTemplateTarget(target) });
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
      snapshot = await triggerNodePoolCacheRecovery(version);
      if (!snapshot?.text) {
        logTemplateEvent("error", "template recovery failed because redis node pool is not ready", {
          version,
          target: normalizeTemplateTarget(target)
        });
        await setCacheStepState("redisNodePool", {
          status: "failed",
          ready: false,
          version,
          message: "redis node pool is not ready"
        });
        await setCacheStepState("template", {
          status: "failed",
          ready: false,
          version,
          message: "template waiting for redis node pool"
        });
        await setUpstreamBatchState({
          phase: "failed",
          running: false,
          ready: false,
          version,
          message: "template recovery failed because redis node pool is not ready"
        });
        return null;
      }
      await setCacheStepState("redisNodePool", {
        status: "ready",
        ready: true,
        total: 0,
        success: 0,
        nodeCount: snapshot.nodeCount,
        version,
        message: "redis node pool ready"
      });
    }

    try {
      const warmed = await warmSubscriptionTemplate(version, target, snapshot.text);
      const defaultTargetsReady = await Promise.all(DEFAULT_TEMPLATE_TARGETS.map((item) => getSubscriptionTemplate(version, item)));
      const readyCount = defaultTargetsReady.filter(Boolean).length;
      const allReady = readyCount === DEFAULT_TEMPLATE_TARGET_COUNT;
      await setCacheStepState("template", {
        status: allReady ? "ready" : "running",
        ready: allReady,
        total: DEFAULT_TEMPLATE_TARGET_COUNT,
        success: readyCount,
        nodeCount: snapshot.nodeCount,
        version,
        message: allReady ? "template cache ready" : `template recovery ${readyCount}/${DEFAULT_TEMPLATE_TARGET_COUNT}`
      });
      await setUpstreamBatchState({
        phase: allReady ? "ready" : "warming_templates",
        running: false,
        ready: allReady,
        version,
        message: allReady ? "template cache ready" : "subscription template recovery running"
      });
      logTemplateEvent("log", "template recovery completed", {
        version,
        target: normalizeTemplateTarget(target),
        ready: allReady,
        success: readyCount,
        total: DEFAULT_TEMPLATE_TARGET_COUNT,
        nodeCount: snapshot.nodeCount
      });
      return warmed;
    } catch (error) {
      logTemplateEvent("error", "template recovery failed", {
        version,
        target: normalizeTemplateTarget(target),
        error: error instanceof Error ? error.message : "template recovery failed"
      });
      await setCacheStepState("template", {
        status: "failed",
        ready: false,
        version,
        message: error instanceof Error ? error.message : "template recovery failed"
      });
      await setUpstreamBatchState({
        phase: "failed",
        running: false,
        ready: false,
        version,
        message: "template recovery failed"
      });
      return null;
    }
  })().finally(() => {
    templateRecoveryTasks.delete(key);
  });

  templateRecoveryTasks.set(key, task);
  return task;
}

export async function recoverSubscriptionCaches(version: string) {
  logTemplateEvent("log", "cache recovery started", { version, phase: "hydrating_redis" });
  await setUpstreamBatchState({
    phase: "hydrating_redis",
    running: false,
    ready: false,
    version,
    message: "recovering redis node pool"
  });
  await setCacheStepState("redisNodePool", {
    status: "running",
    ready: false,
    version,
    message: "redis node pool recovery running"
  });
  const snapshot = await ensureNodePoolCache(version);
  if (!snapshot?.text) {
    logTemplateEvent("error", "redis node pool recovery failed because mongo snapshot missing", { version });
    await setCacheStepState("redisNodePool", {
      status: "failed",
      ready: false,
      version,
      message: "mongo node pool snapshot missing"
    });
    await setUpstreamBatchState({
      phase: "failed",
      ready: false,
      version,
      message: "node pool recovery failed"
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
    phase: "warming_templates",
    ready: false,
    version,
    message: "recovering subscription templates"
  });
  logTemplateEvent("log", "cache recovery warming templates", { version, nodeCount: snapshot.nodeCount });
  await warmDefaultSubscriptionTemplates(version, snapshot);
  return snapshot;
}
