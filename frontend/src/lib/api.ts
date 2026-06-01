export const API_BASE = import.meta.env.VITE_APP_BASE_URL || "http://192.168.10.3:8084";

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
