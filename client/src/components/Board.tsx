"use client";

import dynamic from "next/dynamic";

// react-chessboard v4 touches window/document and needs its DnD provider
// context, so the real board lives in BoardCanvas and is loaded client-only
// (ssr:false) — otherwise Next's SSR renders an empty board.
const BoardCanvas = dynamic(() => import("./BoardCanvas"), {
  ssr: false,
  loading: () => <div style={{ height: 480, maxWidth: 480, background: "#eee" }}>Loading board…</div>,
});

export interface BoardProps {
  fen: string;
  myTurn: boolean;
  orientation?: "white" | "black";
  onPropose: (from: string, to: string, promotion?: string) => void;
}

export default function Board(props: BoardProps) {
  return <BoardCanvas {...props} />;
}
