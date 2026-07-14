import type { RoomBus } from "./bus.js";
import type { AppSocket } from "./realtime.js";
import { colorRoom, userRoom } from "./realtime.js";
import { logger } from "../observability/logger.js";

/**
 * P2P team-voice signaling. The server only *introduces* peers and relays their
 * SDP/ICE — audio flows browser-to-browser over a WebRTC mesh (fine for the
 * small 3–5 player teams this app serves). Call membership is tracked in memory
 * per (match, color) so the roster can be broadcast; peers exchange offers/
 * answers/ICE directly through their personal `user:<id>` rooms.
 *
 * Glare-free: the client uses "lower userId offers", so each pair has exactly
 * one offer regardless of join order.
 */

interface CallPeer {
  userId: string;
  username: string;
}

// `${matchId}:${color}` → userId → peer
const calls = new Map<string, Map<string, CallPeer>>();
const MAX_PER_CALL = 8;

function key(matchId: string, color: string): string {
  return `${matchId}:${color}`;
}

function roster(matchId: string, color: string): CallPeer[] {
  const m = calls.get(key(matchId, color));
  return m ? [...m.values()] : [];
}

function broadcastRoster(bus: RoomBus, matchId: string, color: string): void {
  bus.to(colorRoom(matchId, color)).emit("webrtc_peers", {
    matchId,
    color,
    peers: roster(matchId, color),
  });
}

export function onCallJoin(bus: RoomBus, peer: AppSocket, _raw: unknown): void {
  const { userId, username, matchId, color } = peer.data;
  if (!matchId || !color || !userId) return;
  const k = key(matchId, color);
  let m = calls.get(k);
  if (!m) {
    m = new Map();
    calls.set(k, m);
  }
  if (m.size >= MAX_PER_CALL) {
    peer.emit("error", { code: "call_full", message: "team call is full" });
    return;
  }
  m.set(userId, { userId, username });
  logger.info({ msg: "voice.join", userId, matchId, color, peers: m.size });
  broadcastRoster(bus, matchId, color);
}

export function onCallLeave(bus: RoomBus, peer: AppSocket): void {
  const { userId, matchId, color } = peer.data;
  if (!matchId || !color || !userId) return;
  const m = calls.get(key(matchId, color));
  if (m && m.delete(userId)) {
    if (m.size === 0) calls.delete(key(matchId, color));
    broadcastRoster(bus, matchId, color);
  }
}

/** Relay a point-to-point signaling message (offer/answer/ice) to its target. */
export function onRelaySignal(
  bus: RoomBus,
  peer: AppSocket,
  event: string,
  raw: unknown,
): void {
  const data = raw as { to?: string; sdp?: unknown; candidate?: unknown } | null;
  const to = data?.to;
  if (!to) return;
  bus
    .to(userRoom(to))
    .emit(event, {
      from: peer.data.userId,
      ...(data && data.sdp !== undefined ? { sdp: data.sdp } : {}),
      ...(data && data.candidate !== undefined ? { candidate: data.candidate } : {}),
    });
}

/** Remove the socket from any call on disconnect, and rebroadcast the roster. */
export function onDisconnectCleanup(bus: RoomBus, peer: AppSocket): void {
  onCallLeave(bus, peer);
}
