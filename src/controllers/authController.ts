import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { AuthService } from "../services/authService";
import { parseOrThrow, requireAuth } from "../consts/utils";

const registerSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(200),
  role: z.enum(["coach", "client"])
});

const loginSchema = z.object({
  email: z.string().max(320),
  password: z.string().min(1).max(200)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(200)
});

const logoutSchema = z
  .object({
    refreshToken: z.string().min(10).optional(),
    logoutAll: z.boolean().optional()
  })
  .refine((v) => v.logoutAll === true || typeof v.refreshToken === "string", {
    message: "Provide refreshToken or set logoutAll=true"
  });

export class AuthController {
  constructor(private readonly auth: AuthService = new AuthService()) { }

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseOrThrow(logoutSchema, req.body);
      const { refreshToken, logoutAll } = parsed;

      if (logoutAll && req.user) {
        requireAuth(req.user);

        const revoked = await this.auth.logoutAll(req.user.id);
        return res.status(200).json({ message: "logged out", revoked });
      }

      await this.auth.logout(refreshToken!);
      return res.status(200).json({ message: "logged out" });
    } catch (err) {
      return next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseOrThrow(refreshSchema, req.body);
      const tokens = await this.auth.rotateRefreshToken(parsed.refreshToken);

      return res.status(200).json(tokens);
    } catch (err) {
      return next(err);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseOrThrow(registerSchema, req.body);
      const user = await this.auth.register(parsed);

      // 201 + no password hash
      return res.status(201).json({ user });
    } catch (err) {
      return next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseOrThrow(loginSchema, req.body);
      const result = await this.auth.login(parsed);

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}
