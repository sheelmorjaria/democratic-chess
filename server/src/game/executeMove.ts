import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { ChessEngine, type GameStatus } from "./engine.js";
import { clearTurn, getProposals } from "../voting/ephemeral.js";
import { matchRoom, type Realtime } from "../realtime/io.js";
import { endMatch } from "./matchEnd.js";
import { moveKey as makeMoveKey } from "@democratic-chess/types";

export interface ExecuteDeps {
  db: PrismaClient;
  redis: Redis;
  io?: Realtime;
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

export interface MoveInput {
  from: string;
  to: string;
  promotion?: Promotion;
}

/**
 * Applies a move directly to the authoritative game (the single source of
 * truth — constitution I). Used by BOTH paths: team turns (the winning
 * proposal's move) and solo turns (the solo player's direct move, FR-010).
 *
 * Re-validates legality against the current FEN, advances FEN + turn +
 * turnNumber, clears the turn's ephemeral state, emits `move_executed` to the
 * match room, and finalizes via `endMatch` if the game is over.
 */
export async function applyMove(
  deps: ExecuteDeps,
  matchId: string,
  move: MoveInput,
): Promise<ExecutedMove> {
  const { db, redis, io } = deps;

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("match not found");
  if (match.status !== "ACTIVE") throw new Error(`match not active (${match.status})`);

  const engine = new ChessEngine(match.fen);
  if (!engine.isLegal(move.from, move.to, move.promotion)) {
    throw new IllegalMoveError(`illegal move: ${move.from}-${move.to}`);
  }
  const applied = engine.apply(move.from, move.to, move.promotion);
  const status = engine.gameStatus();
  const turnBefore = match.turnNumber;

  await db.match.update({
    where: { id: matchId },
    data: {
      fen: applied.fen,
      turn: applied.color === "white" ? "BLACK" : "WHITE",
      turnNumber: { increment: 1 },
    },
  });
  await clearTurn(redis, matchId, turnBefore);

  const key = makeMoveKey(applied.from, applied.to, move.promotion);
  const payload = {
    fen: applied.fen,
    san: applied.san,
    from: applied.from,
    to: applied.to,
    color: applied.color,
    moveKey: key,
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

/**
 * Team-turn execution: resolves the winning proposal by move key, then delegates
 * to {@link applyMove}. (Solo turns call `applyMove` directly — see soloTurn.ts.)
 */
export async function executeMove(
  deps: ExecuteDeps,
  matchId: string,
  moveKey: string,
): Promise<ExecutedMove> {
  const { db, redis } = deps;

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("match not found");
  if (match.status !== "ACTIVE") throw new Error(`match not active (${match.status})`);

  const proposals = await getProposals(redis, matchId, match.turnNumber);
  const proposal = proposals[moveKey];
  if (!proposal) throw new Error(`proposal not found: ${moveKey}`);

  return applyMove(deps, matchId, {
    from: proposal.from,
    to: proposal.to,
    promotion: proposal.promotion as Promotion | undefined,
  });
}
