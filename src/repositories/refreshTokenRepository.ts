import type { Pool } from "pg";
import { getPostgresPool } from "../config/postgres";

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  revoked_at: string | null;
  expires_at: string;
  created_at: string;
};

export class RefreshTokenRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) { }

  async revokeActiveByHash(tokenHash: string): Promise<boolean> {
    const res = await this.pool.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE token_hash = $1
        AND revoked_at IS NULL
      `,
      [tokenHash]
    );

    if (!res.rowCount) return false;

    return res.rowCount > 0;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const res = await this.pool.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId]
    );

    return res.rowCount || 0;
  }

  async create(params: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshTokenRow> {
    const res = await this.pool.query<RefreshTokenRow>(
      `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token_hash, revoked_at, expires_at, created_at
      `,
      [params.userId, params.tokenHash, params.expiresAt]
    );
    return res.rows[0];
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const res = await this.pool.query<RefreshTokenRow>(
      `
      SELECT id, user_id, token_hash, revoked_at, expires_at, created_at
      FROM refresh_tokens
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      LIMIT 1
      `,
      [tokenHash]
    );
    return res.rows[0] ?? null;
  }

  async revokeById(id: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE id = $1 AND revoked_at IS NULL
      `,
      [id]
    );
  }

  /**
   * Atomic rotation: verify active old token by hash, revoke it, create a new one.
   * Returns new token row + the userId of the old token.
   */
  async rotateByHash(params: {
    oldHash: string;
    newHash: string;
    newExpiresAt: Date;
  }): Promise<{ userId: string; newToken: RefreshTokenRow } | null> {
    await this.pool.query("BEGIN");
    try {
      // Lock the row to prevent double-rotation races
      const found = await this.pool.query<Pick<RefreshTokenRow, "id" | "user_id">>(
        `
        SELECT id, user_id
        FROM refresh_tokens
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        FOR UPDATE
        LIMIT 1
        `,
        [params.oldHash]
      );

      const row = found.rows[0];
      if (!row) {
        await this.pool.query("ROLLBACK");
        return null;
      }

      await this.pool.query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
        [row.id]
      );

      const inserted = await this.pool.query<RefreshTokenRow>(
        `
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, token_hash, revoked_at, expires_at, created_at
        `,
        [row.user_id, params.newHash, params.newExpiresAt]
      );

      await this.pool.query("COMMIT");
      return { userId: row.user_id, newToken: inserted.rows[0] };
    } catch (e) {
      await this.pool.query("ROLLBACK");
      throw e;
    }
  }
}
