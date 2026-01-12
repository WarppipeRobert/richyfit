import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");

    redis = new Redis(url, {
      // fail fast if cannot connect
      connectTimeout: 5_000,
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const r = getRedis();
  await r.connect();
  const pong = await r.ping();
  if (pong !== "PONG") throw new Error(`Unexpected Redis PING response: ${pong}`);
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    // quit closes cleanly; if it errors, disconnect hard
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    } finally {
      redis = null;
    }
  }
}
