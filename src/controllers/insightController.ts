// src/controllers/insightController.ts
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { InsightService } from "../services/insightService";
import { parseOrThrow, requireAuth } from "../consts/utils";

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidYMD(date: string): boolean {
  if (!ymdRegex.test(date)) return false;
  const d = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

const clientIdParams = z.object({ clientId: z.uuid() });

const bodySchema = z
  .object({
    from: z.string().refine(isValidYMD, "Invalid from date"),
    to: z.string().refine(isValidYMD, "Invalid to date")
  })
  .refine((q) => q.from <= q.to, { message: "`from` must be <= `to`" });

const querySchema = z
  .object({
    from: z.string().refine(isValidYMD, "Invalid from date"),
    to: z.string().refine(isValidYMD, "Invalid to date")
  })
  .refine((q) => q.from <= q.to, { message: "`from` must be <= `to`" });

export class InsightController {
  constructor(private readonly service: InsightService = new InsightService()) { }

  enqueue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      const params = parseOrThrow(clientIdParams, req.params);
      const body = parseOrThrow(bodySchema, req.body);

      const result = await this.service.enqueueInsight(user.id, params.clientId, body);

      // returns instantly; job executes in worker process
      return res.status(202).json({ jobId: result.jobId });
    } catch (err) {
      return next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = requireAuth(req.user);
      const params = parseOrThrow(clientIdParams, req.params);
      const query = parseOrThrow(querySchema, req.query);

      const result = await this.service.getInsight(user.id, params.clientId, query);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}
