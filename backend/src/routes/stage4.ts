import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";
import { subAccessLogsCol, usersCol } from "../lib/db.js";
import { syncUserLifecycle } from "../services/user-lifecycle.js";
import { formatShanghaiDate } from "../lib/shanghai-date.js";
import {
  buildSubscriptionInfoName,
  decorateRawSubscriptionContent,
  decorateShadowrocketSubscriptionContent,
  insertClashSubscriptionInfoGroup,
  NODE_LINE_RE
} from "../lib/subscription-display.js";
import {
  countNodeProtocols,
  createShortCacheKey,
  maskToken
} from "../lib/subscription-conversion.js";
import { getNodePoolText } from "../lib/node-pool.js";
import { getCurrentSubVersion } from "../services/subscription-version.js";

const router = Router();

const targetSchema = z.string().trim().min(1).max(32).optional();

function clientIp(ip?: string) {
  return ip || "unknown";
}

function isExpired(expireAt: Date | null, now: Date) {
  return Boolean(expireAt && expireAt.getTime() < now.getTime());
}

function applyEmojiPreservingParams(url: URL) {
  url.searchParams.set("emoji", "true");
  url.searchParams.set("add_emoji", "true");
  url.searchParams.set("remove_emoji", "false");
  url.searchParams.set("remove_old_emoji", "false");
}

function normalizeFilenamePart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .slice(0, 120);
}

function normalizeSubscriptionFilenameTemplate(template: string) {
  const value = String(template || "").trim();
  if (!value || value === "{{username}}" || value === "{{username}}_V{{version}}") {
    return "{{username}}_云域数字";
  }
  return value;
}

function buildSubscriptionFilename(
  template: string,
  params: { username: string; target: string; expire: string; version: string }
) {
  const username = String(params.username || "").trim();
  const normalizedTemplate = normalizeSubscriptionFilenameTemplate(template);
  const fallback = username ? `${username}_云域数字` : "云域数字";
  if (!username && normalizedTemplate === "{{username}}_云域数字") {
    return "云域数字";
  }
  const replaced = String(normalizedTemplate || fallback)
    .replace(/\{\{username\}\}/gi, username)
    .replace(/\{\{target\}\}/gi, params.target)
    .replace(/\{\{expire\}\}/gi, params.expire)
    .replace(/\{\{version\}\}/gi, params.version);
  return normalizeFilenamePart(replaced) || normalizeFilenamePart(fallback) || "subscription";
}

function buildEmptySubscriptionTitle(status: "expired" | "inactive" | "disabled") {
  if (status === "inactive") {
    return "账号未授权，请兑换授权码";
  }
  if (status === "disabled") {
    return "账号已禁用，请联系管理员";
  }
  return "订阅已过期，请联系管理员";
}

function buildEmptySubscriptionContent(target: string) {
  if (target === "clash" || target === "mihomo") {
    return [
      "port: 7890",
      "socks-port: 7891",
      "allow-lan: true",
      "mode: Rule",
      "log-level: info",
      "external-controller: 127.0.0.1:9090",
      "proxies: []",
      "proxy-groups: []",
      "rules: []"
    ].join("\n");
  }
  if (target === "sing-box" || target === "singbox") {
    return JSON.stringify({
      log: { level: "info" },
      inbounds: [],
      outbounds: [],
      route: { rules: [] }
    });
  }
  return "";
}

function buildShadowrocketSubscriptionContent(nodePoolText: string) {
  const lines = nodePoolText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => NODE_LINE_RE.test(line));

  if (!lines.length) {
    return "";
  }

  return Buffer.from(lines.join("\n"), "utf8").toString("base64");
}

function buildRawNodeSubscriptionContent(nodePoolText: string) {
  return nodePoolText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => NODE_LINE_RE.test(line))
    .join("\n");
}

function encodeBase64SubscriptionContent(text: string) {
  const normalized = String(text || "").trim();
  return normalized ? Buffer.from(normalized, "utf8").toString("base64") : "";
}

