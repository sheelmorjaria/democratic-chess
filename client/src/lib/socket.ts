"use client";

/**
 * Realtime client over a native WebSocket (the server now runs uWebSockets.js,
 * not Socket.io). Exposes the same surface the pages use — getSocket / emit /
 * on / off / setActiveMatch / onConnectionChange / resetSocket — so pages are
 * unchanged. Wire format is the JSON envelope `{ t, d }`.
 *
 * The returned handle is a stable singleton: its listeners survive reconnects,
 * and on every (re)connect it re-emits `join_match` for the active match so the
 * server resends authoritative state (constitution I).
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WS_URL = API.replace(/^http/, "ws");

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

interface Envelope {
  t: string;
  d: unknown;
}

/** Stable handle the pages hold; delegates to module state. */
export interface DcSocket {
  emit(event: string, data: unknown): void;
  // `any` (not `unknown`) so pages can register typed handlers like
  // `(data: MatchStart) => …`; the eslint recommended config does not flag it.
  on(event: string, cb: (data: any) => void): void;
  off(event: string, cb: (data: any) => void): void;
}

let ws: WebSocket | null = null;
let everOpened = false;
let stopped = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 500;
let socketHandle: DcSocket | null = null;
/** The match the client is in, so a dropped socket can re-`join_match` on reconnect. */
let activeMatchId: string | null = null;

const listeners = new Map<string, Set<(data: any) => void>>();
const stateListeners = new Set<(state: ConnectionState) => void>();

function setState(state: ConnectionState): void {
  for (const cb of stateListeners) cb(state);
}

function dispatch(env: Envelope): void {
  const set = listeners.get(env.t);
  if (set) for (const cb of set) cb(env.d);
}

function emit(event: string, data: unknown): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: event, d: data }));
  }
}

function connect(token: string): void {
  setState("connecting");
  everOpened = false;
  const sock = new WebSocket(`${WS_URL}/?token=${encodeURIComponent(token)}`);
  ws = sock;

  sock.addEventListener("open", () => {
    everOpened = true;
    reconnectDelay = 500;
    setState("connected");
    // Resync: rejoin the active match so the server re-sends authoritative state.
    if (activeMatchId) emit("join_match", { matchId: activeMatchId });
  });

  sock.addEventListener("message", (event) => {
    const text =
      typeof event.data === "string"
        ? event.data
        : new TextDecoder().decode(event.data as ArrayBuffer);
    let env: Envelope;
    try {
      env = JSON.parse(text) as Envelope;
    } catch {
      return;
    }
    dispatch(env);
  });

  sock.addEventListener("close", () => {
    ws = null;
    if (stopped || !everOpened) {
      // Explicit reset, OR the first connection never opened (auth reject /
      // unreachable) — don't hammer the server in a reconnect loop.
      setState("disconnected");
      return;
    }
    setState("reconnecting");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (stopped || !token) {
        setState("disconnected");
        return;
      }
      reconnectDelay = Math.min(reconnectDelay * 2, 5000);
      connect(token);
    }, reconnectDelay);
  });

  sock.addEventListener("error", () => {
    /* a `close` always follows */
  });
}

/** Returns the singleton socket handle (creates it from the stored token), or null if unauthenticated. */
export function getSocket(): DcSocket | null {
  if (typeof window === "undefined") return null;
  if (socketHandle) return socketHandle;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;

  stopped = false;
  socketHandle = {
    emit,
    on: (event, cb) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb);
    },
    off: (event, cb) => {
      listeners.get(event)?.delete(cb);
    },
  };
  connect(token);
  return socketHandle;
}

/** Registers the match the client is in (null on leave) for reconnect-resync. */
export function setActiveMatch(matchId: string | null): void {
  activeMatchId = matchId;
}

/** Subscribes to connection-state changes (for "Reconnecting…" banners). Returns an unsubscribe fn. */
export function onConnectionChange(cb: (state: ConnectionState) => void): () => void {
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}

/** Tears down the socket (e.g. on logout). Suppresses any pending reconnect. */
export function resetSocket(): void {
  stopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    ws = null;
  }
  socketHandle = null;
  activeMatchId = null;
  listeners.clear();
  stateListeners.clear();
}
