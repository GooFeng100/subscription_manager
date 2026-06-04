import { MongoClient, ObjectId } from "mongodb";
import { env } from "../config/env.js";

export type UserStatus = "inactive" | "active" | "grace" | "expired" | "disabled";

export type UserDoc = {
  _id?: ObjectId;
  username: string;
  password_hash: string;
  contact?: string | null;
  note?: string | null;
  sub_token: string | null;
  status: UserStatus;
  expire_at: Date | null;
  disable_after: Date | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type AdminDoc = {
  _id?: ObjectId;
  username: string;
  password_hash: string;
  status: "active" | "disabled";
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type AuthLogDoc = {
  _id?: ObjectId;
  user_id: ObjectId | null;
  username: string;
  ip: string;
  user_agent: string;
  action: string;
  success: boolean;
  message: string;
  created_at: Date;
};

export type ActivationCodeStatus = "unused" | "used" | "revoked";
export type ActivationCodeMode = "add_days" | "fixed_expire_date";

export type ActivationCodeDoc = {
  _id?: ObjectId;
  code: string;
  mode?: ActivationCodeMode;
  duration_days: number;
  fixed_expire_date?: string | null;
  grace_days: number;
  status: ActivationCodeStatus;
  used_by_user_id: ObjectId | null;
  used_by_username: string | null;
  used_at: Date | null;
  old_expire_at?: Date | null;
  new_expire_at?: Date | null;
  revoked_at: Date | null;
  revoke_reason?: "manual" | "expired_fixed_date" | null;
  note: string | null;
  created_at: Date;
  updated_at: Date;
};

export type RenewalLogDoc = {
  _id?: ObjectId;
  user_id: ObjectId;
  username: string;
  activation_code_id: ObjectId | null;
  activation_code: string | null;
  mode?: ActivationCodeMode;
  duration_days: number;
  fixed_expire_date?: string | null;
  grace_days: number;
  previous_expire_at: Date | null;
  previous_disable_after: Date | null;
  next_expire_at: Date;
  next_disable_after: Date;
  operator_user_id: ObjectId;
  operator_type: "admin" | "user";
  operator_username: string;
  source: "redeem" | "admin_manual";
  created_at: Date;
};

export type UpstreamDoc = {
  _id?: ObjectId;
  name: string;
  provider: string;
  source_type: string;
  source_url: string;
  fetch_via_proxy?: boolean;
  enabled: boolean;
  last_test_ok: boolean | null;
  last_test_status: number | null;
  last_test_error: string | null;
  last_test_type?: string | null;
  last_test_node_count?: number | null;
  last_test_message?: string | null;
  last_test_via_proxy?: boolean | null;
  last_test_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type SubAccessLogDoc = {
  _id?: ObjectId;
  user_id: ObjectId | null;
  username: string | null;
  token: string;
  target: string;
  ip: string;
  status_code: number;
  success: boolean;
  message: string;
  created_at: Date;
};

export type RotationLogDoc = {
  _id?: ObjectId;
  from_version: string;
  to_version: string | null;
  reason: string;
  operator_user_id: ObjectId;
  operator_username: string;
  impacted_user_count: number;
  success: boolean;
  message: string;
  created_at: Date;
};

export type SystemStateDoc = {
  _id?: ObjectId;
  key: string;
  sub_version?: string | number;
  payload?: Record<string, unknown>;
  updated_at: Date;
};

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
let connected = false;

export async function connectDb() {
  if (connected) {
    return;
  }
  await client.connect();
  connected = true;
}

export function getDb() {
  return client.db();
}

export function usersCol() {
  return getDb().collection<UserDoc>("users");
}

export function adminsCol() {
  return getDb().collection<AdminDoc>("admins");
}

export function authLogsCol() {
  return getDb().collection<AuthLogDoc>("auth_logs");
}

export function activationCodesCol() {
  return getDb().collection<ActivationCodeDoc>("activation_codes");
}

export function renewalLogsCol() {
  return getDb().collection<RenewalLogDoc>("renewal_logs");
}

export function upstreamsCol() {
  return getDb().collection<UpstreamDoc>("upstreams");
}

export function subAccessLogsCol() {
  return getDb().collection<SubAccessLogDoc>("sub_access_logs");
}

export function rotationLogsCol() {
  return getDb().collection<RotationLogDoc>("rotation_logs");
}

export function systemStateCol() {
  return getDb().collection<SystemStateDoc>("system_state");
}

export async function ensureIndexes() {
  await usersCol().createIndex({ username: 1 }, { unique: true });
  const userIndexes = await usersCol().indexes();
  const legacySubTokenIndex = userIndexes.find((idx) => idx.name === "sub_token_1");
  if (legacySubTokenIndex && !legacySubTokenIndex.partialFilterExpression) {
    await usersCol().dropIndex("sub_token_1");
  }
  await usersCol().createIndex(
    { sub_token: 1 },
    {
      name: "sub_token_1",
      unique: true,
      partialFilterExpression: { sub_token: { $type: "string" } }
    }
  );
  await adminsCol().createIndex({ username: 1 }, { unique: true });
  await authLogsCol().createIndex({ created_at: 1 });
  await authLogsCol().createIndex({ username: 1, created_at: 1 });
  await activationCodesCol().createIndex({ code: 1 }, { unique: true });
  await activationCodesCol().createIndex({ status: 1, created_at: -1 });
  await activationCodesCol().createIndex({ status: 1, mode: 1, fixed_expire_date: 1 });
  await renewalLogsCol().createIndex({ user_id: 1, created_at: -1 });
  await renewalLogsCol().createIndex({ created_at: -1 });
  await upstreamsCol().createIndex({ name: 1 }, { unique: true });
  await upstreamsCol().createIndex({ enabled: 1, updated_at: -1 });
  await subAccessLogsCol().createIndex({ token: 1, created_at: -1 });
  await subAccessLogsCol().createIndex({ user_id: 1, created_at: -1 });
  await subAccessLogsCol().createIndex({ created_at: -1 });
  await rotationLogsCol().createIndex({ created_at: -1 });
  await systemStateCol().createIndex({ key: 1 }, { unique: true });
}
