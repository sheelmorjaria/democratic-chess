import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import { createSoloMatch, createTeamMatch } from "../game/matchService.js";
import { getRuntime } from "../game/runtime.js";
import { userRoom } from "../realtime/io.js";
import { logger } from "../observability/logger.js";
import { INITIAL_RATING } from "./rating.js";
import {
  baseBand,
  clearMatched,
  clearUserQueueState,
  findMatch,
  findSoloVsTeam,
  getMatched,
  getUserQueueState,
  joinQueue,
  leaveQueue,
  setMatched,
  setUserQueueState,
  SOLO_VS_TEAM_SOLO,
  SOLO_VS_TEAM_TEAM,
} from "./queue.js";

export interface MatchmakerDeps {
  db: PrismaClient;
  redis: Redis;
  io: Server;
}

/** SC-007 target: a queued match starts within ~2 min of a full lobby forming. */
export const ESTIMATED_WAIT_SEC = 120;

export interface JoinResult {
  queued: boolean;
  searchBand?: number;
  matchId?: string;
  mode?: string;
}

export interface QueueStatus {
  state: "idle" | "queued" | "matched";
  estimatedWaitSec: number | null;
  matchId?: string;
  mode?: string;
}

async function ratingForSolo(db: PrismaClient, userId: string): Promise<number> {
  const r = await db.rating.findUnique({ where: { userId } });
  return r?.rating ?? INITIAL_RATING;
}

async function ratingForTeam(db: PrismaClient, teamId: string): Promise<number> {
  const r = await db.rating.findUnique({ where: { teamId } });
  return r?.rating ?? INITIAL_RATING;
}

/** Emits `queue_matched` to every relevant player's personal room. */
async function notifyMatched(
  deps: MatchmakerDeps,
  matchId: string,
  mode: string,
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    deps.io.to(userRoom(userId)).emit("queue_matched", { matchId, mode });
  }
}

async function teamMemberIds(deps: MatchmakerDeps, teamId: string): Promise<string[]> {
  const team = await deps.db.team.findUnique({ where: { id: teamId }, include: { members: true } });
  return team?.members.map((m) => m.userId) ?? [];
}

/** Pairs one waiting solo player with one waiting team → creates a SOLO_VS_TEAM match. */
async function tryFormSoloVsTeam(
  deps: MatchmakerDeps,
  now: number,
): Promise<{ solo: string; team: string; matchId: string } | null> {
  const pair = await findSoloVsTeam(deps.redis, now);
  if (!pair) return null;
  const match = await createSoloMatch(deps.db, { soloUserId: pair.solo, teamId: pair.team });
  await setMatched(deps.redis, SOLO_VS_TEAM_SOLO, pair.solo, match.id);
  await setMatched(deps.redis, SOLO_VS_TEAM_TEAM, pair.team, match.id);
  void getRuntime().startMatch(match.id);
  const memberIds = await teamMemberIds(deps, pair.team);
  logger.info({ msg: "queue.paired", mode: "SOLO_VS_TEAM", matchId: match.id, solo: pair.solo, team: pair.team });
  await notifyMatched(deps, match.id, "SOLO_VS_TEAM", [pair.solo, ...memberIds]);
  return { solo: pair.solo, team: pair.team, matchId: match.id };
}

/** Pairs two waiting teams → creates a TEAM_VS_TEAM match. */
async function tryFormTeamVsTeam(
  deps: MatchmakerDeps,
  now: number,
): Promise<{ white: string; black: string; matchId: string } | null> {
  const pair = await findMatch(deps.redis, SOLO_VS_TEAM_TEAM, now);
  if (!pair) return null;
  const match = await createTeamMatch(deps.db, { whiteTeamId: pair.a, blackTeamId: pair.b });
  await setMatched(deps.redis, SOLO_VS_TEAM_TEAM, pair.a, match.id);
  await setMatched(deps.redis, SOLO_VS_TEAM_TEAM, pair.b, match.id);
  void getRuntime().startMatch(match.id);
  const [whiteIds, blackIds] = await Promise.all([
    teamMemberIds(deps, pair.a),
    teamMemberIds(deps, pair.b),
  ]);
  logger.info({ msg: "queue.paired", mode: "TEAM_VS_TEAM", matchId: match.id, white: pair.a, black: pair.b });
  await notifyMatched(deps, match.id, "TEAM_VS_TEAM", [...whiteIds, ...blackIds]);
  return { white: pair.a, black: pair.b, matchId: match.id };
}

