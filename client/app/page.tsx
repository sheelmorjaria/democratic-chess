import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
      }}
    >
      <h1>🤝 DemocraticChess</h1>
      <p>Real-time, synchronous team chess. Teams vote on every move — or go solo against the hive mind.</p>

      <p>
        <Link href="/login" style={{ marginRight: 12 }}>
          ▶ Play
        </Link>
        <Link href="/leaderboard">Leaderboard</Link>
      </p>

      <ul style={{ color: "#444", lineHeight: 1.6, marginTop: "1.5rem" }}>
        <li>Team vs Team: propose, vote, and auto-execute under a turn timer — captain breaks ties.</li>
        <li>Solo vs Team: queue up and play your own moves directly against a voting team.</li>
        <li>Rating-banded matchmaking with a public ELO leaderboard.</li>
        <li>Works on web and mobile; reconnects and resyncs to the authoritative board.</li>
      </ul>
    </main>
  );
}
