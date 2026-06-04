import { API_BASE } from "./api";

type AuthKind = "login" | "register";

function normalizeMessage(kind: AuthKind, status: number, message: string) {
  const text = String(message || "").trim();

  if (kind === "login") {
    if (status === 401) return "用户名或密码错误，或账号已禁用";
    if (status === 429) return "登录失败次数过多，请稍后再试";
    if (status === 400) {
      if (text === "Turnstile token required") return "请先完成验证码";
      if (text === "Turnstile verification failed") return "验证码已失效，请重新验证后再试";
      if (text === "Turnstile request error") return "验证码校验失败，请稍后重试";
      return text || "请输入正确的用户名和密码";
    }
    if (status === 403) return text || "账号已禁用或无权登录";
  }

  if (kind === "register") {
    if (status === 409) return "用户名已存在";
    if (status === 429) return "注册过于频繁，请稍后再试";
    if (status === 400) {
      if (text === "Turnstile token required") return "请先完成验证码";
      if (text === "Turnstile verification failed") return "验证码已失效，请重新验证后再试";
      if (text === "Turnstile request error") return "验证码校验失败，请稍后重试";
      return text || "请检查用户名和密码格式";
    }
    if (status === 403) return text || "注册功能已关闭";
  }

  return text || `HTTP ${status}`;
}

export async function postAuthJson<T = Record<string, unknown>>(
  kind: AuthKind,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: T; status: number } | { ok: false; message: string; status: number }> {
  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await resp.json().catch(() => ({} as Record<string, unknown>));
    const message = normalizeMessage(kind, resp.status, String((data as { message?: unknown }).message || ""));
    if (!resp.ok) {
      return { ok: false, message, status: resp.status };
    }
    return { ok: true, data: data as T, status: resp.status };
  } catch {
    return { ok: false, message: "网络异常，请稍后重试", status: 0 };
  }
}