/** A solo player enters the queue; paired immediately if a compatible team waits. */
export async function joinAsSolo(deps: MatchmakerDeps, userId: string, now: number): Promise<JoinResult> {
  await deps.db.rating.upsert({
    where: { userId },
    create: { subjectType: "SOLO", userId },
    update: {},
  });
  const rating = await ratingForSolo(deps.db, userId);
  await joinQueue(deps.redis, SOLO_VS_TEAM_SOLO, userId, rating, now);
  await setUserQueueState(deps.redis, userId, { type: SOLO_VS_TEAM_SOLO, subjectId: userId, enqueuedAt: now });

  const formed = await tryFormSoloVsTeam(deps, now);
  if (formed && formed.solo === userId) {
    await clearUserQueueState(deps.redis, userId);
    return { queued: false, matchId: formed.matchId, mode: "SOLO_VS_TEAM" };
  }
  return { queued: true, searchBand: baseBand };
}

/** A team (via its captain) enters the queue; paired with a solo or another team. */
export async function joinAsTeam(
  deps: MatchmakerDeps,
  teamId: string,
  captainUserId: string,
  now: number,
): Promise<JoinResult> {
  const rating = await ratingForTeam(deps.db, teamId);
  await joinQueue(deps.redis, SOLO_VS_TEAM_TEAM, teamId, rating, now);
  await setUserQueueState(deps.redis, captainUserId, {
    type: SOLO_VS_TEAM_TEAM,
    subjectId: teamId,
    enqueuedAt: now,
  });

  // Prefer a waiting solo (SOLO_VS_TEAM), then fall back to another team.
  const soloForm = await tryFormSoloVsTeam(deps, now);
  if (soloForm && soloForm.team === teamId) {
    await clearUserQueueState(deps.redis, captainUserId);
    return { queued: false, matchId: soloForm.matchId, mode: "SOLO_VS_TEAM" };
  }
  const teamForm = await tryFormTeamVsTeam(deps, now);
  if (teamForm && (teamForm.white === teamId || teamForm.black === teamId)) {
    await clearUserQueueState(deps.redis, captainUserId);
    return { queued: false, matchId: teamForm.matchId, mode: "TEAM_VS_TEAM" };
  }
  return { queued: true, searchBand: baseBand };
}

/** Removes the caller's subject from the queue. */
export async function leaveQueueForUser(deps: MatchmakerDeps, userId: string): Promise<void> {
  const state = await getUserQueueState(deps.redis, userId);
  if (!state) return;
  await leaveQueue(deps.redis, state.type, state.subjectId);
  await clearMatched(deps.redis, state.type, state.subjectId);
  await clearUserQueueState(deps.redis, userId);
}

/** Reports idle / queued / matched for the caller. */
export async function statusForUser(deps: MatchmakerDeps, userId: string): Promise<QueueStatus> {
  const state = await getUserQueueState(deps.redis, userId);
  if (!state) return { state: "idle", estimatedWaitSec: null };
  const matchId = await getMatched(deps.redis, state.type, state.subjectId);
  if (matchId) {
    const match = await deps.db.match.findUnique({ where: { id: matchId }, select: { mode: true } });
    return { state: "matched", estimatedWaitSec: 0, matchId, mode: match?.mode };
  }
  return { state: "queued", estimatedWaitSec: ESTIMATED_WAIT_SEC };
}
