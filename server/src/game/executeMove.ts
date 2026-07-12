import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import { ChessEngine, type GameStatus } from "./engine.js";
import { clearTurn, getProposals } from "../voting/ephemeral.js";
import { matchRoom } from "../realtime/io.js";
import { endMatch } from "./matchEnd.js";

export interface ExecuteDeps {
  db: PrismaClient;
  redis: Redis;
  io?: Server;
}

export interface ExecutedMove {
  fen: string;
  san: string;
  from: string;
  to: string;
  color: "white" | "black";
  moveKey: string;
  status: GameStatus;
}

export class IllegalMoveError extends Error {}

type Promotion = "q" | "r" | "b" | "n";

/**
 * Applies the winning proposal's move to the authoritative game: re-validates
 * legality, advances FEN + turn + turnNumber, clears the turn's ephemeral state,
 * emits `move_executed`, and finalizes via `endMatch` if the game is over.
 */
export async function executeMove(
  deps: ExecuteDeps,
  matchId: string,
  moveKey: string,
): Promise<ExecutedMove> {
  const { db, redis, io } = deps;

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("match not found");
  if (match.status !== "ACTIVE") throw new Error(`match not active (${match.status})`);

  const proposals = await getProposals(redis, matchId, match.turnNumber);
  const proposal = proposals[moveKey];
  if (!proposal) throw new Error(`proposal not found: ${moveKey}`);

  const promotion = proposal.promotion as Promotion | undefined;
  const engine = new ChessEngine(match.fen);
  if (!engine.isLegal(proposal.from, proposal.to, promotion)) {
    throw new IllegalMoveError(`illegal move on ballot: ${moveKey}`);
  }
  const applied = engine.apply(proposal.from, proposal.to, promotion);
  const status = engine.gameStatus();

  await db.match.update({
    where: { id: matchId },
    data: {
      fen: applied.fen,
      turn: applied.color === "white" ? "BLACK" : "WHITE",
      turnNumber: { increment: 1 },
    },
  });
  await clearTurn(redis, matchId, match.turnNumber);

  const payload = {
    fen: applied.fen,
    san: applied.san,
    from: applied.from,
    to: applied.to,
    color: applied.color,
    moveKey,
  };
  io?.to(matchRoom(matchId)).emit("move_executed", payload);

  if (status.over) {
    await endMatch({ db, io }, matchId, {
      winner: status.winner === "draw" ? "DRAW" : status.winner === "white" ? "WHITE" : "BLACK",
      reason: status.reason === "stalemate" ? "stalemate" : status.reason === "draw" ? "draw" : "checkmate",
    });
  }

  return { ...payload, status };
}
