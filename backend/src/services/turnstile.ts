import { env } from "../config/env.js";
import { boolFromEnv } from "../lib/utils.js";

export type TurnstileScene = "admin_login" | "user_login" | "register" | "redeem";

function sceneEnabled(scene: TurnstileScene) {
  if (!boolFromEnv(env.TURNSTILE_ENABLED, false)) {
    return false;
  }
  if (scene === "admin_login" || scene === "user_login") {
    return boolFromEnv(env.LOGIN_TURNSTILE_ENABLED, true);
  }
  if (scene === "register") {
    return boolFromEnv(env.REGISTER_TURNSTILE_ENABLED, true);
  }
  return boolFromEnv(env.REDEEM_TURNSTILE_ENABLED, true);
}

export async function verifyTurnstile(scene: TurnstileScene, token?: string) {
  if (!sceneEnabled(scene)) {
    return { ok: true as const, skipped: true as const };
  }
  if (!token) {
    return { ok: false as const, message: "Turnstile token required" };
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    return { ok: false as const, message: "Turnstile secret key not configured" };
  }

  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);

  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = (await resp.json()) as { success?: boolean };
    if (!data.success) {
      return { ok: false as const, message: "Turnstile verification failed" };
    }
    return { ok: true as const, skipped: false as const };
  } catch {
    return { ok: false as const, message: "Turnstile request error" };
  }
}
