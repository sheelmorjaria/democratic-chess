# Tasks: Democratic Team Chess

**Input**: Design documents from `specs/001-democratic-chess/` — [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, research.md

**Tests**: Included for **rule-critical logic only** (constitution mandate: move validation, vote tallying, tie-breaker, room isolation, ELO, matchmaking, forfeit) — not blanket TDD. Marked in-line.

**Organization**: Tasks are grouped by user story (US1–US4) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (different files, no dependency on an incomplete task)
- **[USx]**: Maps to a user story from spec.md (user-story phases only)
- All paths are monorepo-relative (see Path Conventions)

## Path Conventions

Monorepo (npm workspaces) — NOT the template's single-project layout:

- **Client (web/mobile)**: `client/src/...` (Next.js app router)
- **Server (realtime + REST)**: `server/src/...`
- **Shared types**: `packages/types/src/...`
- **Durable schema**: `server/prisma/schema.prisma`
- **E2E tests**: `client/e2e/...` (Playwright); unit/integration: `server/src/**/*.test.ts`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo skeleton, local services, tooling.

- [x] T001 Initialize npm-workspaces monorepo in root `package.json` (workspaces: `client`, `server`, `packages/types`) + base `tsconfig.base.json`
- [x] T002 [P] Create `docker-compose.yml` (postgres:16 on 5432, redis:7 on 6379) at repo root
- [x] T003 [P] Scaffold Next.js 14 client (app router, TS) in `client/`
- [x] T004 [P] Scaffold Express + TS server in `server/` (dev/build scripts)
- [x] T005 [P] Scaffold `packages/types` (TS library, barrel export, build via `tsc`)
- [x] T006 [P] Configure shared tooling: eslint, prettier, vitest at repo root + per-package configs
- [x] T007 [P] Create `client/.env.example` (`NEXT_PUBLIC_API_URL`) and `server/.env.example` (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every user story depends on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [x] T008 [P] Prisma schema + initial migration for all durable entities (User, Team, TeamMembership, Match, MatchParticipant, Rating) in `server/prisma/schema.prisma`
- [x] T009 [P] Redis connection module (ioredis) in `server/src/db/redis.ts`
- [x] T010 [P] Auth core: bcrypt password hashing + JWT issue/verify (jose) in `server/src/auth/{crypto.ts,jwt.ts}`
- [x] T011 REST auth endpoints (register/login/refresh/me) in `server/src/http/routes/auth.ts` + Supertest contract tests in `server/src/http/routes/auth.test.ts`
- [x] T012 [P] Shared socket-event + domain types with zod schemas in `packages/types/src/{events.ts,enums.ts}`
- [x] T013 Socket.io server with `@socket.io/redis-adapter`, JWT handshake auth, and room join/leave helpers in `server/src/realtime/io.ts`
- [x] T014 [P] Authoritative `chess.js` engine wrapper (from FEN → validate → apply → SAN → game-over) in `server/src/game/engine.ts` + unit tests in `server/src/game/engine.test.ts`
- [x] T015 [P] Redis ephemeral helpers (proposals hash, vote sets, one-vote guard, turn-timer key w/ EX, presence set) in `server/src/voting/ephemeral.ts` + unit tests in `server/src/voting/ephemeral.test.ts`
- [x] T016 [P] zod validation guards at socket + REST boundaries in `server/src/realtime/validate.ts` and `server/src/http/validate.ts`
- [x] T017 [P] Repositories for durable entities in `server/src/db/repositories/{users,teams,matches,ratings}.ts`

**Checkpoint**: Foundation ready — auth works, engine validates moves, ephemeral layer + realtime rooms operational.

---

## Phase 3: User Story 1 — Team vs Team Blitz Match (Priority: P1) 🎯 MVP

**Goal**: Two teams play a full game via propose → vote → execute under the turn timer; ratings update on completion.

**Independent Test**: Two teams (formed via team management) start a direct-challenge match; a full game completes through propose/vote/auto-execute; the board syncs to both sides; no private events leak to opponents; both ratings update at `match_end`.

- [x] T018 [P] [US1] Team service + REST (create team with creator-as-captain, get team) in `server/src/http/routes/teams.ts`
- [x] T019 [US1] Match service: create match (direct challenge), assign colors + captain flags, status WAITING→ACTIVE, seed FEN + time banks in `server/src/game/matchService.ts`
- [x] T020 [US1] Turn/timer engine: open turn, arm Redis turn-timer key, resolve on expiry (auto-execute leading) or unanimous `execute_now` in `server/src/game/turnEngine.ts` + tests in `server/src/game/turnEngine.test.ts`
- [x] T021 [US1] `propose_move` handler: validate via chess.js, dedupe by `{from}:{to}:{promo}`, add to Redis ballot, emit `new_proposal` to color room in `server/src/realtime/handlers/proposeMove.ts` + tests in `server/src/realtime/handlers/proposeMove.test.ts`
- [x] T022 [US1] `vote_move` handler: one vote/member (changeable), update tallies, emit `vote_update` to color room in `server/src/realtime/handlers/voteMove.ts` + tests in `server/src/realtime/handlers/voteMove.test.ts`
- [x] T023 [US1] Move execution: apply leading move to chess.js, update `Match.fen`, emit `move_executed` to match room, advance turn / detect game-over in `server/src/game/executeMove.ts` + tests in `server/src/game/executeMove.test.ts`
- [x] T024 [US1] `match_end` + ELO rating update (compute per research R5, persist to `Rating`) in `server/src/game/matchEnd.ts` and `server/src/matchmaking/rating.ts` + tests in `server/src/matchmaking/rating.test.ts`
- [ ] T025 [P] [US1] Client socket + REST API clients with auth token wiring in `client/src/lib/{socket.ts,api.ts}`
- [ ] T026 [P] [US1] Match view + `react-chessboard` integration; click-to-move emits `propose_move` in `client/src/app/match/[id]/page.tsx` and `client/src/components/Board.tsx`
- [ ] T027 [P] [US1] Voting sidebar (list proposals, vote buttons, live tallies, turn-timer display) in `client/src/components/VotingSidebar.tsx`
- [ ] T028 [P] [US1] Team text-chat component (same-color room only) in `client/src/components/TeamChat.tsx`
- [ ] T029 [P] [US1] Lobby: create/join team, form sides, direct-challenge to start a match in `client/src/app/lobby/page.tsx`
- [ ] T030 [US1] Playwright e2e for quickstart scenario A (two browsers: propose/vote/auto-execute; board syncs; cross-room isolation) in `client/e2e/core-loop.spec.ts`

**Checkpoint**: US1 fully functional and independently testable — the MVP centerpiece.

---

## Phase 4: User Story 2 — Mobile Participation (Priority: P2)

**Goal**: A mobile user can vote and chat without clutter; full parity with web.

**Independent Test**: On a phone-sized viewport, a player completes propose → vote → chat with no core mechanic blocked.

- [ ] T031 [P] [US2] Responsive layout (full-screen board; bottom-tab/drawer for votes + chat) in `client/src/components/MobileLayout.tsx`
- [ ] T032 [P] [US2] `touch-action: none` + drag handling on the board for mobile in `client/src/components/Board.tsx`
- [ ] T033 [US2] Capacitor wrap + config and iOS/Android build scripts in `client/capacitor.config.ts`

**Checkpoint**: US1 and US2 both work, web + mobile parity achieved.

---

## Phase 5: User Story 3 — Captain Tie-Breaker (Priority: P3)

**Goal**: Ties resolve deterministically without stalling; captain owns the roster.

**Independent Test**: A 50/50 tie resolves to the captain's choice (no stall); a captain can invite/remove members.

- [ ] T034 [US3] Captain double-weight tie-break in turn resolution (captain vote = 2; fallback earliest-proposed) in `server/src/game/turnEngine.ts` (resolveTie) + tests in `server/src/game/turnEngine.test.ts`
- [ ] T035 [P] [US3] Captain roster-management REST (invite/remove members, set match params — FR-014) in `server/src/http/routes/teams.ts` + UI in `client/src/components/RosterManager.tsx`

**Checkpoint**: Voting edge cases handled; captain authority complete.

---

## Phase 6: User Story 4 — Solo vs Team + Competitive Layer (Priority: P3)

**Goal**: A solo player challenges a team via the queue; ratings surface on a leaderboard.

**Independent Test**: A solo player queues, is paired against a team within a rating band, plays directly (no voting), and the leaderboard reflects the result.

- [ ] T036 [US4] Solo turn path: solo player plays a direct move, bypassing voting in `server/src/game/soloTurn.ts`
- [ ] T037 [US4] Matchmaking queue (rating-banded, widening search via Redis sorted set; create match on pairing) in `server/src/matchmaking/queue.ts` + tests in `server/src/matchmaking/queue.test.ts`
- [ ] T038 [P] [US4] Queue REST (join/leave/status) in `server/src/http/routes/queue.ts`
- [ ] T039 [P] [US4] Leaderboard REST + UI in `server/src/http/routes/leaderboard.ts` and `client/src/app/leaderboard/page.tsx`
- [ ] T040 [US4] Playwright e2e: solo queues vs team; match forms within band; leaderboard reflects a completed match in `client/e2e/competitive.spec.ts`

**Checkpoint**: Full competitive loop (queue → solo/team match → rating → leaderboard).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Reliability and UX hardening across all stories.

- [ ] T041 [P] Structured logging (pino) + correlation IDs across HTTP and socket in `server/src/observability/`
- [ ] T042 [P] Reconnect/resync: client re-fetches authoritative FEN on reconnect in `client/src/lib/socket.ts`
- [ ] T043 [P] Error / empty / loading states across match UI in `client/src/components/*`
- [ ] T044 [P] Disconnect forfeit: a side with zero presence forfeits (FR-009) in `server/src/realtime/presence.ts` + tests in `server/src/realtime/presence.test.ts`
- [ ] T045 Run full `quickstart.md` verification end-to-end and close any gaps

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup; **BLOCKS all user stories**.
- **User Stories (Phases 3–6)**: All depend on Foundational. US2/US3/US4 layer onto US1 (the core loop).
- **Polish (Phase 7)**: Depends on the user stories being complete.

### User Story Dependencies
- **US1 (P1)**: Starts after Foundational. No other-story dependency.
- **US2 (P2)**: After Foundational; builds on US1's match UI.
- **US3 (P3)**: After Foundational; extends US1's turn resolution + team routes.
- **US4 (P3)**: After Foundational; extends match creation (solo path) + rating (US1) into queue/leaderboard.

### Within Each User Story
- Models/repositories before services; services before handlers/endpoints; core before integration; story complete before next priority.

### Parallel Opportunities
- All Setup tasks marked [P] (T002–T007) run in parallel after T001.
- Foundational [P] tasks (T008–T010, T012, T014–T017) run in parallel within Phase 2.
- Within US1, client components (T025–T029) are [P] once the server handlers (T019–T024) exist.

---

## Parallel Example: US1 Client Components

```bash
# Once US1 server handlers exist, build client pieces concurrently:
Task: "Client socket+API clients in client/src/lib/{socket.ts,api.ts}"
Task: "Match view + Board in client/src/app/match/[id]/page.tsx, client/src/components/Board.tsx"
Task: "VotingSidebar in client/src/components/VotingSidebar.tsx"
Task: "TeamChat in client/src/components/TeamChat.tsx"
Task: "Lobby in client/src/app/lobby/page.tsx"
```

---

## Implementation Strategy

### MVP scope decision (⚠️ revisit)
Spec-kit's default MVP is "User Story 1 only." However, `/speckit-clarify` chose **full competitive**, which pulls ratings/leaderboards/matchmaking into the MVP. Two options:
- **Lean first**: ship US1 (+ ELO on match_end, T024) as the first releasable increment, then layer US4's queue/leaderboard.
- **Full competitive MVP**: deliver US1 **and** the Phase 6 competitive layer (T036–T039) before launch.

Recommendation: build **US1 first** (it is independently shippable and proves the core loop), then decide whether to hold launch for the competitive layer.

### Incremental Delivery
1. Setup + Foundational → foundation ready.
2. US1 → test independently → demo (MVP core loop).
3. US2 → mobile parity → demo.
4. US3 → tie-break + roster → demo.
5. US4 → solo + queue + leaderboard → demo.
6. Polish → harden → full `quickstart.md` pass.

---

## Notes

- Tasks are immediately executable; each is specific enough to complete without extra context.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- Voice chat is **Phase 3 (post-MVP)** — no voice tasks here; a future spec will add LiveKit integration.
- Spectating is **Phase 4 (post-MVP)** — the realtime layer serves participants only at launch.
- Avoid: vague tasks, same-file conflicts between [P] tasks, cross-story dependencies that break independence.
