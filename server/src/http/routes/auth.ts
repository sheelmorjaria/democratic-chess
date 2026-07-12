import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../../auth/crypto.js";
import {
  requireAuth,
  type AuthedRequest,
} from "../../auth/middleware.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../auth/jwt.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../../db/repositories/users.js";
import { loginSchema, refreshSchema, registerSchema } from "../validate.js";

function publicUser(user: { id: string; username: string; email: string }) {
  return { id: user.id, username: user.username, email: user.email };
}

export function createAuthRouter(db: PrismaClient): Router {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const { username, email, password } = registerSchema.parse(req.body);
      if (await findUserByEmail(db, email)) {
        res.status(409).json({ code: "exists", message: "email already registered" });
        return;
      }
      const user = await createUser(db, {
        username,
        email,
        passwordHash: await hashPassword(password),
      });
      const accessToken = await signAccessToken({ sub: user.id, username: user.username });
      const refreshToken = await signRefreshToken({ sub: user.id });
      res.status(201).json({ accessToken, refreshToken, user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await findUserByEmail(db, email);
      const valid = user ? await verifyPassword(password, user.passwordHash) : false;
      if (!user || !valid) {
        res.status(401).json({ code: "invalid_credentials", message: "invalid email or password" });
        return;
      }
      const accessToken = await signAccessToken({ sub: user.id, username: user.username });
      const refreshToken = await signRefreshToken({ sub: user.id });
      res.json({ accessToken, refreshToken, user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/refresh", async (req, res, next) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const claims = await verifyRefreshToken(refreshToken);
      const user = await findUserById(db, claims.sub);
      if (!user) {
        res.status(401).json({ code: "invalid_token", message: "user not found" });
        return;
      }
      const accessToken = await signAccessToken({ sub: user.id, username: user.username });
      res.json({ accessToken });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const user = await findUserById(db, req.userId ?? "");
      if (!user) {
        res.status(404).json({ code: "not_found", message: "user not found" });
        return;
      }
      res.json(publicUser(user));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
