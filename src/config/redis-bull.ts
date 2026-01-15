// src/config/redis-bull.ts
import Redis from "ioredis";

let bullRedis: Redis | null = null;

export function getBullRedis(): Redis {
  if (!bullRedis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");

    bullRedis = new Redis(url, {
      // BullMQ-required / recommended
      maxRetriesPerRequest: null,
      enableReadyCheck: false,

      // keep sane timeouts
      connectTimeout: 5_000,

      // IMPORTANT: avoid lazyConnect when BullMQ will duplicate connections
      // (default is false; leaving it out is fine)
    });
  }
  return bullRedis;
}
