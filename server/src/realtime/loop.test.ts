import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { io as ioc, type Socket } from "socket.io-client";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { getPrisma } from "../db/prisma.js";
import { getRedis } from "../db/redis.js";
import { createRealtimeServer, type AppServer } from "./io.js";
import { registerGameHandlers } from "./handlers.js";
import { TurnEngine } from "../game/turnEngine.js";
import { signAccessToken } from "../auth/jwt.js";
import { createTeamMatch } from "../game/matchService.js";

const db: PrismaClient = getPrisma();
const redis: Redis = getRedis();

interface Player {
  id: string;
  username: string;
}
interface Fixture {
  matchId: string;
  white: Player;
  black: Player;
  teams: string[];
  users: string[];
}

async function seed(): Promise<Fixture> {
  const s = crypto.randomUUID();
  const whiteUser = await db.user.create({
    data: { username: `w_${s}`, email: `w_${s}@e.com`, passwordHash: "x" },
  });
  const blackUser = await db.user.create({
    data: { username: `b_${s}`, email: `b_${s}@e.com`, passwordHash: "x" },
  });
  const whiteTeam = await db.team.create({
    data: {
      name: `White ${s}`,
      captainId: whiteUser.id,
      members: { create: { userId: whiteUser.id, role: "CAPTAIN" } },
      rating: { create: { subjectType: "TEAM", rating: 1200 } },
    },
  });
  const blackTeam = await db.team.create({
    data: {
      name: `Black ${s}`,
      captainId: blackUser.id,
      members: { create: { userId: blackUser.id, role: "CAPTAIN" } },
      rating: { create: { subjectType: "TEAM", rating: 1200 } },
    },
  });
  const match = await createTeamMatch(db, { whiteTeamId: whiteTeam.id, blackTeamId: blackTeam.id });
  return {
    matchId: match.id,
    white: whiteUser,
    black: blackUser,
    teams: [whiteTeam.id, blackTeam.id],
    users: [whiteUser.id, blackUser.id],
  };
}

async function cleanup(f: Fixture): Promise<void> {
  await db.matchParticipant.deleteMany({ where: { matchId: f.matchId } });
  await db.match.deleteMany({ where: { id: f.matchId } });
  await db.rating.deleteMany({ where: { teamId: { in: f.teams } } });
  await db.teamMembership.deleteMany({ where: { teamId: { in: f.teams } } });
  await db.team.deleteMany({ where: { id: { in: f.teams } } });
  await db.user.deleteMany({ where: { id: { in: f.users } } });
}

let httpServer: http.Server;
let io: AppServer;
let engine: TurnEngine;
let port = 0;
let fx: Fixture;

beforeEach(async () => {
  httpServer = http.createServer();
  io = createRealtimeServer({ httpServer, redis, clientOrigin: "*" });
  engine = new TurnEngine({ db, redis, io, forfeitGraceMs: 100 });
  registerGameHandlers(io, engine);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
  fx = await seed();
});

afterEach(async () => {
  engine.dispose();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await cleanup(fx);
});

function waitFor(socket: Socket, event: string, ms = 2000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data: unknown) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function observedWithin(socket: Socket, event: string, ms = 400): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const handler = () => resolve(true);
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(false);
    }, ms);
  });
}

async function connect(player: Player): Promise<Socket> {
  const token = await signAccessToken({ sub: player.id, username: player.username });
  const socket = ioc(`http://localhost:${port}`, { auth: { token }, transports: ["websocket"] });
  if (!socket.connected) await waitFor(socket, "connect");
  return socket;
}

describe("US1 realtime loop (socket-level e2e)", () => {
  it("runs propose -> vote -> execute with opponent isolation", async () => {
    const white = await connect(fx.white);
    const black = await connect(fx.black);

    white.emit("join_match", { matchId: fx.matchId });
    black.emit("join_match", { matchId: fx.matchId });
    await waitFor(white, "match_start");
    await waitFor(black, "match_start");

    white.emit("propose_move", { matchId: fx.matchId, from: "e2", to: "e4" });

    const proposal = (await waitFor(white, "new_proposal")) as { san: string };
    expect(proposal.san).toBe("e4");
    // Constitution principle IV: opponents never see proposals.
    expect(await observedWithin(black, "new_proposal")).toBe(false);

    white.emit("vote_move", { matchId: fx.matchId, moveKey: "e2:e4:-" });
    const vote = (await waitFor(white, "vote_update")) as {
      tallies: { moveKey: string; count: number }[];
    };
    expect(vote.tallies.find((t) => t.moveKey === "e2:e4:-")?.count).toBe(1);

    // Window-expiry path: arm listeners first — resolveTurn runs in-process and
    // emits synchronously, so the waiter must be registered before the call.
    const whiteMoveP = waitFor(white, "move_executed");
    const blackMoveP = waitFor(black, "move_executed");
    await engine.resolveTurn(fx.matchId);

    const whiteMove = (await whiteMoveP) as { fen: string; san: string };
    const blackMove = (await blackMoveP) as { fen: string };
    expect(whiteMove.san).toBe("e4");
    expect(blackMove.fen).toBe(whiteMove.fen); // board consistent across both sides

    white.disconnect();
    black.disconnect();
  }, 20000);

  it("forfeits a side when its last member disconnects (FR-009)", async () => {
    const white = await connect(fx.white);
    white.emit("join_match", { matchId: fx.matchId });
    await waitFor(white, "match_start");
    white.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 600)); // let disconnect + forfeit settle

    const match = await db.match.findUnique({ where: { id: fx.matchId } });
    expect(match?.status).toBe("COMPLETED");
    expect(match?.winner).toBe("BLACK");
  }, 15000);
});
