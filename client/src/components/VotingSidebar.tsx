"use client";

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
  onVote: (moveKey: string) => void;
}

export default function VotingSidebar({
  proposals,
  tallies,
  myTurn,
  turnColor,
  deadline,
  onVote,
}: VotingSidebarProps) {
  return (
    <section style={{ border: "1px solid #ccc", padding: "0.75rem", minWidth: 240 }}>
      <h3>Ballot {turnColor ? `(${turnColor} to move)` : ""}</h3>
      {deadline && <p style={{ color: "#666" }}>window ends {new Date(deadline).toLocaleTimeString()}</p>}
      {!myTurn && <p style={{ color: "#999" }}>Waiting for your team&apos;s turn…</p>}
      {myTurn && proposals.length === 0 && (
        <p style={{ color: "#999" }}>No proposals yet — drag a piece to propose a move.</p>
      )}
      {proposals.length === 0 && !myTurn && <p style={{ color: "#999" }}>No proposals yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {proposals.map((p) => (
          <li key={p.moveKey} style={{ marginBottom: 6 }}>
            <button
              type="button"
              disabled={!myTurn}
              onClick={() => onVote(p.moveKey)}
              style={{ marginRight: 8 }}
            >
              {p.san} ({p.proposerUsername})
            </button>
            <span>{tallies[p.moveKey] ?? 0} votes</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
