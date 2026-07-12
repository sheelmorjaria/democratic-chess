import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../../auth/middleware.js";
import { addMember, createTeamWithCaptain, findTeamById, removeMember } from "../../db/repositories/teams.js";
import { upsertRating } from "../../db/repositories/ratings.js";

const createTeamSchema = z.object({ name: z.string().min(3).max(48) });

export function createTeamsRouter(db: PrismaClient): Router {
  const router = Router();

  router.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { name } = createTeamSchema.parse(req.body);
      const team = await createTeamWithCaptain(db, { name, captainId: req.userId ?? "" });
      await upsertRating(db, { subjectType: "TEAM", teamId: team.id });
      res.status(201).json(team);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", requireAuth, async (req, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      res.json(team);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/members", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      if (team.captainId !== req.userId) {
        res.status(403).json({ code: "forbidden", message: "only the captain can manage the roster" });
        return;
      }
      const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
      await addMember(db, { teamId: team.id, userId });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id/members/:userId", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      if (team.captainId !== req.userId) {
        res.status(403).json({ code: "forbidden", message: "only the captain can manage the roster" });
        return;
      }
      await removeMember(db, team.id, req.params.userId ?? "");
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
