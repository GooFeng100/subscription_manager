import { env } from "../config/env.js";
import { getRuntimeSettings } from "../lib/runtime-settings.js";

export type TurnstileScene = "admin_login" | "user_login" | "register";

function sceneEnabled(scene: TurnstileScene, settings: Awaited<ReturnType<typeof getRuntimeSettings>>) {
  if (!settings.turnstile_enabled) {
    return false;
  }
  if (scene === "admin_login" || scene === "user_login") {
    return settings.login_turnstile_enabled;
  }
  if (scene === "register") {
    return settings.register_turnstile_enabled;
  }
  return false;
}

export async function verifyTurnstile(scene: TurnstileScene, token?: string) {
  const settings = await getRuntimeSettings();
  if (!sceneEnabled(scene, settings)) {
    return { ok: true as const, skipped: true as const };
  }
  if (!token) {
    return { ok: false as const, message: "Turnstile token required" };
  }
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false as const, message: "Turnstile secret key not configured" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
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
