import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Realtime } from "../realtime/realtime.js";
import { ZodError } from "zod";
import { createAuthRouter } from "./routes/auth.js";
import { createLeaderboardRouter } from "./routes/leaderboard.js";
import { createMatchesRouter } from "./routes/matches.js";
import { createQueueRouter } from "./routes/queue.js";
import { createTeamsRouter } from "./routes/teams.js";
import { createUsersRouter } from "./routes/users.js";
import { createWebRtcRouter } from "./routes/webrtc.js";
import { requestContext, requestLogger, type ContextualRequest } from "../observability/http.js";
import { logger } from "../observability/logger.js";

export interface AppDeps {
  db: PrismaClient;
  redis?: Redis;
  io?: Realtime;
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
  // Correlation id + request-scoped logger on every request (research.md R11).
  app.use(requestContext);
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "democratic-chess-server" });
  });

  app.use("/auth", createAuthRouter(deps.db));
  app.use("/teams", createTeamsRouter(deps.db));
  app.use("/matches", createMatchesRouter(deps.db));
  app.use("/leaderboard", createLeaderboardRouter(deps.db));
  app.use("/users", createUsersRouter(deps.db));
  app.use("/webrtc", createWebRtcRouter());
  if (deps.redis && deps.io) {
    app.use("/queue", createQueueRouter(deps.db, deps.redis, deps.io));
  }

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const log = (req as ContextualRequest).log ?? logger;
    if (err instanceof ZodError) {
      res
        .status(400)
        .json({ code: "invalid_payload", message: "validation failed", issues: err.issues });
      return;
    }
    log.error({ err, msg: "request.error", method: req.method, path: req.path });
    res.status(500).json({
      code: "internal_error",
      message: err instanceof Error ? err.message : "error",
    });
  };
  app.use(errorHandler);

  return app;
}
