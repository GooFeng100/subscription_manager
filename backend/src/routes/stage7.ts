import { Router } from "express";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { z } from "zod";
import { requireAdmin } from "../middleware/require-role.js";
import { activationCodesCol, authLogsCol, subAccessLogsCol } from "../lib/db.js";
import { getRuntimeSettings, updateRuntimeSettings } from "../lib/runtime-settings.js";

const router = Router();
const require = createRequire(import.meta.url);
const { ProxyAgent } = require("undici") as { ProxyAgent: new (url: string) => { close?: () => Promise<void>; destroy?: () => void } };

const settingsUpdateSchema = z.object({
  registration_enabled: z.boolean().optional(),
  converter_backend_url: z.string().optional(),
  converter_default_target: z.string().optional(),
  converter_default_config_url: z.string().optional(),
  subscription_filename_template: z.string().optional(),
  upstream_poll_interval_minutes: z.number().int().nonnegative().optional(),
  upstream_fetch_proxy_url: z.string().optional(),
  sub_rate_limit_per_minute: z.number().int().positive().optional(),
  login_fail_limit: z.number().int().positive().optional(),
  login_lock_minutes: z.number().int().positive().optional(),
  register_ip_limit: z.number().int().positive().optional(),
  register_ip_window_minutes: z.number().int().positive().optional(),
  turnstile_enabled: z.boolean().optional(),
  login_turnstile_enabled: z.boolean().optional(),
  register_turnstile_enabled: z.boolean().optional(),
  site_domain: z.string().optional()
});

const authLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  username: z.string().trim().min(1).max(64).optional(),
  action: z.string().trim().min(1).max(64).optional(),
  success: z
    .string()
    .optional()
    .transform((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    })
});

const codeLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  status: z.enum(["used", "revoked"]).optional(),
  username: z.string().trim().min(1).max(64).optional(),
  code: z.string().trim().min(1).max(64).optional()
});

const subLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  username: z.string().trim().min(1).max(64).optional(),
  token: z.string().trim().min(1).max(128).optional(),
  success: z
    .string()
    .optional()
    .transform((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }),
  target: z.string().trim().min(1).max(32).optional()
});

router.get("/admin/settings", requireAdmin, async (_req, res) => {
  const settings = await getRuntimeSettings();
  return res.json(settings);
});

router.put("/admin/settings", requireAdmin, async (req, res) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid settings payload" });
  }
  const updated = await updateRuntimeSettings(parsed.data);
  return res.json({ message: "updated", settings: updated });
});

function maskProxyUrl(url: string) {
  try {
    const parsed = new URL(url);
    const auth = parsed.username || parsed.password ? "***@" : "";
    return `${parsed.protocol}//${auth}${parsed.host}`;
  } catch {
    return "***";
  }
}

const locationLabelMap: Record<string, string> = {
  "Hong Kong": "香港",
  Taiwan: "台湾",
  Japan: "日本",
  Singapore: "新加坡",
  "South Korea": "韩国",
  "North Korea": "朝鲜",
  "United States": "美国",
  Canada: "加拿大",
  Australia: "澳大利亚",
  "United Kingdom": "英国",
  Germany: "德国",
  France: "法国",
  Netherlands: "荷兰",
  Italy: "意大利",
  Spain: "西班牙",
  India: "印度",
  Vietnam: "越南",
  Thailand: "泰国",
  Turkey: "土耳其",
  Israel: "以色列",
  Malaysia: "马来西亚",
  Brazil: "巴西",
  Chile: "智利",
  Argentina: "阿根廷",
  SouthAfrica: "南非"
};

function normalizeLocationLabel(value: string | undefined | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return locationLabelMap[trimmed] || trimmed;
}

async function lookupExitIpLocation(exitIp: string, signal: AbortSignal) {
  if (!isIP(exitIp)) return null;
  try {
    const resp = await fetch(`http://ip-api.com/json/${encodeURIComponent(exitIp)}?fields=status,country,regionName,city,message`, {
      method: "GET",
      signal
    } as RequestInit);
    if (!resp.ok) return null;
    const data = await resp.json() as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
      message?: string;
    };
    if (data.status !== "success") return null;
    const country = normalizeLocationLabel(data.country);
    const region = normalizeLocationLabel(data.regionName);
    const city = normalizeLocationLabel(data.city);
    const location = [country, region, city]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    return location || null;
  } catch {
    return null;
  }
}

