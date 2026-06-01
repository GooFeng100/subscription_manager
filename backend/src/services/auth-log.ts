import { ObjectId } from "mongodb";
import { authLogsCol } from "../lib/db.js";

type AuthLogInput = {
  userId?: string | null;
  username: string;
  ip: string;
  userAgent: string;
  action: string;
  success: boolean;
  message: string;
};

export async function writeAuthLog(input: AuthLogInput) {
  const userObjectId = input.userId && ObjectId.isValid(input.userId) ? new ObjectId(input.userId) : null;
  await authLogsCol().insertOne({
    user_id: userObjectId,
    username: input.username,
    ip: input.ip,
    user_agent: input.userAgent,
    action: input.action,
    success: input.success,
    message: input.message,
    created_at: new Date()
  });
}
