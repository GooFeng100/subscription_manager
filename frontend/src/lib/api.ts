import { clearBootMeCache } from "./auth-cache";
import { redirectToLogin } from "./auth-navigation";

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}

const configuredApiBase = normalizeBaseUrl(import.meta.env.VITE_APP_BASE_URL);

export const API_BASE =
  import.meta.env.DEV && configuredApiBase ? configuredApiBase : window.location.origin;

function contentType(resp: Response) {
  return String(resp.headers.get("content-type") || "").toLowerCase();
}

function isHtmlResponse(resp: Response) {
  return contentType(resp).includes("text/html");
}

function refreshCurrentPage() {
  const current = `${window.location.pathname}${window.location.search}`;
  window.location.replace(current || "/");
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (resp.status === 401) {
    clearBootMeCache();
    redirectToLogin();
    return new Promise<T>(() => undefined);
  }
  if (resp.status === 403 && window.location.pathname.startsWith("/admin")) {
    clearBootMeCache();
    window.location.replace("/dashboard");
    return new Promise<T>(() => undefined);
  }
  if (isHtmlResponse(resp)) {
    refreshCurrentPage();
    return new Promise<T>(() => undefined);
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.message || `HTTP ${resp.status}`);
  }
  return data as T;
}

export function redirectOnUnauthorizedStatus(status: number) {
  if (status === 401) {
    clearBootMeCache();
    redirectToLogin();
    return true;
  }
  return false;
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function fmtDateOnly(value: string | null | undefined) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
