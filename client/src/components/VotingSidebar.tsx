"use client";

import { EmptyState } from "@/components/ui/EmptyState";

export interface ProposalView {
  moveKey: string;
  san: string;
  from: string;
  to: string;
  proposerUsername: string;
}

interface VotingSidebarProps {
  proposals: ProposalView[];
  tallies: Record<string, number>;
  myTurn: boolean;
  turnColor: string | null;
  deadline: string | null;
  /** The move key this member currently voted for (null = not voted). */
  myVote?: string | null;
  onVote: (moveKey: string) => void;
}

export default function VotingSidebar({
  proposals,
  tallies,
  myTurn,
  turnColor,
  deadline,
  myVote,
  onVote,
}: VotingSidebarProps) {
  const total = Object.values(tallies).reduce((a, b) => a + b, 0);

  return (
    <section className="dc-card" style={{ minWidth: 280, flex: "1 1 300px", maxWidth: 340 }}>
      <h2 className="dc-card__title">Ballot {turnColor ? `· ${turnColor} to move` : ""}</h2>

      {deadline && (
        <p className="dc-muted" style={{ fontSize: 12, marginBottom: 8 }}>
          window ends {new Date(deadline).toLocaleTimeString()}
        </p>
      )}

      {myTurn && proposals.length > 0 && (
        <p className="dc-muted" style={{ fontSize: 12, marginBottom: 12 }}>
          {myVote ? "Click a different move to change your vote." : "Click a move to vote."} Votes are
          changeable until the window closes.
        </p>
      )}
      {!myTurn && <EmptyState>Waiting for your team&apos;s turn…</EmptyState>}
      {myTurn && proposals.length === 0 && (
        <EmptyState>No proposals yet — drag a piece to propose a move.</EmptyState>
      )}

      <div className="dc-vote-list">
        {proposals.map((p) => {
          const votes = tallies[p.moveKey] ?? 0;
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
          const voted = myVote === p.moveKey;
          return (
            <button
              key={p.moveKey}
              type="button"
              disabled={!myTurn}
              onClick={() => onVote(p.moveKey)}
              className={`dc-vote${voted ? " dc-vote--selected" : ""}`}
            >
              <span className="dc-vote__top">
                <span>
                  <span className="dc-vote__san">
                    {voted ? "✓ " : ""}
                    {p.san}
                  </span>{" "}
                  <span className="dc-vote__by">· {p.proposerUsername}</span>
                </span>
                <span className="dc-vote__pct">
                  {pct}% · {votes}
                </span>
              </span>
              <span className="dc-vote__bar">
                <span className="dc-vote__fill" style={{ width: `${pct}%` }} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
