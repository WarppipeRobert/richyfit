import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

function sanitizeRequestId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // keep it simple + safe for logs/headers
  if (trimmed.length > 128) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = sanitizeRequestId(req.header("x-request-id"));
  const id = incoming ?? randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-Id", id);

  next();
}

export function basicRequestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  // Log request start
  console.log(
    JSON.stringify({
      level: "info",
      msg: "request.start",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl
    })
  );

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;

    console.log(
      JSON.stringify({
        level: "info",
        msg: "request.end",
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms: Math.round(ms * 10) / 10
      })
    );
  });

  next();
}
