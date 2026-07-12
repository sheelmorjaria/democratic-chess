# Data Model: Democratic Team Chess (Phase 1)

Two stores, per the constitution: **PostgreSQL** (durable, via Prisma) and **Redis** (ephemeral match state). Types are TypeScript; enums are shared via `packages/types`.

## State Machines

### Match status (Postgres `Match.status`)

```text
WAITING ──(both sides full + start)──▶ ACTIVE ──(checkmate/stalemate/resign/timeout)──▶ COMPLETED
   │                                    │
   │                                    └──(abort / all of a side disconnect)──▶ ABORTED
   └──(cancelled before start)──▶ ABORTED
```

### Turn lifecycle (in-memory + Redis, per turn `n`)

```text
OPEN (accept proposals + votes; timer running)
  ├── unanimous consent ──────────────▶ RESOLVED (execute top move) ──▶ next OPEN (n+1) or GAME_OVER
  └── timer expiry ───────────────────▶ RESOLVED (execute leading move; if ballot empty, no move + bank drains)
```

## PostgreSQL Entities (durable)

### User
A player account.
- `id`: UUID (PK)
- `username`: String, unique, length 3–32
- `email`: String, unique, validated
- `passwordHash`: String (bcrypt)
- `createdAt`: Timestamp
- Relationships: 1—many `TeamMembership`, 1—many `MatchParticipant`, 1—1 `Rating` (subjectType=SOLO)

### Team
A persistent roster (the MVP team model).
- `id`: UUID (PK)
- `name`: String, unique, length 3–48
- `captainId`: UUID (FK → User.id)
- `createdAt`: Timestamp
- Relationships: 1—1 `Rating` (subjectType=TEAM), 1—many `TeamMembership`, 1—many `Match` (as white/black)

### TeamMembership
Roster membership (captain authority over this — FR-014).
- `id`: UUID (PK)
- `teamId`: UUID (FK → Team.id)
- `userId`: UUID (FK → User.id)
- `role`: Enum `CAPTAIN | MEMBER`
- `joinedAt`: Timestamp
- Constraints: unique (`teamId`, `userId`)

### Match
A single game instance. Single source of FEN truth.
- `id`: UUID (PK)
- `mode`: Enum `TEAM_VS_TEAM | SOLO_VS_TEAM`
- `whiteTeamId`: UUID nullable (FK → Team.id; null if a solo side)
- `blackTeamId`: UUID nullable (FK → Team.id; null if a solo side)
- `status`: Enum `WAITING | ACTIVE | COMPLETED | ABORTED`
- `winner`: Enum `WHITE | BLACK | DRAW` nullable
- `fen`: String (current authoritative board state)
- `turn`: Enum `WHITE | BLACK`
- `turnNumber`: Integer
- `moveWindowSec`: Integer (default 60)
- `whiteTimeRemainingMs`: Integer (time bank)
- `blackTimeRemainingMs`: Integer (time bank)
- `startedAt`, `endedAt`: Timestamp nullable
- Relationships: 1—many `MatchParticipant`

### MatchParticipant
Links a user to a match and assigns color + captain flag.
- `id`: UUID (PK)
- `matchId`: UUID (FK → Match.id)
- `userId`: UUID (FK → User.id)
- `teamColor`: Enum `WHITE | BLACK`
- `isCaptain`: Boolean
- Constraints: unique (`matchId`, `userId`)

### Rating
ELO rating per rated subject (team or solo player). See research.md R5.
- `id`: UUID (PK)
- `subjectType`: Enum `TEAM | SOLO`
- `subjectId`: UUID (FK → Team.id or User.id, polymorphic by `subjectType`)
- `rating`: Integer (default 1200)
- `wins`, `losses`, `draws`: Integer (default 0)
- `provisionalGames`: Integer (default 0; K-factor band)
- `updatedAt`: Timestamp
- Constraints: unique (`subjectType`, `subjectId`)
- **Leaderboard** is a derived view: `SELECT … ORDER BY rating DESC` over this table.

## Redis Entities (ephemeral)

### MoveProposal (per match, per turn `n`)
Hot-path candidate moves on the ballot. Duplicate `{from}:{to}:{promo}` collapses into one entry.
- Key: `match:{matchId}:turn:{n}:proposals` (hash; field = move key)
- Field value: `{ id: UUID, proposerUserId: UUID, from, to, promotion?, san }`

### VoteTally (per proposal, per turn)
- Key: `match:{matchId}:turn:{n}:votes:{moveKey}` (set of voter userIds); count = `SCARD`
- One-vote-per-member enforced via `match:{matchId}:turn:{n}:voters` (set).

### TurnTimer
- Key: `match:{matchId}:turn:{n}:expiresAt` (string, set with `EX = moveWindowSec`)
- Expiry (via keyspace notification or scheduler) triggers server-side auto-execute of the leading proposal.

### Presence
- Key: `match:{matchId}:{color}:presence` (set of connected userIds). A side reaching zero members triggers forfeit (FR-009).

## Validation rules (from requirements)

- Move legality: every proposal is validated by the server-side `chess.js` against `Match.fen` before it enters the ballot (FR-003). Promotion defaults to queen if unspecified (edge case).
- Voting: one vote per member per turn; changeable before window close (assumption). Captain's vote counts double on tie resolution (FR-005).
- Time: per-move window is a pacing soft cap; total time bank exhaustion loses on time (FR-008).
- Isolation: proposals/votes/chat are only ever emitted to the same-color room (`match_{id}_{color}`); executed moves go to `match_{id}` (constitution IV).
