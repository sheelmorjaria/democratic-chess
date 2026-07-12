import "dotenv/config";
import http from "node:http";
import { createApp } from "./http/app.js";
import { getPrisma } from "./db/prisma.js";
import { getRedis } from "./db/redis.js";
import { createRealtimeServer } from "./realtime/io.js";
import { registerGameHandlers } from "./realtime/handlers.js";
import { initRuntime } from "./game/runtime.js";
import { logger } from "./observability/logger.js";

const port = Number(process.env.PORT ?? 3001);

const db = getPrisma();
const redis = getRedis();

// Build the realtime server first (needs the http server), then the game
// runtime (needs io), then Express (the match route reaches the runtime via
// the singleton at request time, avoiding a construction cycle).
const httpServer = http.createServer();
const io = createRealtimeServer({ httpServer, redis });
const turnEngine = initRuntime({ db, redis, io });
registerGameHandlers(io, turnEngine);

const app = createApp({ db, redis, io });
httpServer.on("request", app);

httpServer.listen(port, () => {
  logger.info({ msg: "server.listening", url: `http://localhost:${port}` });
});
