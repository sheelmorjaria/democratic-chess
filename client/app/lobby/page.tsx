"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  createMatch,
  createTeam,
  getQueueStatus,
  joinQueueSolo,
  joinQueueTeam,
  leaveQueue,
  type QueueStatus,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";

export default function LobbyPage() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [whiteId, setWhiteId] = useState("");
  const [blackId, setBlackId] = useState("");
  const [queueTeamId, setQueueTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueStatus>({ state: "idle", estimatedWaitSec: null });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  // Instant match-start push from the queue; polling is the reliable fallback.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onMatched = (data: { matchId?: string }) => {
      if (data.matchId) router.push(`/match/${data.matchId}`);
    };
    socket.on("queue_matched", onMatched);
    return () => {
      socket.off("queue_matched", onMatched);
    };
  }, [router]);

  // Poll status while queued; stop once matched/idle.
  useEffect(() => {
    if (queue.state === "queued") {
      pollRef.current = setInterval(async () => {
        try {
          const s = await getQueueStatus();
          setQueue(s);
          if (s.state === "matched" && s.matchId) router.push(`/match/${s.matchId}`);
        } catch {
          /* transient — keep polling */
        }
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [queue.state, router]);

  if (!ready || !user) return <main style={{ padding: "2rem" }}>Loading…</main>;

  async function makeTeam(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const team = await createTeam(teamName);
      alert(`Team created: ${team.name} (${team.id})`);
      setTeamName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function makeMatch(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const match = await createMatch(whiteId, blackId);
      router.push(`/match/${match.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function queueSolo() {
    setError(null);
    try {
      const res = await joinQueueSolo();
      if (res.matchId) router.push(`/match/${res.matchId}`);
      else setQueue({ state: "queued", estimatedWaitSec: 120 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to join queue");
    }
  }

  async function queueTeam(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const res = await joinQueueTeam(queueTeamId);
      if (res.matchId) router.push(`/match/${res.matchId}`);
      else setQueue({ state: "queued", estimatedWaitSec: 120 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to join queue");
    }
  }

  async function leave() {
    setError(null);
    try {
      await leaveQueue();
      setQueue({ state: "idle", estimatedWaitSec: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to leave queue");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 560, fontFamily: "system-ui, sans-serif" }}>
      <h1>Lobby</h1>
      <p>
        Signed in as <strong>{user.username}</strong>.{" "}
        <button onClick={logout}>Log out</button>{" "}
        <button onClick={() => router.push("/leaderboard")}>Leaderboard</button>
      </p>

      <form onSubmit={makeTeam} style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem" }}>
        <h2>Create a team</h2>
        <input placeholder="team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
        <button type="submit">Create team (you become captain)</button>
      </form>

      <form onSubmit={makeMatch} style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem" }}>
        <h2>Start a match (direct challenge)</h2>
        <input placeholder="white team id" value={whiteId} onChange={(e) => setWhiteId(e.target.value)} required />
        <input placeholder="black team id" value={blackId} onChange={(e) => setBlackId(e.target.value)} required />
        <button type="submit">Create match</button>
      </form>

      <div style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem" }}>
        <h2>Find a match (matchmaking queue)</h2>
        {queue.state === "queued" ? (
          <p style={{ color: "#666" }}>
            Searching for an opponent… est. wait ~{queue.estimatedWaitSec ?? "—"}s.{" "}
            <button onClick={leave}>Leave queue</button>
          </p>
        ) : (
          <>
            <button onClick={queueSolo}>Queue as solo player</button>
            <form onSubmit={queueTeam} style={{ display: "grid", gap: "0.5rem" }}>
              <input
                placeholder="your team id"
                value={queueTeamId}
                onChange={(e) => setQueueTeamId(e.target.value)}
                required
              />
              <button type="submit">Queue as team (captain)</button>
            </form>
          </>
        )}
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}
