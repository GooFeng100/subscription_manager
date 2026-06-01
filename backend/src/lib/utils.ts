import crypto from "node:crypto";

export function boolFromEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

export function generateSubToken() {
  return crypto.randomBytes(24).toString("hex");
}
