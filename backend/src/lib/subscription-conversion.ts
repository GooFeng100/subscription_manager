import crypto from "node:crypto";
import { load as loadYaml } from "js-yaml";

export type SubscriptionContentType = "raw_nodes" | "base64_nodes" | "clash_yaml" | "invalid_or_html";
export type UpstreamSourceType = "auto" | "ss" | "trojan" | "vmess" | "vless" | "hysteria2" | "tuic" | "clash_yaml" | "base64";

const NODE_PROTOCOL_RE = /\b(?:trojan|vmess|vless|ss|ssr|hysteria2|tuic|anytls):\/\//gi;
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

type ClashProxy = Record<string, unknown>;

function stringValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function hostValue(value: unknown) {
  const host = stringValue(value).trim();
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function encoded(value: unknown) {
  return encodeURIComponent(stringValue(value));
}

function appendQuery(params: URLSearchParams, key: string, value: unknown) {
  const normalized = stringValue(value).trim();
  if (normalized) params.set(key, normalized);
}

function clashProxyToUri(proxy: ClashProxy) {
  const type = stringValue(proxy.type).toLowerCase();
  const server = hostValue(proxy.server);
  const port = Number(proxy.port);
  const name = encoded(proxy.name || `${type}-${server}`);
  if (!server || !Number.isInteger(port) || port <= 0 || port > 65535) return null;

  if (type === "ss") {
    const cipher = stringValue(proxy.cipher);
    const password = stringValue(proxy.password);
    if (!cipher || !password) return null;
    const credentials = Buffer.from(`${cipher}:${password}`, "utf8").toString("base64url");
    const query = new URLSearchParams();
    appendQuery(query, "plugin", proxy.plugin);
    appendQuery(query, "plugin-opts", proxy["plugin-opts"]);
    return `ss://${credentials}@${server}:${port}${query.size ? `?${query}` : ""}#${name}`;
  }

  if (type === "vmess") {
    const uuid = stringValue(proxy.uuid);
    if (!uuid) return null;
    const network = stringValue(proxy.network || "tcp");
    const wsOpts = (proxy["ws-opts"] || {}) as ClashProxy;
    const headers = (wsOpts.headers || {}) as ClashProxy;
    const h2Opts = (proxy["h2-opts"] || {}) as ClashProxy;
    const grpcOpts = (proxy["grpc-opts"] || {}) as ClashProxy;
    const payload = {
      v: "2",
      ps: stringValue(proxy.name),
      add: stringValue(proxy.server),
      port: String(port),
      id: uuid,
      aid: stringValue(proxy.alterId || 0),
      scy: stringValue(proxy.cipher || "auto"),
      net: network,
      type: "none",
      host: stringValue(headers.Host || headers.host || h2Opts.host),
      path: stringValue(wsOpts.path || h2Opts.path || grpcOpts["grpc-service-name"]),
      tls: proxy.tls ? "tls" : "",
      sni: stringValue(proxy.servername || proxy.sni),
      alpn: Array.isArray(proxy.alpn) ? proxy.alpn.join(",") : stringValue(proxy.alpn),
      fp: stringValue(proxy["client-fingerprint"])
    };
    return `vmess://${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
  }

  const password = type === "trojan" ? proxy.password : type === "vless" ? proxy.uuid : null;
  if ((type === "trojan" || type === "vless") && password) {
    const query = new URLSearchParams();
    if (type === "vless") appendQuery(query, "encryption", "none");
    appendQuery(query, "security", proxy.tls ? "tls" : proxy.security);
    appendQuery(query, "sni", proxy.servername || proxy.sni);
    appendQuery(query, "type", proxy.network);
    const wsOpts = (proxy["ws-opts"] || {}) as ClashProxy;
    const headers = (wsOpts.headers || {}) as ClashProxy;
    appendQuery(query, "host", headers.Host || headers.host);
    appendQuery(query, "path", wsOpts.path);
    appendQuery(query, "flow", proxy.flow);
    if (proxy["skip-cert-verify"] !== undefined) query.set("allowInsecure", proxy["skip-cert-verify"] ? "1" : "0");
    return `${type}://${encoded(password)}@${server}:${port}${query.size ? `?${query}` : ""}#${name}`;
  }

  if (type === "hysteria2" || type === "hy2") {
    const password = proxy.password || proxy.auth;
    if (!password) return null;
    const query = new URLSearchParams();
    appendQuery(query, "sni", proxy.sni || proxy.servername);
    appendQuery(query, "obfs", proxy.obfs);
    appendQuery(query, "obfs-password", proxy["obfs-password"]);
    if (proxy["skip-cert-verify"] !== undefined) query.set("insecure", proxy["skip-cert-verify"] ? "1" : "0");
    return `hysteria2://${encoded(password)}@${server}:${port}${query.size ? `?${query}` : ""}#${name}`;
  }

  if (type === "anytls") {
    if (!proxy.password) return null;
    const query = new URLSearchParams();
    appendQuery(query, "security", "tls");
    appendQuery(query, "sni", proxy.sni || proxy.servername);
    if (proxy["skip-cert-verify"] !== undefined) query.set("insecure", proxy["skip-cert-verify"] ? "1" : "0");
    return `anytls://${encoded(proxy.password)}@${server}:${port}${query.size ? `?${query}` : ""}#${name}`;
  }

  if (type === "tuic") {
    if (!proxy.uuid || !proxy.password) return null;
    const query = new URLSearchParams();
    appendQuery(query, "congestion_control", proxy["congestion-controller"]);
    appendQuery(query, "udp_relay_mode", proxy["udp-relay-mode"]);
    appendQuery(query, "sni", proxy.sni || proxy.servername);
    if (Array.isArray(proxy.alpn)) query.set("alpn", proxy.alpn.join(","));
    if (proxy["skip-cert-verify"] !== undefined) query.set("allow_insecure", proxy["skip-cert-verify"] ? "1" : "0");
    return `tuic://${encoded(proxy.uuid)}:${encoded(proxy.password)}@${server}:${port}${query.size ? `?${query}` : ""}#${name}`;
  }

  return null;
}

export function convertClashYamlToNodeText(text: string) {
  try {
    const document = loadYaml(text) as { proxies?: unknown } | null;
    const proxies = Array.isArray(document?.proxies) ? document.proxies : [];
    const nodes = proxies
      .filter((proxy): proxy is ClashProxy => !!proxy && typeof proxy === "object" && !Array.isArray(proxy))
      .map((proxy) => clashProxyToUri(proxy))
      .filter((node): node is string => !!node);
    return { text: nodes.join("\n"), nodeCount: nodes.length, totalProxyCount: proxies.length };
  } catch {
    return { text: "", nodeCount: 0, totalProxyCount: 0 };
  }
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
    const converted = convertClashYamlToNodeText(normalizedText);
    return {
      type: "clash_yaml",
      normalizedText,
      decodedText: converted.text,
      nodeCount: converted.nodeCount,
      message: converted.nodeCount > 0
        ? `识别为 Clash YAML，已转换 ${converted.nodeCount}/${converted.totalProxyCount} 个节点`
        : "识别为 Clash YAML，但未找到可转换节点"
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
    const converted = convertClashYamlToNodeText(decodedText);
    return {
      type: "clash_yaml",
      normalizedText,
      decodedText: converted.text,
      nodeCount: converted.nodeCount,
      message: converted.nodeCount > 0
        ? `识别为 Base64 Clash YAML，已转换 ${converted.nodeCount}/${converted.totalProxyCount} 个节点`
        : "识别为 Base64 Clash YAML，但未找到可转换节点"
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
