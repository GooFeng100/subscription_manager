import { classifySubscriptionText, resolveUpstreamFetchUserAgent } from "./subscription-conversion.js";
import { sanitizeNodePoolText } from "./node-pool.js";

export type UpstreamSourceLike = {
  name: string;
  provider: string;
  source_type: string;
  source_url: string;
};

export type UpstreamTestResult = {
  ok: boolean;
  status: number | null;
  error: string | null;
  type: string | null;
  nodeCount: number | null;
  message: string | null;
  nodeText: string | null;
  fetchedAt: string;
};

export async function testUpstreamSource(source: UpstreamSourceLike): Promise<UpstreamTestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const fetchedAt = new Date().toISOString();

  try {
    const userAgent = resolveUpstreamFetchUserAgent(source.source_type || "auto");
    const resp = await fetch(source.source_url, {
      method: "GET",
      headers: {
        "User-Agent": userAgent
      },
      redirect: "follow",
      signal: controller.signal
    });
    const text = await resp.text();
    const classification = classifySubscriptionText(text);
    const ok = resp.ok && (classification.type === "raw_nodes" || classification.type === "base64_nodes" || classification.type === "clash_yaml");
    const nodeText =
      classification.type === "raw_nodes"
        ? sanitizeNodePoolText(classification.normalizedText)
        : classification.type === "base64_nodes"
          ? sanitizeNodePoolText(classification.decodedText || "")
          : null;
    return {
      ok,
      status: resp.status,
      error: ok ? null : resp.ok ? classification.message : `HTTP ${resp.status}`,
      type: classification.type,
      nodeCount: nodeText ? nodeText.split(/\r?\n/u).filter(Boolean).length : 0,
      message: classification.message,
      nodeText,
      fetchedAt
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "request failed",
      type: null,
      nodeCount: null,
      message: null,
      nodeText: null,
      fetchedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}
