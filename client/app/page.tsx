import Link from "next/link";

const FEATURES = [
  {
    title: "Team vs Team",
    body: "Propose, vote, and auto-execute under a turn timer. Captains break ties.",
  },
  {
    title: "Solo vs Team",
    body: "Queue up and play your own moves directly against a voting team.",
  },
  {
    title: "Rating & Leaderboard",
    body: "Rating-banded matchmaking with a public ELO leaderboard.",
  },
];

export default function Home() {
  return (
    <>
      <section className="dc-hero">
        <h1 className="dc-hero__title">Play chess, together.</h1>
        <p className="dc-hero__sub">
          Real-time, synchronous team chess. Teams vote on every move — or go solo against the hive
          mind.
        </p>
        <div className="dc-row">
          <Link href="/login" className="dc-btn dc-btn--primary">
            ▶ Play
          </Link>
          <Link href="/leaderboard" className="dc-btn dc-btn--secondary">
            Leaderboard
          </Link>
        </div>
      </section>

      <div className="dc-feature-grid">
        {FEATURES.map((f) => (
          <article key={f.title} className="dc-card">
            <h3 className="dc-feature__title">{f.title}</h3>
            <p className="dc-feature__body">{f.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}
