import type { PrismaClient, Match } from "@prisma/client";
import { START_FEN } from "./engine.js";

export class MatchServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface CreateTeamMatchInput {
  whiteTeamId: string;
  blackTeamId: string;
  moveWindowSec?: number;
  timeBankMs?: number;
}

/**
 * Creates a Team vs Team match (direct challenge), seeds the start FEN and time
 * banks, and creates a MatchParticipant row for each roster member with their
 * color and captain flag. Status starts ACTIVE (see data-model.md state machine).
 */
export async function createTeamMatch(
  db: PrismaClient,
  input: CreateTeamMatchInput,
): Promise<Match> {
  const [white, black] = await Promise.all([
    db.team.findUnique({ where: { id: input.whiteTeamId }, include: { members: true } }),
    db.team.findUnique({ where: { id: input.blackTeamId }, include: { members: true } }),
  ]);
  if (!white || !black) {
    throw new MatchServiceError("team_not_found", "one or both teams not found");
  }

  const timeBank = input.timeBankMs ?? 600_000;
  return db.match.create({
    data: {
      mode: "TEAM_VS_TEAM",
      status: "ACTIVE",
      fen: START_FEN,
      turn: "WHITE",
      moveWindowSec: input.moveWindowSec ?? 60,
      whiteTimeRemainingMs: timeBank,
      blackTimeRemainingMs: timeBank,
      whiteTeamId: white.id,
      blackTeamId: black.id,
      participants: {
        create: [
          ...white.members.map((member) => ({
            userId: member.userId,
            teamColor: "WHITE" as const,
            isCaptain: member.role === "CAPTAIN",
          })),
          ...black.members.map((member) => ({
            userId: member.userId,
            teamColor: "BLACK" as const,
            isCaptain: member.role === "CAPTAIN",
          })),
        ],
      },
    },
  });
}
