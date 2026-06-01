import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { adminsCol } from "../lib/db.js";

export async function ensureDefaultAdmin() {
  const col = adminsCol();
  const now = new Date();
  const password_hash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await col.updateOne(
    { username: env.ADMIN_USERNAME },
    {
      $set: {
        password_hash,
        status: "active",
        updated_at: now
      },
      $setOnInsert: {
        username: env.ADMIN_USERNAME,
        created_at: now,
        last_login_at: null
      }
    },
    { upsert: true }
  );
  console.log(`admin ensured: ${env.ADMIN_USERNAME}`);
}
