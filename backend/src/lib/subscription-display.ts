export const SUBSCRIPTION_INFO_GROUP_PREFIX = "📌 订阅信息｜";
export const NODE_LINE_RE = /^(?:ss|trojan|vmess|vless|ssr|hysteria2|tuic|anytls):\/\//i;

export function buildSubscriptionInfoName(params: { version: string; expireDate: string; suffix?: string }) {
  const base = `${SUBSCRIPTION_INFO_GROUP_PREFIX}V${params.version}｜到期 ${params.expireDate}`;
  const suffix = String(params.suffix || "").trim();
  return suffix ? `${base}｜${suffix}` : base;
}

function countLeadingSpaces(line: string) {
  return line.match(/^\s*/u)?.[0].length ?? 0;
}

function isTopLevelYamlKey(line: string) {
  return /^[^\s#][^:]*:\s*/u.test(line);
}

function readYamlGroupName(line: string) {
  const match = /^\s*-\s*name:\s*(.*?)\s*$/u.exec(line);
  if (!match) return null;
  const raw = match[1].trim();
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function isSubscriptionInfoGroupStart(line: string) {
  return (readYamlGroupName(line) || "").startsWith(SUBSCRIPTION_INFO_GROUP_PREFIX);
}

function buildClashInfoGroupLines(infoName: string) {
  return [
    `  - name: ${infoName}`,
    "    type: select",
    "    proxies:",
    "      - DIRECT"
  ];
}

export function insertClashSubscriptionInfoGroup(yamlText: string, infoName: string) {
  const hasTrailingNewline = yamlText.endsWith("\n");
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  if (hasTrailingNewline) {
    lines.pop();
  }

  const proxyGroupsIndex = lines.findIndex((line) => /^proxy-groups\s*:\s*(?:\[\s*\])?\s*(?:#.*)?$/u.test(line));
  if (proxyGroupsIndex < 0) {
    return yamlText;
  }

  const output = lines.slice(0, proxyGroupsIndex);
  output.push("proxy-groups:");
  output.push(...buildClashInfoGroupLines(infoName));

  let index = proxyGroupsIndex + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (isTopLevelYamlKey(line)) {
      break;
    }

    if (isSubscriptionInfoGroupStart(line)) {
      const groupIndent = countLeadingSpaces(line);
      index += 1;
      while (index < lines.length) {
        const nextLine = lines[index];
        if (isTopLevelYamlKey(nextLine)) {
          break;
        }
        if (/^\s*-\s+/u.test(nextLine) && countLeadingSpaces(nextLine) <= groupIndent) {
          break;
        }
        index += 1;
      }
      continue;
    }

    output.push(line);
    index += 1;
  }

  output.push(...lines.slice(index));
  return `${output.join("\n")}${hasTrailingNewline ? "\n" : ""}`;
}

function decodeBase64Subscription(value: string) {
  try {
    const compact = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = compact + "=".repeat((4 - (compact.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function decodeFragment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatNodeFragment(value: string, encode: boolean) {
  return encode ? encodeURIComponent(value) : value;
}

function decorateNodeName(line: string, displayPrefix: string, encode: boolean) {
  const trimmed = line.trim();
  if (!NODE_LINE_RE.test(trimmed)) {
    return null;
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex >= 0) {
    const originalName = decodeFragment(trimmed.slice(hashIndex + 1)) || "节点";
    return `${trimmed.slice(0, hashIndex)}#${formatNodeFragment(`${displayPrefix}｜${originalName}`, encode)}`;
  }

  try {
    // Validate parseability before adding a fragment to formats that omit a node name.
    // Legacy vmess/ssr names are often embedded in protocol-specific payloads, not URL fragments.
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.replace(/:$/u, "").toLowerCase();
    if (protocol === "vmess" || protocol === "ssr") {
      return null;
    }
    return `${trimmed}#${formatNodeFragment(`${displayPrefix}｜节点`, encode)}`;
  } catch {
    return null;
  }
}

export function decorateRawSubscriptionContent(rawText: string, displayPrefix: string) {
  const lines = rawText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const decorated = decorateNodeName(lines[index], displayPrefix, true);
    if (decorated) {
      lines[index] = decorated;
      break;
    }
  }

  return lines.join("\n");
}

export function decorateShadowrocketSubscriptionContent(base64Payload: string, displayPrefix: string) {
  const decoded = decodeBase64Subscription(base64Payload);
  if (!decoded.trim()) {
    return base64Payload;
  }

  const lines = decoded.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const decorated = decorateNodeName(lines[index], displayPrefix, true);
    if (decorated) {
      lines[index] = decorated;
      return Buffer.from(lines.join("\n"), "utf8").toString("base64");
    }
  }

  return base64Payload;
}
