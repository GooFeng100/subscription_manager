import { redis } from "./redis.js";

const NODE_POOL_OPERATION_LOCK_KEY = "sm:sub:upstream-batch-lock";
const NODE_POOL_OPERATION_LOCK_TTL_SECONDS = 60 * 30;

export async function acquireNodePoolOperationLock(prefix: string) {
  const token = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ok = await redis.call(
    "set",
    NODE_POOL_OPERATION_LOCK_KEY,
    token,
    "NX",
    "EX",
    String(NODE_POOL_OPERATION_LOCK_TTL_SECONDS)
  );
  return ok ? token : null;
}

export async function releaseNodePoolOperationLock(token: string) {
  const current = await redis.get(NODE_POOL_OPERATION_LOCK_KEY);
  if (current === token) {
    await redis.del(NODE_POOL_OPERATION_LOCK_KEY);
  }
}
