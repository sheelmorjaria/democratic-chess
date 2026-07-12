import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { requireAuth } from "../../auth/middleware.js";

const querySchema = z.object({
  type: z.enum(["TEAM", "SOLO"]).default("TEAM"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function createLeaderboardRouter(db: PrismaClient): Router {
  const router = Router();

  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const { type, limit } = querySchema.parse(req.query);
      const ratings = await db.rating.findMany({
        where: { subjectType: type },
        orderBy: { rating: "desc" },
        take: limit,
        include: { team: true, user: true },
      });
      const entries = ratings.map((r) => ({
        subjectId: r.teamId ?? r.userId,
        name: r.team?.name ?? r.user?.username ?? "—",
        rating: r.rating,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
      }));
      res.json({ entries });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
