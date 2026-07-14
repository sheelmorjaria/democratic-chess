"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getSocket,
  onConnectionChange,
  setActiveMatch,
  type ConnectionState,
} from "@/lib/socket";
import { getMatch } from "@/lib/api";
import Board from "@/components/Board";
import VotingSidebar, { type ProposalView } from "@/components/VotingSidebar";
import TeamChat, { type ChatMessage } from "@/components/TeamChat";

interface MatchStart {
  matchId: string;
  mode: "TEAM_VS_TEAM" | "SOLO_VS_TEAM";
  youAre: "white" | "black";
  youAreSolo: boolean;
  fen: string;
  moveWindowSec: number;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function MatchPage() {
  const params = useParams();
  const matchId = String((params as { id?: string }).id ?? "");
  const router = useRouter();

  const [fen, setFen] = useState(START_FEN);
  const [color, setColor] = useState<"white" | "black">("white");
  const [youAreSolo, setYouAreSolo] = useState(false);
  const [turnColor, setTurnColor] = useState<"white" | "black" | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [tallies, setTallies] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<ConnectionState>("connecting");

  // Seed authoritative state + register for reconnect-resync, then wire socket events.
  useEffect(() => {
    let cancelled = false;
    setActiveMatch(matchId);
    const unsub = onConnectionChange(setConn);

    // Resync from the single source of truth (handles late load AND reconnect).
    async function resync() {
      try {
        const match = await getMatch(matchId);
        if (cancelled) return;
        setFen(match.fen);
        setTurnColor(match.turn === "WHITE" ? "white" : "black");
        if (match.status !== "ACTIVE") {
          setOver(
            match.winner
              ? `Match over: ${match.winner.toLowerCase()}`
              : `Match ${match.status.toLowerCase()}`,
          );
        }
      } catch {
        if (!cancelled) setError("Couldn't load match state.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void resync();

    const socket = getSocket();
    if (!socket) {
      router.replace("/login");
      return () => {
        unsub();
        setActiveMatch(null);
      };
    }
    socket.emit("join_match", { matchId });

    const onMatchStart = (data: MatchStart) => {
      setFen(data.fen);
      setColor(data.youAre);
      setYouAreSolo(!!data.youAreSolo);
      setLoading(false);
    };
    const onTurnStart = (data: { color: "white" | "black"; deadlineAt: string }) => {
      setTurnColor(data.color);
      setDeadline(data.deadlineAt);
      setMyVote(null); // fresh ballot each turn
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
      setMyVote(null);
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
      cancelled = true;
      unsub();
      setActiveMatch(null);
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
  const reconnecting = conn === "reconnecting" || conn === "disconnected";

  if (loading) {
    return (
      <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Match {matchId.slice(0, 8)}…</h1>
        <p>Loading match…</p>
      </main>
    );
  }

  // Terminal state: the match is over — show the result + final position, no ballot.
  if (over) {
    return (
      <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Match {matchId.slice(0, 8)}…</h1>
        <p style={{ color: "green", fontWeight: 600, fontSize: "1.1rem" }}>{over}</p>
        <p>
          <button onClick={() => router.push("/lobby")} style={{ marginRight: 8 }}>
            ← Back to lobby
          </button>
          <button onClick={() => router.push("/leaderboard")}>Leaderboard</button>
        </p>
        <div style={{ maxWidth: 480, marginTop: "1rem" }}>
          <Board fen={fen} myTurn={false} orientation={color} onPropose={() => undefined} />
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Match {matchId.slice(0, 8)}…</h1>
      <p>
        You are <strong>{color}</strong>.{" "}
        {youAreSolo ? "Solo vs Team — " : ""}
        {turnColor ? `${turnColor} to move` : ""}
      </p>
      {reconnecting && (
        <p style={{ color: "darkorange" }}>Connection lost — reconnecting…</p>
      )}
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
        {/* Solo player: no ballot/chat — they see only executed moves (AC2). */}
        {!youAreSolo && (
          <>
            <VotingSidebar
              proposals={proposals}
              tallies={tallies}
              myTurn={myTurn}
              turnColor={turnColor}
              deadline={deadline}
              myVote={myVote}
              onVote={(moveKey) => {
                setMyVote(moveKey);
                getSocket()?.emit("vote_move", { matchId, moveKey });
              }}
            />
            <TeamChat
              messages={chats}
              onSend={(message) => getSocket()?.emit("send_chat_message", { matchId, message })}
            />
          </>
        )}
      </div>
    </main>
  );
}
