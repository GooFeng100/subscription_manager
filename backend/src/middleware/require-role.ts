import type { Request, Response, NextFunction } from "express";

function unauthorized(res: Response) {
  return res.status(401).json({
    error: "UNAUTHORIZED",
    message: "请先登录"
  });
}

function forbidden(res: Response) {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "无权限访问"
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.userType) {
    return unauthorized(res);
  }
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.userType) {
    return unauthorized(res);
  }
  if (req.session.userType !== "admin") {
    return forbidden(res);
  }
  return next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.userType) {
    return unauthorized(res);
  }
  if (req.session.userType !== "user") {
    return forbidden(res);
  }
  return next();
}
