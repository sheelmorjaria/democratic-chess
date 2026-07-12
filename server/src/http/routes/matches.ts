import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { requireAuth } from "../../auth/middleware.js";
import { createTeamMatch, MatchServiceError } from "../../game/matchService.js";
import { getRuntime } from "../../game/runtime.js";

const createMatchSchema = z.object({
  whiteTeamId: z.string().uuid(),
  blackTeamId: z.string().uuid(),
  moveWindowSec: z.number().int().min(5).max(300).optional(),
  timeBankMs: z.number().int().min(10_000).optional(),
});

export function createMatchesRouter(db: PrismaClient): Router {
  const router = Router();

  router.post("/", requireAuth, async (req, res, next) => {
    try {
      const input = createMatchSchema.parse(req.body);
      const match = await createTeamMatch(db, input);
      // Open turn 1 (fire-and-forget; emits to an empty room until players join).
      void getRuntime().startMatch(match.id);
      res.status(201).json(match);
    } catch (error) {
      if (error instanceof MatchServiceError) {
        res.status(400).json({ code: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/:id", requireAuth, async (req, res, next) => {
    try {
      const match = await db.match.findUnique({
        where: { id: req.params.id },
        include: { participants: true },
      });
      if (!match) {
        res.status(404).json({ code: "not_found", message: "match not found" });
        return;
      }
      res.json(match);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
