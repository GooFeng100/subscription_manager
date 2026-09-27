import { ObjectId } from "mongodb";
import type { NodePoolEntryDoc } from "./db.js";

const SUPPORTED_PROTOCOLS = new Set([
  "ss",
  "ssr",
  "vmess",
  "vless",
  "trojan",
  "hysteria2",
  "tuic",
  "anytls"
]);

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeBase64Loose(value: string) {
  const compact = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (!compact) return "";
  const padded = compact + "=".repeat((4 - (compact.length % 4)) % 4);
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function readFragmentName(uri: string) {
  const hashIndex = uri.indexOf("#");
  if (hashIndex < 0) return "";
  return decodeURIComponentSafe(uri.slice(hashIndex + 1)).trim();
}

function readVmessName(uri: string) {
  const encoded = uri.replace(/^vmess:\/\//iu, "").split("#", 1)[0];
  const decoded = decodeBase64Loose(encoded);
  if (!decoded) return "";
  try {
    const payload = JSON.parse(decoded) as { ps?: unknown };
    return typeof payload.ps === "string" ? payload.ps.trim() : "";
  } catch {
    return "";
  }
}

function readSsrName(uri: string) {
  const encoded = uri.replace(/^ssr:\/\//iu, "").split("#", 1)[0];
  const decoded = decodeBase64Loose(encoded);
  if (!decoded) return "";
  const queryIndex = decoded.indexOf("/?");
  if (queryIndex < 0) return "";
  const params = new URLSearchParams(decoded.slice(queryIndex + 2));
  const remarks = params.get("remarks");
  return remarks ? decodeBase64Loose(decodeURIComponentSafe(remarks)).trim() : "";
}

export function extractNodePoolEntryMetadata(uri: string, nodeNumber: number) {
  const protocolMatch = /^([a-z][a-z0-9+.-]*):\/\//iu.exec(uri.trim());
  if (!protocolMatch) return null;
  const protocol = protocolMatch[1].toLowerCase();
  if (!SUPPORTED_PROTOCOLS.has(protocol)) return null;

  const fragmentName = readFragmentName(uri);
  const parsedName = fragmentName
    || (protocol === "vmess" ? readVmessName(uri) : "")
    || (protocol === "ssr" ? readSsrName(uri) : "");
  const nodeName = parsedName || `${protocol.toUpperCase()} 节点 ${nodeNumber}`;

  return { protocol, nodeName };
}

export function buildNodePoolEntries(input: {
  upstreamId: ObjectId;
  upstreamName: string;
  upstreamOrder: number;
  nodeText: string;
  createdAt: Date;
}): NodePoolEntryDoc[] {
  return input.nodeText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((uri, nodeOrder) => {
      const metadata = extractNodePoolEntryMetadata(uri, nodeOrder + 1);
      if (!metadata) return [];
      return [{
        upstream_id: input.upstreamId,
        upstream_name: input.upstreamName,
        node_name: metadata.nodeName,
        protocol: metadata.protocol,
        uri,
        selected: true,
        upstream_order: input.upstreamOrder,
        node_order: nodeOrder,
        created_at: input.createdAt
      }];
    });
}
