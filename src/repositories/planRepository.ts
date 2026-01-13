import type { Pool, PoolClient } from "pg";
import { getPostgresPool } from "../config/postgres";

export type PlanRow = {
  id: string;
  coach_user_id: string;
  client_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type WorkoutRow = {
  id: string;
  plan_id: string;
  scheduled_day: number;
  title: string;
  created_at: string;
};

export type WorkoutItemRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  sets: number;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  created_at: string;
  exercise_name: string;
};

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

export class PlanRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) { }

  async createPlanTx(params: {
    coachUserId: string;
    clientId: string;
    title: string;
    startDate?: string | null;
    endDate?: string | null;
  }): Promise<{ planId: string }> {
    return withTransaction(this.pool, async (tx) => {
      const res = await tx.query<{ id: string }>(
        `
        INSERT INTO plans (coach_user_id, client_id, title, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [params.coachUserId, params.clientId, params.title, params.startDate ?? null, params.endDate ?? null]
      );

      return { planId: res.rows[0].id };
    });
  }

  async planBelongsToCoach(planId: string, coachUserId: string): Promise<boolean> {
    const res = await this.pool.query(
      `
      SELECT 1
      FROM plans
      WHERE id = $1 AND coach_user_id = $2
      LIMIT 1
      `,
      [planId, coachUserId]
    );
    return (res.rowCount || 0) > 0;
  }

  async getPlan(planId: string, coachUserId: string): Promise<PlanRow | null> {
    const res = await this.pool.query<PlanRow>(
      `
      SELECT id, coach_user_id, client_id, title, start_date, end_date, created_at
      FROM plans
      WHERE id = $1 AND coach_user_id = $2
      LIMIT 1
      `,
      [planId, coachUserId]
    );
    return res.rows[0] ?? null;
  }

  async listWorkoutsForPlan(planId: string): Promise<WorkoutRow[]> {
    const res = await this.pool.query<WorkoutRow>(
      `
      SELECT id, plan_id, scheduled_day, title, created_at
      FROM workouts
      WHERE plan_id = $1
      ORDER BY scheduled_day ASC, created_at ASC
      `,
      [planId]
    );
    return res.rows;
  }

  async listItemsForPlan(planId: string): Promise<WorkoutItemRow[]> {
    // Items joined to exercises, filtered by plan via workouts
    const res = await this.pool.query<WorkoutItemRow>(
      `
      SELECT
        wi.id,
        wi.workout_id,
        wi.exercise_id,
        wi.sets,
        wi.reps,
        wi.rpe,
        wi.notes,
        wi.created_at,
        e.name AS exercise_name
      FROM workout_items wi
      JOIN workouts w ON w.id = wi.workout_id
      JOIN exercises e ON e.id = wi.exercise_id
      WHERE w.plan_id = $1
      ORDER BY w.scheduled_day ASC, wi.created_at ASC
      `,
      [planId]
    );
    return res.rows;
  }
}
