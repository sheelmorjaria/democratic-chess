<!--
Sync Impact Report
- Version change: (none) -> 1.0.0
- Modified principles: flat numbered list converted to per-principle H3 sections.
  Wording tightened to declarative MUST statements; meaning preserved:
    1. Server Authority is Absolute
    2. Synchronous by Default
    3. Cross-Platform Parity
    4. Fair Play & Integrity
    5. Modularity of Communication
- Added sections: Architectural Constraints, Development Workflow, Governance,
  and the Version/Ratification footer.
- Removed sections: none.
- Templates requiring updates:
    .specify/templates/plan-template.md   - reviewed; "Constitution Check" GATE
      reads this file dynamically. No change needed.
    .specify/templates/spec-template.md   - reviewed; no constitution-specific
      references. No change needed.
    .specify/templates/tasks-template.md  - reviewed; no constitution-specific
      references. No change needed.
    .specify/templates/checklist-template.md - reviewed; no constitution-specific
      references. No change needed.
    .specify/templates/commands/          - directory absent in this project;
      speckit commands live as skills in .claude/skills/. No stale references.
- Follow-up TODOs: none.
- Rationale for 1.0.0 (MAJOR): initial ratification establishing baseline
  governance and all five core principles. There is no prior version to be
  backward-incompatible with, so 1.0.0 (rather than a MINOR/PATCH bump) is the
  correct baseline.
-->

# DemocraticChess Constitution

## Core Principles

### I. Server Authority is Absolute

The client MUST never be treated as the source of truth. All chess logic — move
generation, legality validation, check/checkmate/stalemate detection — vote
tallying, and game-state transitions MUST execute on the server. Clients are
renderers: they emit move *proposals* and never execute moves directly.

**Rationale:** A trust-the-client architecture is trivially exploitable in a
competitive game. A single authoritative engine guarantees rule integrity and an
identical board state for every participant and spectator.

### II. Synchronous by Default

Every gameplay interaction — move proposal, voting, move execution, and voice —
MUST meet real-time latency budgets. The experience MUST feel like a live
esports event, never correspondence chess. Latency-sensitive state (turn timers,
active proposals, vote tallies) MUST live in low-latency ephemeral storage
co-located with the game loop.

**Rationale:** The product's entire differentiation is synchronous, sub-minute
team decision-making. Any multi-second lag collapses the core value proposition
and reduces the game to the slow correspondence format it replaces.

### III. Cross-Platform Parity

Web and mobile MUST be feature-identical, with equal access to board, voting,
text chat, and voice. The UI MUST adapt to available screen real estate without
removing access to any core mechanic. One codebase (web app wrapped with
Capacitor) MUST serve both targets.

**Rationale:** A fragmented or degraded mobile experience caps the addressable
audience and breaks the "play anywhere with your friends" promise. A single
codebase guarantees parity and avoids duplicating game logic across platforms.

### IV. Fair Play & Integrity

Vote tallies MUST be transparent to the proposing team and invisible to
opponents. Tie-breakers MUST be deterministic and declared before the match
starts (e.g., captain double-vote, then earliest-proposed move wins). Team-private
channels — proposals, votes, chat, and voice — MUST be isolated from opponents
and spectators at the room level.

**Rationale:** Hidden information leaking to opponents destroys competitive
integrity. Non-deterministic tie-breakers stall games and feel arbitrary,
undermining trust in the outcome.

### V. Modularity of Communication

Text and voice chat MUST be independent, swappable modules behind stable
interfaces. Either MUST be replaceable or independently scalable without
touching the core game loop (propose -> vote -> execute).

**Rationale:** Coupling chat to game state, or hard-locking to a single vendor
(e.g., LiveKit), would make future migration and independent scaling impossible.
The game loop is the product's core and MUST remain agnostic to the
communication transport.

## Architectural Constraints

Non-negotiable technical rules derived from the Core Principles:

- **Single source of FEN truth:** Exactly one server-side `chess.js` instance per
  match is authoritative for board state. No client-reported FEN is ever trusted.
- **Minimal realtime payloads:** All gameplay events flow over WebSockets
  (Socket.io). Payloads MUST carry deltas/SAN/FEN, never full-board re-renders.
- **Ephemeral vs. persistent separation:** In-progress match state (timers,
  proposals, tallies, presence) lives in Redis; durable records (users, teams,
  completed matches) live in PostgreSQL.
- **Information isolation:** Per-match team rooms (`match_{id}_white`,
  `match_{id}_black`) MUST segregate proposals, votes, and chat from opponents.
  The shared `match_{id}` room carries only executed moves and public state.
- **Client validation is advisory only:** The client MAY validate moves for UX,
  but the server MUST re-validate every proposal before it enters the ballot.

## Development Workflow

- **Constitution supersedes:** This document overrides conflicting ad-hoc
  practices. Any deviation MUST be justified in the plan's Complexity Tracking
  table and survive the Constitution Check gate.
- **Chess-logic isolation:** `chess.js` usage MUST be isolated from render/UI
  code on both client and server, so the engine remains swappable and unit-testable.
- **Tests-first for rule-critical logic:** Move validation, vote tallying,
  tie-breaker resolution, and room isolation MUST have automated tests.
- **Compliance gate:** Every plan MUST pass a Constitution Check before research
  begins, and be re-checked after design (see Governance).

## Governance

- **Supremacy:** This constitution is the highest-authority project document.
  Specs, plans, and tasks MUST comply with it.
- **Amendment procedure:** An amendment requires (a) a written rationale,
  (b) an impact assessment of dependent specs/plans, and (c) a migration plan for
  in-flight work. Each amendment MUST be recorded in the Sync Impact Report
  prepended to this file.
- **Versioning policy:** Semantic versioning applies.
  - **MAJOR:** principle removal or redefinition (backward-incompatible).
  - **MINOR:** new principle or section, or materially expanded guidance.
  - **PATCH:** clarification, wording, or non-semantic refinement.
- **Compliance review:** The `/speckit-plan` Constitution Check gate MUST pass
  before Phase 0 research and be re-verified after Phase 1 design.

**Version**: 1.0.0 | **Ratified**: 2026-07-12 | **Last Amended**: 2026-07-12
