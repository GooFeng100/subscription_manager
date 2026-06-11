import { redis } from "./redis.js";

const UPSTREAM_BATCH_STATE_KEY = "sm:sub:upstream-batch-state";

export type CacheStepStatus = "idle" | "running" | "ready" | "failed";
export type CachePipelinePhase =
  | "idle"
  | "refreshing_upstreams"
  | "writing_mongo"
  | "hydrating_redis"
  | "warming_templates"
  | "ready"
  | "failed";

export type CacheStepState = {
  status: CacheStepStatus;
  ready: boolean;
  total: number;
  success: number;
  nodeCount: number;
  version: string | null;
  updatedAt: string;
  message: string | null;
};

export type UpstreamBatchState = {
  running: boolean;
  ready: boolean;
  phase: CachePipelinePhase;
  version: string | null;
  total: number;
  success: number;
  failed: number;
  nodeCount: number;
  mongoNodePool: CacheStepState;
  redisNodePool: CacheStepState;
  template: CacheStepState;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  message: string | null;
};

type CacheStepName = "mongoNodePool" | "redisNodePool" | "template";

const DEFAULT_STEP_STATE: CacheStepState = {
  status: "idle",
  ready: false,
  total: 0,
  success: 0,
  nodeCount: 0,
  version: null,
  updatedAt: new Date(0).toISOString(),
  message: null
};

const DEFAULT_STATE: UpstreamBatchState = {
  running: false,
  ready: true,
  phase: "idle",
  version: null,
  total: 0,
  success: 0,
  failed: 0,
  nodeCount: 0,
  mongoNodePool: { ...DEFAULT_STEP_STATE },
  redisNodePool: { ...DEFAULT_STEP_STATE },
  template: { ...DEFAULT_STEP_STATE },
  startedAt: null,
  finishedAt: null,
  updatedAt: new Date(0).toISOString(),
  message: null
};

function normalizeStep(value: Partial<CacheStepState> | null | undefined): CacheStepState {
  const status = value?.status || (value?.ready ? "ready" : "idle");
  return {
    status,
    ready: value?.ready !== undefined ? !!value.ready : status === "ready",
    total: Number(value?.total || 0),
    success: Number(value?.success || 0),
    nodeCount: Number(value?.nodeCount || 0),
    version: value?.version ? String(value.version) : null,
    updatedAt: value?.updatedAt || new Date().toISOString(),
    message: value?.message ?? null
  };
}

function normalizeState(value: Partial<UpstreamBatchState> | null | undefined): UpstreamBatchState {
  if (!value) return { ...DEFAULT_STATE };
  const mongoNodePool = normalizeStep(value.mongoNodePool);
  const redisNodePool = normalizeStep(value.redisNodePool);
  const template = normalizeStep(value.template);
  return {
    running: !!value.running,
    ready: value.ready !== undefined ? !!value.ready : !value.running,
    phase: value.phase || (value.running ? "refreshing_upstreams" : value.ready ? "ready" : "idle"),
    version: value.version ? String(value.version) : null,
    total: Number(value.total || 0),
    success: Number(value.success || 0),
    failed: Number(value.failed || 0),
    nodeCount: Number(value.nodeCount || 0),
    mongoNodePool,
    redisNodePool,
    template,
    startedAt: value.startedAt || null,
    finishedAt: value.finishedAt || null,
    updatedAt: value.updatedAt || new Date().toISOString(),
    message: value.message ?? null
  };
}

export async function getUpstreamBatchState(): Promise<UpstreamBatchState> {
  const raw = await redis.get(UPSTREAM_BATCH_STATE_KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    return normalizeState(JSON.parse(raw) as Partial<UpstreamBatchState>);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function setUpstreamBatchState(input: Partial<UpstreamBatchState>) {
  const next = normalizeState({ ...(await getUpstreamBatchState()), ...input, updatedAt: new Date().toISOString() });
  await redis.set(UPSTREAM_BATCH_STATE_KEY, JSON.stringify(next));
  return next;
}

export async function setCacheStepState(step: CacheStepName, input: Partial<CacheStepState>) {
  const current = await getUpstreamBatchState();
  const currentStep = current[step];
  const nextStep = normalizeStep({ ...currentStep, ...input, updatedAt: new Date().toISOString() });
  const next = normalizeState({ ...current, [step]: nextStep, updatedAt: new Date().toISOString() });
  await redis.set(UPSTREAM_BATCH_STATE_KEY, JSON.stringify(next));
  return next;
}
