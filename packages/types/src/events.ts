import { z } from "zod";
import { TeamColor } from "./enums.js";

/**
 * Realtime contract — client -> server payloads.
 * Matches specs/001-democratic-chess/contracts/socket-events.md.
 */

export const ProposeMove = z.object({
  matchId: z.string().uuid(),
  from: z.string().min(2).max(3),
  to: z.string().min(2).max(3),
  promotion: z
    .enum(["q", "r", "b", "n"])
    .optional(),
});
export type ProposeMove = z.infer<typeof ProposeMove>;

export const VoteMove = z.object({
  matchId: z.string().uuid(),
  moveKey: z.string().min(1),
});
export type VoteMove = z.infer<typeof VoteMove>;

export const SendChatMessage = z.object({
  matchId: z.string().uuid(),
  message: z.string().min(1).max(500),
});
export type SendChatMessage = z.infer<typeof SendChatMessage>;

export const ExecuteNow = z.object({
  matchId: z.string().uuid(),
});
export type ExecuteNow = z.infer<typeof ExecuteNow>;

/** Server -> client: the executed move (public, to the whole match room). */
export const MoveExecuted = z.object({
  fen: z.string(),
  san: z.string(),
  from: z.string(),
  to: z.string(),
  color: TeamColor,
  moveKey: z.string(),
});
export type MoveExecuted = z.infer<typeof MoveExecuted>;

export const CLIENT_EVENTS = [
  "propose_move",
  "vote_move",
  "send_chat_message",
  "execute_now",
] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

export const SERVER_EVENTS = [
  "match_start",
  "turn_start",
  "new_proposal",
  "vote_update",
  "chat_message",
  "move_executed",
  "match_end",
  "error",
] as const;
export type ServerEvent = (typeof SERVER_EVENTS)[number];

export function moveKey(from: string, to: string, promotion?: string): string {
  return `${from}:${to}:${promotion ?? "-"}`;
}
