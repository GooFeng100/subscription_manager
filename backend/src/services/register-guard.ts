import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";

function registerIpKey(ip: string) {
  return `register_ip:${ip}`;
}

export async function checkRegisterIpLimit(ip: string) {
  const key = registerIpKey(ip);
  const count = Number((await redis.get(key)) || "0");
  return count < env.REGISTER_IP_LIMIT;
}

export async function recordRegisterIp(ip: string) {
  const key = registerIpKey(ip);
  const ttl = env.REGISTER_IP_WINDOW_MINUTES * 60;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttl);
  }
}
