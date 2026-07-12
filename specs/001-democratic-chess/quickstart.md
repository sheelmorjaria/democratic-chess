# Quickstart: Run & Verify

A validation/run guide for the MVP slice. Contracts and entity details live in [contracts/](./contracts/) and [data-model.md](./data-model.md) — this file does not duplicate them.

## Prerequisites
- Node.js 20+
- Docker (local Postgres + Redis)

## 1. Infrastructure
```bash
docker compose up -d   # Postgres (5432) + Redis (6379) via ./docker-compose.yml
```
(Or, ad hoc: `docker run --name democratic-chess-db -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres` and `docker run --name democratic-chess-redis -p 6379:6379 -d redis`.)

## 2. Backend
```bash
cd server
npm install
cp .env.example .env   # DATABASE_URL, REDIS_URL, JWT_SECRET
npm run dev            # http://localhost:3001
```

## 3. Frontend
```bash
cd client
npm install
cp .env.example .env   # NEXT_PUBLIC_API_URL (no LiveKit keys in MVP — voice is Phase 3)
npm run dev            # http://localhost:3000
```

## 4. Verification scenarios
Each scenario maps to a success criterion in [spec.md](./spec.md). Use two browsers (or profiles) for multi-user steps.

**A — Core loop (SC-001, SC-002)**
1. Open `localhost:3000` in two windows; register/log in as different users.
2. Form two teams and start a Team vs Team match (direct challenge).
3. In Window A (White), propose `e4`. Confirm it appears in White's voting sidebar only (not in the Black window).
4. Cast votes; confirm `vote_update` tallies reflect on White only.
5. Let the move window expire (or reach consensus) → `e4` auto-executes.
6. Confirm both windows update to the new position within ~1s and it becomes Black's turn.

**B — Fair play / isolation (SC-004)**
7. While White deliberates, confirm Black sees no proposals, votes, or chat.

**C — Tie-breaker (SC-006)**
8. Engineer a 50/50 tie among proposals; confirm the captain's choice wins (double-weight), with no stall.

**D — Ratings & matchmaking (SC-007)**
9. Complete a match; confirm each side's `Rating` updates and the `/leaderboard` reflects it.
10. Join the queue from two clients; confirm a pairing forms within the rating band and a match starts within ~2 min of both being queued.

**E — Disconnect handling (FR-009)**
11. Close all of one side's clients; confirm that side forfeits. Close all but one of a side's clients; confirm the match continues.

## Expected outcomes
- The authoritative board (server `Match.fen`) is the single source of truth; clients never execute moves locally.
- No opponent-readable private events leak across color rooms.
- Ratings and the leaderboard update only on server-side `match_end`.
