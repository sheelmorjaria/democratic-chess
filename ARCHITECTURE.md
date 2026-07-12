# Architecture & Game Loop

## Core Principle: Server Authority
The client is never trusted. `chess.js` runs on the server as the source of truth. Clients only send *proposals*; the server executes the final move based on team votes.

## The Synchronous Game Loop
1. **Matchmaking:** Matchmaker groups Team A (e.g., 5 players) vs Team B (5 players) or 1 Player.
2. **Turn Start:** Server initializes turn timer (e.g., 60s) and emits `turn_start`.
3. **Proposal Phase:** 
   - Players drag pieces on `react-chessboard`.
   - Client uses local `chess.js` to validate the move visually.
   - Client emits `propose_move` to the server (does not move the piece globally).
4. **Voting Phase:**
   - Server broadcasts valid proposals to the *same team only*.
   - Players click to vote. Server tallies votes in Redis.
5. **Execution:**
   - Timer expires OR team reaches 100% consensus.
   - Server executes highest-voted move on the master `chess.js` instance.
   - *Tie-breaker:* Team Captain's vote counts as 2, or first-proposed move wins.
6. **Sync:** Server emits `move_executed` with new FEN string to all clients and spectators.

## Cross-Platform Architecture (Web & Mobile)
- The frontend is a standard React web application.
- `react-chessboard` renders via HTML/CSS.
- **Mobile Build:** The web app is wrapped using **Capacitor** to deploy to iOS and Android. This avoids the complexity of React Native Webview bridges and natively supports WebRTC for voice chat.
- **Mobile UX:** The board takes full screen. Voting and Chat are accessible via slide-out drawers or bottom tabs to conserve screen real estate.

## Voice Chat Architecture
- Uses **LiveKit** for scalable, low-latency WebRTC.
- When a match starts, the backend generates a LiveKit JWT for each user.
- Clients connect to a LiveKit room specific to their team color (e.g., `match_123_white_voice`). Opponents cannot join.
