import type { Redis } from "ioredis";

/**
 * Ephemeral per-turn match state in Redis (constitution: single source of
 * truth for the hot voting path). See data-model.md "Redis Entities".
 *
 * Keys are namespaced per match + turn; duplicate proposals collapse on the
 * move key, and each member has at most one (changeable) vote per turn.
 */

export interface ProposalRecord {
  id: string;
  proposerUserId: string;
  san: string;
  from: string;
  to: string;
  promotion?: string;
  /** Server-set timestamp used for tie-break ordering (earliest proposed). */
  proposedAt?: number;
}

export interface Tally {
  moveKey: string;
  count: number;
}

const proposalsKey = (matchId: string, turn: number) =>
  `match:${matchId}:turn:${turn}:proposals`;
const votesKey = (matchId: string, turn: number, moveKey: string) =>
  `match:${matchId}:turn:${turn}:votes:${moveKey}`;
const voterChoiceKey = (matchId: string, turn: number) =>
  `match:${matchId}:turn:${turn}:voterChoice`;
const votersKey = (matchId: string, turn: number) =>
  `match:${matchId}:turn:${turn}:voters`;
const timerKey = (matchId: string, turn: number) =>
  `match:${matchId}:turn:${turn}:expiresAt`;
const presenceKey = (matchId: string, color: string) =>
  `match:${matchId}:${color}:presence`;

/** Adds a proposal. Returns true if newly created, false if a duplicate move key collapsed. */
export async function addProposal(
  r: Redis,
  matchId: string,
  turn: number,
  moveKey: string,
  record: ProposalRecord,
): Promise<boolean> {
  const stored: ProposalRecord = { ...record, proposedAt: Date.now() };
  const wasSet = await r.hsetnx(proposalsKey(matchId, turn), moveKey, JSON.stringify(stored));
  return wasSet === 1;
}

export async function getProposals(
  r: Redis,
  matchId: string,
  turn: number,
): Promise<Record<string, ProposalRecord>> {
  const all = await r.hgetall(proposalsKey(matchId, turn));
  const out: Record<string, ProposalRecord> = {};
  for (const [key, value] of Object.entries(all)) {
    out[key] = JSON.parse(value) as ProposalRecord;
  }
  return out;
}

/**
 * Casts (or changes) a member's single vote. Removing the prior choice keeps
 * tallies correct when a voter switches proposals.
 */
export async function castVote(
  r: Redis,
  matchId: string,
  turn: number,
  userId: string,
  moveKey: string,
): Promise<void> {
  const previous = await r.hget(voterChoiceKey(matchId, turn), userId);
  if (previous && previous !== moveKey) {
    await r.srem(votesKey(matchId, turn, previous), userId);
  }
  await r.hset(voterChoiceKey(matchId, turn), userId, moveKey);
  await r.sadd(votesKey(matchId, turn, moveKey), userId);
  await r.sadd(votersKey(matchId, turn), userId);
}

export async function getTallies(
  r: Redis,
  matchId: string,
  turn: number,
): Promise<Tally[]> {
  const proposals = await r.hgetall(proposalsKey(matchId, turn));
  const out: Tally[] = [];
  for (const moveKey of Object.keys(proposals)) {
    const count = await r.scard(votesKey(matchId, turn, moveKey));
    out.push({ moveKey, count });
  }
  return out;
}

export async function getVoterChoice(
  r: Redis,
  matchId: string,
  turn: number,
  userId: string,
): Promise<string | null> {
  return r.hget(voterChoiceKey(matchId, turn), userId);
}

export async function getLeading(
  r: Redis,
  matchId: string,
  turn: number,
): Promise<Tally | null> {
  const tallies = await getTallies(r, matchId, turn);
  if (tallies.length === 0) return null;
  let best = tallies[0] as Tally;
  for (const tally of tallies) {
    if (tally.count > best.count) best = tally;
  }
  return best;
}

export async function armTurnTimer(
  r: Redis,
  matchId: string,
  turn: number,
  seconds: number,
): Promise<void> {
  await r.set(timerKey(matchId, turn), String(turn), "EX", seconds);
}

export async function addPresence(
  r: Redis,
  matchId: string,
  color: string,
  userId: string,
): Promise<void> {
  await r.sadd(presenceKey(matchId, color), userId);
}

export async function removePresence(
  r: Redis,
  matchId: string,
  color: string,
  userId: string,
): Promise<number> {
  return r.srem(presenceKey(matchId, color), userId);
}

export async function presenceCount(
  r: Redis,
  matchId: string,
  color: string,
): Promise<number> {
  return r.scard(presenceKey(matchId, color));
}

/** Clears all keys for a turn (call when the turn resolves). */
export async function clearTurn(
  r: Redis,
  matchId: string,
  turn: number,
): Promise<void> {
  const proposals = await r.hgetall(proposalsKey(matchId, turn));
  const keys: string[] = [
    proposalsKey(matchId, turn),
    voterChoiceKey(matchId, turn),
    votersKey(matchId, turn),
    timerKey(matchId, turn),
  ];
  for (const moveKey of Object.keys(proposals)) {
    keys.push(votesKey(matchId, turn, moveKey));
  }
  await r.del(...keys);
}
