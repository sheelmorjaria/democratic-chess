import {
  ExecuteNow,
  ProposeMove,
  SendChatMessage,
  VoteMove,
} from "@democratic-chess/types";

/** zod guards at the socket boundary (constitution: client is never trusted). */

export const validateProposeMove = (input: unknown) => ProposeMove.parse(input);
export const validateVoteMove = (input: unknown) => VoteMove.parse(input);
export const validateSendChatMessage = (input: unknown) => SendChatMessage.parse(input);
export const validateExecuteNow = (input: unknown) => ExecuteNow.parse(input);
