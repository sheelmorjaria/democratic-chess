import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Realtime } from "../../realtime/realtime.js";
import { requireAuth, type AuthedRequest } from "../../auth/middleware.js";
import type { MatchmakerDeps } from "../../matchmaking/matchmaker.js";
import {
  joinAsSolo,
  joinAsTeam,
  leaveQueueForUser,
  statusForUser,
} from "../../matchmaking/matchmaker.js";

const joinSchema = z.object({
  subjectType: z.enum(["TEAM", "SOLO"]),
  subjectId: z.string().uuid().optional(),
});

export function createQueueRouter(db: PrismaClient, redis: Redis, io: Realtime): Router {
  const router = Router();
  const deps: MatchmakerDeps = { db, redis, io };

  router.post("/join", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const input = joinSchema.parse(req.body);
      const now = Date.now();

      if (input.subjectType === "SOLO") {
        // A solo player may only queue themselves.
        const result = await joinAsSolo(deps, req.userId!, now);
        res.json(result);
        return;
      }

      // Team join: the caller must be a roster member (captain-gated, FR-014).
      const teamId = input.subjectId;
      if (!teamId) {
        res.status(400).json({ code: "invalid_payload", message: "subjectId required for TEAM" });
        return;
      }
      const membership = await db.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: req.userId! } },
      });
      if (!membership) {
        res.status(403).json({ code: "not_team_member", message: "you are not on this team" });
        return;
      }
      const result = await joinAsTeam(deps, teamId, req.userId!, now);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/leave", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      await leaveQueueForUser(deps, req.userId!);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/status", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      res.json(await statusForUser(deps, req.userId!));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
