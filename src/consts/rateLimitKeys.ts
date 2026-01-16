// middleware/rateLimitKeys.ts  (helpers)
import type { Request } from "express";

export function keyByIp(req: Request) {
  // trust proxy must be set correctly if behind LB
  return req.ip || null;
}

export function keyByUser(req: Request) {
  return req.user?.id ?? null;
}

export function keyByEmail(req: Request) {
  const email = (req.body?.email ?? req.body?.username ?? "").toString().trim().toLowerCase();
  if (!email || email.length > 320) return null;
  return email;
}
