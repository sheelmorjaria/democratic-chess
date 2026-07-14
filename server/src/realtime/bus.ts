import type * as uWS from "uWebSockets.js";
import type { Redis } from "ioredis";
import type { Realtime } from "./realtime.js";
import { logger } from "../observability/logger.js";

const ROOM_CHANNEL = "dc:rooms";
const INSTANCE_ID = crypto.randomUUID();

interface BridgeMessage {
  room: string;
  msg: string;
  origin: string;
}

/**
 * Room publish/subscribe over uWS native topics, bridged across server
 * instances via Redis pub/sub — the uWS equivalent of the old
 * `@socket.io/redis-adapter`. Local subscribers are published to instantly;
 * other instances receive the Redis message and republish locally, skipping
 * the originator so no socket gets a duplicate.
 */
export class RoomBus implements Realtime {
  private sub: Redis | null = null;

  constructor(private readonly app: uWS.TemplatedApp, private readonly redis: Redis) {}

  to(room: string): { emit(event: string, payload: unknown): void } {
    return { emit: (event, payload) => this.publish(room, event, payload) };
  }

  publish(room: string, event: string, payload: unknown): void {
    const msg = JSON.stringify({ t: event, d: payload });
    // Local delivery (instant, to subscribers on this instance).
    this.app.publish(room, msg, false);
    // Cross-instance fan-out.
    this.redis
      .publish(ROOM_CHANNEL, JSON.stringify({ room, msg, origin: INSTANCE_ID } satisfies BridgeMessage))
      .catch((err) => logger.warn({ msg: "roomBus.publish.redis", err: String(err) }));
  }

  /** Subscribe to the Redis room bridge. Call once after the app is created. */
  startBridge(): void {
    if (this.sub) return;
    this.sub = this.redis.duplicate();
    void this.sub.subscribe(ROOM_CHANNEL);
    this.sub.on("message", (_channel: string, payload: string) => {
      try {
        const bridge = JSON.parse(payload) as BridgeMessage;
        if (bridge.origin === INSTANCE_ID) return; // already delivered locally
        this.app.publish(bridge.room, bridge.msg, false);
      } catch (err) {
        logger.warn({ msg: "roomBus.bridge.parse", err: String(err) });
      }
    });
  }

  async stopBridge(): Promise<void> {
    if (this.sub) {
      this.sub.disconnect();
      this.sub = null;
    }
  }
}
