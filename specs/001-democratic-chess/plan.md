# Implementation Plan: Democratic Team Chess

**Branch**: `001-democratic-chess` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-democratic-chess/spec.md`; constitution at `.specify/memory/constitution.md`.

## Summary

A real-time, synchronous team-chess application where teams (or a solo player) propose and majority-vote moves under blitz time controls, with server-authoritative game state. **MVP scope** (locked in `/speckit-clarify`): text chat only (voice deferred to Phase 3); persistent teams; ELO ratings + an auto-matchmaking queue; a captain with tie-break + roster powers. Spectating is deferred to Phase 4. The server runs `chess.js` as the sole source of truth; clients render and emit *proposals*, never executing moves.

> Note: choosing "full competitive" in clarify pulls ratings, leaderboards, and matchmaking (originally ROADMAP Phase 4) into the MVP. The ROADMAP should be re-sequenced during task breakdown.

## Technical Context

**Language/Version**: TypeScript 5.x — Node.js 20 LTS (server), Next.js 14+ / React 18 (client).

**Primary Dependencies**:
- Server: `express`, `socket.io`, `chess.js`, `prisma` + `@prisma/client`, `ioredis`, `jose` (JWT), `zod` (validation), `@socket.io/redis-adapter` (horizontal scaling).
- Client: `next`, `react`, `react-chessboard`, `chess.js` (advisory validation only), `socket.io-client`. (`@livekit/*` is Phase 3.)
- Shared: `packages/types` — Socket event payloads + domain enums, consumed by both apps via npm workspaces.

**Storage**: PostgreSQL 16 via Prisma for durable data (users, teams, memberships, matches, participants, ratings); Redis 7 for ephemeral match state (active proposals, vote tallies, turn timers, presence) and as the Socket.io pub/sub adapter.

**Testing**: Vitest (unit/integration), Playwright (end-to-end quickstart scenarios), Supertest (REST contract tests). See `research.md` for rationale.

**Target Platform**: Node.js on Linux (server); evergreen desktop browsers + iOS/Android via a Capacitor wrap of the Next.js app (client).

**Project Type**: web-service (realtime) + web/mobile app.

**Performance Goals**: board consistent across participants within 1s of a move executing (SC-002); ≥90% of turns resolve within the 60s decision window (SC-001); Socket.io event round-trip <200ms p50 on a reliable network.

**Constraints**: server-authoritative (no client trust); team information isolated by room; minimal WS payloads (SAN/FEN deltas, never full boards); mobile feature parity (constitution III).

**Scale/Scope**: MVP team size ≤5 per side; target hundreds of concurrent matches, scaled horizontally via the Redis adapter. Exact capacity validated by load tests after MVP.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate (how the plan upholds it) | Status |
|---|-----------|--------------------------------|--------|
| I  | Server Authority | One server-side `chess.js` instance per match is the sole FEN source; clients only `propose_move`; the server validates and executes every move. | ✅ Pass |
| II | Synchronous | Redis-backed turn timers + ephemeral tallies drive sub-minute decisions; the leading proposal auto-executes at window expiry. | ✅ Pass |
| III | Cross-Platform Parity | A single Next.js codebase; Capacitor wrap for iOS/Android; responsive board/vote/chat. (Voice joins parity in Phase 3.) | ✅ Pass |
| IV | Fair Play & Integrity | Per-color Socket.io rooms isolate proposals, votes, and chat from opponents; deterministic tie-breaks declared before match start. | ✅ Pass |
| V  | Modularity of Communication | Text chat sits behind a stable interface; voice is an independent Phase 3 module; the game loop is transport-agnostic. | ✅ Pass |

**Architectural Constraints (constitution)**: single FEN authority ✅ · minimal payloads (SAN/FEN) ✅ · Redis/Postgres split ✅ · room isolation ✅ · advisory-only client validation ✅.

**Post-Phase-1 re-check**: `data-model.md` keeps a single `Match.fen` authority and a Redis-only `MoveProposal`; `contracts/socket-events.md` carries SAN/FEN deltas and splits rooms by color. No violations introduced. **All gates still PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/001-democratic-chess/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── socket-events.md
│   └── rest-api.md
└── tasks.md             # /speckit-tasks output (not created here)
```

### Source Code (repository root)

```text
democratic-chess/
├── client/              # Next.js + react-chessboard (web); Capacitor wrap (mobile)
│   ├── src/
│   │   ├── app/         # Next.js routes
│   │   ├── components/  # board, voting sidebar, chat
│   │   ├── lib/         # socket + REST API clients
│   │   └── hooks/
│   └── tests/
├── server/              # Node + Express + Socket.io; authoritative chess.js
│   ├── src/
│   │   ├── game/        # chess.js wrapper, move validation, turn/timer engine
│   │   ├── realtime/    # socket.io handlers, rooms, events
│   │   ├── voting/      # proposal + tally (Redis)
│   │   ├── matchmaking/ # ELO rating + queue
│   │   ├── auth/        # JWT issue/verify
│   │   ├── db/          # Prisma schema + repositories
│   │   └── http/        # Express REST routes
│   └── tests/
├── packages/
│   └── types/           # shared TS types (socket events, domain enums)
├── docker-compose.yml   # local Postgres + Redis
└── .specify/
```

**Structure Decision**: Web-application monorepo using **npm workspaces**. `client` and `server` are independent deployables; `packages/types` is the shared contract layer consumed by both, so socket and domain types have a single source of truth — directly supporting constitution principle I.

## Complexity Tracking

> None. All constitution gates pass without exception. (This table is filled only if a gate violation must be justified.)
