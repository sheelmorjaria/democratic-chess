"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

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

  if (!ready || !user) {
    return (
      <div className="dc-row">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <>
      <div className="dc-pagehead">
        <h1 className="dc-pagehead__title">Leaderboard</h1>
        <Link href="/lobby" className="dc-btn dc-btn--ghost dc-btn--sm">
          ← Lobby
        </Link>
      </div>

      <div className="dc-segmented" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`dc-segmented__btn ${board === "TEAM" ? "dc-segmented__btn--active" : ""}`}
          onClick={() => setBoard("TEAM")}
        >
          Teams
        </button>
        <button
          type="button"
          className={`dc-segmented__btn ${board === "SOLO" ? "dc-segmented__btn--active" : ""}`}
          onClick={() => setBoard("SOLO")}
        >
          Solo
        </button>
      </div>

      {loading && (
        <div className="dc-row">
          <Spinner /> Loading rankings…
        </div>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      {!loading && !error && entries.length === 0 && (
        <EmptyState>No ranked {board === "TEAM" ? "teams" : "players"} yet.</EmptyState>
      )}
      {!loading && entries.length > 0 && (
        <table className="dc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th className="num">Rating</th>
              <th className="num">W</th>
              <th className="num">L</th>
              <th className="num">D</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.subjectId}>
                <td>{i + 1}</td>
                <td>{e.name}</td>
                <td className="num">{e.rating}</td>
                <td className="num">{e.wins}</td>
                <td className="num">{e.losses}</td>
                <td className="num">{e.draws}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
