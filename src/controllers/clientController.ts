import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../middleware/error";
import { ClientService } from "../services/clientService";
import { parseOrThrow, requireAuth } from "../consts/utils";

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
      const parsed = parseOrThrow(createClientSchema, req.body);
      const user = requireAuth(req.user);

      const result = await this.service.createClient(user.id, parsed);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseOrThrow(listQuerySchema, req.query);
      const user = requireAuth(req.user);

      const result = await this.service.listClients(user.id, {
        limit: parsed.limit,
        cursor: parsed.cursor
      });

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramsParsed = parseOrThrow(clientIdSchema, req.params);
      const user = requireAuth(req.user);

      const client = await this.service.getClient(user.id, paramsParsed.clientId);

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
