import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { adminsCol, nodePoolEntriesCol, rotationLogsCol, upstreamsCol, usersCol, type NodePoolEntryDoc } from "../lib/db.js";
import { buildNodePoolEntries } from "../lib/node-pool-entry.js";
import { acquireNodePoolOperationLock, releaseNodePoolOperationLock } from "../lib/node-pool-operation-lock.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";
import { countNodeProtocols, maskUrlForLog } from "../lib/subscription-conversion.js";
import { getUpstreamBatchState, setCacheStepState, setUpstreamBatchState } from "../lib/upstream-batch-state.js";
import { DEFAULT_TEMPLATE_TARGET_COUNT } from "../lib/subscription-template-cache.js";
import { testUpstreamSource } from "../lib/upstream-testing.js";
import { publishNodePool } from "./node-pool-publisher.js";
import { getCurrentSubVersion } from "./subscription-version.js";

function logBatchEvent(level: "log" | "warn" | "error", message: string, meta: Record<string, unknown> = {}) {
  const payload = { scope: "upstream-batch", ...meta };
  const line = `[batch] ${message} ${JSON.stringify(payload)}`;
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
  const lockToken = await acquireNodePoolOperationLock("batch");
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

    await nodePoolEntriesCol().deleteMany({});
    const docs = await upstreamsCol().find({ enabled: true }).sort({ updated_at: -1 }).toArray();
    docsCount = docs.length;
    startedAt = new Date().toISOString();
    const runtimeSettings = await getRuntimeSettings();
    const fromVersion = await getCurrentSubVersion();
    logBatchEvent("log", "batch refresh started", { fromVersion: fromVersion.version, total: docsCount, trigger: options.trigger });
    await setUpstreamBatchState({
      running: true,
      ready: false,
      phase: "refreshing_upstreams",
      version: fromVersion.version,
      total: docsCount,
      success: 0,
      failed: 0,
      nodeCount: 0,
      mongoNodePool: {
        status: "running",
        ready: false,
        total: docsCount,
        success: 0,
        nodeCount: 0,
        version: fromVersion.version,
        updatedAt: new Date().toISOString(),
        message: "upstream refresh running"
      },
      redisNodePool: {
        status: "idle",
        ready: false,
        total: docsCount,
        success: 0,
        nodeCount: 0,
        version: fromVersion.version,
        updatedAt: new Date().toISOString(),
        message: "waiting for mongo node pool"
      },
      template: {
        status: "idle",
        ready: false,
        total: DEFAULT_TEMPLATE_TARGET_COUNT,
        success: 0,
        nodeCount: 0,
        version: fromVersion.version,
        updatedAt: new Date().toISOString(),
        message: "waiting for redis node pool"
      },
      startedAt,
      finishedAt: null,
      message: "batch test running"
    });

    let nextNodePoolText = "";
    const nextNodePoolEntries: NodePoolEntryDoc[] = [];

    for (const [upstreamOrder, doc] of docs.entries()) {
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
          nextNodePoolEntries.push(...buildNodePoolEntries({
            upstreamId: doc._id!,
            upstreamName: doc.name,
            upstreamOrder,
            nodeText: result.nodeText,
            createdAt: now
          }));
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

    if (nextNodePoolEntries.length) {
      await nodePoolEntriesCol().insertMany(nextNodePoolEntries);
    }
    const published = await publishNodePool(nextNodePoolText, {
      fromVersion,
      progress: {
        total: docsCount,
        success: successCount,
        failed: failedCount
      }
    });
    const toVersion = published.toVersion;

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
      phase: "ready",
      version: toVersion.version,
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
    logBatchEvent("log", "batch refresh completed", {
      fromVersion: fromVersion.version,
      toVersion: toVersion.version,
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount
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
    logBatchEvent("error", "batch refresh failed", {
      error: message,
      total: docsCount,
      success: successCount,
      failed: failedCount,
      nodeCount
    });
    await setCacheStepState("template", {
      status: "failed",
      ready: false,
      total: DEFAULT_TEMPLATE_TARGET_COUNT,
      success: 0,
      nodeCount,
      message
    });
    await setUpstreamBatchState({
      running: false,
      ready: false,
      phase: "failed",
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
    await releaseNodePoolOperationLock(lockToken);
  }
}
