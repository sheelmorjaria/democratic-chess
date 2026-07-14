"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import RosterManager from "@/components/RosterManager";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";

export default function LobbyPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [whiteId, setWhiteId] = useState("");
  const [blackId, setBlackId] = useState("");
  const [queueTeamId, setQueueTeamId] = useState("");
  const [rosterTeamId, setRosterTeamId] = useState("");
  const [activeRosterId, setActiveRosterId] = useState<string | null>(null);
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

  if (!ready || !user) {
    return (
      <div className="dc-row">
        <Spinner /> Loading…
      </div>
    );
  }

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
    <>
      <div className="dc-pagehead">
        <div>
          <h1 className="dc-pagehead__title">Lobby</h1>
          <p className="dc-muted">
            Signed in as <strong>{user.username}</strong>
          </p>
        </div>
        <Link href="/leaderboard" className="dc-btn dc-btn--secondary dc-btn--sm">
          Leaderboard
        </Link>
      </div>

      <div className="dc-grid-2">
        <Card title="Create a team">
          <form onSubmit={makeTeam} className="dc-stack">
            <Field
              label="Team name"
              placeholder="My grandmasters"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
            <Button type="submit" variant="primary">
              Create team
            </Button>
            <p className="dc-muted" style={{ fontSize: 13 }}>
              You become the captain.
            </p>
          </form>
        </Card>

        <Card title="Find a match">
          {queue.state === "queued" ? (
            <div className="dc-stack">
              <Banner tone="info">
                Searching for an opponent… est. wait ~{queue.estimatedWaitSec ?? "—"}s
              </Banner>
              <Button variant="secondary" onClick={leave}>
                Leave queue
              </Button>
            </div>
          ) : (
            <div className="dc-stack">
              <p className="dc-muted" style={{ fontSize: 13 }}>
                Rating-banded matchmaking. Cross-type solo vs team pairing.
              </p>
              <Button variant="primary" onClick={queueSolo}>
                Queue as solo player
              </Button>
              <form onSubmit={queueTeam} className="dc-stack">
                <Field
                  label="Your team id"
                  placeholder="team_…"
                  value={queueTeamId}
                  onChange={(e) => setQueueTeamId(e.target.value)}
                  required
                />
                <Button type="submit" variant="secondary">
                  Queue as team (captain)
                </Button>
              </form>
            </div>
          )}
        </Card>

        <Card title="Direct challenge">
          <form onSubmit={makeMatch} className="dc-stack">
            <Field
              label="White team id"
              placeholder="team_…"
              value={whiteId}
              onChange={(e) => setWhiteId(e.target.value)}
              required
            />
            <Field
              label="Black team id"
              placeholder="team_…"
              value={blackId}
              onChange={(e) => setBlackId(e.target.value)}
              required
            />
            <Button type="submit" variant="primary">
              Create match
            </Button>
          </form>
        </Card>

        <Card title="Manage roster">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActiveRosterId(rosterTeamId.trim() || null);
            }}
            className="dc-stack"
          >
            <Field
              label="Your team id"
              placeholder="team_…"
              value={rosterTeamId}
              onChange={(e) => setRosterTeamId(e.target.value)}
              required
            />
            <Button type="submit" variant="secondary">
              Load roster
            </Button>
          </form>
          {activeRosterId && (
            <div style={{ marginTop: 16 }}>
              <RosterManager teamId={activeRosterId} />
            </div>
          )}
        </Card>
      </div>

      {error && (
        <div style={{ marginTop: 16 }}>
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </>
  );
}
