# Feature Specification: Democratic Team Chess

**Feature Branch**: `001-democratic-chess`

**Created**: 2026-07-12

**Status**: Draft

**Input**: Reconciled from the originally authored "Spec 001" draft and aligned to the project constitution at `.specify/memory/constitution.md`.

## Problem & Audience

**Problem**: Current online chess platforms treat "Vote Chess" as an asynchronous, multi-day correspondence format. Players discuss moves in forums or external voice apps and vote once per day, which strips away the tension, adrenaline, and rapid strategic collaboration found in live esports. Bridging real-time voice communication, live voting, and a unified chessboard state today forces users to juggle several disconnected applications.

**Target Audience**:

- Groups of friends (3–6 people) who want to play chess collaboratively.
- Chess clubs looking for a synchronous team-battle format.
- Streamers and their communities who want a structured, real-time "chat plays" format.

## Clarifications

### Session 2026-07-12

- Q: Should real-time voice chat be part of the MVP? → A: No — text chat is the MVP communication baseline; voice is deferred to Phase 3. This keeps LiveKit/WebRTC off the MVP critical path and matches the ROADMAP.
- Q: What team-formation and matching model is in scope for v1? → A: Full competitive — persistent teams, ELO ratings, and an auto-matchmaking queue are all in the MVP. (Note: this pulls ratings, leaderboards, and matchmaking — ROADMAP Phase 4 — into the MVP; the ROADMAP should be re-sequenced during `/speckit-plan`.)
- Q: When the per-move decision window expires, what happens? → A: The highest-voted legal move auto-executes. The per-move window is a pacing soft cap, distinct from the total time bank — only exhausting the time bank loses on time (FR-008). If the ballot is empty at expiry, no move is made and the time bank keeps draining.
- Q: What authority does a team captain have in the MVP? → A: A double-weight tie-break vote (FR-005) plus roster management (invite/remove members, set match parameters). Voice-room mute/kick moderation is deferred to Phase 3 with voice.
- Q: Is live spectating part of the MVP? → A: No — spectating is deferred to post-MVP (ROADMAP Phase 4). The MVP realtime layer serves match participants only; there is no read-only spectating path at launch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Team vs Team Blitz Match (Priority: P1)

A casual player wants to play a short blitz game with three friends against another team, debating and laughing over moves together in real time.

**Why this priority**: This is the core value proposition — the synchronous, collaborative team chess loop. It is the MVP slice; no other story delivers value without it.

**Independent Test**: Two teams (e.g., four players each) can start a match and complete a full game end to end through the propose → vote → execute loop, with the board updating for everyone after each turn.

**Acceptance Scenarios**:

1. **Given** two teams are matched, **When** the white team's turn opens, **Then** every white member can see the board and the decision-window countdown.
2. **Given** a white member proposes a legal move and the team votes, **When** the decision window closes, **Then** the highest-voted legal move executes and the new position appears to both teams within about one second.

---

### User Story 2 - Mobile Participation (Priority: P2)

A mobile user wants to vote and chat with their team without the screen becoming cluttered. (Real-time voice rejoins the mobile experience in Phase 3.)

**Why this priority**: Cross-platform parity is a constitution principle, but it depends on the core loop (US1) existing first; mobile is the second MVP layer that broadens the audience.

**Independent Test**: On a phone, a player can join a match, view the board, vote on a proposal, and use team chat without losing access to any core mechanic.

**Acceptance Scenarios**:

1. **Given** a match is in progress on a mobile device, **When** the player opens the voting panel, **Then** they can see proposals and cast a vote without the board becoming hidden or unusable.
2. **Given** the player is using team chat, **When** they switch between board, votes, and chat views, **Then** chat stays usable and no core action is blocked.

---

### User Story 3 - Captain Tie-Breaker (Priority: P3)

A team captain wants their vote to break ties so the game does not stall when the team is split 50/50.

**Why this priority**: It refines the voting experience and prevents stalls, but it only matters once voting (US1) exists.

**Independent Test**: In a match with a captain, a tied vote resolves to a single move within the same turn window, with no stall.

**Acceptance Scenarios**:

1. **Given** the turn ends with two proposals tied for the most votes, **When** the result is computed, **Then** the captain's preferred proposal is selected (the captain's vote counts double).
2. **Given** a tie persists even after captain weighting, or no captain is connected, **When** the result is computed, **Then** the earliest-proposed tied move is selected deterministically.

---

### User Story 4 - Solo vs Team Challenge (Priority: P3)

A solo player wants to challenge a team of lower-rated players to test their skills against a hive mind.

**Why this priority**: An alternate match mode that broadens appeal; it is not required for the core MVP.

**Independent Test**: A single player can create or join a Solo vs Team match, play their own moves directly, and face a team that votes.

**Acceptance Scenarios**:

1. **Given** a Solo vs Team match, **When** it is the solo player's turn, **Then** they play a single move directly with no voting step.
2. **Given** it is the team's turn, **When** the team proposes and votes, **Then** the solo player sees only the executed move — never the team's proposals, votes, or chat.

---

### Edge Cases

