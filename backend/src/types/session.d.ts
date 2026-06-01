import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userType?: "admin" | "user";
    username?: string;
  }
}
