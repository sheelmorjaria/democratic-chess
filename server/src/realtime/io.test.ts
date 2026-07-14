import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { signAccessToken } from "../auth/jwt.js";
import { getRedis } from "../db/redis.js";
import { colorRoom, matchRoom } from "./realtime.js";
import { createRealtimeApp, type RealtimeApp } from "./uws.js";
import type { TurnEngine } from "../game/turnEngine.js";

let rt: RealtimeApp;
let port = 0;

// The auth gate doesn't drive the engine; a stub with the only method the
// close handler calls is enough.
function stubEngine(): TurnEngine {
  return { onDisconnect: async () => {} } as unknown as TurnEngine;
}

beforeEach(async () => {
  rt = createRealtimeApp({ redis: getRedis(), internalPort: 0, createEngine: () => stubEngine() });
  port = (await rt.listen(0)).port;
});

afterEach(async () => {
  await rt.close();
});

/** Returns "open" if the WS handshakes, "failed" otherwise (rejected/timeout). */
function attempt(url: string, ms = 1500): Promise<"open" | "failed"> {
  return new Promise((resolve) => {
    let done = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve("failed");
      return;
    }
    const finish = (result: "open" | "failed") => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(result);
    };
    ws.on("open", () => finish("open"));
    ws.on("error", () => finish("failed"));
    ws.on("close", () => finish("failed"));
    ws.on("unexpected-response", () => finish("failed"));
    setTimeout(() => finish("failed"), ms);
  });
}

describe("realtime auth gate", () => {
  it("rejects a connection without a token", async () => {
    const result = await attempt(`ws://localhost:${port}/`);
    expect(result).toBe("failed");
  });

  it("rejects a connection with an invalid token", async () => {
    const result = await attempt(`ws://localhost:${port}/?token=not-a-jwt`);
    expect(result).toBe("failed");
  });

  it("accepts a connection with a valid access token", async () => {
    const token = await signAccessToken({ sub: "u1", username: "alice" });
    const result = await attempt(`ws://localhost:${port}/?token=${token}`);
    expect(result).toBe("open");
  });
});

describe("room naming", () => {
  it("names the shared match room and color-private rooms distinctly", () => {
    expect(matchRoom("123")).toBe("match_123");
    expect(colorRoom("123", "white")).toBe("match_123_white");
    expect(colorRoom("123", "black")).toBe("match_123_black");
  });
});
