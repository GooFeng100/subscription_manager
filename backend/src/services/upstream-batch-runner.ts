import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { adminsCol, rotationLogsCol, upstreamsCol, usersCol } from "../lib/db.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";
import { redis } from "../lib/redis.js";
import { countNodeProtocols, maskUrlForLog, maskToken } from "../lib/subscription-conversion.js";
import { getUpstreamBatchState, setUpstreamBatchState } from "../lib/upstream-batch-state.js";
import { setNodePoolText } from "../lib/node-pool.js";
import { testUpstreamSource } from "../lib/upstream-testing.js";
import { bumpCurrentSubVersion, getCurrentSubVersion } from "./subscription-version.js";

const BATCH_LOCK_KEY = "sm:sub:upstream-batch-lock";
const BATCH_LOCK_TTL_SECONDS = 60 * 30;

export type UpstreamBatchTrigger = "manual" | "auto";

export type UpstreamBatchRunEvent =
  | {
      kind: "phase";
      id: string;
      name: string;
      provider: string;
      source_type: string;
      phase: "direct" | "proxy";
      source_url_masked: string;
    }
  | {
      kind: "result";
      id: string;
      name: string;
      provider: string;
      source_type: string;
      ok: boolean;
      status: number | null;
      error: string | null;
      type: string | null;
      nodeCount: number | null;
      message: string | null;
      source_url_masked: string;
      fetchedAt: string;
      last_test_ok: boolean;
      last_test_status: number | null;
      last_test_error: string | null;
      last_test_type: string | null;
      last_test_node_count: number | null;
      last_test_message: string | null;
      last_test_via_proxy: boolean;
      last_test_at: string;
    }
  | {
      kind: "summary";
      total: number;
      success: number;
      failed: number;
      nodeCount: number;
      ready: true;
      version: string | null;
      fromVersion: string | null;
      trigger: UpstreamBatchTrigger;
      locked: false;
    };

export type UpstreamBatchRunSummary = {
  locked: boolean;
  total: number;
  success: number;
  failed: number;
  nodeCount: number;
  version: string | null;
  fromVersion: string | null;
  ready: boolean;
  trigger: UpstreamBatchTrigger;
  message: string;
};

type RunOptions = {
  trigger: UpstreamBatchTrigger;
  reason: string;
  operatorUserId?: ObjectId | null;
  operatorUsername?: string | null;
  onEvent?: (event: UpstreamBatchRunEvent) => void;
};

