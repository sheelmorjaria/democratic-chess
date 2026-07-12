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

const setKey = (type: string) => `queue:${type}`;
const entryKey = (type: string, subjectId: string) => `queue:${type}:entry:${subjectId}`;

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
