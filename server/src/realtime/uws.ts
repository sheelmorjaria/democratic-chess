import http from "node:http";
import * as uWS from "uWebSockets.js";
import type { Redis } from "ioredis";
import type { AppSocket, Envelope, SocketData } from "./realtime.js";
import { userRoom } from "./realtime.js";
import { RoomBus } from "./bus.js";
import { dispatchMessage } from "./handlers.js";
import { onDisconnectCleanup } from "./voice.js";
import type { TurnEngine } from "../game/turnEngine.js";
import { verifyAccessToken } from "../auth/jwt.js";
import { logger } from "../observability/logger.js";

/**
 * uWebSockets.js realtime app. Owns the public PORT: handles WebSocket
 * upgrades natively and forwards plain HTTP to Express on a loopback port
 * (see {@link forwardHttp}). Auth is a JWT in the `?token=` query, verified at
 * upgrade time (missing/invalid → 401, the connection is rejected).
 */

type UwsSocket = uWS.WebSocket<SocketData>;

/** {@link AppSocket} backed by a uWS WebSocket. Reads context live from the
 *  connection's UserData, so mutations by the game layer (matchId/color) stick. */
export class Peer implements AppSocket {
  constructor(private readonly ws: UwsSocket) {}
  get data(): SocketData {
    return this.ws.getUserData();
  }
  emit(event: string, payload: unknown): void {
    const env: Envelope = { t: event, d: payload };
    this.ws.cork(() => this.ws.send(JSON.stringify(env)));
  }
  join(room: string): void {
    this.ws.subscribe(room);
  }
  leave(room: string): void {
    this.ws.unsubscribe(room);
  }
}

export interface RealtimeAppOptions {
  redis: Redis;
  /** Loopback port Express listens on; plain HTTP is forwarded here. */
  internalPort: number;
  /** Builds the TurnEngine once the room bus exists (breaks the io↔engine cycle). */
  createEngine: (io: RoomBus) => TurnEngine;
  /** Verify the JWT; defaults to {@link verifyAccessToken}. Throw to reject. */
  verify?: (token: string) => Promise<SocketData>;
  /** Seconds of idle before uWS closes a socket (0 disables). */
  idleTimeout?: number;
  maxPayloadLength?: number;
}

export interface RealtimeApp {
  bus: RoomBus;
  engine: TurnEngine;
  app: uWS.TemplatedApp;
  listen(port: number, host?: string): Promise<{ port: number; socket: uWS.us_listen_socket }>;
  close(): Promise<void>;
}

async function defaultVerify(token: string): Promise<SocketData> {
  const claims = await verifyAccessToken(token);
  return { userId: claims.sub, username: claims.username };
}

