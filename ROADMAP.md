# Project Roadmap

## Phase 1: MVP (Minimum Viable Product)
- [ ] Basic User Authentication
- [ ] Setup Next.js client and Node/Express server
- [ ] Implement Socket.io connection
- [ ] Create `chess.js` backend game state authority
- [ ] Implement `react-chessboard` on frontend with click-to-move
- [ ] Basic 1v1 real-time chess (no voting yet)

## Phase 2: Team Dynamics
- [ ] Implement team creation and matchmaking
- [ ] Build "Propose Move" UI/UX
- [ ] Build "Voting" sidebar UI
- [ ] Implement Redis-backed voting logic
- [ ] Implement turn timers and auto-execution
- [ ] Implement tie-breaker logic (Team Captain)

## Phase 3: Communication
- [ ] Integrate Socket.io text chat (team-only rooms)
- [ ] Integrate LiveKit for real-time voice chat
- [ ] Add mute/deafen controls in UI
- [ ] Add push-to-talk and voice activity detection

## Phase 4: Polish & Mobile
- [ ] Implement Capacitor for iOS/Android wrapping
- [ ] Design responsive mobile layout (drawers for chat/votes)
- [ ] Add touch-action CSS to prevent mobile scrolling bugs
- [ ] Implement "Team vs. Individual" mode
- [ ] Add spectator mode
- [ ] Leaderboards and ELO rating system for teams
