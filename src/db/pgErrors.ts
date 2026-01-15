// db/pgErrors.ts
import { AppError } from "../middleware/error";

type PgError = { code?: string; constraint?: string; detail?: string };

export function mapPgError(err: unknown): never {
  const e = err as PgError;

  // 23505 = unique_violation
  if (e?.code === "23505") {
    throw new AppError("CONFLICT", "Conflict", 409, {
      constraint: e.constraint,
      detail: e.detail
    });
  }

  throw err as any;
}
