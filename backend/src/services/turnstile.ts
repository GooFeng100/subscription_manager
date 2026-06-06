import { env } from "../config/env.js";
import { buildEffectiveTurnstileSettings, getRuntimeSettings } from "../lib/runtime-settings.js";

export type TurnstileScene = "admin_login" | "user_login" | "register";

const TURNSTILE_VERIFY_MESSAGE = "安全验证失败，请重新验证";

type TurnstileVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
  hostname?: string;
  action?: string;
  challenge_ts?: string;
};

function sceneEnabled(scene: TurnstileScene, settings: Awaited<ReturnType<typeof getRuntimeSettings>>) {
  const turnstile = buildEffectiveTurnstileSettings(settings);
  if (!turnstile.turnstileEnabled) {
    return false;
  }
  if (scene === "admin_login" || scene === "user_login") {
    return turnstile.turnstileLoginEnabled;
  }
  if (scene === "register") {
    return turnstile.turnstileRegisterEnabled;
  }
  return false;
}

export async function verifyTurnstile(scene: TurnstileScene, token?: string) {
  const settings = await getRuntimeSettings();
  if (!sceneEnabled(scene, settings)) {
    return { ok: true as const, skipped: true as const };
  }
  if (!token) {
    console.warn("turnstile verify failed", {
      success: false,
      errorCodes: ["missing-input-response"],
      hostname: undefined,
      action: scene,
      challengeTs: undefined,
      durationMs: 0
    });
    return { ok: false as const, error: "TURNSTILE_VERIFY_FAILED", message: TURNSTILE_VERIFY_MESSAGE };
  }
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("turnstile verify failed", {
      success: false,
      errorCodes: ["missing-input-secret"],
      hostname: undefined,
      action: scene,
      challengeTs: undefined,
      durationMs: 0
    });
    return { ok: false as const, error: "TURNSTILE_VERIFY_FAILED", message: TURNSTILE_VERIFY_MESSAGE };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  const startedAt = Date.now();

  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const durationMs = Date.now() - startedAt;
    const data = (await resp.json()) as TurnstileVerifyResponse;
    if (!data.success) {
      console.warn("turnstile verify failed", {
        success: Boolean(data.success),
        errorCodes: data["error-codes"] || [],
        hostname: data.hostname,
        action: data.action || scene,
        challengeTs: data.challenge_ts,
        durationMs
      });
      return { ok: false as const, error: "TURNSTILE_VERIFY_FAILED", message: TURNSTILE_VERIFY_MESSAGE };
    }
    return { ok: true as const, skipped: false as const };
  } catch {
    console.warn("turnstile verify failed", {
      success: false,
      errorCodes: ["request-error"],
      hostname: undefined,
      action: scene,
      challengeTs: undefined,
      durationMs: Date.now() - startedAt
    });
    return { ok: false as const, error: "TURNSTILE_VERIFY_FAILED", message: TURNSTILE_VERIFY_MESSAGE };
  }
}
