"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addTeamMember,
  findUserByUsername,
  getTeam,
  removeTeamMember,
  type TeamDetail,
} from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

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
    typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem("user") || "null") as { id: string } | null)
      : null;
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

  if (loading) {
    return (
      <div className="dc-row">
        <Spinner /> Loading roster…
      </div>
    );
  }
  if (!team) return <Banner tone="error">{error ?? "team not found"}</Banner>;

  return (
    <Card>
      <div className="dc-pagehead" style={{ marginBottom: 12 }}>
        <h2 className="dc-card__title" style={{ margin: 0 }}>
          {team.name}
        </h2>
        <Badge tone="accent">{team.members.length} members</Badge>
      </div>

      <ul className="dc-roster__list">
        {team.members.map((m) => (
          <li key={m.userId} className="dc-roster__row">
            <span className="dc-row">
              {m.user.username}
              {m.role === "CAPTAIN" && <Badge tone="accent">captain</Badge>}
            </span>
            {isCaptain && m.role !== "CAPTAIN" && (
              <button
                type="button"
                className="dc-btn dc-btn--ghost dc-btn--sm"
                onClick={() => remove(m.userId, m.user.username)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isCaptain ? (
        <form onSubmit={add} className="dc-stack" style={{ marginTop: 12 }}>
          <Field
            label="Invite by username"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Button type="submit" variant="primary">
            Add member
          </Button>
        </form>
      ) : (
        <p className="dc-muted" style={{ fontSize: 13, marginTop: 8 }}>
          Only the captain can manage the roster.
        </p>
      )}

      {msg && (
        <div style={{ marginTop: 12 }}>
          <Banner tone="success">{msg}</Banner>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12 }}>
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </Card>
  );
}
