import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../middleware/error";
import { ClientService } from "../services/clientService";

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email().max(320).optional()
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

const clientIdSchema = z.object({
  clientId: z.uuid()
});

export class ClientController {
  constructor(private readonly service: ClientService = new ClientService()) { }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createClientSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const result = await this.service.createClient(req.user.id, parsed.data);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const result = await this.service.listClients(req.user.id, {
        limit: parsed.data.limit,
        cursor: parsed.data.cursor
      });

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramsParsed = clientIdSchema.safeParse(req.params);
      if (!paramsParsed.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const client = await this.service.getClient(req.user.id, paramsParsed.data.clientId);

      // ✅ IMPORTANT: not owned or not found => 404 (not 403)
      if (!client) {
        throw new AppError("NOT_FOUND", "Client not found", 404);
      }

      return res.status(200).json({ client });
    } catch (err) {
      return next(err);
    }
  };
}
