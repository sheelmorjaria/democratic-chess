import type { AppServer } from "./io.js";
import type { TurnEngine } from "../game/turnEngine.js";

/** Binds the game socket events to the TurnEngine. Call after `initRuntime`. */
export function registerGameHandlers(io: AppServer, engine: TurnEngine): void {
  io.on("connection", (socket) => {
    socket.on("join_match", (raw: unknown) => {
      engine.onJoinMatch(socket, raw).catch((error) => console.error("[join_match]", error));
    });
    socket.on("propose_move", (raw: unknown) => {
      engine.onProposeMove(socket, raw).catch((error) => console.error("[propose_move]", error));
    });
    socket.on("vote_move", (raw: unknown) => {
      engine.onVoteMove(socket, raw).catch((error) => console.error("[vote_move]", error));
    });
    socket.on("execute_now", (raw: unknown) => {
      engine.onExecuteNow(socket, raw).catch((error) => console.error("[execute_now]", error));
    });
    socket.on("send_chat_message", (raw: unknown) => {
      engine.onSendChatMessage(socket, raw).catch((error) => console.error("[send_chat_message]", error));
    });
    socket.on("disconnect", () => {
      engine.onDisconnect(socket).catch((error) => console.error("[disconnect]", error));
    });
  });
}
