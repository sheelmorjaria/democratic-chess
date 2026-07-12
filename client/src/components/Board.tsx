"use client";

import dynamic from "next/dynamic";

// react-chessboard touches `window`/`document` at render, so it must not run
// during Next's server-side pre-render — load it client-only, else the board
// renders empty while the rest of the page is fine.
const Chessboard = dynamic(() => import("react-chessboard").then((m) => m.Chessboard), {
  ssr: false,
  loading: () => <div style={{ height: 480, maxWidth: 480, background: "#eee" }}>Loading board…</div>,
});

interface BoardProps {
  fen: string;
  myTurn: boolean;
  orientation?: "white" | "black";
  onPropose: (from: string, to: string, promotion?: string) => void;
}

function isPromotion(piece: string, target: string): boolean {
  const isPawn = piece[1] === "P";
  const color = piece[0];
  return isPawn && (color === "w" ? target[1] === "8" : target[1] === "1");
}

export default function Board({ fen, myTurn, orientation = "white", onPropose }: BoardProps) {
  return (
    <div className="dc-board" style={{ touchAction: "none", maxWidth: 480 }}>
      <Chessboard
        id="dc-board"
        position={fen}
        arePiecesDraggable={myTurn}
        boardOrientation={orientation}
        onPieceDrop={(sourceSquare: string, targetSquare: string, piece: string) => {
          const promotion = isPromotion(piece, targetSquare) ? "q" : undefined;
          onPropose(sourceSquare, targetSquare, promotion);
          return true;
        }}
      />
    </div>
  );
}