router.post("/admin/settings/test-upstream-proxy", requireAdmin, async (req, res) => {
  const proxyUrl = String(req.body?.proxyUrl || "").trim();
  const testUrl = String(req.body?.testUrl || "https://api.ipify.org").trim();
  const timeoutMs = Number(req.body?.timeoutMs || 10000);
  if (!proxyUrl) {
    return res.json({ ok: false, message: "请先填写上游拉取代理地址" });
  }
  if (!/^https?:\/\/.+/i.test(proxyUrl) && !/^socks5h?:\/\/.+/i.test(proxyUrl)) {
    return res.json({ ok: false, message: "请输入有效的 http/https/socks5 地址" });
  }

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number.isFinite(timeoutMs) ? timeoutMs : 10000));
  const dispatcher = new ProxyAgent(proxyUrl);
  try {
    const resp = await fetch(testUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      dispatcher: dispatcher as never
    } as RequestInit);
    const elapsedMs = Date.now() - startedAt;
    const exitIp = (await resp.text()).trim();
    const exitIpLocation = await lookupExitIpLocation(exitIp, controller.signal);
    if (!resp.ok) {
      return res.json({
        ok: false,
        proxyUrlMasked: maskProxyUrl(proxyUrl),
        testUrl,
        elapsedMs,
        errorType: "http_error",
        message: `代理测试返回 HTTP ${resp.status}`
      });
    }
    return res.json({
      ok: true,
      proxyUrlMasked: maskProxyUrl(proxyUrl),
      testUrl,
      httpStatus: resp.status,
      elapsedMs,
      exitIp,
      exitIpLocation,
      message: "代理连通性正常"
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = controller.signal.aborted
      ? "代理连接超时，请检查 NAS tinyproxy 是否启动、Tailscale 是否在线、端口是否允许 VPS 访问"
      : error instanceof Error
        ? error.message
        : "代理测试失败";
    return res.json({
      ok: false,
      proxyUrlMasked: maskProxyUrl(proxyUrl),
      testUrl,
      elapsedMs,
      errorType: controller.signal.aborted ? "timeout" : "request_failed",
      message
    });
  } finally {
    clearTimeout(timeout);
    if (dispatcher.close) {
      await dispatcher.close().catch(() => dispatcher.destroy?.());
    } else {
      dispatcher.destroy?.();
    }
  }
});

router.get("/admin/logs/auth", requireAdmin, async (req, res) => {
  const parsed = authLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params" });
  }
  const { limit, username, action, success } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (username) filter.username = username;
  if (action) filter.action = action;
  if (success !== undefined) filter.success = success;

  const docs = await authLogsCol().find(filter).sort({ created_at: -1 }).limit(limit).toArray();
  return res.json({
    items: docs.map((doc) => ({
      id: String(doc._id),
      username: doc.username,
      action: doc.action,
      success: doc.success,
      message: doc.message,
      ip: doc.ip,
      created_at: doc.created_at
    }))
  });
});

router.get("/admin/logs/code-usage", requireAdmin, async (req, res) => {
  const parsed = codeLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params" });
  }
  const { limit, status, username, code } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (username) filter.used_by_username = username;
  if (code) filter.code = code;
  if (!status) filter.status = { $in: ["used", "revoked"] };

  const docs = await activationCodesCol().find(filter).sort({ updated_at: -1 }).limit(limit).toArray();
  return res.json({
    items: docs.map((doc) => ({
      id: String(doc._id),
      code: doc.code,
      status: doc.status,
      used_by_username: doc.used_by_username,
      used_at: doc.used_at,
      revoked_at: doc.revoked_at,
      note: doc.note,
      duration_days: doc.duration_days,
      grace_days: doc.grace_days,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    }))
  });
});

router.get("/admin/logs/sub-access", requireAdmin, async (req, res) => {
  const parsed = subLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query params" });
  }
  const { limit, username, token, success, target } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (username) filter.username = username;
  if (token) filter.token = token;
  if (success !== undefined) filter.success = success;
  if (target) filter.target = target;

  const docs = await subAccessLogsCol().find(filter).sort({ created_at: -1 }).limit(limit).toArray();
  return res.json({
    items: docs.map((doc) => ({
      id: String(doc._id),
      username: doc.username,
      token: doc.token,
      target: doc.target,
      ip: doc.ip,
      status_code: doc.status_code,
      success: doc.success,
      message: doc.message,
      created_at: doc.created_at
    }))
  });
});

export default router;
