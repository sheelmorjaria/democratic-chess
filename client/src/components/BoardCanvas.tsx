"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Chessboard, ChessboardDnDProvider } from "react-chessboard";
import { Chess, type Square as ChessSquare } from "chess.js";
import { useTheme } from "@/lib/theme";

/**
 * The actual react-chessboard mount. Split out so {@link Board} can load it
 * client-only (ssr:false) — react-chessboard v4 touches window/document and
 * needs its DnD provider context + an explicit boardWidth. Width is derived
 * from the viewport (capped at 480) so it's responsive without depending on a
 * parent's width.
 *
 * Square + frame colors, piece glyphs, and move/check highlights all come from
 * the active theme tokens, so the board recolors instantly with the picker.
 * Pieces can be moved by drag OR by click-then-click (better for touch & AT).
 */
interface BoardCanvasProps {
  fen: string;
  myTurn: boolean;
  orientation?: "white" | "black";
  onPropose: (from: string, to: string, promotion?: string) => void;
}

const PIECE_GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const PIECE_KEYS = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const ALL_SQUARES: string[] = RANKS.flatMap((r) => FILES.map((f) => `${f}${r}`));

function isPawnPromotion(type: string, color: "w" | "b", target: string): boolean {
  return type === "p" && (color === "w" ? target[1] === "8" : target[1] === "1");
}

function useBoardWidth(): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => setWidth(Math.min(window.innerWidth - 48, 480));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

export default function BoardCanvas({ fen, myTurn, orientation = "white", onPropose }: BoardCanvasProps) {
  const width = useBoardWidth();
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selection whenever the position changes or turn ownership flips.
  useEffect(() => {
    setSelected(null);
  }, [fen, myTurn]);

  // Authoritative position parser for legal-move hints + click-to-move.
  // Guarded: a bad FEN just disables hints/click (drag still works).
  const game = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  // Per-theme piece renderers — Unicode silhouettes with fill + stroke (+ glow).
  const customPieces = useMemo<Record<string, (args: { squareWidth: number }) => ReactElement>>(() => {
    const map: Record<string, (args: { squareWidth: number }) => ReactElement> = {};
    for (const key of PIECE_KEYS) {
      const color = key[0] === "w" ? "white" : "black";
      const glyph = PIECE_GLYPH[key.slice(1).toLowerCase()] ?? "";
      map[key] = ({ squareWidth }) => {
        const pc = tokens.pieces[color];
        const strokeW = Math.max(1, squareWidth * 0.03);
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              fontSize: squareWidth * 0.82,
              lineHeight: 1,
              color: pc.fill,
              WebkitTextStroke: `${strokeW}px ${pc.stroke}`,
              textShadow: tokens.pieces.glow
                ? `0 0 ${squareWidth * 0.2}px ${tokens.pieces.glow}`
                : undefined,
              userSelect: "none",
              cursor: myTurn ? "grab" : "default",
            }}
          >
            {glyph}
          </div>
        );
      };
    }
    return map;
  }, [tokens, myTurn]);

  // Square highlights: king-in-check (always), selected + legal targets (when a
  // own piece is selected on the mover's turn).
  const squareStyles = useMemo<Record<string, Record<string, string | number>>>(() => {
    const styles: Record<string, Record<string, string | number>> = {};
    if (!game) return styles;

    if (game.inCheck()) {
      const side = game.turn();
      for (const sq of ALL_SQUARES) {
        const p = game.get(sq as ChessSquare);
        if (p && p.type === "k" && p.color === side) {
          styles[sq] = { background: `radial-gradient(circle, ${tokens.highlight.check} 40%, transparent 72%)` };
          break;
        }
      }
    }

    if (selected && game.get(selected as ChessSquare)) {
      styles[selected] = {
        ...(styles[selected] ?? {}),
        boxShadow: `inset 0 0 0 ${Math.max(2, width * 0.045)}px ${tokens.accent}`,
      };
      for (const m of game.moves({ square: selected as ChessSquare, verbose: true })) {
        const capture = !!m.captured || m.flags.includes("c") || m.flags.includes("e");
        styles[m.to] = {
          background: capture
            ? `radial-gradient(circle, transparent 64%, ${tokens.highlight.legalDot} 66%)`
            : `radial-gradient(circle, ${tokens.highlight.legalDot} 22%, transparent 23%)`,
        };
      }
    }

    return styles;
  }, [game, selected, tokens, width]);

  function handleSquareClick(square: string, piece: string | undefined) {
    if (!myTurn || !game) {
      setSelected(null);
      return;
    }
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      // Clicking another own piece re-selects instead of proposing.
      if (piece && piece[0] === game.turn()) {
        setSelected(square);
        return;
      }
      const legal = game
        .moves({ square: selected as ChessSquare, verbose: true })
        .some((m) => m.to === square);
      if (legal) {
        const fromPc = game.get(selected as ChessSquare);
        const promo =
          fromPc && isPawnPromotion(fromPc.type, fromPc.color, square) ? "q" : undefined;
        onPropose(selected, square, promo);
      }
      setSelected(null);
      return;
    }
    if (piece && piece[0] === game.turn()) setSelected(square);
  }

  if (width === 0) return null;
  return (
    <div
      className="dc-board"
      role="img"
      aria-label={`Chessboard. ${myTurn ? "Your turn." : "Waiting for opponent."}`}
      style={{ touchAction: "none", width, maxWidth: 480 }}
    >
      <ChessboardDnDProvider>
        <Chessboard
          id="dc-board"
          boardWidth={width}
          position={fen}
          arePiecesDraggable={myTurn}
          boardOrientation={orientation}
          customLightSquareStyle={{ backgroundColor: tokens.board.light }}
          customDarkSquareStyle={{ backgroundColor: tokens.board.dark }}
          customBoardStyle={{
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "var(--shadow)",
            border: `1px solid ${tokens.board.border}`,
          }}
          customPieces={customPieces}
          customSquareStyles={squareStyles}
          onSquareClick={handleSquareClick}
          onPieceDrop={(sourceSquare: string, targetSquare: string, piece: string) => {
            const promotion = isDragPromotion(piece, targetSquare) ? "q" : undefined;
            onPropose(sourceSquare, targetSquare, promotion);
            return true;
          }}
        />
      </ChessboardDnDProvider>
    </div>
  );
}

/** Drag path uses react-chessboard's piece string (e.g. "wP"). */
function isDragPromotion(piece: string, target: string): boolean {
  const isPawn = piece[1] === "P";
  const color = piece[0];
  return isPawn && (color === "w" ? target[1] === "8" : target[1] === "1");
}
