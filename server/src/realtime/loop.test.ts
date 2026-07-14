import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { getPrisma } from "../db/prisma.js";
import { getRedis } from "../db/redis.js";
import { createRealtimeApp, type RealtimeApp } from "./uws.js";
import { TurnEngine } from "../game/turnEngine.js";
import { signAccessToken } from "../auth/jwt.js";
import { createTeamMatch } from "../game/matchService.js";
import type { Envelope } from "./realtime.js";

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

/** Minimal WebSocket client speaking the `{t,d}` envelope. */
class TestClient {
  private readonly ws: WebSocket;
  private readonly waiters = new Map<string, (data: unknown) => void>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on("message", (data: Buffer, isBinary: boolean) => {
      if (isBinary) return;
      let env: Envelope;
      try {
        env = JSON.parse(data.toString()) as Envelope;
      } catch {
        return;
      }
      const cb = this.waiters.get(env.t);
      if (cb) {
        this.waiters.delete(env.t);
        cb(env.d);
      }
    });
  }

  static connect(url: string, ms = 2000): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error("connect timeout")), ms);
      ws.on("open", () => {
        clearTimeout(timer);
        resolve(new TestClient(ws));
      });
      ws.on("error", () => {
        clearTimeout(timer);
        reject(new Error("connect error"));
      });
    });
  }

  emit(event: string, data: unknown): void {
    this.ws.send(JSON.stringify({ t: event, d: data }));
  }

  waitFor(event: string, ms = 2000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
      this.waiters.set(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  observedWithin(event: string, ms = 400): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) resolve(false);
      }, ms);
      this.waiters.set(event, () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
  }

  disconnect(): void {
    this.ws.close();
  }
}

async function connect(player: Player, port: number): Promise<TestClient> {
  const token = await signAccessToken({ sub: player.id, username: player.username });
  return TestClient.connect(`ws://localhost:${port}/?token=${token}`);
}

let rt: RealtimeApp;
let engine: TurnEngine;
let port = 0;
let fx: Fixture;

beforeEach(async () => {
  rt = createRealtimeApp({
    redis,
    internalPort: 0,
    createEngine: (io) => new TurnEngine({ db, redis, io, forfeitGraceMs: 100 }),
  });
  port = (await rt.listen(0)).port;
  engine = rt.engine;
  fx = await seed();
});

afterEach(async () => {
  engine.dispose();
  await rt.close();
  await cleanup(fx);
});

describe("US1 realtime loop (socket-level e2e)", () => {
  it("runs propose -> vote -> execute with opponent isolation", async () => {
    const white = await connect(fx.white, port);
    const black = await connect(fx.black, port);

    white.emit("join_match", { matchId: fx.matchId });
    black.emit("join_match", { matchId: fx.matchId });
    await white.waitFor("match_start");
    await black.waitFor("match_start");

    white.emit("propose_move", { matchId: fx.matchId, from: "e2", to: "e4" });

    const proposal = (await white.waitFor("new_proposal")) as { san: string };
    expect(proposal.san).toBe("e4");
    // Constitution principle IV: opponents never see proposals.
    expect(await black.observedWithin("new_proposal")).toBe(false);

    white.emit("vote_move", { matchId: fx.matchId, moveKey: "e2:e4:-" });
    const vote = (await white.waitFor("vote_update")) as {
      tallies: { moveKey: string; count: number }[];
    };
    expect(vote.tallies.find((t) => t.moveKey === "e2:e4:-")?.count).toBe(1);

    // Window-expiry path: arm listeners first — resolveTurn runs in-process and
    // emits synchronously, so the waiter must be registered before the call.
    const whiteMoveP = white.waitFor("move_executed");
    const blackMoveP = black.waitFor("move_executed");
    await engine.resolveTurn(fx.matchId);

    const whiteMove = (await whiteMoveP) as { fen: string; san: string };
    const blackMove = (await blackMoveP) as { fen: string };
    expect(whiteMove.san).toBe("e4");
    expect(blackMove.fen).toBe(whiteMove.fen); // board consistent across both sides

    white.disconnect();
    black.disconnect();
  }, 20000);

  it("forfeits a side when its last member disconnects (FR-009)", async () => {
    const white = await connect(fx.white, port);
    white.emit("join_match", { matchId: fx.matchId });
    await white.waitFor("match_start");
    white.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 600)); // let disconnect + forfeit settle

    const match = await db.match.findUnique({ where: { id: fx.matchId } });
    expect(match?.status).toBe("COMPLETED");
    expect(match?.winner).toBe("BLACK");
  }, 15000);
});
