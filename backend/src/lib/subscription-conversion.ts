import crypto from "node:crypto";

export type SubscriptionContentType = "raw_nodes" | "base64_nodes" | "clash_yaml" | "invalid_or_html";
export type UpstreamSourceType = "auto" | "ss" | "trojan" | "vmess" | "vless" | "hysteria2" | "tuic" | "clash_yaml" | "base64";

const NODE_PROTOCOL_RE = /\b(?:trojan|vmess|vless|ss|ssr|hysteria2|tuic):\/\//gi;
const HTML_HINT_RE = /<(?:!doctype|html|head|body|title|meta|script|style|iframe|div|span)[\s>]/i;

function normalizeText(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

export function countNodeProtocols(text: string) {
  return (text.match(NODE_PROTOCOL_RE) || []).length;
}

export function hasNodeProtocols(text: string) {
  return countNodeProtocols(text) > 0;
}

export function isLikelyClashYaml(text: string) {
  return /\bproxies\s*:/i.test(text);
}

export function looksLikeHtml(text: string) {
  return HTML_HINT_RE.test(text) || /^\s*</.test(text);
}

function decodeBase64Loose(value: string) {
  const compact = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!compact) {
    return "";
  }
  const padded = compact + "=".repeat((4 - (compact.length % 4)) % 4);
  const candidates = [padded, compact];
  for (const candidate of candidates) {
    try {
      const decoded = Buffer.from(candidate, "base64").toString("utf8");
      if (decoded) {
        return decoded;
      }
    } catch {
      // try next candidate
    }
  }
  return "";
}

export function classifySubscriptionText(rawText: string): {
  type: SubscriptionContentType;
  normalizedText: string;
  nodeCount: number;
  message: string;
  decodedText?: string;
} {
  const normalizedText = normalizeText(rawText);
  if (!normalizedText || normalizedText.length < 8) {
    return { type: "invalid_or_html", normalizedText, nodeCount: 0, message: "内容为空或过短" };
  }

  if (isLikelyClashYaml(normalizedText)) {
    return {
      type: "clash_yaml",
      normalizedText,
      nodeCount: 0,
      message: "识别为 Clash YAML"
    };
  }

  if (looksLikeHtml(normalizedText)) {
    return {
      type: "invalid_or_html",
      normalizedText,
      nodeCount: 0,
      message: "疑似 HTML 或登录页"
    };
  }

  if (hasNodeProtocols(normalizedText)) {
    return {
      type: "raw_nodes",
      normalizedText,
      nodeCount: countNodeProtocols(normalizedText),
      message: "识别为原始节点"
    };
  }

  const decodedText = normalizeText(decodeBase64Loose(normalizedText));
  if (decodedText && hasNodeProtocols(decodedText)) {
    return {
      type: "base64_nodes",
      normalizedText,
      decodedText,
      nodeCount: countNodeProtocols(decodedText),
      message: "识别成功"
    };
  }

  if (decodedText && isLikelyClashYaml(decodedText)) {
    return {
      type: "clash_yaml",
      normalizedText,
      decodedText,
      nodeCount: 0,
      message: "识别为 Clash YAML"
    };
  }

  return {
    type: "invalid_or_html",
    normalizedText,
    nodeCount: 0,
    message: "未识别到有效节点"
  };
}

export function mergeSubscriptionText(items: Array<{ type: SubscriptionContentType; text: string }>) {
  const textParts: string[] = [];
  const unsupported: Array<Exclude<SubscriptionContentType, "raw_nodes" | "base64_nodes">> = [];

  for (const item of items) {
    if (item.type === "raw_nodes" || item.type === "base64_nodes") {
      const text = item.text.trim();
      if (text) {
        textParts.push(text);
      }
    } else if (item.type === "clash_yaml") {
      unsupported.push(item.type);
    }
  }

  return {
    text: textParts.join("\n"),
    unsupported
  };
}

export function maskValue(value: string, head = 6, tail = 4) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= head + tail) {
    return `${normalized.slice(0, Math.min(head, normalized.length))}****`;
  }
  return `${normalized.slice(0, head)}****${normalized.slice(-tail)}`;
}

export const maskToken = maskValue;

export function maskUrlForLog(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/[^/]+$/u, "***");
    const query = parsed.search ? "?***" : "";
    return `${parsed.protocol}//${parsed.host}${pathname}${query}`;
  } catch {
    return maskValue(url, 12, 8);
  }
}

export function maskTrojanUrl(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/^(trojan:\/\/)([^@]+)@/i, "$1***@");
}

export function createShortCacheKey() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export function resolveUpstreamFetchUserAgent(sourceType: string) {
  switch (sourceType) {
    case "clash_yaml":
      return "Clash";
    case "ss":
    case "trojan":
    case "vmess":
    case "vless":
    case "hysteria2":
    case "tuic":
    case "base64":
    case "auto":
    default:
      return "Shadowrocket";
  }
}
