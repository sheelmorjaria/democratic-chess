"use client";

import { Chessboard } from "react-chessboard";

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
        onPieceDrop={(sourceSquare, targetSquare, piece) => {
          const promotion = isPromotion(piece, targetSquare) ? "q" : undefined;
          onPropose(sourceSquare, targetSquare, promotion);
          return true;
        }}
      />
    </div>
  );
}
