import { createRequire } from "node:module";
import { classifySubscriptionText, resolveUpstreamFetchUserAgent } from "./subscription-conversion.js";
import { sanitizeNodePoolText } from "./node-pool.js";

const require = createRequire(import.meta.url);

type ProxyDispatcher = {
  close?: () => Promise<void>;
  destroy?: () => void;
};

const { ProxyAgent } = require("undici") as { ProxyAgent: new (url: string) => ProxyDispatcher };

export type UpstreamSourceLike = {
  name: string;
  provider: string;
  source_type: string;
  source_url: string;
  fetch_via_proxy?: boolean;
  upstream_fetch_proxy_url?: string | null;
  onPhase?: (phase: "direct" | "proxy") => void;
};

export type UpstreamTestResult = {
  ok: boolean;
  status: number | null;
  error: string | null;
  type: string | null;
  nodeCount: number | null;
  message: string | null;
  nodeText: string | null;
  usedProxy: boolean;
  fetchedAt: string;
};

type FetchAttemptResult = {
  status: number | null;
  text: string | null;
  error: string | null;
  fetchedAt: string;
};

function normalizeProxyUrl(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

async function fetchSubscriptionText(sourceUrl: string, userAgent: string, proxyUrl?: string | null): Promise<FetchAttemptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const fetchedAt = new Date().toISOString();
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : null;

  try {
    const requestInit: RequestInit & { dispatcher?: unknown } = {
      method: "GET",
      headers: {
        "User-Agent": userAgent
      },
      redirect: "follow",
      signal: controller.signal
    };

    if (dispatcher) {
      requestInit.dispatcher = dispatcher;
    }

    const resp = await fetch(sourceUrl, requestInit as RequestInit);
    return {
      status: resp.status,
      text: await resp.text(),
      error: null,
      fetchedAt
    };
  } catch (error) {
    return {
      status: null,
      text: null,
      error: error instanceof Error ? error.message : "request failed",
      fetchedAt
    };
  } finally {
    if (dispatcher) {
      if (dispatcher.close) {
        await dispatcher.close().catch(() => {
          dispatcher.destroy?.();
        });
      } else {
        dispatcher.destroy?.();
      }
    }
    clearTimeout(timeout);
  }
}

function buildTestResult(attempt: FetchAttemptResult, usedProxy = false): UpstreamTestResult {
  const classification = attempt.text ? classifySubscriptionText(attempt.text) : null;
  const ok =
    attempt.status !== null &&
    attempt.status >= 200 &&
    attempt.status < 300 &&
    classification !== null &&
    (classification.type === "raw_nodes" || classification.type === "base64_nodes" || classification.type === "clash_yaml");
  const nodeText =
    classification?.type === "raw_nodes"
      ? sanitizeNodePoolText(classification.normalizedText)
      : classification?.type === "base64_nodes"
        ? sanitizeNodePoolText(classification.decodedText || "")
        : null;

  return {
    ok,
    status: attempt.status,
    error: ok ? null : attempt.status !== null ? `HTTP ${attempt.status}` : attempt.error,
    type: classification?.type || null,
    nodeCount: nodeText ? nodeText.split(/\r?\n/u).filter(Boolean).length : 0,
    message: classification?.message || null,
    nodeText,
    usedProxy,
    fetchedAt: attempt.fetchedAt
  };
}

export async function testUpstreamSource(source: UpstreamSourceLike): Promise<UpstreamTestResult> {
  const userAgent = resolveUpstreamFetchUserAgent(source.source_type || "auto");
  const directAttempts = source.fetch_via_proxy ? 3 : 1;
  const proxyUrl = normalizeProxyUrl(source.upstream_fetch_proxy_url);
  let lastFailure: UpstreamTestResult | null = null;

  source.onPhase?.("direct");
  for (let i = 0; i < directAttempts; i += 1) {
    const directAttempt = await fetchSubscriptionText(source.source_url, userAgent);
    const directResult = buildTestResult(directAttempt);
    if (directResult.ok) {
      return directResult;
    }
    lastFailure = directResult;
  }

  if (source.fetch_via_proxy) {
    if (proxyUrl) {
      source.onPhase?.("proxy");
      const proxyAttempt = await fetchSubscriptionText(source.source_url, userAgent, proxyUrl);
      return buildTestResult(proxyAttempt, true);
    }
    return {
      ok: false,
      status: null,
      error: "该上游已开启代理回退，但系统设置中未配置上游拉取代理地址。",
      type: null,
      nodeCount: null,
      message: null,
      nodeText: null,
      usedProxy: false,
      fetchedAt: new Date().toISOString()
    };
  }

  return (
    lastFailure || {
      ok: false,
      status: null,
      error: "request failed",
      type: null,
      nodeCount: null,
      message: null,
      nodeText: null,
      usedProxy: false,
      fetchedAt: new Date().toISOString()
    }
  );
}
