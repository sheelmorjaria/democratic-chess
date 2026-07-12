import { Chess } from "chess.js";
import type { Promotion } from "@democratic-chess/types";

/**
 * Server-authoritative chess engine wrapper (constitution principle I).
 * The single source of FEN truth per match; clients never own one of these.
 */

export interface AppliedMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  fen: string;
  color: "white" | "black";
}

export interface GameStatus {
  over: boolean;
  winner: "white" | "black" | "draw" | null;
  reason: "checkmate" | "stalemate" | "draw" | "ongoing";
}

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export class ChessEngine {
  private readonly chess: Chess;

  constructor(fen: string = START_FEN) {
    // chess.js throws on an invalid FEN — propagate to the caller.
    this.chess = new Chess(fen);
  }

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): "white" | "black" {
    return this.chess.turn() === "w" ? "white" : "black";
  }

  /** Probes a clone so legality checks never mutate the authoritative game. */
  isLegal(from: string, to: string, promotion?: Promotion): boolean {
    try {
      const probe = new Chess(this.chess.fen());
      probe.move({ from, to, promotion });
      return true;
    } catch {
      return false;
    }
  }

  /** Applies a move. Throws if illegal — callers MUST validate first. */
  apply(from: string, to: string, promotion?: Promotion): AppliedMove {
    const move = this.chess.move({ from, to, promotion });
    return {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      san: move.san,
      fen: this.chess.fen(),
      color: move.color === "w" ? "white" : "black",
    };
  }

  /** Evaluates terminal status. The side to move on checkmate has lost. */
  gameStatus(): GameStatus {
    if (this.chess.isCheckmate()) {
      const sideToMove = this.chess.turn() === "w" ? "white" : "black";
      return {
        over: true,
        winner: sideToMove === "white" ? "black" : "white",
        reason: "checkmate",
      };
    }
    if (this.chess.isStalemate()) {
      return { over: true, winner: "draw", reason: "stalemate" };
    }
    if (this.chess.isDraw()) {
      return { over: true, winner: "draw", reason: "draw" };
    }
    return { over: false, winner: null, reason: "ongoing" };
  }
}
