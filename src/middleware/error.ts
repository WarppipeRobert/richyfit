import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";


export type ApiErrorResponse = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
};


export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function zodDetails(err: ZodError) {
  return {
    issues: err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
      code: i.code
    }))
  };
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
  // Zod validation -> 400 consistent
  if (err instanceof ZodError) {
    const body: ApiErrorResponse = {
      code: "BAD_REQUEST",
      message: "Invalid input",
      details: zodDetails(err)
    };
    return res.status(400).json(body);
  }

  // Known (expected) errors
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details
    });
  }

  // Unknown errors (don’t leak details)
  // You can log err to your logger here
  console.error(err);

  return res.status(500).json({ code: "INTERNAL", message: "Internal server error" });
}
