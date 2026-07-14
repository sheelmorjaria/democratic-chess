# Project Roadmap

> Last updated: 2026-07-14. Tracks status against the spec-driven build in
> `specs/001-democratic-chess/` (see `tasks.md` for task-level detail) and
> [Architecture & Game Loop](./ARCHITECTURE.md).
>
> Legend: ✅ done · 🟡 partial / config-only · ⬜ not started

## ✅ Foundation & Core Loop
- ✅ Monorepo (npm workspaces): `client`, `server`, `packages` + Docker Compose (Postgres, Redis) + tooling
- ✅ Auth: JWT (jose/bcryptjs) register/login/refresh over REST; uWebSockets.js JWT handshake
- ✅ Prisma schema + migration; Redis module; shared zod types
- ✅ uWebSockets.js realtime (Redis room-bridge), color rooms, presence
- ✅ Authoritative `chess.js` engine; ephemeral voting/presence helpers; repositories

## ✅ US1 — Realtime Team Match Loop
- ✅ Teams & matches REST; matchService
- ✅ TurnEngine: turn-timer orchestration + `resolveLeading` auto-execution
- ✅ Propose / vote / execute / chat socket handlers; `executeMove`
- ✅ Match end + ELO update
- ✅ Next.js client: REST + WebSocket wrappers, AuthProvider, login, lobby, match view (`react-chessboard` + voting sidebar + team chat)

## ✅ US2 — Responsive & Mobile-Ready
- ✅ Responsive layout (flex-wrap, stacks on phones)
- ✅ `touch-action: none` on the board (mobile drag parity)
- ✅ Capacitor config (@capacitor/core+cli)

## ✅ US3 — Captain & Roster
- ✅ Captain double-weight tie-break (`weightTallies`, earliest-proposed fallback)
- ✅ Captain-gated roster REST (POST/DELETE `/teams/:id/members`) + UI

## ✅ US4 — Matchmaking, Solo & Leaderboard
- ✅ Solo turn (direct `applyMove`, bypassing voting)
- ✅ Matchmaking queue (solo + team, cross-type pairing) + queue REST + matchmaker
- ✅ Leaderboard REST + UI (Teams / Solo tabs)
- ✅ Competitive integration test (matchmaker pairing + solo direct move + dual rating update)

## ✅ Polish & Hardening
- ✅ Observability: pino + correlation IDs (`x-correlation-id`)
- ✅ Client reconnect/resync to authoritative FEN
- ✅ Error / empty / loading states across the match UI; solo hides ballot & chat
- ✅ Forfeit (with reconnection grace), terminal match state, overlapping-roster rejection

## ✅ UI Redesign & Theming (2026-07-14)
- ✅ Token-driven design system (CSS custom properties) — inline styles removed
- ✅ Four runtime-switchable themes: Tournament (dark), Minimal light, Classic warm, Glass/neon
- ✅ Header swatch picker; persisted to `localStorage`; system-preference fallback; no-flash bootstrap
- ✅ `ui/` primitives (Button, Field, Card, Badge, Banner, Spinner, EmptyState, ThemeSwatches, Header, AppShell)
- ✅ All 5 screens + Voting/Chat/Roster rebuilt; board recolors per theme
- ✅ Figma source-of-truth file ([2c7XMot7lcnlAaitdcgVZw](https://www.figma.com/design/2c7XMot7lcnlAaitdcgVZw))

## ✅ UX & Accessibility (2026-07-14)
- ✅ Per-theme piece sets (Unicode silhouettes; fill / stroke / glow per theme)
- ✅ Click-to-move + legal-move dots + king-in-check highlight on the board (`chess.js`-driven)
- ✅ Accessibility: skip-to-content link, `aria-live` regions for turn/errors, board `aria-label`, visually-hidden login heading, focus-visible coverage

## ✅ Realtime transport → uWebSockets.js (2026-07-14)
- ✅ Socket.io replaced by uWebSockets.js (uWS owns the public port; HTTP forwarded to Express on a loopback port; `{t,d}` envelope; JWT at `?token=`)
- ✅ Drop-in `Realtime`/`AppSocket` interfaces keep game logic unchanged; color-room isolation + opponent-isolation + forfeit invariants preserved (44 tests green)
- ✅ Client on native `WebSocket` (reconnect/resync, on-open re-`join_match`, logout teardown)

## ✅ Team voice — P2P WebRTC mesh + coturn (2026-07-14)
- ✅ Browser-to-browser audio mesh (3–5 per team); server only relays signaling (`webrtc_offer/answer/ice`) + roster via color/personal rooms
- ✅ "Lower-id-offers" glare rule; mute toggle; mic-device picker; `CallBar` in the match (hidden for solo)
- ✅ `GET /webrtc/ice` (STUN always + TURN when configured); coturn compose service (`--profile turn`)

## ✅ Roster invite-by-email (2026-07-14)
- ✅ `TeamInvite` table + migration; captain invites by email → registered users added instantly, others get a shareable `/join?token=` link, auto-consumed on register
- ✅ Lobby "My teams" selector (no more id-paste); `/join` page; login `?next=` round-trip

---

## 🟡 / ⬜ Next Up (Backlog)

### Native mobile
- 🟡 Capacitor config present; web build only
- ⬜ `next` `output: "export"` static export
- ⬜ `cap add ios` / `cap add android` native shells
- ⬜ Mobile drawers for chat/voting on small screens

### Gameplay & social
- ⬜ Spectator mode

### Quality
- ⬜ Playwright E2E harness (today: vitest integration tests only)
