"use client";

import { useEffect, useState } from "react";
import { Chessboard, ChessboardDnDProvider } from "react-chessboard";

/**
 * The actual react-chessboard mount. Split out so {@link Board} can load it
 * client-only (ssr:false) — react-chessboard v4 touches window/document and
 * needs its DnD provider context + an explicit boardWidth. Width is derived
 * from the viewport (capped at 480) so it's responsive without depending on a
 * parent's width (the board sits in a flex item with no definite width).
 */
interface BoardCanvasProps {
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

  if (width === 0) return null;
  return (
    <div className="dc-board" style={{ touchAction: "none", width, maxWidth: 480 }}>
      <ChessboardDnDProvider>
        <Chessboard
          id="dc-board"
          boardWidth={width}
          position={fen}
          arePiecesDraggable={myTurn}
          boardOrientation={orientation}
          onPieceDrop={(sourceSquare: string, targetSquare: string, piece: string) => {
            const promotion = isPromotion(piece, targetSquare) ? "q" : undefined;
            onPropose(sourceSquare, targetSquare, promotion);
            return true;
          }}
        />
      </ChessboardDnDProvider>
    </div>
  );
}
