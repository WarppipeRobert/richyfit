import type { Pool, PoolClient } from "pg";
import { getPostgresPool } from "../config/postgres";

export class WorkoutRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) { }

  async createWorkout(params: { planId: string; scheduledDay: number; title: string }): Promise<{ workoutId: string }> {
    const res = await this.pool.query<{ id: string }>(
      `
      INSERT INTO workouts (plan_id, scheduled_day, title)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [params.planId, params.scheduledDay, params.title]
    );
    return { workoutId: res.rows[0].id };
  }

  async workoutBelongsToCoach(workoutId: string, coachUserId: string): Promise<boolean> {
    const res = await this.pool.query(
      `
      SELECT 1
      FROM workouts w
      JOIN plans p ON p.id = w.plan_id
      WHERE w.id = $1 AND p.coach_user_id = $2
      LIMIT 1
      `,
      [workoutId, coachUserId]
    );
    return (res.rowCount || 0) > 0;
  }

  async getPlanIdForWorkout(workoutId: string): Promise<string | null> {
    const res = await this.pool.query<{ plan_id: string }>(
      `SELECT plan_id FROM workouts WHERE id = $1 LIMIT 1`,
      [workoutId]
    );
    return res.rows[0]?.plan_id ?? null;
  }

  async upsertByNameTx(tx: PoolClient, name: string): Promise<{ exerciseId: string }> {
    const res = await tx.query<{ id: string }>(
      `
      INSERT INTO exercises (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
      `,
      [name]
    );
    return { exerciseId: res.rows[0].id };
  }

  async createItemTx(tx: PoolClient, params: {
    workoutId: string;
    exerciseId: string;
    sets: number;
    reps?: number | null;
    rpe?: number | null;
    notes?: string | null;
  }): Promise<{ itemId: string }> {
    const res = await tx.query<{ id: string }>(
      `
      INSERT INTO workout_items (workout_id, exercise_id, sets, reps, rpe, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [params.workoutId, params.exerciseId, params.sets, params.reps ?? null, params.rpe ?? null, params.notes ?? null]
    );
    return { itemId: res.rows[0].id };
  }
}
