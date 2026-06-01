import express from "express";
import session from "express-session";
import { env } from "./config/env.js";
import { connectDb, ensureIndexes, getDb } from "./lib/db.js";
import { redis } from "./lib/redis.js";
import authRouter from "./routes/auth.js";
import stage2Router from "./routes/stage2.js";
import stage3Router from "./routes/stage3.js";
import stage4Router from "./routes/stage4.js";
import stage6Router from "./routes/stage6.js";
import stage7Router from "./routes/stage7.js";
import { ensureDefaultAdmin } from "./services/admin-seed.js";
import { boolFromEnv } from "./lib/utils.js";
import { getRuntimeSettings } from "./lib/runtime-settings.js";

async function bootstrap() {
  await connectDb();
  await ensureIndexes();
  await ensureDefaultAdmin();
  await redis.ping();

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());

  app.use(
    session({
      name: env.SESSION_COOKIE_NAME,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: boolFromEnv(env.SESSION_COOKIE_SECURE, false),
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
    })
  );

  app.get("/", (_req, res) => {
    res.json({
      service: "subscription-manager-app",
      status: "running",
      baseUrl: env.APP_BASE_URL
    });
  });

  app.get("/health", async (_req, res) => {
    try {
      await getDb().command({ ping: 1 });
      await redis.ping();
      return res.json({
        ok: true,
        dependencies: {
          mongo: { ok: true, message: "connected" },
          redis: { ok: true, message: "connected" }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return res.status(503).json({
        ok: false,
        dependencies: {
          mongo: { ok: false, message },
          redis: { ok: false, message }
        }
      });
    }
  });

  app.get("/config", async (_req, res) => {
    const settings = await getRuntimeSettings();
    res.json({
      appBaseUrl: settings.site_domain || env.APP_BASE_URL,
      nodeEnv: env.NODE_ENV,
      turnstileEnabled: settings.turnstile_enabled,
      turnstileSiteKey: settings.turnstile_site_key
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", stage2Router);
  app.use("/api", stage3Router);
  app.use("/api", stage6Router);
  app.use("/api", stage7Router);
  app.use("/", stage4Router);

  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`subscription-manager-backend listening on ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("bootstrap failed:", error);
  process.exit(1);
});
