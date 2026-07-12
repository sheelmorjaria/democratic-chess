import { io, type Socket } from "socket.io-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

/** Returns the singleton socket (creates it from the stored access token), or null if unauthenticated. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (socket) return socket;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  socket = io(API, { auth: { token }, transports: ["websocket"] });
  return socket;
}

export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}
