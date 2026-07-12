# Socket.io Events API

All game communication happens via WebSockets. 

## Rooms
- `match_{id}`: Both teams and spectators.
- `match_{id}_white`: White team only (for proposals, votes, chat).
- `match_{id}_black`: Black team only.

## Client -> Server Events

### `propose_move`
Payload: `{ matchId, from, to, promotion? }`
Description: Client proposes a move. Server validates with `chess.js`. If valid, adds to Redis proposal list and emits `new_proposal` to the team room.

### `vote_move`
Payload: `{ matchId, moveId }`
Description: Client votes for a specific proposed move. Server increments tally in Redis and emits `vote_update`.

### `send_chat_message`
Payload: `{ matchId, message }`
Description: Sends a text message to the team room.

### `execute_now` (Optional)
Payload: `{ matchId }`
Description: If all active players on a team vote to execute early, the server ends the turn timer immediately and plays the highest-voted move.

## Server -> Client Events

### `match_start`
Payload: `{ matchId, fen, whiteTeam, blackTeam, turnTimeLimit, liveKitToken }`
Description: Initializes the game on the client.

### `turn_start`
Payload: `{ color, timeLimit }`
Description: Notifies clients whose turn it is and starts the local countdown timer.

### `new_proposal`
Payload: `{ moveId, san, from, to, proposerUsername }`
Description: Alerts clients of a new move to vote on. Updates the UI sidebar.

### `vote_update`
Payload: `{ moveId, voteCount }`
Description: Updates the vote tally on the UI.

### `move_executed`
Payload: `{ fen, san, color }`
Description: The final move has been played. Clients update `react-chessboard` to this new FEN state.

### `match_end`
Payload: `{ winner, reason }`
Description: Game over (Checkmate, Stalemate, Resignation, or Timeout).
