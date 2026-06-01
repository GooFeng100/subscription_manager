import { redis } from "../lib/redis.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";

function registerIpKey(ip: string) {
  return `register_ip:${ip}`;
}

export async function checkRegisterIpLimit(ip: string) {
  const settings = await getRuntimeSettings();
  const key = registerIpKey(ip);
  const count = Number((await redis.get(key)) || "0");
  return count < settings.register_ip_limit;
}

export async function recordRegisterIp(ip: string) {
  const settings = await getRuntimeSettings();
  const key = registerIpKey(ip);
  const ttl = settings.register_ip_window_minutes * 60;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttl);
  }
}
