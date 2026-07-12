import { z } from "zod";

export const TeamColor = z.enum(["white", "black"]);
export type TeamColor = z.infer<typeof TeamColor>;

export const MatchMode = z.enum(["TEAM_VS_TEAM", "SOLO_VS_TEAM"]);
export type MatchMode = z.infer<typeof MatchMode>;

export const MatchStatus = z.enum(["WAITING", "ACTIVE", "COMPLETED", "ABORTED"]);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const MatchWinner = z.enum(["WHITE", "BLACK", "DRAW"]);
export type MatchWinner = z.infer<typeof MatchWinner>;

export const RatingSubjectType = z.enum(["TEAM", "SOLO"]);
export type RatingSubjectType = z.infer<typeof RatingSubjectType>;

export const Promotion = z.enum(["q", "r", "b", "n"]);
export type Promotion = z.infer<typeof Promotion>;

/** A board square, e.g. "e4". Kept as a branded string for transport. */
export type Square = string;
