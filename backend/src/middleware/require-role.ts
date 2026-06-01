import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.userType) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.userType !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.userType !== "user") {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}
