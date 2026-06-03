import crypto from "node:crypto";

export function boolFromEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

export function generateSubToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}
