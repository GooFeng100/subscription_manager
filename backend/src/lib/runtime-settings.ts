import { z } from "zod";
import { env } from "../config/env.js";
import { boolFromEnv } from "./utils.js";
import { systemStateCol } from "./db.js";

const SETTINGS_KEY = "runtime_settings";
const DEFAULT_UPSTREAM_FETCH_PROXY_URL = "http://100.69.223.58:17890";

const runtimeSettingsSchema = z.object({
  registration_enabled: z.boolean().default(boolFromEnv(env.REGISTRATION_ENABLED, true)),
  converter_backend_url: z.string().default(env.CONVERTER_BACKEND_URL || "http://subconverter:25500/sub"),
  converter_default_target: z.string().default("clash"),
  converter_default_config_url: z
    .string()
    .default("https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini"),
  subscription_filename_template: z.string().default("{{username}}_云域数字"),
  upstream_poll_interval_minutes: z.number().int().nonnegative().default(env.UPSTREAM_POLL_INTERVAL_MINUTES),
  upstream_fetch_proxy_url: z.string().default(env.UPSTREAM_FETCH_PROXY_URL || DEFAULT_UPSTREAM_FETCH_PROXY_URL),
  sub_rate_limit_per_minute: z.number().int().positive().default(env.SUB_RATE_LIMIT_PER_MINUTE),
  login_fail_limit: z.number().int().positive().default(env.LOGIN_FAIL_LIMIT),
  login_lock_minutes: z.number().int().positive().default(env.LOGIN_LOCK_MINUTES),
  register_ip_limit: z.number().int().positive().default(env.REGISTER_IP_LIMIT),
  register_ip_window_minutes: z.number().int().positive().default(env.REGISTER_IP_WINDOW_MINUTES),
  site_domain: z.string().default(env.APP_BASE_URL)
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
