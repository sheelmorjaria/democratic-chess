import { TurnEngine, type TurnEngineDeps } from "./turnEngine.js";

/**
 * Game-runtime singleton. Held so the HTTP layer (match creation) can start a
 * match's realtime turn without a construction-order cycle with the realtime
 * server. Initialized once at boot in `index.ts`.
 */
let turnEngine: TurnEngine | null = null;

export function initRuntime(deps: TurnEngineDeps): TurnEngine {
  turnEngine = new TurnEngine(deps);
  return turnEngine;
}

export function getRuntime(): TurnEngine {
  if (!turnEngine) {
    throw new Error("runtime not initialized — call initRuntime at boot");
  }
  return turnEngine;
}
