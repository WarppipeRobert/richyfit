import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { AppError } from "../middleware/error";
import { AuthService } from "../services/authService";

const registerSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(200),
  role: z.enum(["coach", "client"])
});

const loginSchema = z.object({
  email: z.string().max(320),
  password: z.string().min(1).max(200)
});

export class AuthController {
  constructor(private readonly auth: AuthService = new AuthService()) { }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        // keep message minimal; you can expose parsed.error.flatten() if you want
        throw new AppError("BAD_REQUEST", "Invalid input", 400);
      }

      const user = await this.auth.register(parsed.data);

      // 201 + no password hash
      return res.status(201).json({ user });
    } catch (err) {
      return next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("BAD_REQUEST", "Invalid input", 400);
      }

      const result = await this.auth.login(parsed.data);

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);
      }
      return res.status(200).json({ user: req.user });
    } catch (err) {
      return next(err);
    }
  };
}
