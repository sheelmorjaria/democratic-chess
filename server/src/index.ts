import "dotenv/config";
import http from "node:http";
import { createApp } from "./http/app.js";
import { getPrisma } from "./db/prisma.js";
import { getRedis } from "./db/redis.js";
import { createRealtimeApp } from "./realtime/uws.js";
import { initRuntime } from "./game/runtime.js";
import { logger } from "./observability/logger.js";

const port = Number(process.env.PORT ?? 3001);
// Express (REST) listens on a loopback port. The uWebSockets.js app owns the
// public PORT: it handles WebSocket upgrades natively and forwards plain HTTP
// here — one process, one public port, one URL for REST + WS.
const internalPort = Number(process.env.INTERNAL_PORT ?? port + 1);

const db = getPrisma();
const redis = getRedis();

const rt = createRealtimeApp({
  redis,
  internalPort,
  createEngine: (io) => initRuntime({ db, redis, io }),
});

// REST surface. The /queue and /matches routes reach the realtime bus via `io`
// (e.g. to push `queue_matched` to a user's personal room).
const expressApp = createApp({ db, redis, io: rt.bus });
const internal = http.createServer(expressApp);

async function main(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    internal.once("error", reject);
    internal.listen(internalPort, "127.0.0.1", () => {
      internal.removeListener("error", reject);
      resolve();
    });
  });
  await rt.listen(port);
  rt.bus.startBridge(); // cross-instance room fan-out (no-op for single instance)
  logger.info({ msg: "server.listening", url: `http://localhost:${port}`, internalPort });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ msg: "server.shutdown", signal });
    await rt.close();
    internal.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err, msg: "server.startup.error" });
  process.exit(1);
});
