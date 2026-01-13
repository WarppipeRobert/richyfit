import type { Pool, PoolClient } from "pg";
import { getPostgresPool } from "../config/postgres";

export type CoachClientStatus = "active" | "archived";

export type ClientRow = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  created_at: string;
};

export type ClientForCoach = ClientRow & {
  status: CoachClientStatus;
  link_created_at: string;
};

export type CreateClientData = {
  name: string;
  email?: string | null;
  userId?: string | null;
};

export type Pagination = {
  limit?: number; // default 20, max 100
  cursor?: string; // opaque-ish: use created_at of last row (ISO string)
  includeArchived?: boolean; // default false
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
};

function clampLimit(limit?: number): number {
  const n = Number(limit ?? 20);
  if (!Number.isFinite(n)) return 20;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

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

export class ClientRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) { }

  async coachOwnsClient(coachUserId: string, clientId: string): Promise<boolean> {
    const res = await this.pool.query(
      `
      SELECT 1
      FROM coach_clients
      WHERE coach_user_id = $1
        AND client_id = $2
        AND status = 'active'
      LIMIT 1
      `,
      [coachUserId, clientId]
    );

    return (res.rowCount || 0) > 0;
  }

  async createClientWithLink(
    coachUserId: string,
    clientData: CreateClientData
  ): Promise<{ client: ClientRow; link: { coach_user_id: string; client_id: string; status: CoachClientStatus } }> {
    return withTransaction(this.pool, async (tx) => {
      const created = await tx.query<ClientRow>(
        `
        INSERT INTO clients (user_id, display_name, email)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, display_name, email, created_at
        `,
        [clientData.userId ?? null, clientData.name, clientData.email ?? null]
      );

      const client = created.rows[0];

      const linked = await tx.query<{ coach_user_id: string; client_id: string; status: CoachClientStatus }>(
        `
        INSERT INTO coach_clients (coach_user_id, client_id)
        VALUES ($1, $2)
        RETURNING coach_user_id, client_id, status
        `,
        [coachUserId, client.id]
      );

      return { client, link: linked.rows[0] };
    });
  }

  async listClientsForCoach(
    coachUserId: string,
    pagination: Pagination = {}
  ): Promise<PaginatedResult<ClientForCoach>> {
    const limit = clampLimit(pagination.limit);
    const includeArchived = pagination.includeArchived ?? false;
    const cursor = pagination.cursor ?? null;

    const params: any[] = [coachUserId, limit + 1]; // fetch one extra to know if next page exists
    let i = params.length;

    const statusClause = includeArchived ? "" : `AND cc.status = 'active'`;

    let cursorClause = "";
    if (cursor) {
      params.push(cursor);
      cursorClause = `AND cc.created_at < $${++i}`;
    }

    const res = await this.pool.query<ClientForCoach>(
      `
      SELECT
        c.id,
        c.user_id,
        c.display_name,
        c.email,
        c.created_at,
        cc.status,
        cc.created_at AS link_created_at
      FROM coach_clients cc
      JOIN clients c ON c.id = cc.client_id
      WHERE cc.coach_user_id = $1
        ${statusClause}
        ${cursorClause}
      ORDER BY cc.created_at DESC, c.id DESC
      LIMIT $2
      `,
      params
    );

    const rows = res.rows;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore ? items[items.length - 1]?.link_created_at ?? null : null;

    return { items, nextCursor };
  }

  async getClientForCoach(coachUserId: string, clientId: string): Promise<ClientForCoach | null> {
    const res = await this.pool.query<ClientForCoach>(
      `
      SELECT
        c.id,
        c.user_id,
        c.display_name,
        c.email,
        c.created_at,
        cc.status,
        cc.created_at AS link_created_at
      FROM coach_clients cc
      JOIN clients c ON c.id = cc.client_id
      WHERE cc.coach_user_id = $1
        AND cc.client_id = $2
      LIMIT 1
      `,
      [coachUserId, clientId]
    );

    return res.rows[0] ?? null;
  }
}
