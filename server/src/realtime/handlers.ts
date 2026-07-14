import type { AppSocket, Envelope } from "./realtime.js";
import type { RoomBus } from "./bus.js";
import type { TurnEngine } from "../game/turnEngine.js";
import { onCallJoin, onCallLeave, onRelaySignal } from "./voice.js";

/**
 * Route one inbound envelope to the game engine or the voice-signaling layer.
 * Called per WebSocket message by the uWS app.
 */
export function dispatchMessage(
  engine: TurnEngine,
  bus: RoomBus,
  socket: AppSocket,
  env: Envelope,
): Promise<void> {
  switch (env.t) {
    case "join_match":
      return engine.onJoinMatch(socket, env.d);
    case "propose_move":
      return engine.onProposeMove(socket, env.d);
    case "vote_move":
      return engine.onVoteMove(socket, env.d);
    case "execute_now":
      return engine.onExecuteNow(socket, env.d);
    case "send_chat_message":
      return engine.onSendChatMessage(socket, env.d);
    case "webrtc_join":
      onCallJoin(bus, socket, env.d);
      return Promise.resolve();
    case "webrtc_leave":
      onCallLeave(bus, socket);
      return Promise.resolve();
    case "webrtc_offer":
      onRelaySignal(bus, socket, "webrtc_offer", env.d);
      return Promise.resolve();
    case "webrtc_answer":
      onRelaySignal(bus, socket, "webrtc_answer", env.d);
      return Promise.resolve();
    case "webrtc_ice":
      onRelaySignal(bus, socket, "webrtc_ice", env.d);
      return Promise.resolve();
    default:
      return Promise.resolve();
  }
}
