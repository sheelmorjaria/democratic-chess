import pino from "pino";

/**
 * Structured logging baseline (research.md R11). A single root logger; HTTP and
 * socket paths derive children bound to a correlation id so a request/event can
 * be traced across the stack. Logs are newline JSON, ready for any aggregator.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "democratic-chess-server" },
  redact: ["req.headers.authorization", "*.token", "*.password"],
});

/** Convenience for modules that want a named child without a correlation id. */
export function childLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
