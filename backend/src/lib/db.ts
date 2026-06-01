import { MongoClient, ObjectId } from "mongodb";
import { env } from "../config/env.js";

export type UserStatus = "inactive" | "active" | "grace" | "expired" | "disabled";

export type UserDoc = {
  _id?: ObjectId;
  username: string;
  password_hash: string;
  sub_token: string;
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

export async function ensureIndexes() {
  await usersCol().createIndex({ username: 1 }, { unique: true });
  await usersCol().createIndex({ sub_token: 1 }, { unique: true });
  await adminsCol().createIndex({ username: 1 }, { unique: true });
  await authLogsCol().createIndex({ created_at: 1 });
  await authLogsCol().createIndex({ username: 1, created_at: 1 });
}
