// ioredis exposes `Redis` as a named class (detectable by Node's ESM loader),
// so a named import both typechecks and runs. (bcryptjs, by contrast, needs a
// default import — its named exports are assigned dynamically.)
import { Redis } from "ioredis";

let client: Redis | null = null;

export function getRedis(
  url: string = process.env.REDIS_URL ?? "redis://localhost:6379",
): Redis {
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return client;
}

/** Test-only: drop the cached client so tests can supply their own. */
export function __resetRedisForTests(): void {
  client = null;
}
