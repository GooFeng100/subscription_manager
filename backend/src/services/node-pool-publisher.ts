import { sanitizeNodePoolText, clearNodePool, hydrateNodePoolFromMongo, saveNodePoolSnapshot } from "../lib/node-pool.js";
import { getUpstreamBatchState, setCacheStepState, setUpstreamBatchState } from "../lib/upstream-batch-state.js";
import { clearSubscriptionTemplateCache, warmDefaultSubscriptionTemplates } from "../lib/subscription-template-cache.js";
import { bumpCurrentSubVersion, getCurrentSubVersion, type SubscriptionVersionState } from "./subscription-version.js";

export type PublishNodePoolProgress = {
  total: number;
  success: number;
  failed: number;
};

export type PublishNodePoolOptions = {
  fromVersion?: SubscriptionVersionState;
  progress?: PublishNodePoolProgress;
};

export async function publishNodePool(nodeText: string, options: PublishNodePoolOptions = {}) {
  const normalizedNodeText = sanitizeNodePoolText(nodeText);
  const fromVersion = options.fromVersion || await getCurrentSubVersion();
  const currentState = await getUpstreamBatchState();
  const progress = options.progress || {
    total: currentState.total,
    success: currentState.success,
    failed: currentState.failed
  };
  const toVersion = await bumpCurrentSubVersion(new Date());

  await setUpstreamBatchState({
    phase: "writing_mongo",
    version: toVersion.version,
    total: progress.total,
    success: progress.success,
    failed: progress.failed,
    message: "writing node pool to mongo"
  });
  const snapshot = await saveNodePoolSnapshot(toVersion.version, normalizedNodeText);
  await setUpstreamBatchState({ nodeCount: snapshot.nodeCount });
  await setCacheStepState("mongoNodePool", {
    status: "ready",
    ready: true,
    total: progress.total,
    success: progress.success,
    nodeCount: snapshot.nodeCount,
    version: toVersion.version,
    message: `mongo node pool ready (${progress.success}/${progress.total})`
  });

  await setUpstreamBatchState({
    phase: "hydrating_redis",
    ready: false,
    version: toVersion.version,
    message: "hydrating redis node pool"
  });
  await setCacheStepState("redisNodePool", {
    status: "running",
    ready: false,
    total: progress.total,
    success: 0,
    nodeCount: snapshot.nodeCount,
    version: toVersion.version,
    message: "redis node pool hydrating"
  });
  await clearNodePool();
  await clearSubscriptionTemplateCache(fromVersion.version);
  await clearSubscriptionTemplateCache(toVersion.version);
  const hydrated = await hydrateNodePoolFromMongo(toVersion.version);
  if (!hydrated) {
    throw new Error("redis node pool hydration failed");
  }
  await setCacheStepState("redisNodePool", {
    status: "ready",
    ready: true,
    total: progress.total,
    success: progress.success,
    nodeCount: hydrated.nodeCount,
    version: toVersion.version,
    message: `redis node pool ready (${progress.success}/${progress.total})`
  });

  await setUpstreamBatchState({
    phase: "warming_templates",
    ready: false,
    version: toVersion.version,
    message: "warming subscription templates"
  });
  await warmDefaultSubscriptionTemplates(toVersion.version, hydrated);

  return {
    fromVersion,
    toVersion,
    snapshot,
    hydrated
  };
}
