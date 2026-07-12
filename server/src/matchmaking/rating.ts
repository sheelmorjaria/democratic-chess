/**
 * ELO rating (research.md R5). Initial 1200; K=32 while provisional (first 30
 * games), then K=24. Applied per team and per solo player.
 */

export const INITIAL_RATING = 1200;
export const PROVISIONAL_GAMES = 30;

export function kFactor(provisionalGames: number): number {
  return provisionalGames < PROVISIONAL_GAMES ? 32 : 24;
}

export interface EloSide {
  rating: number;
  provisionalGames: number;
}

export interface EloResult {
  a: number;
  b: number;
}

/** `scoreA` is 1 (A wins), 0.5 (draw), or 0 (A loses). */
export function applyElo(a: EloSide, b: EloSide, scoreA: 1 | 0.5 | 0): EloResult {
  const expectedA = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
  const expectedB = 1 - expectedA;
  const newA = Math.round(a.rating + kFactor(a.provisionalGames) * (scoreA - expectedA));
  const newB = Math.round(b.rating + kFactor(b.provisionalGames) * ((1 - scoreA) - expectedB));
  return { a: newA, b: newB };
}
