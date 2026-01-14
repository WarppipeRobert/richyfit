import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../middleware/error";
import { CheckinService } from "../services/checkinService";

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidYMD(date: string): boolean {
  if (!ymdRegex.test(date)) return false;
  const d = new Date(`${date}T00:00:00.000Z`);
  // Ensure it round-trips to the same Y-M-D (catches 2026-02-30)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

const clientIdParams = z.object({
  clientId: z.uuid()
});

const upsertBodySchema = z.object({
  date: z.string().refine(isValidYMD, "Invalid date format (YYYY-MM-DD)"),
  metrics: z.record(z.string(), z.unknown()),
  notes: z.string().optional()
});

const listQuerySchema = z.object({
  from: z.string().refine(isValidYMD, "Invalid from date"),
  to: z.string().refine(isValidYMD, "Invalid to date"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
}).refine((q) => q.from <= q.to, { message: "`from` must be <= `to`" });

export class CheckinController {
  constructor(private readonly service: CheckinService = new CheckinService()) { }

  upsert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const p = clientIdParams.safeParse(req.params);
      if (!p.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const b = upsertBodySchema.safeParse(req.body);
      if (!b.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const result = await this.service.upsertDailyCheckin(req.user.id, p.data.clientId, b.data);
      return res.status(result.status).json({ checkinId: result.checkinId });
    } catch (err) {
      return next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const p = clientIdParams.safeParse(req.params);
      if (!p.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const q = listQuerySchema.safeParse(req.query);
      if (!q.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const result = await this.service.listCheckinsRange(req.user.id, p.data.clientId, {
        from: q.data.from,
        to: q.data.to,
        limit: q.data.limit ?? 30,
        cursor: q.data.cursor ?? null
      });

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}
