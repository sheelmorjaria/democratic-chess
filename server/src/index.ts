import "dotenv/config";
import http from "node:http";
import { createApp } from "./http/app.js";
import { getPrisma } from "./db/prisma.js";
import { getRedis } from "./db/redis.js";
import { createRealtimeServer } from "./realtime/io.js";

const port = Number(process.env.PORT ?? 3001);

const app = createApp({ db: getPrisma() });
const httpServer = http.createServer(app);

createRealtimeServer({ httpServer, redis: getRedis() });

httpServer.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
