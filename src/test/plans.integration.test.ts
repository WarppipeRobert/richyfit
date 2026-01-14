import request from "supertest";
import { disconnectPostgres, getPostgresPool } from "../config/postgres";
import { registerAndLogin, resetDb } from "./utils";
import app from "../app";

describe("Plans,workouts,exercises + ownership enforcement (integration)", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
    process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
    process.env.JWT_REFRESH_DAYS = process.env.JWT_REFRESH_DAYS || "7";
    await resetDb(getPostgresPool(), ["workout_items", "workouts", "plans", "exercises", "coach_clients", "clients", "coaches", "refresh_tokens", "users"]);
  });

  afterAll(async () => {
    await disconnectPostgres();
  });

  test("coach creates plan for owned client -> 201", async () => {
    const coachToken = await registerAndLogin("coach-plan-1@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Client A", email: "clientA@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;
    expect(clientId).toBeTruthy();

    const createdPlan = await request(app)
      .post(`/clients/${clientId}/plans`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ title: "My Plan", startDate: "2025-01-01", endDate: "2025-12-31" });

    expect(createdPlan.status).toBe(201);
    expect(createdPlan.body).toHaveProperty("planId");
    expect(typeof createdPlan.body.planId).toBe("string");
  })

  test("other coach try to get plan -> 404", async () => {
    const coachAToken = await registerAndLogin("coach-plan-A@example.com", "coach");
    const coachBToken = await registerAndLogin("coach-plan-B@example.com", "coach");

    const cRes = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachAToken}`)
      .send({ name: "Client Owned", email: "owned@example.com" });
    const clientId = cRes.body.clientId as string;

    const pRes = await request(app)
      .post(`/clients/${clientId}/plans`)
      .set("Authorization", `Bearer ${coachAToken}`)
      .send({ title: "Secret Plan" });

    const planId = pRes.body.planId as string;

    // Coach B tries to read
    const otherGet = await request(app)
      .get(`/plans/${planId}`)
      .set("Authorization", `Bearer ${coachBToken}`);

    expect(otherGet.status).toBe(404);
    expect(otherGet.body).toHaveProperty("code", "NOT_FOUND");
  })

  test("add workout + item then get plan return nested structure with items", async () => {
    const coachToken = await registerAndLogin("coach-nested@example.com", "coach");
    const cRes = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Nested Client" });
    expect(cRes.status).toBe(201);
    const clientId = cRes.body.clientId as string;

    const pRes = await request(app)
      .post(`/clients/${clientId}/plans`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ title: "Nested Plan", startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(pRes.status).toBe(201);
    const planId = pRes.body.planId as string;

    const wRes = await request(app)
      .post(`/plans/${planId}/workouts`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ scheduledDay: 1, title: "Day 1 - Lower" });;
    expect(wRes.status).toBe(201);
    const workoutId = wRes.body.workoutId as string;

    const iRes = await request(app)
      .post(`/workouts/${workoutId}/items`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ exerciseName: "Back Squat", sets: 5, reps: 5, rpe: 8, notes: "Depth" })
    expect(iRes.status).toBe(201);
    const itemId = iRes.body.itemId as string;

    const plan = await request(app)
      .get(`/plans/${planId}`)
      .set("Authorization", `Bearer ${coachToken}`);

    expect(plan.status).toBe(200);
    expect(plan.body).toHaveProperty("plan");

    const planDetails = plan.body.plan;
    expect(planDetails).toHaveProperty("id", planId);
    expect(Array.isArray(planDetails.workouts)).toBe(true);
    expect(planDetails.workouts.length).toBeGreaterThan(0);

    const firstWorkout = planDetails.workouts[0];
    expect(firstWorkout).toMatchObject({ id: workoutId, scheduledDay: 1, title: "Day 1 - Lower" });
    expect(Array.isArray(firstWorkout.items)).toBe(true);
    expect(firstWorkout.items.length).toBeGreaterThan(0);

    const firstItem = firstWorkout.items.find((x: any) => x.id === itemId);
    expect(firstItem).toBeTruthy();
    expect(firstItem).toMatchObject({
      sets: 5,
      reps: 5,
      rpe: 8,
      notes: "Depth"
    });
    expect(firstItem.exercise).toMatchObject({ name: "Back Squat" });
  })

  test("exercise upsert is idempotent (same exercise twice doesn’t duplicate)", async () => {
    const coachToken = await registerAndLogin("coach-upsert@example.com", "coach");

    const cRes = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Upsert Client" });
    const clientId = cRes.body.clientId as string;

    const pRes = await request(app)
      .post(`/clients/${clientId}/plans`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ title: "Upsert Plan" });
    const planId = pRes.body.planId as string;

    const wRes1 = await request(app)
      .post(`/plans/${planId}/workouts`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ scheduledDay: 1, title: "Workout 1" });
    const workoutId1 = wRes1.body.workoutId as string;

    const wRes2 = await request(app)
      .post(`/plans/${planId}/workouts`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ scheduledDay: 2, title: "Workout 2" });
    const workoutId2 = wRes2.body.workoutId as string;

    await request(app)
      .post(`/workouts/${workoutId1}/items`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ exerciseName: "Bench Press", sets: 3, reps: 8 });

    await request(app)
      .post(`/workouts/${workoutId2}/items`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ exerciseName: "Bench Press", sets: 4, reps: 6 });

    const pool = getPostgresPool();
    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM exercises WHERE name = $1`,
      ["Bench Press"]
    );

    expect(Number(count.rows[0].count)).toBe(1);
  });
})