export function createRealtimeApp(opts: RealtimeAppOptions): RealtimeApp {
  const app = uWS.App();
  const bus = new RoomBus(app, opts.redis);
  const engine = opts.createEngine(bus);
  const verify = opts.verify ?? defaultVerify;
  const internalPort = opts.internalPort;

  app.ws<SocketData>("/*", {
    idleTimeout: opts.idleTimeout ?? 0, // liveness handled by presence + client reconnect
    maxPayloadLength: opts.maxPayloadLength ?? 64 * 1024,
    sendPingsAutomatically: true,
    upgrade: async (res, req, context) => {
      let aborted = false;
      res.onAborted(() => {
        aborted = true;
      });
      const token = req.getQuery("token");
      try {
        if (!token) throw new Error("missing_token");
        const userData = await verify(token);
        if (aborted) return;
        res.upgrade<SocketData>(
          userData,
          req.getHeader("sec-websocket-key"),
          req.getHeader("sec-websocket-protocol"),
          req.getHeader("sec-websocket-extensions"),
          context,
        );
      } catch (err) {
        if (aborted) return;
        const code =
          err instanceof Error && err.message === "missing_token" ? "missing_token" : "invalid_token";
        res.writeStatus("401 Unauthorized").end(code);
      }
    },
    open: (ws) => {
      const d = ws.getUserData();
      ws.subscribe(userRoom(d.userId)); // personal room → targeted pushes (queue_matched)
      logger.info({ msg: "socket.connect", userId: d.userId, username: d.username });
    },
    message: (ws, message, isBinary) => {
      if (isBinary) return;
      let env: Envelope;
      try {
        env = JSON.parse(Buffer.from(message).toString()) as Envelope;
      } catch {
        return;
      }
      if (!env || typeof env.t !== "string") return;
      dispatchMessage(engine, bus, new Peer(ws), env).catch((error) =>
        logger.error({ err: error, event: env.t }),
      );
    },
    close: (ws) => {
      const d = ws.getUserData();
      logger.info({ msg: "socket.disconnect", userId: d.userId });
      engine.onDisconnect(new Peer(ws)).catch((error) =>
        logger.error({ err: error, event: "disconnect" }),
      );
      onDisconnectCleanup(bus, new Peer(ws));
    },
  });

  // Everything that isn't a WebSocket upgrade is plain HTTP → Express.
  app.any("/*", (res, req) => forwardHttp(res, req, internalPort));

  // NOTE: the cross-instance Redis bridge is NOT started here — it owns a
  // dedicated pub/sub connection, which is wasteful (and flaky under rapid
  // create/teardown) for tests. Production boots it via `bus.startBridge()`
  // in index.ts; single-instance delivery works without it (app.publish).

  return {
    bus,
    engine,
    app,
    listen: (port, host) =>
      new Promise((resolve, reject) => {
        const cb = (socket: uWS.us_listen_socket | false) => {
          if (!socket) {
            reject(new Error(`uWS listen failed on ${host ?? ""}:${port}`));
            return;
          }
          resolve({ port: uWS.us_socket_local_port(socket), socket });
        };
        if (host) app.listen(host, port, cb);
        else app.listen(port, cb);
      }),
    close: async () => {
      await bus.stopBridge();
      app.close();
    },
  };
}

/** Forward a plain HTTP request to the internal Express listener. */
function forwardHttp(res: uWS.HttpResponse, req: uWS.HttpRequest, internalPort: number): void {
  const method = req.getMethod();
  const query = req.getQuery();
  const path = req.getUrl() + (query ? `?${query}` : "");
  const headers: Record<string, string> = {};
  req.forEach((key, value) => {
    headers[key] = value;
  });

  let aborted = false;
  res.onAborted(() => {
    aborted = true;
  });

  // Buffer the (small JSON) request body, then proxy. uWS hands transient
  // ArrayBuffers per chunk, so copy each before the callback returns.
  const chunks: Buffer[] = [];
  res.onData((chunk, isLast) => {
    chunks.push(Buffer.from(chunk));
    if (!isLast) return;
    if (aborted) return;
    const body = Buffer.concat(chunks);
    const proxy = http.request(
      { hostname: "127.0.0.1", port: internalPort, method, path, headers },
      (upstream) => {
        if (aborted) return;
        res.cork(() => {
          res.writeStatus(`${upstream.statusCode ?? 502} ${upstream.statusMessage ?? ""}`.trim());
          if (upstream.headers) {
            // Skip hop-by-hop / framing headers: uWS frames the body itself
            // (chunked when streaming via write+end), so forwarding the
            // upstream's Content-Length would put BOTH Content-Length and
            // Transfer-Encoding on the wire — invalid HTTP (HPE_UNEXPECTED_CONTENT_LENGTH).
            for (const [key, value] of Object.entries(upstream.headers)) {
              const lk = key.toLowerCase();
              if (lk === "content-length" || lk === "transfer-encoding" || lk === "connection" || lk === "keep-alive") {
                continue;
              }
              res.writeHeader(key, String(value));
            }
          }
        });
        upstream.on("data", (chunk: Buffer) => {
          if (!aborted) res.cork(() => res.write(chunk));
        });
        upstream.on("end", () => {
          if (!aborted) res.cork(() => res.end());
        });
      },
    );
    proxy.on("error", () => {
      if (!aborted) {
        try {
          res.cork(() => res.writeStatus("502 Bad Gateway").end());
        } catch {
          /* response already torn down */
        }
      }
    });
    if (body.length > 0) proxy.write(body);
    proxy.end();
  });
}
