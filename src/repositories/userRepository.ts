import type { Pool } from "pg";

import { getPostgresPool } from "../config/postgres";

export type UserRole = "coach" | "client";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string; // ISO-ish from pg
};

export type UserPublic = Omit<UserRow, "password_hash">;

export class DuplicateEmailError extends Error {
  constructor() {
    super("Email already exists");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
}

export class UserRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }


  async findByEmail(email: string): Promise<UserRow | null> {
    const res = await this.pool.query<UserRow>(
      `
      SELECT id, email, password_hash, role, created_at
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    return res.rows[0] ?? null;
  }

  async createUser(input: CreateUserInput): Promise<UserPublic> {
    try {
      const res = await this.pool.query<UserPublic>(
        `
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, $3)
        RETURNING id, email, role, created_at
        `,
        [input.email, input.passwordHash, input.role]
      );

      return res.rows[0];
    } catch (err: unknown) {
      // Postgres unique violation
      const e = err as { code?: string };
      if (e?.code === "23505") {
        throw new DuplicateEmailError();
      }
      throw err;
    }
  }
}