async function acquireBatchLock() {
  const token = `batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ok = await (redis as any).set(BATCH_LOCK_KEY, token, "NX", "EX", BATCH_LOCK_TTL_SECONDS);
  return ok ? token : null;
}

async function releaseBatchLock(token: string) {
  const current = await redis.get(BATCH_LOCK_KEY);
  if (current === token) {
    await redis.del(BATCH_LOCK_KEY);
  }
}

async function resolveOperatorForAuto() {
  const admin = await adminsCol().findOne({ username: env.ADMIN_USERNAME });
  if (admin?._id) {
    return { operatorUserId: admin._id, operatorUsername: admin.username };
  }
  const anyAdmin = await adminsCol().findOne({});
  if (anyAdmin?._id) {
    return { operatorUserId: anyAdmin._id, operatorUsername: anyAdmin.username };
  }
  return { operatorUserId: new ObjectId("000000000000000000000000"), operatorUsername: "system" };
}

export async function runUpstreamBatchRefresh(options: RunOptions): Promise<UpstreamBatchRunSummary> {
  const lockToken = await acquireBatchLock();
  if (!lockToken) {
    return {
      locked: true,
      total: 0,
      success: 0,
      failed: 0,
      nodeCount: 0,
      version: null,
      fromVersion: null,
      ready: false,
      trigger: options.trigger,
      message: "batch test already running"
    };
  }

  let docsCount = 0;
  let successCount = 0;
  let nodeCount = 0;
  let failedCount = 0;
  let startedAt = new Date().toISOString();

  try {
    const state = await getUpstreamBatchState();
    if (state.running) {
      return {
        locked: true,
        total: state.total,
        success: state.success,
        failed: state.failed,
        nodeCount: state.nodeCount,
        version: null,
        fromVersion: null,
        ready: false,
        trigger: options.trigger,
        message: "batch test already running"
      };
    }

    const docs = await upstreamsCol().find({ enabled: true }).sort({ updated_at: -1 }).toArray();
    docsCount = docs.length;
    startedAt = new Date().toISOString();
    const runtimeSettings = await getRuntimeSettings();
    await setUpstreamBatchState({
      running: true,
      ready: false,
      total: docsCount,
      success: 0,
      failed: 0,
      nodeCount: 0,
      startedAt,
      finishedAt: null,
      message: "batch test running"
    });

    const fromVersion = await getCurrentSubVersion();
    let nextNodePoolText = "";

    for (const doc of docs) {
      const now = new Date();
      const result = await testUpstreamSource({
        name: doc.name,
        provider: doc.provider,
        source_type: doc.source_type || "auto",
        source_url: doc.source_url,
        fetch_via_proxy: !!doc.fetch_via_proxy,
        upstream_fetch_proxy_url: runtimeSettings.upstream_fetch_proxy_url,
        onPhase: (phase) => {
          options.onEvent?.({
            kind: "phase",
            id: String(doc._id),
            name: doc.name,
            provider: doc.provider,
            source_type: doc.source_type || "auto",
            phase,
            source_url_masked: maskUrlForLog(doc.source_url)
          });
        }
      });

      if (result.ok) {
        successCount += 1;
        if (result.nodeText) {
          nodeCount += result.nodeCount || countNodeProtocols(result.nodeText);
          nextNodePoolText = nextNodePoolText ? `${nextNodePoolText}\n${result.nodeText}` : result.nodeText;
        }
      } else {
        failedCount += 1;
      }

      await upstreamsCol().updateOne(
        { _id: doc._id },
        {
          $set: {
            last_test_ok: result.ok,
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

      options.onEvent?.({
        kind: "result",
        id: String(doc._id),
        name: doc.name,
        provider: doc.provider,
        source_type: doc.source_type || "auto",
        ok: result.ok,
        status: result.status,
        error: result.error,
        type: result.type,
        nodeCount: result.nodeCount,
        message: result.message,
        source_url_masked: maskUrlForLog(doc.source_url),
        fetchedAt: result.fetchedAt,
        last_test_ok: result.ok,
        last_test_status: result.status,
        last_test_error: result.error,
        last_test_type: result.type,
        last_test_node_count: result.nodeCount,
        last_test_message: result.message,
        last_test_via_proxy: result.usedProxy,
        last_test_at: now.toISOString()
      });
    }

    await setNodePoolText(nextNodePoolText);
    const toVersion = await bumpCurrentSubVersion(new Date());
    const operator = options.operatorUserId && options.operatorUsername
      ? { operatorUserId: options.operatorUserId, operatorUsername: options.operatorUsername }
      : options.trigger === "auto"
        ? await resolveOperatorForAuto()
        : { operatorUserId: new ObjectId("000000000000000000000000"), operatorUsername: "system" };
    const activeUserCount = await usersCol().countDocuments({ status: { $in: ["active", "grace"] } });
    await rotationLogsCol().insertOne({
      from_version: fromVersion.version,
      to_version: toVersion.version,
      reason: options.reason,
      operator_user_id: operator.operatorUserId,
      operator_username: operator.operatorUsername,
      impacted_user_count: activeUserCount,
      success: true,
      message: `${options.trigger} batch refresh completed`,
      created_at: new Date()
    });

    const finishedAt = new Date().toISOString();
    await setUpstreamBatchState({
      running: false,
      ready: true,
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount,
      startedAt,
      finishedAt,
      message: docsCount
        ? `batch test completed (${successCount}/${docsCount})`
        : "batch test completed (no enabled upstreams)"
    });

    const summary = {
      kind: "summary" as const,
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount,
      ready: true as const,
      version: toVersion.version,
      fromVersion: fromVersion.version,
      trigger: options.trigger,
      locked: false as const
    };
    options.onEvent?.(summary);

    return {
      locked: false,
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount,
      version: toVersion.version,
      fromVersion: fromVersion.version,
      ready: true,
      trigger: options.trigger,
      message: docsCount
        ? `batch test completed (${successCount}/${docsCount})`
        : "batch test completed (no enabled upstreams)"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "batch test aborted";
    await setUpstreamBatchState({
      running: false,
      ready: true,
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount,
      startedAt,
      finishedAt: new Date().toISOString(),
      message
    });
    options.onEvent?.({
      kind: "summary",
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount,
      ready: true,
      version: null,
      fromVersion: null,
      trigger: options.trigger,
      locked: false
    });
    return {
      locked: false,
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount,
      version: null,
      fromVersion: null,
      ready: true,
      trigger: options.trigger,
      message
    };
  } finally {
    await releaseBatchLock(lockToken);
  }
}
