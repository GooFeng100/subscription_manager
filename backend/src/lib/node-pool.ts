import { redis } from "./redis.js";

const NODE_POOL_KEY = "sm:sub:node-pool";

function normalizeNodeText(value: string) {
  return String(value || "").replace(/^\uFEFF/, "").trim();
}

function sanitizeNodeLabel(label: string) {
  const trimmed = String(label || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^(Traffic|Expire)\s*:/i.test(trimmed)) {
    return "";
  }

  const parts = trimmed
    .split(/\s*[|｜]\s*/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/\b(?:Traffic|Expire)\s*:\s*.*$/iu, "")
        .trim()
    )
    .filter(Boolean);

  return parts.join(" | ");
}

function sanitizeSubscriptionLine(line: string) {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^(Traffic|Expire)\s*:/i.test(trimmed)) {
    return "";
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex < 0) {
    return trimmed;
  }

  const head = trimmed.slice(0, hashIndex + 1);
  const fragmentRaw = trimmed.slice(hashIndex + 1);
  let fragment = fragmentRaw;
  try {
    fragment = decodeURIComponent(fragmentRaw);
  } catch {
    fragment = fragmentRaw;
  }

  const cleanedFragment = sanitizeNodeLabel(fragment);
  if (!cleanedFragment) {
    return head.slice(0, -1).trim();
  }

  return `${head}${cleanedFragment}`;
}

export function sanitizeNodePoolText(text: string) {
  const normalized = normalizeNodeText(text);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\r?\n/u)
    .map((line) => sanitizeSubscriptionLine(line))
    .filter(Boolean)
    .join("\n");
}

export async function clearNodePool() {
  await redis.del(NODE_POOL_KEY);
}

export async function getNodePoolText() {
  return normalizeNodeText((await redis.get(NODE_POOL_KEY)) || "");
}

export async function setNodePoolText(text: string) {
  const normalized = sanitizeNodePoolText(text);
  if (!normalized) {
    await clearNodePool();
    return;
  }
  await redis.set(NODE_POOL_KEY, normalized);
}

export async function appendNodePoolText(text: string) {
  const normalized = sanitizeNodePoolText(text);
  if (!normalized) {
    return;
  }
  const current = await getNodePoolText();
  const next = current ? `${current}\n${normalized}` : normalized;
  await redis.set(NODE_POOL_KEY, next);
}