function normalizeConverterTarget(target: string) {
  switch (target) {
    case "mihomo":
      return "clash";
    case "sing-box":
      return "singbox";
    default:
      return target;
  }
}

function formatSubscriptionExpireDate(user: { expire_at: Date | null; disable_after: Date | null }) {
  return formatShanghaiDate(user.expire_at);
}

function buildSubscriptionUserInfo(user: { expire_at: Date | null; disable_after: Date | null }) {
  const source = user.expire_at;
  if (!source) return null;
  const expire = Math.floor(source.getTime() / 1000);
  return `expire=${expire}`;
}

type SubscriptionResponseFormat = {
  contentDisposition: "attachment" | "inline";
  extension: "yaml" | "txt" | "json";
  contentType: string;
};

function responseFormatForTarget(target: string): SubscriptionResponseFormat {
  switch (target) {
    case "ss":
      return { contentDisposition: "inline", extension: "txt", contentType: "text/plain; charset=utf-8" };
    case "shadowrocket":
      return { contentDisposition: "attachment", extension: "txt", contentType: "text/plain; charset=utf-8" };
    case "sing-box":
    case "singbox":
      return { contentDisposition: "attachment", extension: "json", contentType: "application/json; charset=utf-8" };
    case "clash":
    case "mihomo":
    default:
      return { contentDisposition: "attachment", extension: "yaml", contentType: "text/plain; charset=utf-8" };
  }
}

function buildContentDisposition(filename: string, format: SubscriptionResponseFormat) {
  const base = normalizeFilenamePart(filename) || "subscription";
  const asciiSafe = base.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, '\\"') || "subscription";
  const encoded = encodeURIComponent(base);
  return `${format.contentDisposition}; filename="${asciiSafe}.${format.extension}"; filename*=UTF-8''${encoded}.${format.extension}`;
}

function headerUtf8(value: string) {
  return Buffer.from(value, "utf8").toString("latin1");
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
    token: maskToken(params.token),
    target: params.target,
    ip: params.ip,
    status_code: params.statusCode,
    success: params.success,
    message: params.message,
    created_at: new Date()
  });
}

router.get("/api/internal/converter-source/:cacheKey", async (req, res) => {
  const secret = String(req.query.secret || "");
  if (!env.CONVERTER_SOURCE_SECRET || secret !== env.CONVERTER_SOURCE_SECRET) {
    return res.status(403).type("text/plain; charset=utf-8").send("forbidden");
  }

  const cacheKey = String(req.params.cacheKey || "");
  const text = await redis.get(`sm:sub:source:${cacheKey}`);
  if (!text) {
    return res.status(404).type("text/plain; charset=utf-8").send("source not found");
  }

  const format = String(req.query.format || "");
  const output = format === "base64" ? Buffer.from(text, "utf8").toString("base64") : text;
  return res.setHeader("Cache-Control", "no-store").type("text/plain; charset=utf-8").send(output);
});

