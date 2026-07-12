/**
 * Shared domain + realtime types for DemocraticChess.
 *
 * Phase 1 placeholder — full socket-event payloads and entity types arrive in
 * task T012 (Phase 2, see specs/001-democratic-chess/tasks.md).
 */

export const TEAM_COLORS = ["white", "black"] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];

export const MATCH_STATUSES = ["WAITING", "ACTIVE", "COMPLETED", "ABORTED"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_MODES = ["TEAM_VS_TEAM", "SOLO_VS_TEAM"] as const;
export type MatchMode = (typeof MATCH_MODES)[number];
