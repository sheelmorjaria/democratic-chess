import type { Request, Response, NextFunction } from "express";
import type pino from "pino";
import { CORRELATION_HEADER, correlationIdFromHeaders } from "./correlation.js";
import { logger } from "./logger.js";

/**
 * Express middleware (research.md R11): assigns a per-request correlation id
 * (honoring an inbound `x-correlation-id`), exposes a request-scoped child
 * logger as `req.log`, and echoes the id back on the response so clients can
 * stitch their side of a request to server logs.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const id = correlationIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
  (req as ContextualRequest).correlationId = id;
  (req as ContextualRequest).log = logger.child({ correlationId: id });
  res.setHeader(CORRELATION_HEADER, id);
  next();
}

export interface ContextualRequest extends Request {
  correlationId?: string;
  log?: pino.Logger;
}

/** Tiny request logger: one line per completed request with method/route/status/duration. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const dur = Date.now() - start;
    const log = (req as ContextualRequest).log ?? logger;
    log.info({
      msg: "request",
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: dur,
    });
  });
  next();
}
