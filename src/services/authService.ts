import bcrypt from "bcryptjs";

import { AppError } from "../middleware/error";
import { DuplicateEmailError, type UserPublic, UserRepository, type UserRole, UserRow } from "../repositories/userRepository";
import jwt from "jsonwebtoken";

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
  user: UserPublic;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}


export class AuthService {
  constructor(private readonly users: UserRepository = new UserRepository()) { }

  private issueAccessToken(user: Pick<UserRow, "id" | "role">): string {
    const secret: jwt.Secret = getJwtSecret();

    // payload requirements: sub=userId, role, iat/exp handled by jwt automatically
    return jwt.sign({
      role: user.role,
    }, secret, {
      subject: user.id,
      expiresIn: "15m"
    })
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

    const accessToken = this.issueAccessToken({ id: user.id, role: user.role });

    // return basic user info (no password_hash)
    const publicUser: UserPublic = {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    return { accessToken, user: publicUser };
  }
}
