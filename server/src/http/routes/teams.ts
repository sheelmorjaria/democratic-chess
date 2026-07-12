import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../../auth/middleware.js";
import { createTeamWithCaptain, findTeamById } from "../../db/repositories/teams.js";
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

  return router;
}
