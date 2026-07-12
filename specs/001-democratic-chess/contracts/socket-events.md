# Contract: Socket.io Events

Authoritative client ↔ server contract for the realtime layer. Types live in `packages/types` (zod-validated; see `research.md` R10). Auth: a JWT is passed in the handshake `auth` payload; the server verifies before joining any room.

## Rooms

| Room | Members | Carries |
|------|---------|---------|
| `match_{id}` | both colors (+ spectators in Phase 4) | public state only: `turn_start`, `move_executed`, `match_end` |
| `match_{id}_white` | white team only | proposals, vote tallies, text chat |
| `match_{id}_black` | black team only | proposals, vote tallies, text chat |

Information isolation (constitution IV): private events are emitted **only** to the same-color room; opponents never see proposals, votes, or chat.

## Client → Server

### `propose_move`
Propose a move. Server validates against `Match.fen` via `chess.js`; if legal, it is added to the turn's ballot (duplicate `{from}:{to}:{promo}` collapses — see `data-model.md`) and `new_proposal` is broadcast to the same-color room.
```ts
{ matchId: string; from: Square; to: Square; promotion?: "q"|"r"|"b"|"n" }
```

### `vote_move`
Cast the member's single vote for a proposal on the ballot. Replaces any prior vote (one vote per member, changeable before window close).
```ts
{ matchId: string; moveKey: string }   // moveKey = `${from}:${to}:${promo ?? "-"}`
```

### `send_chat_message`
Send a text message to the same-color room only.
```ts
{ matchId: string; message: string }   // length 1–500, server-trimmed
```

### `execute_now` (optional)
If every active member of a side votes to execute early, the server ends the turn immediately and plays the leading proposal (early consensus path).
```ts
{ matchId: string }
```

## Server → Client

### `match_start` (to `match_{id}` + color rooms)
Initializes the match on the client.
```ts
{
  matchId: string; mode: "TEAM_VS_TEAM" | "SOLO_VS_TEAM";
  fen: string; youAre: "white" | "black";
  teammates: { userId: string; username: string; isCaptain: boolean }[];
  opponents: { count: number };        // names hidden; identity minimal
  moveWindowSec: number; timeBanks: { white: number; black: number }; // ms
}
```

### `turn_start` (to `match_{id}`)
Whose turn it is + authoritative deadline. Client countdown is display-only.
```ts
{ color: "white" | "black"; turnNumber: number; deadlineAt: string /* ISO */ }
```

### `new_proposal` (to same-color room)
A new move appeared on the ballot.
```ts
{ moveKey: string; san: string; from: Square; to: Square; proposerUsername: string }
```

### `vote_update` (to same-color room)
Updated tallies for the ballot this turn.
```ts
{ tallies: { moveKey: string; count: number }[]; totalVoters: number; activeMembers: number }
```

### `chat_message` (to same-color room)
```ts
{ userId: string; username: string; message: string; at: string /* ISO */ }
```

### `move_executed` (to `match_{id}`)
The authoritative move has been played. Clients set their board to this FEN (single source of truth — constitution I).
```ts
{ fen: string; san: string; from: Square; to: Square; color: "white"|"black"; moveKey: string }
```

### `match_end` (to `match_{id}`)
```ts
{ winner: "white" | "black" | "draw"; reason: "checkmate"|"stalemate"|"resignation"|"timeout"|"aborted" }
```

### `error` (to the offending socket)
```ts
{ code: "illegal_move"|"not_your_turn"|"not_in_match"|"invalid_payload"|string; message: string }
```

## Sequencing notes
- Turn resolution is triggered **only** by the server (timer expiry via Redis key, or unanimous `execute_now`). The leading proposal auto-executes at expiry; an empty ballot yields no move and the side's time bank keeps draining (`research.md` R7).
- Tie at resolution: captain double-vote, then earliest-proposed move key wins (FR-005).
- Voice events are out of scope for MVP (Phase 3); this contract will be extended then.
