"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createMatch, createTeam } from "@/lib/api";

export default function LobbyPage() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [whiteId, setWhiteId] = useState("");
  const [blackId, setBlackId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

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

  return (
    <main style={{ padding: "2rem", maxWidth: 560, fontFamily: "system-ui, sans-serif" }}>
      <h1>Lobby</h1>
      <p>Signed in as <strong>{user.username}</strong>. <button onClick={logout}>Log out</button></p>

      <form onSubmit={makeTeam} style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem" }}>
        <h2>Create a team</h2>
        <input placeholder="team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
        <button type="submit">Create team (you become captain)</button>
      </form>

      <form onSubmit={makeMatch} style={{ display: "grid", gap: "0.5rem" }}>
        <h2>Start a match (direct challenge)</h2>
        <input placeholder="white team id" value={whiteId} onChange={(e) => setWhiteId(e.target.value)} required />
        <input placeholder="black team id" value={blackId} onChange={(e) => setBlackId(e.target.value)} required />
        <button type="submit">Create match</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}
