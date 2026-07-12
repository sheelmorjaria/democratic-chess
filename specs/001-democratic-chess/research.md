# Research: Democratic Team Chess (Phase 0)

Resolves every `NEEDS CLARIFICATION` from the Technical Context and records best-practice decisions for the core dependencies. Each item follows **Decision / Rationale / Alternatives**.

## R1 — Monorepo tooling

- **Decision**: npm workspaces (`client`, `server`, `packages/types`).
- **Rationale**: Zero added tooling; native to npm; sufficient for a 3-package monorepo. `packages/types` is installed as a workspace dependency by both apps, giving a single source of truth for socket/domain types.
- **Alternatives**: pnpm workspaces (faster, stricter; rejected — extra toolchain for marginal MVP gain); Turborepo/Nx (rejected — build-orchestation overhead not needed at MVP scale).

## R2 — Authentication

- **Decision**: Stateless JWT access tokens (short-lived, ~15 min) + rotating refresh tokens (HttpOnly cookie) via `jose`. Passwords hashed with bcrypt.
- **Rationale**: Stateless tokens suit a realtime, horizontally-scaled Socket.io fleet (no session store lookups per event). Refresh tokens limit exposure window. Accounts are required (ratings/leaderboards need stable identity).
- **Alternatives**: Server sessions (rejected — adds a session store and per-event lookup); OAuth2/SSO (deferred — not needed for MVP; revisit for the "streamers" audience).

## R3 — Realtime scaling

- **Decision**: Socket.io with `@socket.io/redis-adapter` for multi-node broadcast, and Redis for ephemeral state.
- **Rationale**: Socket.io rooms map cleanly to per-match/per-color isolation (constitution IV). The Redis adapter lets the server scale horizontally while keeping room broadcasts correct across nodes. Sticky sessions not required with the adapter.
- **Alternatives**: Raw `ws` (rejected — re-implementing rooms/reconnect/back-pressure; Socket.io is well-trodden); Centrifugo/NATS (rejected — extra infra for MVP).

## R4 — Ephemeral match state (Redis structures)

- **Decision**:
  - Proposals per turn: a Redis hash keyed `match:{id}:turn:{n}:proposals`, field = `{from}:{to}:{promo}`, value = JSON `{id, proposerUserId, san}`. Duplicate moves collapse into one field (spec edge case).
  - Votes: a set keyed `match:{id}:turn:{n}:votes:{moveKey}` of voter userIds; `voteCount = SCARD`. One-vote-per-member tracked via `match:{id}:turn:{n}:voters`.
  - Turn timer: a Redis key `match:{id}:turn:{n}:expiresAt` set with EX; keyspace notifications or a server-side scheduler triggers auto-execute on expiry.
  - Presence: `match:{id}:{color}:presence` set.
- **Rationale**: Redis-native structures give O(1) tallies, atomic dedupe of duplicate proposals, and a reliable expiry signal that survives a single Node process restart.
- **Alternatives**: In-memory maps (rejected — lost on restart/redeploy and not multi-node safe); Postgres for tallies (rejected — too slow for hot voting path).

## R5 — Rating system (ELO)

- **Decision**: Standard ELO. Initial rating 1200; K-factor 32 (provisional, first 30 games) → 24 (settled). Applied per **team** and per **solo player** (the rated subject).
- **Rationale**: ELO is simple, well-understood by the audience, and sufficient for matchmaking. Per-subject ratings support both Team vs Team and Solo vs Team.
- **Alternatives**: Glicko-2 (rejected — more accurate but adds rating-period complexity not needed at MVP); TrueSkill (rejected — proprietary/multi-team overhead).

## R6 — Matchmaking queue

- **Decision**: Rating-banded queue. A queued entry searches within ±N rating (start N=100), widening by +50 every ~15s up to a cap; when two compatible entries exist, a match is created. Queue state lives in Redis (sorted by rating for range scans).
- **Rationale**: Bounds fairness (SC-007: paired within a band, match starts within ~2 min of a full lobby). Redis sorted set enables efficient range queries by rating.
- **Alternatives**: Strict FIFO (rejected — unfair mismatches); pre-formed lobbies only (rejected — conflicts with the "full competitive" decision).

## R7 — Turn-timer reliability

- **Decision**: Authoritative timing on the server, driven by Redis key expiry + a single per-match scheduler job (not client `setTimeout` alone). The client countdown is display-only.
- **Rationale**: Constitution II (synchronous) and the auto-execute rule require the server to be the only trigger of turn resolution, immune to client clock drift or tab-throttling.
- **Alternatives**: Client-driven timers (rejected — untrusted and drift); per-Node `setTimeout` only (rejected — lost on crash/redeploy without Redis-backed recovery).

## R8 — Testing stack

- **Decision**: Vitest (unit/integration, fast, Jest-compatible API); Playwright (e2e, cross-browser, covers the quickstart scenarios); Supertest (REST contract tests against the Express app).
- **Rationale**: Vitest integrates with the Next.js/TS toolchain; Playwright drives the two-browser verification in `quickstart.md`; Supertest keeps the REST contract (Phase 1) honest.
- **Alternatives**: Jest (rejected — slower, more config for ESM/TS); Cypress (rejected — Playwright is better for multi-window/multi-user scenarios).

## R9 — Mobile delivery

- **Decision**: Wrap the Next.js web build with Capacitor for iOS/Android.
- **Rationale**: One codebase guarantees web/mobile parity (constitution III) without a separate RN bridge, and Capacitor supports the future WebRTC/LiveKit voice path (Phase 3).
- **Alternatives**: React Native (rejected — separate codebase, breaks parity goal); PWA-only (rejected — weaker background/permissions story for future voice).

## R10 — Input validation

- **Decision**: `zod` for runtime validation at every trust boundary (REST bodies, socket payloads); infer TS types from schemas.
- **Rationale**: Single schema → types + validation, reducing drift; pairs with `packages/types` for shared event contracts.
- **Alternatives**: `class-validator`/`io-ts` (rejected — more ceremony); hand-rolled guards (rejected — error-prone).

## R11 — Observability

- **Decision**: Structured logging via `pino`; request/event correlation IDs; Socket.io event counters. Metrics endpoint deferred post-MVP.
- **Rationale**: Cheap, sufficient baseline to debug realtime issues; structured logs are greppable/ship-ready for any log aggregator.
- **Alternatives**: `winston` (rejected — heavier, slower); OpenTelemetry from day one (deferred — added cost before load is understood).
