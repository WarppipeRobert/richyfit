import type { NextFunction, Request, Response } from "express";
import * as jwt from "jsonwebtoken";

import { AppError } from "./error";

export type AuthUser = {
  id: string;
  role: "coach" | "client";
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getJwtSecret(): jwt.Secret {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

type AccessTokenPayload = jwt.JwtPayload & {
  role?: AuthUser["role"];
};

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim() || null;
}

export function authenticate() {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = parseBearerToken(req.header("authorization"));
      if (!token) {
        return next(new AppError("UNAUTHORIZED", "Missing or invalid token", 401));
      }

      const decoded = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;

      // We set sub=userId and role in AuthService when signing
      const userId = decoded.sub;
      const role = decoded.role;

      if (!userId || (role !== "coach" && role !== "client")) {
        return next(new AppError("UNAUTHORIZED", "Missing or invalid token", 401));
      }

      req.user = { id: userId, role };
      return next();
    } catch {
      return next(new AppError("UNAUTHORIZED", "Missing or invalid token", 401));
    }
  };
}

// Optional: authorization stub / guard
export function authorize(roles: AuthUser["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("UNAUTHORIZED", "Missing or invalid token", 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError("FORBIDDEN", "Forbidden", 403));
    }
    return next();
  };
}


