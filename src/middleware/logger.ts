// middleware/logger.ts
import type { NextFunction, Request, Response } from "express";

function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function isNoisyAssetPath(path: string) {
  return (
    path.startsWith("/docs/") ||
    path.startsWith("/favicon") ||
    path.endsWith(".png") ||
    path.endsWith(".ico") ||
    path.endsWith(".css") ||
    path.endsWith(".js") ||
    path.endsWith(".map")
  );
}

export const structuredLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  const requestId = req.requestId ?? req.header("x-request-id") ?? "unknown";
  const rid = shortId(String(requestId));
  const userId = (req as any).user?.id ?? null;

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    // keep logs readable: hide static noise unless error-ish
    const path = req.originalUrl.split("?")[0] ?? "";
    const noisy = isNoisyAssetPath(path);
    const status = res.statusCode;

    if (noisy && status < 400) return;

    const method = req.method.padEnd(4, " ");
    const statusStr = String(status).padStart(3, " ");
    const ms = `${Math.round(latencyMs)}ms`.padStart(6, " ");
    const uid = userId ? shortId(String(userId)) : "-";

    // single-line human log
    // Example: [04:52:09] 304  0ms  GET  /clients  rid=cf210d84 uid=8b12a3f1
    const time = new Date().toISOString().slice(11, 19);

    console.log(
      `[${time}] ${statusStr} ${ms}  ${method} ${path}  rid=${rid} uid=${uid}`
    );

    // optional: verbose JSON when debugging
    if (process.env.LOG_FORMAT === "json") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          requestId,
          userId,
          method: req.method,
          path,
          status,
          latencyMs: Math.round(latencyMs)
        })
      );
    }
  });

  return next();
};
