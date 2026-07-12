import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "node:http";
import { Server } from "socket.io";

const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

const app = express();

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "democratic-chess-server" });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: clientOrigin, credentials: true },
});

io.on("connection", (socket) => {
  console.log(`[realtime] connected: ${socket.id}`);
  socket.on("disconnect", (reason) => {
    console.log(`[realtime] disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
