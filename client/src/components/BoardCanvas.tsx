"use client";

import { useEffect, useRef, useState } from "react";
import { Chessboard, ChessboardDnDProvider } from "react-chessboard";

/**
 * The actual react-chessboard mount. Split out so {@link Board} can load it
 * client-only (ssr:false) — react-chessboard v4 touches window/document and
 * needs its DnD provider context. Measures its container so the board is
 * responsive up to 480px.
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

export default function BoardCanvas({ fen, myTurn, orientation = "white", onPropose }: BoardCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="dc-board" style={{ touchAction: "none", width: "100%", maxWidth: 480 }}>
      {width > 0 && (
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
      )}
    </div>
  );
}
