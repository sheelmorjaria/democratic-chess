import type { AppServer } from "./io.js";
import type { TurnEngine } from "../game/turnEngine.js";
import { logger } from "../observability/logger.js";

/** Binds the game socket events to the TurnEngine. Call after `initRuntime`. */
export function registerGameHandlers(io: AppServer, engine: TurnEngine): void {
  io.on("connection", (socket) => {
    const log = logger.child({ socketId: socket.id, userId: socket.data.userId });
    socket.on("join_match", (raw: unknown) => {
      engine.onJoinMatch(socket, raw).catch((error) => log.error({ err: error, event: "join_match" }));
    });
    socket.on("propose_move", (raw: unknown) => {
      engine.onProposeMove(socket, raw).catch((error) => log.error({ err: error, event: "propose_move" }));
    });
    socket.on("vote_move", (raw: unknown) => {
      engine.onVoteMove(socket, raw).catch((error) => log.error({ err: error, event: "vote_move" }));
    });
    socket.on("execute_now", (raw: unknown) => {
      engine.onExecuteNow(socket, raw).catch((error) => log.error({ err: error, event: "execute_now" }));
    });
    socket.on("send_chat_message", (raw: unknown) => {
      engine.onSendChatMessage(socket, raw).catch((error) =>
        log.error({ err: error, event: "send_chat_message" }),
      );
    });
    socket.on("disconnect", () => {
      engine.onDisconnect(socket).catch((error) => log.error({ err: error, event: "disconnect" }));
    });
  });
}
