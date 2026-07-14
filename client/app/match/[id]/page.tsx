"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";

interface MatchStart {
  matchId: string;
  mode: "TEAM_VS_TEAM" | "SOLO_VS_TEAM";
  youAre: "white" | "black";
  youAreSolo: boolean;
  fen: string;
  moveWindowSec: number;
  /** This member's current vote for the active turn (null if none). Survives refresh. */
  myVote?: string | null;
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
  const [now, setNow] = useState(() => Date.now());

  // Live countdown of the voting/turn window.
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);

  const remaining =
    deadline != null ? Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000)) : null;
  const mmss =
    remaining != null
      ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
      : null;

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
      setMyVote(data.myVote ?? null);
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
      <div className="dc-row">
        <Spinner /> Loading match {matchId.slice(0, 8)}…
      </div>
    );
  }

  // Terminal state: the match is over — show the result + final position, no ballot.
  if (over) {
    return (
      <>
        <h1 className="dc-pagehead__title" style={{ marginBottom: 12 }}>
          Match {matchId.slice(0, 8)}…
        </h1>
        <div style={{ marginBottom: 16 }}>
          <Banner tone="success">{over}</Banner>
        </div>
        <div className="dc-row" style={{ marginBottom: 16 }}>
          <Link href="/lobby" className="dc-btn dc-btn--secondary">
            ← Back to lobby
          </Link>
          <Link href="/leaderboard" className="dc-btn dc-btn--ghost">
            Leaderboard
          </Link>
        </div>
        <div className="dc-boardwrap">
          <Board fen={fen} myTurn={false} orientation={color} onPropose={() => undefined} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="dc-status">
        <div className="dc-row" style={{ flexWrap: "wrap" }}>
          <h1 className="dc-pagehead__title">Match {matchId.slice(0, 8)}…</h1>
          <span className="dc-turn-pill">
            <span className="dc-turn-pill__dot" />
            {turnColor ? `${turnColor} to move` : "waiting"}
          </span>
          <span className="dc-muted" style={{ fontSize: 14 }}>
            You are <strong>{color}</strong>
            {youAreSolo ? " · solo vs team" : ""}
          </span>
        </div>
        {mmss && (
          <span className={`dc-timer${remaining != null && remaining < 10 ? " dc-timer--low" : ""}`}>
            ⏱ {mmss}
          </span>
        )}
      </div>

      {reconnecting && <Banner tone="warning">Connection lost — reconnecting…</Banner>}
      {error && (
        <div style={{ margin: "12px 0" }}>
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      <div className="dc-match-layout">
        <div className="dc-boardwrap">
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
    </>
  );
}
