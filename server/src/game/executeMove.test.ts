import { afterEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { getPrisma } from "../db/prisma.js";
import { getRedis } from "../db/redis.js";
import { addProposal } from "../voting/ephemeral.js";
import { createTeamMatch } from "./matchService.js";
import { executeMove } from "./executeMove.js";

const db: PrismaClient = getPrisma();
const redis: Redis = getRedis();

interface Seed {
  matchId: string;
  whiteTeamId: string;
  blackTeamId: string;
  whiteUserId: string;
  blackUserId: string;
}

async function seed(): Promise<Seed> {
  const suffix = crypto.randomUUID();
  const whiteUser = await db.user.create({
    data: { username: `w_${suffix}`, email: `w_${suffix}@e.com`, passwordHash: "x" },
  });
  const blackUser = await db.user.create({
    data: { username: `b_${suffix}`, email: `b_${suffix}@e.com`, passwordHash: "x" },
  });
  const whiteTeam = await db.team.create({
    data: {
      name: `White ${suffix}`,
      captainId: whiteUser.id,
      members: { create: { userId: whiteUser.id, role: "CAPTAIN" } },
      rating: { create: { subjectType: "TEAM", rating: 1200 } },
    },
  });
  const blackTeam = await db.team.create({
    data: {
      name: `Black ${suffix}`,
      captainId: blackUser.id,
      members: { create: { userId: blackUser.id, role: "CAPTAIN" } },
      rating: { create: { subjectType: "TEAM", rating: 1200 } },
    },
  });
  const match = await createTeamMatch(db, { whiteTeamId: whiteTeam.id, blackTeamId: blackTeam.id });
  return {
    matchId: match.id,
    whiteTeamId: whiteTeam.id,
    blackTeamId: blackTeam.id,
    whiteUserId: whiteUser.id,
    blackUserId: blackUser.id,
  };
}

async function cleanup(s: Seed): Promise<void> {
  await db.matchParticipant.deleteMany({ where: { matchId: s.matchId } });
  await db.match.deleteMany({ where: { id: s.matchId } });
  await db.rating.deleteMany({ where: { teamId: { in: [s.whiteTeamId, s.blackTeamId] } } });
  await db.teamMembership.deleteMany({ where: { teamId: { in: [s.whiteTeamId, s.blackTeamId] } } });
  await db.team.deleteMany({ where: { id: { in: [s.whiteTeamId, s.blackTeamId] } } });
  await db.user.deleteMany({ where: { id: { in: [s.whiteUserId, s.blackUserId] } } });
}

async function proposeAndExecute(matchId: string, turnNumber: number, moveKey: string, from: string, to: string, proposer: string): Promise<void> {
  await addProposal(redis, matchId, turnNumber, moveKey, {
    id: crypto.randomUUID(),
    proposerUserId: proposer,
    san: "",
    from,
    to,
  });
  await executeMove({ db, redis }, matchId, moveKey);
}

describe("executeMove (DB-level)", () => {
  let s: Seed;
  afterEach(async () => {
    if (s) await cleanup(s);
  });

  it("applies the winning proposal and flips the turn", async () => {
    s = await seed();
    await proposeAndExecute(s.matchId, 1, "e2:e4:-", "e2", "e4", s.whiteUserId);

    const match = await db.match.findUnique({ where: { id: s.matchId } });
    expect(match?.turn).toBe("BLACK");
    expect(match?.turnNumber).toBe(2);
    expect(match?.fen).not.toContain(" w "); // no longer white to move
  });

  it("plays fool's mate to completion and updates both ratings", async () => {
    s = await seed();
    await proposeAndExecute(s.matchId, 1, "f2:f3:-", "f2", "f3", s.whiteUserId);
    await proposeAndExecute(s.matchId, 2, "e7:e5:-", "e7", "e5", s.blackUserId);
    await proposeAndExecute(s.matchId, 3, "g2:g4:-", "g2", "g4", s.whiteUserId);
    await proposeAndExecute(s.matchId, 4, "d8:h4:-", "d8", "h4", s.blackUserId);

    const match = await db.match.findUnique({ where: { id: s.matchId } });
    expect(match?.status).toBe("COMPLETED");
    expect(match?.winner).toBe("BLACK");

    const whiteRating = await db.rating.findUnique({ where: { teamId: s.whiteTeamId } });
    const blackRating = await db.rating.findUnique({ where: { teamId: s.blackTeamId } });
    expect(whiteRating?.rating).toBeLessThan(1200);
    expect(blackRating?.rating).toBeGreaterThan(1200);
    expect(blackRating?.wins).toBe(1);
    expect(whiteRating?.losses).toBe(1);
  });
});
