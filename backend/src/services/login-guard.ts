import { redis } from "../lib/redis.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";

function key(username: string, ip: string) {
  return `login_fail:${username}:${ip}`;
}

export async function isLoginLocked(username: string, ip: string) {
  const settings = await getRuntimeSettings();
  const count = await redis.get(key(username, ip));
  const value = Number(count || "0");
  return value >= settings.login_fail_limit;
}

export async function recordLoginFail(username: string, ip: string) {
  const settings = await getRuntimeSettings();
  const k = key(username, ip);
  const ttl = settings.login_lock_minutes * 60;
  const count = await redis.incr(k);
  if (count === 1) {
    await redis.expire(k, ttl);
  }
}

export async function clearLoginFail(username: string, ip: string) {
  await redis.del(key(username, ip));
}
