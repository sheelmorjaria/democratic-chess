import { io, type Socket } from "socket.io-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

let socket: Socket | null = null;

/**
 * The match a client is currently in, so a dropped socket can re-`join_match` on
 * reconnect. The server is the single source of truth (constitution I): on a
 * successful re-join the server re-emits `match_start` with the authoritative
 * FEN, which resyncs the board without trusting any client-held state.
 */
let activeMatchId: string | null = null;

const listeners = new Set<(state: ConnectionState) => void>();

function setState(state: ConnectionState): void {
  for (const cb of listeners) cb(state);
}

/** Returns the singleton socket (creates it from the stored access token), or null if unauthenticated. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (socket) return socket;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  socket = io(API, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  setState("connecting");
  socket.on("connect", () => {
    setState("connected");
    // Resync: rejoin the active match so the server re-sends authoritative state.
    if (activeMatchId) socket?.emit("join_match", { matchId: activeMatchId });
  });
  socket.on("disconnect", () => setState("disconnected"));
  socket.io.on("reconnect_attempt", () => setState("reconnecting"));
  socket.io.on("reconnect_failed", () => setState("disconnected"));

  return socket;
}

/** Registers the match the client is in (null on leave) for reconnect-resync. */
export function setActiveMatch(matchId: string | null): void {
  activeMatchId = matchId;
}

/** Subscribes to connection-state changes (for "Reconnecting…" banners). Returns an unsubscribe fn. */
export function onConnectionChange(cb: (state: ConnectionState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
  activeMatchId = null;
}
