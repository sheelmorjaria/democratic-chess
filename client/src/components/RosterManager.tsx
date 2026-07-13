"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addTeamMember,
  findUserByUsername,
  getTeam,
  removeTeamMember,
  type TeamDetail,
} from "@/lib/api";

interface RosterManagerProps {
  teamId: string;
}

/** Captain-gated roster panel: list members, invite by username, remove. */
export default function RosterManager({ teamId }: RosterManagerProps) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const me =
    typeof window !== "undefined" ? (JSON.parse(localStorage.getItem("user") || "null") as { id: string } | null) : null;
  const isCaptain = !!team && !!me && team.captainId === me.id;

  const load = useCallback(async () => {
    try {
      setTeam(await getTeam(teamId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load team");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMsg(null);
    const name = username.trim();
    if (!name) return;
    try {
      const user = await findUserByUsername(name);
      await addTeamMember(teamId, user.id);
      setUsername("");
      setMsg(`Added ${user.username}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to add member");
    }
  }

  async function remove(userId: string, name: string) {
    setError(null);
    setMsg(null);
    try {
      await removeTeamMember(teamId, userId);
      setMsg(`Removed ${name}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to remove member");
    }
  }

  if (loading) return <p>Loading roster…</p>;
  if (!team) return <p style={{ color: "crimson" }}>{error ?? "team not found"}</p>;

  return (
    <section style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
      <h3>{team.name} — roster</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {team.members.map((m) => (
          <li key={m.userId} style={{ marginBottom: 4 }}>
            {m.user.username} {m.role === "CAPTAIN" && <strong>(captain)</strong>}
            {isCaptain && m.role !== "CAPTAIN" && (
              <button type="button" onClick={() => remove(m.userId, m.user.username)} style={{ marginLeft: 8 }}>
                remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isCaptain ? (
        <form onSubmit={add} style={{ display: "grid", gap: "0.4rem", marginTop: "0.5rem" }}>
          <input
            placeholder="username to invite"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <button type="submit">Add member</button>
        </form>
      ) : (
        <p style={{ color: "#999" }}>Only the captain can manage the roster.</p>
      )}

      {msg && <p style={{ color: "green" }}>{msg}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </section>
  );
}
