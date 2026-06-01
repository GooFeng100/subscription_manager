import { z } from "zod";
import { env } from "../config/env.js";
import { boolFromEnv } from "./utils.js";
import { systemStateCol } from "./db.js";

const SETTINGS_KEY = "runtime_settings";

const runtimeSettingsSchema = z.object({
  registration_enabled: z.boolean().default(boolFromEnv(env.REGISTRATION_ENABLED, true)),
  converter_backend_url: z.string().default(env.CONVERTER_BACKEND_URL || ""),
  sub_rate_limit_per_minute: z.number().int().positive().default(env.SUB_RATE_LIMIT_PER_MINUTE),
  sub_cache_seconds: z.number().int().positive().default(env.SUB_CACHE_SECONDS),
  login_fail_limit: z.number().int().positive().default(env.LOGIN_FAIL_LIMIT),
  login_lock_minutes: z.number().int().positive().default(env.LOGIN_LOCK_MINUTES),
  register_ip_limit: z.number().int().positive().default(env.REGISTER_IP_LIMIT),
  register_ip_window_minutes: z.number().int().positive().default(env.REGISTER_IP_WINDOW_MINUTES),
  turnstile_enabled: z.boolean().default(boolFromEnv(env.TURNSTILE_ENABLED, false)),
  login_turnstile_enabled: z.boolean().default(boolFromEnv(env.LOGIN_TURNSTILE_ENABLED, true)),
  register_turnstile_enabled: z.boolean().default(boolFromEnv(env.REGISTER_TURNSTILE_ENABLED, true)),
  redeem_turnstile_enabled: z.boolean().default(boolFromEnv(env.REDEEM_TURNSTILE_ENABLED, true)),
  site_domain: z.string().default(env.APP_BASE_URL),
  turnstile_site_key: z.string().default(env.TURNSTILE_SITE_KEY || ""),
  turnstile_secret_key: z.string().default(env.TURNSTILE_SECRET_KEY || "")
});

export type RuntimeSettings = z.infer<typeof runtimeSettingsSchema>;

function defaults(): RuntimeSettings {
  return runtimeSettingsSchema.parse({});
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  const doc = await systemStateCol().findOne({ key: SETTINGS_KEY });
  if (!doc?.payload) {
    return defaults();
  }
  const parsed = runtimeSettingsSchema.safeParse(doc.payload);
  if (!parsed.success) {
    return defaults();
  }
  return parsed.data;
}

export async function updateRuntimeSettings(input: Partial<RuntimeSettings>): Promise<RuntimeSettings> {
  const current = await getRuntimeSettings();
  const next = runtimeSettingsSchema.parse({ ...current, ...input });
  await systemStateCol().updateOne(
    { key: SETTINGS_KEY },
    { $set: { payload: next, updated_at: new Date() } },
    { upsert: true }
  );
  return next;
}
