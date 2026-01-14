import type { Pool, PoolClient } from "pg";
import { getPostgresPool } from "../config/postgres";
import { AppError } from "../middleware/error";
import { PlanRepository } from "../repositories/planRepository";
import { WorkoutRepository } from "../repositories/workoutRepository";
import { ClientService } from "./clientService";

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

export class PlanService {
  private readonly pool: Pool;

  constructor(
    private readonly plans: PlanRepository = new PlanRepository(),
    private readonly workouts: WorkoutRepository = new WorkoutRepository(),
    private readonly clientService: ClientService = new ClientService()
  ) {
    this.pool = getPostgresPool();
  }

  async createPlanForClient(coachUserId: string, clientId: string, data: { title: string; startDate?: string | null; endDate?: string | null }) {
    await this.clientService.assertCoachOwnsClient(coachUserId, clientId);

    return this.plans.createPlanTx({
      coachUserId,
      clientId,
      title: data.title,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null
    });
  }

  async addWorkoutToPlan(coachUserId: string, planId: string, data: { scheduledDay: number; title: string }) {
    const ok = await this.plans.planBelongsToCoach(planId, coachUserId);
    if (!ok) throw new AppError("NOT_FOUND", "Plan not found", 404);

    return this.workouts.createWorkout({ planId, scheduledDay: data.scheduledDay, title: data.title });
  }

  async addItemToWorkout(
    coachUserId: string,
    workoutId: string,
    data: { exerciseName: string; sets: number; reps?: number | null; rpe?: number | null; notes?: string | null }
  ) {
    const ok = await this.workouts.workoutBelongsToCoach(workoutId, coachUserId);
    if (!ok) throw new AppError("NOT_FOUND", "Workout not found", 404);

    return withTransaction(this.pool, async (tx) => {
      const { exerciseId } = await this.workouts.upsertByNameTx(tx, data.exerciseName);
      return this.workouts.createItemTx(tx, {
        workoutId,
        exerciseId,
        sets: data.sets,
        reps: data.reps ?? null,
        rpe: data.rpe ?? null,
        notes: data.notes ?? null
      });
    });
  }

  async fetchPlanNested(coachUserId: string, planId: string) {
    const plan = await this.plans.getPlan(planId, coachUserId);
    if (!plan) throw new AppError("NOT_FOUND", "Plan not found", 404);

    const workouts = await this.plans.listWorkoutsForPlan(planId);
    const items = await this.plans.listItemsForPlan(planId);

    const itemsByWorkout = new Map<string, any[]>();
    for (const it of items) {
      const arr = itemsByWorkout.get(it.workout_id) ?? [];
      arr.push({
        id: it.id,
        exercise: { id: it.exercise_id, name: it.exercise_name },
        sets: it.sets,
        reps: it.reps,
        rpe: it.rpe,
        notes: it.notes,
        createdAt: it.created_at
      });
      itemsByWorkout.set(it.workout_id, arr);
    }

    const workoutsNested = workouts.map((w) => ({
      id: w.id,
      scheduledDay: w.scheduled_day,
      title: w.title,
      createdAt: w.created_at,
      items: itemsByWorkout.get(w.id) ?? []
    }));

    return {
      plan: {
        id: plan.id,
        clientId: plan.client_id,
        title: plan.title,
        startDate: plan.start_date,
        endDate: plan.end_date,
        createdAt: plan.created_at,
        workouts: workoutsNested
      }
    };
  }
}
