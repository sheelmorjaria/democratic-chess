"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";

type Board = "TEAM" | "SOLO";

export default function LeaderboardPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [board, setBoard] = useState<Board>("TEAM");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeaderboard(board)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed to load leaderboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [board, user]);

  if (!ready || !user) return <main style={{ padding: "2rem" }}>Loading…</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, fontFamily: "system-ui, sans-serif" }}>
      <h1>Leaderboard</h1>
      <p>
        <button onClick={() => router.push("/lobby")}>← Lobby</button>
      </p>
      <div style={{ marginBottom: "1rem" }}>
        {(["TEAM", "SOLO"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            style={{ fontWeight: board === b ? "bold" : "normal", marginRight: 8 }}
          >
            {b === "TEAM" ? "Teams" : "Solo"}
          </button>
        ))}
      </div>
      {loading && <p>Loading rankings…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p style={{ color: "#999" }}>No ranked {board === "TEAM" ? "teams" : "players"} yet.</p>
      )}
      {!loading && entries.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={cell}>#</th>
              <th style={cell}>Name</th>
              <th style={cell}>Rating</th>
              <th style={cell}>W</th>
              <th style={cell}>L</th>
              <th style={cell}>D</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.subjectId}>
                <td style={cell}>{i + 1}</td>
                <td style={cell}>{e.name}</td>
                <td style={cell}>{e.rating}</td>
                <td style={cell}>{e.wins}</td>
                <td style={cell}>{e.losses}</td>
                <td style={cell}>{e.draws}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "0.4rem 0.6rem",
  textAlign: "left",
};
