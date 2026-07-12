import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./jwt.js";

export interface AuthedRequest extends Request {
  userId?: string;
  username?: string;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  if (!header) {
    res.status(401).json({ code: "unauthorized", message: "missing token" });
    return;
  }
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  try {
    const claims = await verifyAccessToken(token);
    req.userId = claims.sub;
    req.username = claims.username;
    next();
  } catch {
    res.status(401).json({ code: "invalid_token", message: "invalid or expired token" });
  }
}
