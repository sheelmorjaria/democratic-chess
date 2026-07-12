import type { Redis } from "ioredis";

/**
 * Rating-banded matchmaking queue (research.md R6). Each queue is a Redis
 * sorted set keyed by rating so we can range-scan within a band; the band
 * widens the longer an entry waits, capped. `now` is passed in for deterministic
 * tests (callers pass Date.now()).
 */

const BASE_BAND = 100;
const WIDEN_PER_SECOND = 50;
const MAX_BAND = 600;

export const SOLO_VS_TEAM_SOLO = "SOLO";
export const SOLO_VS_TEAM_TEAM = "TEAM";

const setKey = (type: string) => `queue:${type}`;
const entryKey = (type: string, subjectId: string) => `queue:${type}:entry:${subjectId}`;
const matchedKey = (type: string, subjectId: string) => `queue:${type}:matched:${subjectId}`;
const userStateKey = (userId: string) => `queue:user:${userId}`;

export async function joinQueue(
  r: Redis,
  type: string,
  subjectId: string,
  rating: number,
  now: number,
): Promise<void> {
  await r.hset(entryKey(type, subjectId), {
    rating: String(rating),
    enqueuedAt: String(now),
  });
  await r.zadd(setKey(type), rating, subjectId);
}

export async function leaveQueue(r: Redis, type: string, subjectId: string): Promise<void> {
  await r.zrem(setKey(type), subjectId);
  await r.del(entryKey(type, subjectId));
}

export interface QueuePair {
  a: string;
  b: string;
}

function band(enqueuedAt: number, now: number): number {
  return Math.min(MAX_BAND, BASE_BAND + Math.floor((now - enqueuedAt) / 1000) * WIDEN_PER_SECOND);
}

/** Current (widened) band for a still-queued subject; BASE_BAND before it ages. */
export function bandWidth(enqueuedAt: number, now: number): number {
  return band(enqueuedAt, now);
}

export const baseBand = BASE_BAND;

/** Per-user queue membership, so leave/status resolve without a body. */
export interface UserQueueState {
  type: string;
  subjectId: string;
  enqueuedAt: number;
}

export async function setUserQueueState(
  r: Redis,
  userId: string,
  state: UserQueueState,
): Promise<void> {
  await r.hset(userStateKey(userId), {
    type: state.type,
    subjectId: state.subjectId,
    enqueuedAt: String(state.enqueuedAt),
  });
}

export async function getUserQueueState(r: Redis, userId: string): Promise<UserQueueState | null> {
  const h = await r.hgetall(userStateKey(userId));
  if (!h || !h.subjectId || !h.type) return null;
  return { type: h.type, subjectId: h.subjectId, enqueuedAt: Number(h.enqueuedAt) };
}

export async function clearUserQueueState(r: Redis, userId: string): Promise<void> {
  await r.del(userStateKey(userId));
}

/** Records a formed match against a subject so `/queue/status` can report it. */
export async function setMatched(
  r: Redis,
  type: string,
  subjectId: string,
  matchId: string,
): Promise<void> {
  await r.set(matchedKey(type, subjectId), matchId, "EX", 300);
}

export async function getMatched(r: Redis, type: string, subjectId: string): Promise<string | null> {
  return r.get(matchedKey(type, subjectId));
}

export async function clearMatched(r: Redis, type: string, subjectId: string): Promise<void> {
  await r.del(matchedKey(type, subjectId));
}

/** Scans queued entries and pairs the first two within the older entry's widened band. */
export async function findMatch(r: Redis, type: string, now: number): Promise<QueuePair | null> {
  const members = await r.zrange(setKey(type), 0, -1);
  for (const a of members) {
    const entry = await r.hgetall(entryKey(type, a));
    const rating = Number(entry.rating);
    const currentBand = band(Number(entry.enqueuedAt), now);
    const within = await r.zrangebyscore(setKey(type), rating - currentBand, rating + currentBand);
    for (const b of within) {
      if (b !== a) {
        await leaveQueue(r, type, a);
        await leaveQueue(r, type, b);
        return { a, b };
      }
    }
  }
  return null;
}

export interface SoloTeamPair {
  solo: string;
  team: string;
}

/**
 * US4 cross-type pairing: matches a queued SOLO player against a queued TEAM
 * within the older entry's widened band. Removes both from the queue on success.
 * (Team-vs-team pairing reuses {@link findMatch} with type "TEAM".)
 */
export async function findSoloVsTeam(r: Redis, now: number): Promise<SoloTeamPair | null> {
  const solos = await r.zrange(setKey(SOLO_VS_TEAM_SOLO), 0, -1);
  for (const soloId of solos) {
    const sEntry = await r.hgetall(entryKey(SOLO_VS_TEAM_SOLO, soloId));
    if (!sEntry.rating) continue;
    const sRating = Number(sEntry.rating);
    const sBand = band(Number(sEntry.enqueuedAt), now);
    const teams = await r.zrangebyscore(
      setKey(SOLO_VS_TEAM_TEAM),
      sRating - sBand,
      sRating + sBand,
    );
    for (const teamId of teams) {
      await leaveQueue(r, SOLO_VS_TEAM_SOLO, soloId);
      await leaveQueue(r, SOLO_VS_TEAM_TEAM, teamId);
      return { solo: soloId, team: teamId };
    }
  }
  return null;
}
