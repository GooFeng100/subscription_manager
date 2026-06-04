import { activationCodesCol } from "../lib/db.js";
import { todayShanghaiDate } from "../lib/shanghai-date.js";

const FIXED_CODE_EXPIRY_INTERVAL_MS = 60 * 60 * 1000;
let expiryTimer: ReturnType<typeof setInterval> | null = null;
let cleanupRunning = false;

export async function expireFixedActivationCodes(now = new Date()) {
  if (cleanupRunning) {
    return { matched: 0, modified: 0, skipped: true };
  }
  cleanupRunning = true;
  try {
    const today = todayShanghaiDate(now);
    const result = await activationCodesCol().updateMany(
      {
        status: "unused",
        mode: "fixed_expire_date",
        fixed_expire_date: { $lt: today }
      },
      {
        $set: {
          status: "revoked",
          revoked_at: now,
          updated_at: now,
          revoke_reason: "expired_fixed_date"
        }
      }
    );
    return {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      skipped: false
    };
  } finally {
    cleanupRunning = false;
  }
}

export function startActivationCodeExpiryJob() {
  if (expiryTimer) {
    return;
  }

  void expireFixedActivationCodes()
    .then((result) => {
      if (result.modified > 0) {
        console.log(`auto-revoked ${result.modified} expired fixed activation code(s)`);
      }
    })
    .catch((error) => {
      console.error("expired fixed activation code cleanup failed:", error);
    });

  expiryTimer = setInterval(() => {
    void expireFixedActivationCodes()
      .then((result) => {
        if (result.modified > 0) {
          console.log(`auto-revoked ${result.modified} expired fixed activation code(s)`);
        }
      })
      .catch((error) => {
        console.error("expired fixed activation code cleanup failed:", error);
      });
  }, FIXED_CODE_EXPIRY_INTERVAL_MS);
  expiryTimer.unref?.();
}
