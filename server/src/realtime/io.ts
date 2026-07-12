import http from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";
import { Server, Socket, type DefaultEventsMap } from "socket.io";
import { verifyAccessToken } from "../auth/jwt.js";

/**
 * Realtime layer (constitution IV): Socket.io with the Redis adapter for
 * horizontal scaling, JWT-authenticated handshakes (client is never trusted),
 * and color-isolated rooms.
 */

export interface SocketData {
  userId: string;
  username: string;
  /** Set when the socket joins a match, so disconnect can clear presence. */
  matchId?: string;
  color?: "white" | "black";
}

export type AppServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
export type AppSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

export interface RealtimeDeps {
  httpServer: http.Server;
  redis: Redis;
  clientOrigin?: string;
}

export function createRealtimeServer(deps: RealtimeDeps): AppServer {
  const origin = deps.clientOrigin ?? process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
  const pubClient = deps.redis.duplicate();
  const subClient = deps.redis.duplicate();

  const io: AppServer = new Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >(deps.httpServer, {
    cors: { origin, credentials: true },
    adapter: createAdapter(pubClient, subClient),
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) {
      next(new Error("missing_token"));
      return;
    }
    verifyAccessToken(token)
      .then((claims) => {
        socket.data.userId = claims.sub;
        socket.data.username = claims.username;
        next();
      })
      .catch(() => next(new Error("invalid_token")));
  });

  io.on("connection", (socket) => {
    console.log(`[realtime] ${socket.data.username} connected (${socket.id})`);
    socket.on("disconnect", (reason) => {
      console.log(`[realtime] ${socket.id} disconnected (${reason})`);
    });
  });

  return io;
}

export function matchRoom(matchId: string): string {
  return `match_${matchId}`;
}

export function colorRoom(matchId: string, color: string): string {
  return `match_${matchId}_${color}`;
}

export async function joinMatchRooms(
  socket: AppSocket,
  matchId: string,
  color: string,
): Promise<void> {
  await socket.join(matchRoom(matchId));
  await socket.join(colorRoom(matchId, color));
}

export async function leaveMatchRooms(
  socket: AppSocket,
  matchId: string,
  color: string,
): Promise<void> {
  await socket.leave(matchRoom(matchId));
  await socket.leave(colorRoom(matchId, color));
}
