# Contract: REST API

HTTP endpoints for everything outside the live match loop (auth, teams, matchmaking, match history, leaderboard). All realtime gameplay is via Socket.io — see [socket-events.md](./socket-events.md). Schemas are zod-validated; request/response bodies show the relevant fields.

## Conventions
- Base URL: `http://localhost:3001` (dev).
- Auth: `Authorization: Bearer <accessToken>` (JWT). Tokens issued by `/auth/*` (`research.md` R2).
- Errors: `{ code: string, message: string }` with appropriate HTTP status.

## Auth
| Method | Path | Body → 200 |
|--------|------|------------|
| POST | `/auth/register` | `{ username, email, password }` → `{ accessToken, user }` (+ refresh HttpOnly cookie) |
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, user }` |
| POST | `/auth/refresh` | *(refresh cookie)* → `{ accessToken }` |
| GET | `/auth/me` | — → `User` (id, username, email) |

## Teams (captain authority — FR-014)
| Method | Path | Body → 200 |
|--------|------|------------|
| POST | `/teams` | `{ name }` → `Team` (creator becomes captain) |
| GET | `/teams/:id` | — → `Team` + roster |
| PATCH | `/teams/:id` | `{ name? }` → `Team` (captain only) |
| POST | `/teams/:id/members` | `{ userId }` → `TeamMembership` (captain invite) |
| DELETE | `/teams/:id/members/:userId` | — → `204` (captain remove) |

## Matchmaking queue (FR-012)
| Method | Path | Body → 200 |
|--------|------|------------|
| POST | `/queue/join` | `{ subjectType: "TEAM"\|"SOLO", subjectId }` → `{ queued: true, searchBand }` |
| DELETE | `/queue/leave` | — → `204` |
| GET | `/queue/status` | — → `{ state, estimatedWaitSec }` |

When the queue forms a pairing, the server creates a `Match` and clients are directed to the match via a `match_start` socket event. Rating-band widening logic: see `research.md` R6.

## Matches
| Method | Path | Body → 200 |
|--------|------|------------|
| POST | `/matches` | `{ mode, whiteSubject, blackSubject }` (direct challenge) → `Match` |
| GET | `/matches/:id` | — → `Match` summary |
| GET | `/matches` | `?limit&before` → paginated match history for the caller |

## Rating & Leaderboard (FR-013)
| Method | Path | Body → 200 |
|--------|------|------------|
| GET | `/leaderboard` | `?type=team\|solo&limit` → `{ entries: [{ subjectId, name, rating, wins, losses, draws }] }` |
| GET | `/ratings/:subjectType/:subjectId` | — → `Rating` |

## Notes
- Rating updates (`Rating` table, ELO) are computed server-side on `match_end` (`research.md` R5) and are not directly writable by clients.
- All entities referenced here are defined in [data-model.md](../data-model.md).
