function normalizeBaseUrl(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}

export const API_BASE = normalizeBaseUrl(import.meta.env.VITE_APP_BASE_URL) || window.location.origin;

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.message || `HTTP ${resp.status}`);
  }
  return data as T;
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
