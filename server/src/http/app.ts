import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { createAuthRouter } from "./routes/auth.js";
import { createLeaderboardRouter } from "./routes/leaderboard.js";
import { createMatchesRouter } from "./routes/matches.js";
import { createTeamsRouter } from "./routes/teams.js";

export interface AppDeps {
  db: PrismaClient;
  clientOrigin?: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.use(
    cors({
      origin: deps.clientOrigin ?? process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "democratic-chess-server" });
  });

  app.use("/auth", createAuthRouter(deps.db));
  app.use("/teams", createTeamsRouter(deps.db));
  app.use("/matches", createMatchesRouter(deps.db));
  app.use("/leaderboard", createLeaderboardRouter(deps.db));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res
        .status(400)
        .json({ code: "invalid_payload", message: "validation failed", issues: err.issues });
      return;
    }
    res.status(500).json({
      code: "internal_error",
      message: err instanceof Error ? err.message : "error",
    });
  };
  app.use(errorHandler);

  return app;
}
