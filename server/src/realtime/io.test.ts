import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { io as ioc } from "socket.io-client";
import { signAccessToken } from "../auth/jwt.js";
import { getRedis } from "../db/redis.js";
import { colorRoom, createRealtimeServer, matchRoom, type AppServer } from "./io.js";

let httpServer: http.Server;
let io: AppServer;
let port = 0;

beforeEach(async () => {
  httpServer = http.createServer();
  io = createRealtimeServer({ httpServer, redis: getRedis(), clientOrigin: "*" });
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

describe("realtime auth gate", () => {
  it("rejects a connection without a token", async () => {
    const client = ioc(`http://localhost:${port}`);
    const message = await new Promise<string>((resolve) => {
      client.on("connect_error", (err) => resolve(err.message));
    });
    client.disconnect();
    expect(message).toBe("missing_token");
  });

  it("rejects a connection with an invalid token", async () => {
    const client = ioc(`http://localhost:${port}`, { auth: { token: "not-a-jwt" } });
    const message = await new Promise<string>((resolve) => {
      client.on("connect_error", (err) => resolve(err.message));
    });
    client.disconnect();
    expect(message).toBe("invalid_token");
  });

  it("accepts a connection with a valid access token", async () => {
    const token = await signAccessToken({ sub: "u1", username: "alice" });
    const client = ioc(`http://localhost:${port}`, { auth: { token } });
    await new Promise<void>((resolve) => {
      client.on("connect", () => resolve());
    });
    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

describe("room naming", () => {
  it("names the shared match room and color-private rooms distinctly", () => {
    expect(matchRoom("123")).toBe("match_123");
    expect(colorRoom("123", "white")).toBe("match_123_white");
    expect(colorRoom("123", "black")).toBe("match_123_black");
  });
});
