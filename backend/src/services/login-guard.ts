import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";

function key(username: string, ip: string) {
  return `login_fail:${username}:${ip}`;
}

export async function isLoginLocked(username: string, ip: string) {
  const count = await redis.get(key(username, ip));
  const value = Number(count || "0");
  return value >= env.LOGIN_FAIL_LIMIT;
}

export async function recordLoginFail(username: string, ip: string) {
  const k = key(username, ip);
  const ttl = env.LOGIN_LOCK_MINUTES * 60;
  const count = await redis.incr(k);
  if (count === 1) {
    await redis.expire(k, ttl);
  }
}

export async function clearLoginFail(username: string, ip: string) {
  await redis.del(key(username, ip));
}
