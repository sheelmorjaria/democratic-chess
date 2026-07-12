import type { Match, TeamColor } from "@prisma/client";

/**
 * US4 / FR-010: in a Solo vs Team match the solo player plays moves directly on
 * their turn, bypassing the propose → vote → execute path entirely. These
 * helpers identify the solo side from the durable `Match` row (the side whose
 * team is null). The actual move application reuses the shared, authoritative
 * `applyMove` (see executeMove.ts) so both paths land on the same single source
 * of truth.
 */

/**
 * The color the solo player sits on, or null if this isn't a well-formed
 * SOLO_VS_TEAM match (exactly one of the team ids must be set).
 */
export function soloColor(match: Pick<Match, "mode" | "whiteTeamId" | "blackTeamId">): TeamColor | null {
  if (match.mode !== "SOLO_VS_TEAM") return null;
  if (match.whiteTeamId == null && match.blackTeamId != null) return "WHITE";
  if (match.blackTeamId == null && match.whiteTeamId != null) return "BLACK";
  return null;
}

/** True when `color` is the solo player's side in a SOLO_VS_TEAM match. */
export function isSoloSide(
  match: Pick<Match, "mode" | "whiteTeamId" | "blackTeamId">,
  color: TeamColor,
): boolean {
  return soloColor(match) === color;
}

/** True when it is currently the solo player's turn. */
export function isSoloTurn(match: Pick<Match, "mode" | "whiteTeamId" | "blackTeamId" | "turn">): boolean {
  return soloColor(match) === match.turn;
}
