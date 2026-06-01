import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default("http://192.168.10.3:8084"),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().default("sm_session"),
  SESSION_COOKIE_SECURE: z.string().default("false"),
  LOGIN_FAIL_LIMIT: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  REGISTER_IP_LIMIT: z.coerce.number().int().positive().default(10),
  REGISTER_IP_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
  REGISTRATION_ENABLED: z.string().default("true"),
  LOGIN_TURNSTILE_ENABLED: z.string().default("true"),
  REGISTER_TURNSTILE_ENABLED: z.string().default("true"),
  REDEEM_TURNSTILE_ENABLED: z.string().default("true"),
  TURNSTILE_ENABLED: z.string().default("false"),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  CONVERTER_BACKEND_URL: z.string().optional(),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("admin123456")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
