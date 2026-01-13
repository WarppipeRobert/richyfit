import bcrypt from "bcryptjs";

import { AppError } from "../middleware/error";
import { DuplicateEmailError, type UserPublic, UserRepository, type UserRole, UserRow } from "../repositories/userRepository";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import { RefreshTokenRepository } from "../repositories/refreshTokenRepository";

export interface RegisterInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface RegisterInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}

export interface IssueTokensResult {
  accessToken: string;
  refreshToken: string; // raw, returned once
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function getRefreshDays(): number {
  const raw = process.env.JWT_REFRESH_DAYS ?? "30";
  const n = Number(raw);
  // allow 7–30 days as requested; clamp for safety
  if (!Number.isFinite(n)) return 30;

  return Math.min(30, Math.max(7, Math.floor(n)));
}

function hashRefreshToken(rawToken: string): string {
  const pepper = process.env.REFRESH_TOKEN_PEPPER ?? "";
  return createHash("sha256").update(rawToken + pepper).digest("hex");
}

function generateRefreshTokenRaw(): string {
  // 48 bytes => 96 hex chars (within 32–64 bytes requirement)
  return randomBytes(48).toString("hex");
}

export class AuthService {
  constructor(
    private readonly users: UserRepository = new UserRepository(),
    private readonly refreshTokens: RefreshTokenRepository = new RefreshTokenRepository()
  ) { }

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken || refreshToken.length < 10) {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const ok = await this.refreshTokens.revokeActiveByHash(tokenHash);

    // treat missing/revoked as invalid
    if (!ok) {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }
  }

  async logoutAll(userId: string): Promise<number> {
    if (!userId) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);
    return this.refreshTokens.revokeAllForUser(userId);
  }

  private issueAccessToken(user: Pick<UserRow, "id" | "role">): string {
    const secret: jwt.Secret = getJwtSecret();

    // payload requirements: sub=userId, role, iat/exp handled by jwt automatically
    return jwt.sign({
      role: user.role,
    }, secret, {
      subject: user.id,
      expiresIn: process.env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn']
    })
  }

  async issueTokens(userId: string, role: UserRole): Promise<IssueTokensResult> {
    const accessToken = this.issueAccessToken({ id: userId, role });

    const refreshToken = generateRefreshTokenRaw();
    const tokenHash = hashRefreshToken(refreshToken);

    const days = getRefreshDays();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.refreshTokens.create({ userId, tokenHash, expiresAt });

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(oldToken: string): Promise<IssueTokensResult> {
    if (!oldToken || oldToken.length < 10) {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }

    const oldHash = hashRefreshToken(oldToken);

    const active = await this.refreshTokens.findActiveByHash(oldHash);
    if (!active) {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }

    const newRefreshToken = generateRefreshTokenRaw();
    const newHash = hashRefreshToken(newRefreshToken);

    const days = getRefreshDays();
    const newExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const rotated = await this.refreshTokens.rotateByHash({
      oldHash,
      newHash,
      newExpiresAt
    });

    if (!rotated) {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }

    const user = await this.users.findById(rotated.userId);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }

    const accessToken = this.issueAccessToken({ id: user.id, role: user.role });

    return { accessToken, refreshToken: newRefreshToken };
  }


  async register(input: RegisterInput): Promise<UserPublic> {
    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);

    try {
      const user = await this.users.createUser({
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role
      });

      return user;
    } catch (err: unknown) {
      if (err instanceof DuplicateEmailError) {
        throw new AppError("CONFLICT", "Email already registered", 409);
      }
      throw err;
    }
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.toLowerCase();
    const user = await this.users.findByEmail(email);

    // Don’t leak whether email exists
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
    }

    const ok = await bcrypt.compare(input.password, user.password_hash);
    if (!ok) {
      throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
    }

    const { accessToken, refreshToken } = await this.issueTokens(user.id, user.role);

    // return basic user info (no password_hash)
    const publicUser: UserPublic = {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    return { accessToken, refreshToken, user: publicUser };
  }
}