router.get("/sub/:token", async (req, res) => {
  const token = req.params.token;
  const targetParsed = targetSchema.safeParse(req.query.target);
  const ip = clientIp(req.ip);
  const settings = await getRuntimeSettings();
  const target = targetParsed.success ? targetParsed.data || settings.converter_default_target || "clash" : settings.converter_default_target || "clash";
  const converterTarget = normalizeConverterTarget(target);
  const subVersion = await getCurrentSubVersion();
  const nodePoolText = await getNodePoolText();

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

  const syncedUser = await syncUserLifecycle(user);
  const responseHeaders = (
    response: import("express").Response,
    filename: string,
    userInfoHeader: string | null,
    responseTarget = target
  ) => {
    const format = responseFormatForTarget(responseTarget);
    response
      .setHeader("X-Subscription-Version", String(subVersion.version))
      .setHeader("Content-Disposition", buildContentDisposition(filename, format))
      .setHeader("profile-title", headerUtf8(filename))
      .setHeader("profile-update-interval", "24")
      .setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
      .setHeader("Pragma", "no-cache")
      .setHeader("Content-Type", format.contentType);
    if (userInfoHeader) {
      response.setHeader("Subscription-Userinfo", userInfoHeader);
    }
    return response;
  };
  const responseFilename = (responseTarget = target) => buildSubscriptionFilename(
    settings.subscription_filename_template || "{{username}}_云域数字",
    {
      username: syncedUser.username || "",
      target: responseTarget,
      expire: formatSubscriptionExpireDate(syncedUser),
      version: String(subVersion.version)
    }
  );
  const emptySubscriptionBody = (status: "expired" | "inactive" | "disabled") => {
    if (target === "shadowrocket" || target === "ss") {
      return "";
    }
    return buildEmptySubscriptionContent(target) || `# ${buildEmptySubscriptionTitle(status)}`;
  };

  if (syncedUser.status === "disabled") {
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: "account disabled, empty payload returned"
    });
    const userInfoHeader = buildSubscriptionUserInfo(syncedUser);
    const response = responseHeaders(
      res.status(200),
      responseFilename(),
      userInfoHeader
    );
    return response.send(emptySubscriptionBody("disabled"));
  }

  if (syncedUser.status === "inactive") {
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: "account inactive, empty payload returned"
    });
    const userInfoHeader = buildSubscriptionUserInfo(syncedUser);
    const response = responseHeaders(
      res.status(200),
      responseFilename(),
      userInfoHeader
    );
    return response.send(emptySubscriptionBody("inactive"));
  }

  if (isExpired(syncedUser.expire_at, now) && syncedUser.status === "expired") {
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: "subscription expired, empty payload returned"
    });
    const userInfoHeader = buildSubscriptionUserInfo(syncedUser);
    const response = responseHeaders(
      res.status(200),
      responseFilename(),
      userInfoHeader
    );
    return response.send(emptySubscriptionBody("expired"));
  }

  const rlKey = `sm:sub:rl:${token}:${ip}`;
  const current = await redis.incr(rlKey);
  if (current === 1) {
    await redis.expire(rlKey, 60);
  }
  if (current > settings.sub_rate_limit_per_minute) {
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 429,
      success: false,
      message: "rate limit exceeded"
    });
    return res.status(429).type("text/plain; charset=utf-8").send("too many subscription requests");
  }

  if (!nodePoolText) {
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 503,
      success: false,
      message: "node pool empty"
    });
    return res.status(503).type("text/plain; charset=utf-8").send("node pool is empty, please test upstreams first");
  }

  if (target === "shadowrocket") {
    const expireDate = formatSubscriptionExpireDate(syncedUser);
    const payload = decorateShadowrocketSubscriptionContent(
      buildShadowrocketSubscriptionContent(nodePoolText),
      `📌 V${subVersion.version}｜到期 ${expireDate}`
    );
    if (!payload) {
      await writeAccessLog({
        userId: String(syncedUser._id),
        username: syncedUser.username,
        token,
        target,
        ip,
        statusCode: 502,
        success: false,
        message: "shadowrocket payload empty"
      });
      return res.status(200).type("text/plain; charset=utf-8").send("");
    }

    const userInfoHeader = buildSubscriptionUserInfo(syncedUser);
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: `ok nodes=${countNodeProtocols(nodePoolText)} shadowrocket=direct`
    });
    return responseHeaders(
      res.status(200),
      buildSubscriptionFilename(
        settings.subscription_filename_template || "{{username}}_云域数字",
        {
          username: syncedUser.username,
          target,
          expire: expireDate,
          version: String(subVersion.version)
        }
      ),
      userInfoHeader
    ).send(payload);
  }

  if (target === "ss") {
    const expireDate = formatSubscriptionExpireDate(syncedUser);
    const rawPayload = decorateRawSubscriptionContent(
      buildRawNodeSubscriptionContent(nodePoolText),
      `📌 V${subVersion.version}｜到期 ${expireDate}`
    );
    const payload = encodeBase64SubscriptionContent(rawPayload);
    if (!payload) {
      await writeAccessLog({
        userId: String(syncedUser._id),
        username: syncedUser.username,
        token,
        target,
        ip,
        statusCode: 200,
        success: true,
        message: "raw node payload empty"
      });
      return res.status(200).type("text/plain; charset=utf-8").send("");
    }

    const userInfoHeader = buildSubscriptionUserInfo(syncedUser);
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: `ok nodes=${countNodeProtocols(nodePoolText)} ss=raw`
    });
    return responseHeaders(
      res.status(200),
      responseFilename(),
      userInfoHeader
    ).send(payload);
  }

  const sourceCacheKey = createShortCacheKey();
  const sourceCacheTtl = 300;
  await redis.set(`sm:sub:source:${sourceCacheKey}`, nodePoolText, "EX", sourceCacheTtl);

  const internalSourceUrl = new URL(`http://app:${env.PORT}/api/internal/converter-source/${sourceCacheKey}`);
  internalSourceUrl.searchParams.set("secret", env.CONVERTER_SOURCE_SECRET || "");
  internalSourceUrl.searchParams.set("format", "base64");

  const converterUrl = new URL(settings.converter_backend_url || "http://subconverter:25500/sub");
  converterUrl.searchParams.set("target", converterTarget);
  converterUrl.searchParams.set("url", internalSourceUrl.toString());
  if (settings.converter_default_config_url) {
    converterUrl.searchParams.set("config", settings.converter_default_config_url);
  }
  const subscriptionFilename = buildSubscriptionFilename(
    settings.subscription_filename_template || "{{username}}_云域数字",
    {
      username: syncedUser.username,
      target,
      expire: formatSubscriptionExpireDate(syncedUser),
      version: String(subVersion.version)
    }
  );
  converterUrl.searchParams.set("filename", subscriptionFilename);
  applyEmojiPreservingParams(converterUrl);

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
        userId: String(syncedUser._id),
        username: syncedUser.username,
        token,
        target,
        ip,
        statusCode: 502,
        success: false,
        message: `converter failed HTTP ${resp.status}`
      });
      return res.status(502).type("text/plain; charset=utf-8").send("converter request failed");
    }
    if (!text.trim()) {
      await writeAccessLog({
        userId: String(syncedUser._id),
        username: syncedUser.username,
        token,
        target,
        ip,
        statusCode: 502,
        success: false,
        message: "converter returned empty payload"
      });
      return res.status(502).type("text/plain; charset=utf-8").send("converter returned empty payload");
    }
    const expireDate = formatSubscriptionExpireDate(syncedUser);
    const responseText = (target === "clash" || target === "mihomo")
      ? insertClashSubscriptionInfoGroup(
        text,
        buildSubscriptionInfoName({ version: String(subVersion.version), expireDate })
      )
      : text;
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
      token,
      target,
      ip,
      statusCode: 200,
      success: true,
      message: `ok nodes=${countNodeProtocols(nodePoolText)}`
    });
    const userInfoHeader = buildSubscriptionUserInfo(syncedUser);
    const response = res
      .status(200)
      .setHeader("X-Subscription-Version", String(subVersion.version))
      .setHeader("Content-Disposition", buildContentDisposition(subscriptionFilename, responseFormatForTarget(target)))
      .setHeader("profile-title", headerUtf8(subscriptionFilename))
      .setHeader("profile-update-interval", "24")
      .setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
      .setHeader("Pragma", "no-cache")
      .setHeader("Content-Type", responseFormatForTarget(target).contentType);
    if (userInfoHeader) {
      response.setHeader("Subscription-Userinfo", userInfoHeader);
    }
    return response.send(responseText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "converter request error";
    await writeAccessLog({
      userId: String(syncedUser._id),
      username: syncedUser.username,
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
