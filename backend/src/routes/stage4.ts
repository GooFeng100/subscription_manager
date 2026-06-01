import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";
import { subAccessLogsCol, upstreamsCol, usersCol } from "../lib/db.js";
import { getCurrentSubVersion } from "./stage6.js";

const router = Router();

const targetSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .default("clash");

function clientIp(ip?: string) {
  return ip || "unknown";
}

function isExpired(expireAt: Date | null, now: Date) {
  return Boolean(expireAt && expireAt.getTime() < now.getTime());
}

async function writeAccessLog(params: {
  userId: string | null;
  username: string | null;
  token: string;
  target: string;
  ip: string;
  statusCode: number;
  success: boolean;
  message: string;
}) {
  await subAccessLogsCol().insertOne({
    user_id: params.userId ? new ObjectId(params.userId) : null,
    username: params.username,
    token: params.token,
    target: params.target,
    ip: params.ip,
    status_code: params.statusCode,
    success: params.success,
    message: params.message,
    created_at: new Date()
  });
}

router.get("/sub/:token", async (req, res) => {
  const token = req.params.token;
  const targetParsed = targetSchema.safeParse(req.query.target);
  const target = targetParsed.success ? targetParsed.data : "clash";
  const ip = clientIp(req.ip);
  const subVersion = await getCurrentSubVersion();

  const now = new Date();
  const user = await usersCol().findOne({ sub_token: token });
  if (!user) {
    await writeAccessLog({
      userId: null,
      username: null,
      token,
      target,
      ip,
      statusCode: 404,
      success: false,
      message: "token not found"
    });
    return res.status(404).type("text/plain; charset=utf-8").send("subscription token not found");
  }

  if (user.status === "disabled") {
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 403,
      success: false,
      message: "user disabled"
    });
    return res.status(403).type("text/plain; charset=utf-8").send("account disabled");
  }

  if (user.status === "inactive") {
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 403,
      success: false,
      message: "user inactive"
    });
    return res.status(403).type("text/plain; charset=utf-8").send("account not activated");
  }

  if (isExpired(user.expire_at, now)) {
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 403,
      success: false,
      message: "subscription expired"
    });
    return res.status(403).type("text/plain; charset=utf-8").send("subscription expired");
  }

  const rlKey = `sm:sub:rl:${token}:${ip}`;
  const current = await redis.incr(rlKey);
  if (current === 1) {
    await redis.expire(rlKey, 60);
  }
  if (current > env.SUB_RATE_LIMIT_PER_MINUTE) {
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 429,
      success: false,
      message: "rate limit exceeded"
    });
    return res.status(429).type("text/plain; charset=utf-8").send("too many subscription requests");
  }

  const cacheKey = `sm:sub:cache:v${subVersion}:${token}:${target}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: "cache hit"
    });
    return res
      .status(200)
      .setHeader("X-Subscription-Version", String(subVersion))
      .type("text/plain; charset=utf-8")
      .send(cached);
  }

  const enabledUpstreams = await upstreamsCol().find({ enabled: true }).sort({ updated_at: -1 }).toArray();
  if (!enabledUpstreams.length) {
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 503,
      success: false,
      message: "no enabled upstream"
    });
    return res.status(503).type("text/plain; charset=utf-8").send("no enabled upstream");
  }

  if (!env.CONVERTER_BACKEND_URL) {
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 503,
      success: false,
      message: "converter backend not configured"
    });
    return res.status(503).type("text/plain; charset=utf-8").send("converter backend not configured");
  }

  const sourceUrls = enabledUpstreams.map((u) => u.source_url).join("|");
  const converterUrl = new URL("/sub", env.CONVERTER_BACKEND_URL);
  converterUrl.searchParams.set("target", target);
  converterUrl.searchParams.set("url", sourceUrls);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.SUB_CONVERTER_TIMEOUT_MS);
  try {
    const resp = await fetch(converterUrl.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "subscription-manager/1.0" }
    });
    const text = await resp.text();
    if (!resp.ok) {
      await writeAccessLog({
        userId: String(user._id),
        username: user.username,
        token,
        target,
        ip,
        statusCode: 502,
        success: false,
        message: `converter failed HTTP ${resp.status}`
      });
      return res.status(502).type("text/plain; charset=utf-8").send("converter request failed");
    }

    await redis.set(cacheKey, text, "EX", env.SUB_CACHE_SECONDS);
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: "ok"
    });
    return res
      .status(200)
      .setHeader("X-Subscription-Version", String(subVersion))
      .type("text/plain; charset=utf-8")
      .send(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : "converter request error";
    await writeAccessLog({
      userId: String(user._id),
      username: user.username,
      token,
      target,
      ip,
      statusCode: 502,
      success: false,
      message
    });
    return res.status(502).type("text/plain; charset=utf-8").send("converter request failed");
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
