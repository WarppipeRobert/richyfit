// middleware/validate.ts
import { z } from "zod";
import { AppError } from "../middleware/error";

export function parseOrThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // throw the ZodError directly to be caught by errorHandler
    throw parsed.error;
  }
  return parsed.data;
}

export function requireAuth(user: any) {
  if (!user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401, {});

  return user;
}
