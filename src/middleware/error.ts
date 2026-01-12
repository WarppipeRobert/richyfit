import type { NextFunction, Request, Response } from "express";

export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;

  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError("NOT_FOUND", "Route not found", 404));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Known (expected) errors
  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, message: err.message });
  }

  // Unknown errors (don’t leak details)
  // You can log err to your logger here
  console.error(err);

  return res.status(500).json({ code: "INTERNAL", message: "Internal server error" });
}
