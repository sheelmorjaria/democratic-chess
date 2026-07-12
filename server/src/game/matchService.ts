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

export interface CreateSoloMatchInput {
  /** The lone player. */
  soloUserId: string;
  /** The team they challenge. */
  teamId: string;
  /** Which color the solo player takes (defaults to WHITE). */
  soloColor?: "WHITE" | "BLACK";
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

  // A user can't sit on both sides of the same match (unique (matchId, userId)).
  const whiteUserIds = new Set(white.members.map((m) => m.userId));
  if (black.members.some((m) => whiteUserIds.has(m.userId))) {
    throw new MatchServiceError(
      "overlapping_rosters",
      "a player is on both teams — challenge two teams with disjoint rosters",
    );
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

/**
 * Creates a Solo vs Team match (FR-001/FR-010). The solo player is seeded as the
 * sole participant + captain on `soloColor`; the team's roster is seeded on the
 * opposite color. The solo side's team id stays null (how `soloColor`/`isSoloSide`
 * identify it later). A SOLO rating is ensured for the solo player if missing.
 */
export async function createSoloMatch(
  db: PrismaClient,
  input: CreateSoloMatchInput,
): Promise<Match> {
  const team = await db.team.findUnique({ where: { id: input.teamId }, include: { members: true } });
  if (!team) throw new MatchServiceError("team_not_found", "team not found");

  const soloColor = input.soloColor ?? "WHITE";
  const teamColor: "WHITE" | "BLACK" = soloColor === "WHITE" ? "BLACK" : "WHITE";
  const timeBank = input.timeBankMs ?? 600_000;

  const match = await db.match.create({
    data: {
      mode: "SOLO_VS_TEAM",
      status: "ACTIVE",
      fen: START_FEN,
      turn: "WHITE",
      moveWindowSec: input.moveWindowSec ?? 60,
      whiteTimeRemainingMs: timeBank,
      blackTimeRemainingMs: timeBank,
      whiteTeamId: teamColor === "WHITE" ? team.id : null,
      blackTeamId: teamColor === "BLACK" ? team.id : null,
      participants: {
        create: [
          {
            userId: input.soloUserId,
            teamColor: soloColor,
            isCaptain: true,
          },
          ...team.members.map((member) => ({
            userId: member.userId,
            teamColor: teamColor,
            isCaptain: member.role === "CAPTAIN",
          })),
        ],
      },
    },
  });

  // Ensure the solo player has a SOLO rating to update on match_end.
  await db.rating.upsert({
    where: { userId: input.soloUserId },
    create: { subjectType: "SOLO", userId: input.soloUserId },
    update: {},
  });

  return match;
}
