/**
 * Realtime transport abstractions.
 *
 * These interfaces are the slice of the old Socket.io surface that the game
 * layer actually uses, kept stable so the transport (now uWebSockets.js) can
 * be swapped without touching game logic:
 *   - {@link AppSocket}: per-connection context + single-socket send + rooms.
 *   - {@link Realtime}:  room broadcast (`io.to(room).emit(event, data)`).
 *
 * Wire format is a tiny JSON envelope {@link Envelope}, used in both directions.
 */

export interface SocketData {
  userId: string;
  username: string;
  /** Set when the socket joins a match, so disconnect can clear presence. */
  matchId?: string;
  color?: "white" | "black";
}

/** Per-connection handle the game layer codes against. */
export interface AppSocket {
  readonly data: SocketData;
  emit(event: string, payload: unknown): void;
  join(room: string): void;
  leave(room: string): void;
}

/** Broadcast surface the game layer codes against (`io.to(room).emit(...)`). */
export interface Realtime {
  to(room: string): { emit(event: string, payload: unknown): void };
}

/** One JSON message on the wire: `{ "t": "<event>", "d": <payload> }`. */
export interface Envelope {
  t: string;
  d: unknown;
}

// ---- room naming (constitution IV — cross-team isolation depends on these) ----

export function matchRoom(matchId: string): string {
  return `match_${matchId}`;
}

export function colorRoom(matchId: string, color: string): string {
  return `match_${matchId}_${color}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export async function joinMatchRooms(socket: AppSocket, matchId: string, color: string): Promise<void> {
  socket.join(matchRoom(matchId));
  socket.join(colorRoom(matchId, color));
}

export async function leaveMatchRooms(socket: AppSocket, matchId: string, color: string): Promise<void> {
  socket.leave(matchRoom(matchId));
  socket.leave(colorRoom(matchId, color));
}