- **Tie with no captain connected**: fall back to the earliest-proposed tied move (deterministic).
- **No proposals when the window closes**: the leading proposal at expiry executes; if there are zero proposals, the turn yields no move and the team's time bank keeps draining.
- **Team time bank exhausted**: that team loses on time (flag).
- **Duplicate or simultaneous proposals of the same move**: collapsed into a single ballot entry, with votes merged.
- **Illegal move submitted by a participant**: rejected before it reaches the ballot; it never appears for voting.
- **Promotion piece unspecified**: defaults to queen.
- **Unanimous consensus before the window closes**: the move executes immediately (early execute).
- **All team members disconnect**: that team forfeits; a team with at least one connected member continues.
- **Spectating (post-MVP)**: when live spectating ships (Phase 4), spectators see board state only and cannot join any team room; not in scope for the MVP.
- **Reconnect after a network drop**: the participant resynchronizes to the authoritative board state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support both Team vs Team and Solo vs Team matchups, formed either via an auto-matchmaking queue that pairs participants by rating or via direct challenge.
- **FR-002**: Each team MUST have a configurable total time bank (default 10 minutes) and a per-move decision window (default 60 seconds).
- **FR-003**: During a team's turn, any member MAY propose one or more legal moves; the system MUST validate each proposal against the rules of chess before it appears on the ballot.
- **FR-004**: Each team member MAY cast a single vote per turn for any ballot proposal; the live tally MUST be visible to their own team only.
- **FR-005**: At the end of a turn (window expiry or unanimous consent), the system MUST execute the highest-tallied legal move; ties MUST resolve deterministically (captain double-vote, then earliest proposed). Window expiry is a pacing soft cap, separate from the total time bank (FR-008).
- **FR-006**: Each team MUST have a private text chat channel, isolated from opponents and spectators. (A real-time voice channel is a Phase 3 enhancement, not part of the MVP.)
- **FR-007**: The game MUST be fully playable on desktop browsers and mobile devices with feature parity across board, voting, and text chat (voice joins parity in Phase 3).
- **FR-008**: If a team's time bank is exhausted, that team MUST lose on time.
- **FR-009**: A match MUST continue as long as a team has at least one connected member; a team with zero connected members MUST forfeit.
- **FR-010**: In a Solo vs Team match, the solo player MUST play moves directly on their turn, bypassing the voting step.
- **FR-011**: The system MUST maintain persistent teams (rosters with a captain) that persist across matches.
- **FR-012**: The system MUST provide an auto-matchmaking queue that pairs teams or solo players by rating within a configurable band.
- **FR-013**: The system MUST assign and update an ELO rating for each team and solo player based on match results, and MUST expose a leaderboard.
- **FR-014**: The team captain MUST hold a double-weight tie-break vote (FR-005) and MUST be able to invite or remove team members and set match parameters. Voice-room moderation (mute/kick) is a Phase 3 capability.

### Key Entities

- **User**: A player account (identity and display name).
- **Team**: A persistent roster of users (a club) with a captain; a team competes across multiple matches and carries a rating. The captain manages the roster (invite/remove members) and sets match parameters. (Ad-hoc pick-up teams may be supported later, but persistent teams are the MVP model.)
- **Rating & Leaderboard**: An ELO rating for each team and solo player, updated from match results, with a public leaderboard ranking participants.
- **Match**: A single game instance with a board state, current turn, time banks, status (waiting / active / completed / aborted), and winner.
- **MatchParticipant**: Links a user to a match and assigns their team color and captain flag.
- **MoveProposal**: A candidate move on a team's ballot for the current turn, with its proposer, notation, and vote tally.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A team of four can play a full game where at least 90% of turns resolve within the per-move decision window.
- **SC-002**: After a move executes, the board position is consistent across all participants within one second.
- **SC-003**: A new player can join a match from an invite and cast a first vote within two minutes.
- **SC-004**: No opponent can perceive any rival team's proposal, vote, text, or voice (zero information leaks).
- **SC-005**: Mobile and web users can each complete the full propose → vote → chat flow without losing access to any core mechanic.
- **SC-006**: 100% of tied votes resolve to a single move without stalling the game.
- **SC-007**: The matchmaking queue pairs opponents within a defined rating band, and a queued match starts within two minutes of a full lobby forming.

## Assumptions

- Default time controls are a 10-minute team time bank and a 60-second per-move decision window, configurable per match.
- The per-move window is a soft cap: at expiry the leading proposal auto-executes. The team time bank is the hard limit; exhausting it loses on time (the standard chess flag convention).
- Default tie-break ordering: the captain's vote counts double; if still tied or no captain is connected, the earliest-proposed tied move wins.
- Default team size is up to five per side; Solo vs Team pits one player against a team.
- Each member gets one vote per turn and may change it before the window closes; a member may propose multiple distinct moves in a turn.
- Authentication is standard account-based; the specific mechanism is out of scope for this spec.
- Text chat is the MVP communication channel. Voice chat is deferred to Phase 3 and, when added, will require microphone and speaker permission.
- A team remains in the match while at least one member is connected.
- Teams are persistent (rosters with a captain) in the MVP, and each team and solo player carries an ELO rating surfaced on a leaderboard. Matchmaking pairs participants by rating; ratings and the leaderboard are MVP scope (pulled forward from ROADMAP Phase 4).
- Live spectating is out of scope for the MVP (ROADMAP Phase 4); the realtime layer serves match participants only.
