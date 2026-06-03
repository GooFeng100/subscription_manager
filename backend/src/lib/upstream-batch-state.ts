import { redis } from "./redis.js";

const UPSTREAM_BATCH_STATE_KEY = "sm:sub:upstream-batch-state";

export type UpstreamBatchState = {
  running: boolean;
  ready: boolean;
  total: number;
  success: number;
  failed: number;
  nodeCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  message: string | null;
};

const DEFAULT_STATE: UpstreamBatchState = {
  running: false,
  ready: true,
  total: 0,
  success: 0,
  failed: 0,
  nodeCount: 0,
  startedAt: null,
  finishedAt: null,
  updatedAt: new Date(0).toISOString(),
  message: null
};

function normalizeState(value: Partial<UpstreamBatchState> | null | undefined): UpstreamBatchState {
  if (!value) return { ...DEFAULT_STATE };
  return {
    running: !!value.running,
    ready: value.ready !== undefined ? !!value.ready : !value.running,
    total: Number(value.total || 0),
    success: Number(value.success || 0),
    failed: Number(value.failed || 0),
    nodeCount: Number(value.nodeCount || 0),
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

