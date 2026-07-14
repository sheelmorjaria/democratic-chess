/**
 * Compat shim. The realtime layer moved to `realtime.ts` (interfaces + room
 * helpers) and `uws.ts`/`bus.ts` (uWebSockets.js transport). This file only
 * re-exports the abstractions so existing `from "../realtime/io.js"` imports
 * keep resolving during the migration. Prefer importing from `./realtime.js`.
 */
export * from "./realtime.js";
