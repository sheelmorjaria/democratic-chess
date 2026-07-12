import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import { getPrisma } from "../db/prisma.js";
import { getRedis } from "../db/redis.js";
import { TurnEngine } from "../game/turnEngine.js";
import { initRuntime } from "../game/runtime.js";
import { createSoloMatch } from "../game/matchService.js";
import { applyMove } from "../game/executeMove.js";
import { endMatch } from "../game/matchEnd.js";
import {
  joinAsSolo,
  joinAsTeam,
  leaveQueueForUser,
  statusForUser,
  type MatchmakerDeps,
} from "./matchmaker.js";

const db: PrismaClient = getPrisma();
const redis: Redis = getRedis();

/** Minimal io stub: the matchmaker only uses `io.to(room).emit(...)`. */
const stubIo = { to: () => ({ emit: () => undefined }) } as unknown as Server;
const deps: MatchmakerDeps = { db, redis, io: stubIo };

interface Fixture {
  soloId: string;
  captainId: string;
  teamId: string;
  users: string[];
  teams: string[];
}

async function seed(): Promise<Fixture> {
  const s = crypto.randomUUID();
  const solo = await db.user.create({
    data: { username: `solo_${s}`, email: `solo_${s}@e.com`, passwordHash: "x" },
  });
  const captain = await db.user.create({
    data: { username: `cap_${s}`, email: `cap_${s}@e.com`, passwordHash: "x" },
  });
  const team = await db.team.create({
    data: {
      name: `Team ${s}`,
      captainId: captain.id,
      members: { create: { userId: captain.id, role: "CAPTAIN" } },
      rating: { create: { subjectType: "TEAM", rating: 1200 } },
    },
  });
  await db.rating.create({ data: { subjectType: "SOLO", userId: solo.id } });
  return { soloId: solo.id, captainId: captain.id, teamId: team.id, users: [solo.id, captain.id], teams: [team.id] };
}

async function cleanup(f: Fixture): Promise<void> {
  const matches = await db.match.findMany({
    where: { OR: [{ whiteTeamId: { in: f.teams } }, { blackTeamId: { in: f.teams } }] },
    select: { id: true },
  });
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length) await db.matchParticipant.deleteMany({ where: { matchId: { in: matchIds } } });
  await db.match.deleteMany({ where: { id: { in: matchIds } } });
  await db.rating.deleteMany({ where: { OR: [{ teamId: { in: f.teams } }, { userId: { in: f.users } }] } });
  await db.teamMembership.deleteMany({ where: { teamId: { in: f.teams } } });
  await db.team.deleteMany({ where: { id: { in: f.teams } } });
  await db.user.deleteMany({ where: { id: { in: f.users } } });
}

let engine: TurnEngine;
let fx: Fixture;

beforeEach(async () => {
  engine = initRuntime({ db, redis, io: stubIo });
  fx = await seed();
});

afterEach(async () => {
  engine.dispose();
  await leaveQueueForUser(deps, fx.soloId).catch(() => undefined);
  await leaveQueueForUser(deps, fx.captainId).catch(() => undefined);
  await cleanup(fx);
});

describe("US4 matchmaking + solo match (FR-010, FR-012, FR-013)", () => {
  it("pairs a queued solo with a queued team within the rating band", async () => {
    const r1 = await joinAsSolo(deps, fx.soloId, Date.now());
    expect(r1.queued).toBe(true);

    const r2 = await joinAsTeam(deps, fx.teamId, fx.captainId, Date.now());
    expect(r2.queued).toBe(false);
    expect(r2.mode).toBe("SOLO_VS_TEAM");
    expect(r2.matchId).toBeTruthy();

    const match = await db.match.findUnique({
      where: { id: r2.matchId! },
      include: { participants: true },
    });
    expect(match?.mode).toBe("SOLO_VS_TEAM");
    expect(match?.status).toBe("ACTIVE");
    // Solo participant is the captain of their side; the team captain is on the other.
    const soloP = match!.participants.find((p) => p.userId === fx.soloId);
    const capP = match!.participants.find((p) => p.userId === fx.captainId);
    expect(soloP?.isCaptain).toBe(true);
    expect(soloP?.teamColor).not.toBe(capP?.teamColor);
  });

  it("status reports queued, then matched once a pairing forms", async () => {
    await joinAsSolo(deps, fx.soloId, Date.now());
    expect((await statusForUser(deps, fx.soloId)).state).toBe("queued");

    await joinAsTeam(deps, fx.teamId, fx.captainId, Date.now());

    const soloStatus = await statusForUser(deps, fx.soloId);
    expect(soloStatus.state).toBe("matched");
    expect(soloStatus.matchId).toBeTruthy();
  });

  it("a solo move applies directly to the authoritative game, bypassing voting (FR-010)", async () => {
    const match = await createSoloMatch(db, { soloUserId: fx.soloId, teamId: fx.teamId });
    const before = await db.match.findUnique({ where: { id: match.id } });

    const executed = await applyMove({ db, redis }, match.id, { from: "e2", to: "e4" });
    expect(executed.san).toBe("e4");

    const after = await db.match.findUnique({ where: { id: match.id } });
    expect(after?.turn).toBe("BLACK"); // turn passed to the team
    expect(after?.fen).not.toBe(before?.fen);
  });

  it("updates BOTH the team rating and the solo rating on match end (FR-013)", async () => {
    // createSoloMatch places the team on BLACK by default; let the team win.
    const match = await createSoloMatch(db, { soloUserId: fx.soloId, teamId: fx.teamId });
    await endMatch({ db }, match.id, { winner: "BLACK", reason: "forfeit" });

    const teamRating = await db.rating.findUnique({ where: { teamId: fx.teamId } });
    const soloRating = await db.rating.findUnique({ where: { userId: fx.soloId } });
    expect(teamRating?.wins).toBe(1);
    expect(teamRating?.rating).toBeGreaterThan(1200);
    expect(soloRating?.losses).toBe(1);
    expect(soloRating?.rating).toBeLessThan(1200);
  });
});
