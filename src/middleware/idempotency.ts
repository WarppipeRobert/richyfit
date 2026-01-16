// middleware/idempotency.ts
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getRedis } from "../config/redis";
import { parseOrThrow, requireAuth } from "../consts/utils";

const idemKeySchema = z.uuid();

type Snapshot = {
  status: number;
  body: unknown;
};

const TTL_SECONDS = 24 * 60 * 60;

export function idempotency(routeId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      const raw = req.header("Idempotency-Key");
      const parsed = parseOrThrow(idemKeySchema, raw);

      const key = `idem|${user.id}|${routeId}|${parsed}`;
      const redis = getRedis();

      const existing = await redis.get(key);
      if (existing) {
        const snapshot = JSON.parse(existing) as Snapshot;
        return res.status(snapshot.status).json(snapshot.body);
      }

      // Capture response body + status to store after first successful write.
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      let captured: Snapshot | null = null;

      res.json = ((body: unknown) => {
        captured = { status: res.statusCode, body };
        return originalJson(body);
      }) as any;

      res.send = ((body: any) => {
        // if controllers use res.send for JSON, capture it too
        captured = { status: res.statusCode, body };
        return originalSend(body);
      }) as any;

      res.on("finish", async () => {
        try {
          // store only successful responses (prevents caching auth/validation errors)
          if (!captured) return;
          if (captured.status < 200 || captured.status >= 300) return;

          await redis.set(key, JSON.stringify(captured), "EX", TTL_SECONDS);
        } catch {
          // ignore redis failures; do not affect request outcome
        }
      });

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
