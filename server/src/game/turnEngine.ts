import type { ProposalRecord, Tally } from "../voting/ephemeral.js";

/**
 * US1 turn resolution. The highest-voted proposal wins; ties are broken by the
 * earliest-proposed move. Returns `empty` only when the ballot has no proposals.
 * (Captain double-weight tie-break is layered on in US3 / T034.)
 */

export interface TurnResolution {
  moveKey: string | null;
  reason: "leading" | "empty";
}

export function resolveLeading(
  proposals: Record<string, ProposalRecord>,
  tallies: Tally[],
): TurnResolution {
  const keys = Object.keys(proposals);
  if (keys.length === 0) return { moveKey: null, reason: "empty" };

  const counts = new Map<string, number>();
  for (const tally of tallies) counts.set(tally.moveKey, tally.count);

  let bestKey = keys[0] as string;
  let bestCount = counts.get(bestKey) ?? 0;

  for (const key of keys) {
    const count = counts.get(key) ?? 0;
    const isHigher = count > bestCount;
    const isTieButEarlier = count === bestCount && proposedAt(proposals, key) < proposedAt(proposals, bestKey);
    if (isHigher || isTieButEarlier) {
      bestKey = key;
      bestCount = count;
    }
  }

  return { moveKey: bestKey, reason: "leading" };
}

function proposedAt(proposals: Record<string, ProposalRecord>, key: string): number {
  return proposals[key]?.proposedAt ?? 0;
}
