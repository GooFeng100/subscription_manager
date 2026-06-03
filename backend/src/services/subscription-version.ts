import { systemStateCol } from "../lib/db.js";

const SUB_VERSION_STATE_KEY = "subscription_version";

export type SubscriptionVersionState = {
  yy: number;
  month: number;
  seq: number;
  version: string;
};

function buildVersion(yy: number, month: number, seq: number) {
  return `${yy}.${month}.${seq}`;
}

function parseVersion(value: unknown): SubscriptionVersionState | null {
  if (typeof value === "string") {
    const match = value.match(/^(\d{2})\.(\d{1,2})\.(\d+)$/);
    if (match) {
      return {
        yy: Number(match[1]),
        month: Number(match[2]),
        seq: Number(match[3]),
        version: value
      };
    }
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    const now = new Date();
    const yy = now.getFullYear() % 100;
    const month = now.getMonth() + 1;
    const seq = Math.floor(value);
    return { yy, month, seq, version: buildVersion(yy, month, seq) };
  }
  return null;
}

export async function getCurrentSubVersion(): Promise<SubscriptionVersionState> {
  const state = await systemStateCol().findOne({ key: SUB_VERSION_STATE_KEY });
  const parsed = parseVersion(state?.sub_version);
  if (!parsed) {
    const now = new Date();
    const yy = now.getFullYear() % 100;
    const month = now.getMonth() + 1;
    const version = buildVersion(yy, month, 0);
    await systemStateCol().updateOne(
      { key: SUB_VERSION_STATE_KEY },
      { $set: { sub_version: version, updated_at: now } },
      { upsert: true }
    );
    return { yy, month, seq: 0, version };
  }
  return parsed;
}

export async function bumpCurrentSubVersion(now = new Date()): Promise<SubscriptionVersionState> {
  const current = await getCurrentSubVersion();
  const yy = now.getFullYear() % 100;
  const month = now.getMonth() + 1;
  const nextSeq = current.yy === yy && current.month === month ? current.seq + 1 : 1;
  const version = buildVersion(yy, month, nextSeq);
  await systemStateCol().updateOne(
    { key: SUB_VERSION_STATE_KEY },
    { $set: { sub_version: version, updated_at: now } },
    { upsert: true }
  );
  return { yy, month, seq: nextSeq, version };
}
