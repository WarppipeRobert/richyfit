// middleware/rateLimit.ts
import type { NextFunction, Request, Response } from "express";
import { getRedis } from "../config/redis";

type RateLimitOptions = {
  prefix: string;          // redis key namespace
  windowSeconds: number;   // fixed window
  max: number;             // max requests per window
  key: (req: Request) => string | null; // null => skip limiting
};

export function rateLimit(opts: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const k = opts.key(req);
      if (!k) return next();

      const redis = getRedis();
      const redisKey = `${opts.prefix}_${k}`;

      const count = await redis.incr(redisKey);

      // first hit -> start window
      if (count === 1) {
        await redis.expire(redisKey, opts.windowSeconds);
      }

      if (count <= opts.max) return next();

      const ttl = await redis.ttl(redisKey);
      const retryAfter = ttl > 0 ? ttl : opts.windowSeconds;

      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        code: "RATE_LIMITED",
        message: "Too many requests",
        details: {
          limit: opts.max,
          windowSeconds: opts.windowSeconds,
          retryAfterSeconds: retryAfter
        }
      });
    } catch (err) {
      // If Redis is down, fail open (do not block API)
      return next();
    }
  };
}
