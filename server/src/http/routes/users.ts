import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireAuth } from "../../auth/middleware.js";
import { findUserByUsername } from "../../db/repositories/users.js";

export function createUsersRouter(db: PrismaClient): Router {
  const router = Router();

  /**
   * Lookup a user by username so a captain can invite by name. Returns minimal
   * fields ({ id, username }) — never email — since any authenticated user can
   * resolve a username they already know.
   */
  router.get("/lookup", requireAuth, async (req, res, next) => {
    try {
      const username = String(req.query.username ?? "");
      if (!username) {
        res.status(400).json({ code: "invalid_payload", message: "username query is required" });
        return;
      }
      const user = await findUserByUsername(db, username);
      if (!user) {
        res.status(404).json({ code: "not_found", message: "no user with that username" });
        return;
      }
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
