import type { PrismaClient, MatchWinner } from "@prisma/client";
import type { Server } from "socket.io";
import { applyElo, type EloSide } from "../matchmaking/rating.js";
import { matchRoom } from "../realtime/io.js";

export interface MatchDeps {
  db: PrismaClient;
  io?: Server;
}

export interface MatchOutcome {
  winner: MatchWinner;
  reason: "checkmate" | "stalemate" | "draw" | "resignation" | "timeout" | "aborted";
}

/**
 * Finalizes a match: sets status COMPLETED + winner + endedAt, applies ELO to
 * both team ratings (Team vs Team), and emits `match_end` to the match room.
 */
export async function endMatch(deps: MatchDeps, matchId: string, outcome: MatchOutcome): Promise<void> {
  const { db, io } = deps;
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      whiteTeam: { include: { rating: true } },
      blackTeam: { include: { rating: true } },
    },
  });
  if (!match) throw new Error("match not found");

  await db.match.update({
    where: { id: matchId },
    data: { status: "COMPLETED", winner: outcome.winner, endedAt: new Date() },
  });

  const whiteRating = match.whiteTeam?.rating;
  const blackRating = match.blackTeam?.rating;
  if (whiteRating && blackRating && match.whiteTeam && match.blackTeam) {
    const scoreWhite: 1 | 0.5 | 0 = outcome.winner === "WHITE" ? 1 : outcome.winner === "BLACK" ? 0 : 0.5;
    const a: EloSide = { rating: whiteRating.rating, provisionalGames: whiteRating.provisionalGames };
    const b: EloSide = { rating: blackRating.rating, provisionalGames: blackRating.provisionalGames };
    const next = applyElo(a, b, scoreWhite);

    await db.rating.update({
      where: { teamId: match.whiteTeam.id },
      data: {
        rating: next.a,
        wins: { increment: scoreWhite === 1 ? 1 : 0 },
        losses: { increment: scoreWhite === 0 ? 1 : 0 },
        draws: { increment: scoreWhite === 0.5 ? 1 : 0 },
        provisionalGames: { increment: 1 },
      },
    });
    await db.rating.update({
      where: { teamId: match.blackTeam.id },
      data: {
        rating: next.b,
        wins: { increment: scoreWhite === 0 ? 1 : 0 },
        losses: { increment: scoreWhite === 1 ? 1 : 0 },
        draws: { increment: scoreWhite === 0.5 ? 1 : 0 },
        provisionalGames: { increment: 1 },
      },
    });
  }

  io?.to(matchRoom(matchId)).emit("match_end", {
    winner: outcome.winner.toLowerCase(),
    reason: outcome.reason,
  });
}
