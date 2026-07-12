import type { PrismaClient, MatchWinner, TeamColor } from "@prisma/client";
import type { Server } from "socket.io";
import { applyElo, type EloSide } from "../matchmaking/rating.js";
import { matchRoom } from "../realtime/io.js";

export interface MatchDeps {
  db: PrismaClient;
  io?: Server;
}

export interface MatchOutcome {
  winner: MatchWinner;
  reason: "checkmate" | "stalemate" | "draw" | "resignation" | "timeout" | "aborted" | "forfeit";
}

function recordOutcome(score: 1 | 0.5 | 0) {
  return {
    wins: { increment: score === 1 ? 1 : 0 },
    losses: { increment: score === 0 ? 1 : 0 },
    draws: { increment: score === 0.5 ? 1 : 0 },
    provisionalGames: { increment: 1 },
  };
}

function scoreFor(winner: MatchWinner, color: TeamColor): 1 | 0.5 | 0 {
  if (winner === "DRAW") return 0.5;
  return winner === color ? 1 : 0;
}

/**
 * Finalizes a match: sets status COMPLETED + winner + endedAt, applies ELO to
 * both rated subjects (team-vs-team: both team ratings; solo-vs-team: the team
 * rating vs the solo player's SOLO rating — FR-013), and emits `match_end`.
 */
export async function endMatch(deps: MatchDeps, matchId: string, outcome: MatchOutcome): Promise<void> {
  const { db, io } = deps;
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      whiteTeam: { include: { rating: true } },
      blackTeam: { include: { rating: true } },
      participants: { include: { user: { include: { soloRating: true } } } },
    },
  });
  if (!match) throw new Error("match not found");

  try {
    await db.match.update({
      where: { id: matchId },
      data: { status: "COMPLETED", winner: outcome.winner, endedAt: new Date() },
    });
  } catch (err) {
    // Tolerate a match removed concurrently (e.g. a forfeit racing with teardown)
    // — there is nothing left to finalize, so don't crash the disconnect path.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      return;
    }
    throw err;
  }

  if (match.mode === "TEAM_VS_TEAM") {
    const whiteRating = match.whiteTeam?.rating;
    const blackRating = match.blackTeam?.rating;
    if (whiteRating && blackRating && match.whiteTeam && match.blackTeam) {
      const scoreWhite = scoreFor(outcome.winner, "WHITE");
      const next = applyElo(
        { rating: whiteRating.rating, provisionalGames: whiteRating.provisionalGames },
        { rating: blackRating.rating, provisionalGames: blackRating.provisionalGames },
        scoreWhite,
      );
      await db.rating.update({ where: { teamId: match.whiteTeam.id }, data: { rating: next.a, ...recordOutcome(scoreWhite) } });
      await db.rating.update({ where: { teamId: match.blackTeam.id }, data: { rating: next.b, ...recordOutcome(scoreFor(outcome.winner, "BLACK")) } });
    }
  } else if (match.mode === "SOLO_VS_TEAM") {
    // The team sits on whichever color has a team id; the solo player is the
    // opposite-color participant. Apply ELO between the team rating and the
    // solo player's SOLO rating.
    const teamColor: TeamColor | null = match.whiteTeamId ? "WHITE" : match.blackTeamId ? "BLACK" : null;
    if (teamColor) {
      const team = teamColor === "WHITE" ? match.whiteTeam : match.blackTeam;
      const teamRating = team?.rating ?? null;
      const soloColor: TeamColor = teamColor === "WHITE" ? "BLACK" : "WHITE";
      const soloParticipant = match.participants.find((p) => p.teamColor === soloColor);
      const soloUser = soloParticipant?.user ?? null;
      if (team && teamRating && soloUser) {
        let soloRating = soloUser.soloRating;
        if (!soloRating) {
          soloRating = await db.rating.create({ data: { subjectType: "SOLO", userId: soloUser.id } });
        }
        const scoreTeam = scoreFor(outcome.winner, teamColor);
        const next = applyElo(
          { rating: teamRating.rating, provisionalGames: teamRating.provisionalGames },
          { rating: soloRating.rating, provisionalGames: soloRating.provisionalGames },
          scoreTeam,
        );
        const scoreSolo = scoreFor(outcome.winner, soloColor);
        await db.rating.update({ where: { teamId: team.id }, data: { rating: next.a, ...recordOutcome(scoreTeam) } });
        await db.rating.update({ where: { userId: soloUser.id }, data: { rating: next.b, ...recordOutcome(scoreSolo) } });
      }
    }
  }

  io?.to(matchRoom(matchId)).emit("match_end", {
    winner: outcome.winner.toLowerCase(),
    reason: outcome.reason,
  });
}
