"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import Board from "@/components/Board";
import VotingSidebar, { type ProposalView } from "@/components/VotingSidebar";
import TeamChat, { type ChatMessage } from "@/components/TeamChat";

interface MatchStart {
  matchId: string;
  youAre: "white" | "black";
  fen: string;
  moveWindowSec: number;
}

export default function MatchPage() {
  const params = useParams();
  const matchId = String((params as { id?: string }).id ?? "");
  const router = useRouter();

  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [color, setColor] = useState<"white" | "black">("white");
  const [turnColor, setTurnColor] = useState<"white" | "black" | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [tallies, setTallies] = useState<Record<string, number>>({});
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      router.replace("/login");
      return;
    }
    socket.emit("join_match", { matchId });

    const onMatchStart = (data: MatchStart) => {
      setFen(data.fen);
      setColor(data.youAre);
    };
    const onTurnStart = (data: { color: "white" | "black"; deadlineAt: string }) => {
      setTurnColor(data.color);
      setDeadline(data.deadlineAt);
    };
    const onProposal = (p: ProposalView) => setProposals((prev) => [...prev, p]);
    const onVoteUpdate = (data: { tallies: { moveKey: string; count: number }[] }) => {
      const next: Record<string, number> = {};
      for (const t of data.tallies) next[t.moveKey] = t.count;
      setTallies(next);
    };
    const onMoveExecuted = (data: { fen: string }) => {
      setFen(data.fen);
      setProposals([]);
      setTallies({});
    };
    const onChat = (m: ChatMessage) => setChats((prev) => [...prev, m]);
    const onMatchEnd = (data: { winner: string; reason: string }) =>
      setOver(`Match over: ${data.winner} (${data.reason})`);
    const onError = (data: { message: string }) => setError(data.message);

    socket.on("match_start", onMatchStart);
    socket.on("turn_start", onTurnStart);
    socket.on("new_proposal", onProposal);
    socket.on("vote_update", onVoteUpdate);
    socket.on("move_executed", onMoveExecuted);
    socket.on("chat_message", onChat);
    socket.on("match_end", onMatchEnd);
    socket.on("error", onError);

    return () => {
      socket.off("match_start", onMatchStart);
      socket.off("turn_start", onTurnStart);
      socket.off("new_proposal", onProposal);
      socket.off("vote_update", onVoteUpdate);
      socket.off("move_executed", onMoveExecuted);
      socket.off("chat_message", onChat);
      socket.off("match_end", onMatchEnd);
      socket.off("error", onError);
    };
  }, [matchId, router]);

  const myTurn = color === turnColor;

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Match {matchId.slice(0, 8)}…</h1>
      <p>You are <strong>{color}</strong>. {turnColor ? `${turnColor} to move` : ""}</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {over && <p style={{ color: "green" }}>{over}</p>}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 480 }}>
          <Board
            fen={fen}
            myTurn={myTurn}
            orientation={color}
            onPropose={(from, to, promotion) =>
              getSocket()?.emit("propose_move", { matchId, from, to, promotion })
            }
          />
        </div>
        <VotingSidebar
          proposals={proposals}
          tallies={tallies}
          myTurn={myTurn}
          turnColor={turnColor}
          deadline={deadline}
          onVote={(moveKey) => getSocket()?.emit("vote_move", { matchId, moveKey })}
        />
        <TeamChat
          messages={chats}
          onSend={(message) => getSocket()?.emit("send_chat_message", { matchId, message })}
        />
      </div>
    </main>
  );
}
