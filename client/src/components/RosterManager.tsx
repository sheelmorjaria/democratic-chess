"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelTeamInvite,
  getTeam,
  inviteMember,
  listTeamInvites,
  removeTeamMember,
  type TeamDetail,
  type TeamInviteView,
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

/** Captain-gated roster panel: list members, invite by email, remove. */
export default function RosterManager({ teamId }: RosterManagerProps) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [invites, setInvites] = useState<TeamInviteView[]>([]);
  const [email, setEmail] = useState("");
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
      const [t, inv] = await Promise.all([
        getTeam(teamId),
        // Non-captains get 403 here; that's fine — just no invite list.
        listTeamInvites(teamId).catch(() => ({ invites: [] as TeamInviteView[] })),
      ]);
      setTeam(t);
      setInvites(inv.invites);
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

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMsg(null);
    const addr = email.trim();
    if (!addr) return;
    try {
      const res = await inviteMember(teamId, addr);
      setEmail("");
      if (res.status === "added") setMsg(`Added ${res.username ?? addr} to the team.`);
      else if (res.status === "already_member") setMsg(`${res.username ?? addr} is already on the team.`);
      else setMsg(`Invite sent to ${addr} — share the link below so they can join.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to invite");
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

  async function cancel(inviteId: string) {
    setError(null);
    setMsg(null);
    try {
      await cancelTeamInvite(teamId, inviteId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to cancel invite");
    }
  }

  function copyLink(url: string) {
    try {
      void navigator.clipboard?.writeText(url);
      setMsg("Invite link copied to clipboard.");
    } catch {
      /* clipboard unavailable */
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

  const pending = invites.filter((i) => i.status === "PENDING");

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
        <>
          <form onSubmit={invite} className="dc-stack" style={{ marginTop: 12 }}>
            <Field
              label="Invite by email"
              type="email"
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="primary">
              Send invite
            </Button>
            <p className="dc-muted" style={{ fontSize: 13 }}>
              Registered users join instantly. Others get a shareable join link.
            </p>
          </form>

          {pending.length > 0 && (
            <div className="dc-stack" style={{ marginTop: 16 }}>
              <span
                className="dc-muted"
                style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                Pending invites
              </span>
              <ul className="dc-roster__list">
                {pending.map((i) => (
                  <li key={i.id} className="dc-roster__row">
                    <span className="dc-muted" style={{ fontSize: 13 }}>
                      {i.email}
                    </span>
                    <span className="dc-row">
                      {i.inviteUrl && (
                        <button
                          type="button"
                          className="dc-btn dc-btn--ghost dc-btn--sm"
                          onClick={() => i.inviteUrl && copyLink(i.inviteUrl)}
                        >
                          Copy link
                        </button>
                      )}
                      <button
                        type="button"
                        className="dc-btn dc-btn--ghost dc-btn--sm"
                        onClick={() => cancel(i.id)}
                      >
                        Cancel
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
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
