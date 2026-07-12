import { randomUUID } from "node:crypto";

/** Header name carrying a correlation id across the HTTP and socket boundary. */
export const CORRELATION_HEADER = "x-correlation-id";

/** Reads a correlation id from incoming headers, generating one if absent. */
export function correlationIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string {
  const raw = headers[CORRELATION_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.length > 0 ? value : randomUUID();
}

export function newCorrelationId(): string {
  return randomUUID();
}
