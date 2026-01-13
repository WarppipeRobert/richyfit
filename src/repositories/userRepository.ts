import type { Pool, PoolClient } from "pg";

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

// helper (inside file)
async function withTransaction<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export class UserRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async createUserWithOptionalCoachProfile(input: {
    email: string;
    passwordHash: string;
    role: UserRole;
    coachDisplayName?: string;
  }): Promise<UserPublic> {
    return withTransaction(this.pool, async (tx) => {
      const userRes = await tx.query<UserPublic>(
        `
          INSERT INTO users (email, password_hash, role)
          VALUES ($1, $2, $3)
          RETURNING id, email, role, created_at
          `,
        [input.email, input.passwordHash, input.role]
      );

      const user = userRes.rows[0];

      if (input.role === "coach") {
        const displayName =
          input.coachDisplayName?.trim() ||
          (user.email.includes("@") ? user.email.split("@")[0] : user.email);

        await tx.query(
          `
            INSERT INTO coaches (user_id, display_name)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO NOTHING
            `,
          [user.id, displayName]
        );
      }

      return user;
    });
  }

  async findById(id: string): Promise<UserRow | null> {
    const res = await this.pool.query<UserRow>(
      `
      SELECT id, email, password_hash, role, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    return res.rows[0] ?? null;
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
