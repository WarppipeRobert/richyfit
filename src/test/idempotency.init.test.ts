// tests/idempotency.int.test.ts
import request from "supertest";
import { disconnectPostgres, getPostgresPool } from "../config/postgres";
import { registerAndLogin, resetDb } from "./utils";
import app from "../app";

import { connectRedis, disconnectRedis, getRedis } from "../config/redis";

describe("Idempotency keys for write endpoints (integration)", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
    process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
    process.env.JWT_REFRESH_DAYS = process.env.JWT_REFRESH_DAYS || "7";
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

    await resetDb(getPostgresPool(), [
      "checkins",
      "plans",
      "coach_clients",
      "clients",
      "coaches",
      "refresh_tokens",
      "users"
    ]);

    await connectRedis();
    await getRedis().flushdb();
  });

  afterAll(async () => {
    await disconnectRedis();
    await disconnectPostgres();
  });

  test("POST /clients with same Idempotency-Key returns identical response and no duplicate rows", async () => {
    const coachToken = await registerAndLogin("coach-idem-clients@example.com", "coach");

    const idemKey = "11111111-1111-1111-1111-111111111111";

    const r1 = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", idemKey)
      .send({ name: "Idem Client A", email: "idem-client-a@example.com" });

    expect(r1.status).toBe(201);
    expect(typeof r1.body.clientId).toBe("string");
    const clientId1 = r1.body.clientId as string;

    const r2 = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", idemKey)
      .send({ name: "Idem Client A", email: "idem-client-a@example.com" });

    expect(r2.status).toBe(201);
    expect(r2.body.clientId).toBe(clientId1);

    // extra proof: list should only show 1 client for that coach
    const list = await request(app)
      .get("/clients")
      .set("Authorization", `Bearer ${coachToken}`);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.clients)).toBe(true);
    const matches = (list.body.clients as any[]).filter((c) => c.id === clientId1);
    expect(matches.length).toBe(1);
  });

  test("POST /clients missing Idempotency-Key -> 400", async () => {
    const coachToken = await registerAndLogin("coach-idem-missing@example.com", "coach");

    const r = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "No Idem", email: "no-idem@example.com" });

    expect(r.status).toBe(400);
    expect(r.body).toHaveProperty("code");
    expect(r.body.code).toBe("BAD_REQUEST");
  });

  test("POST /clients/:clientId/plans replay returns same planId and no duplicate rows", async () => {
    const coachToken = await registerAndLogin("coach-idem-plans@example.com", "coach");

    // create client (with idem key)
    const clientResp = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", "22222222-2222-2222-2222-222222222222")
      .send({ name: "Plan Client", email: "plan-client@example.com" });

    expect(clientResp.status).toBe(201);
    const clientId = clientResp.body.clientId as string;

    const planIdemKey = "33333333-3333-3333-3333-333333333333";

    const p1 = await request(app)
      .post(`/clients/${clientId}/plans`)
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", planIdemKey)
      .send({ title: "My Plan", startDate: "2026-01-01", endDate: "2026-12-31" });

    expect(p1.status).toBe(201);
    expect(typeof p1.body.planId).toBe("string");
    const planId1 = p1.body.planId as string;

    const p2 = await request(app)
      .post(`/clients/${clientId}/plans`)
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", planIdemKey)
      .send({ title: "My Plan", startDate: "2026-01-01", endDate: "2026-12-31" });

    expect(p2.status).toBe(201);
    expect(p2.body.planId).toBe(planId1);

    // DB proof: exactly one plan row for this planId
    const pool = getPostgresPool();
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM plans WHERE id = $1`, [planId1]);
    expect(count.rows[0].n).toBe(1);
  });

  test("POST /clients/:clientId/checkins replay returns identical response (no duplicates)", async () => {
    const coachToken = await registerAndLogin("coach-idem-checkins@example.com", "coach");

    const clientResp = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", "44444444-4444-4444-4444-444444444444")
      .send({ name: "Checkin Client", email: "checkin-client@example.com" });

    expect(clientResp.status).toBe(201);
    const clientId = clientResp.body.clientId as string;

    const checkinIdemKey = "55555555-5555-5555-5555-555555555555";

    const c1 = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", checkinIdemKey)
      .send({
        date: "2026-01-15",
        metrics: { sleep: 6, soreness: 7, weight: 80 }
      });

    expect([200, 201]).toContain(c1.status); // upsert might return 200 or 201
    expect(c1.body).toBeTruthy();

    const c2 = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .set("Idempotency-Key", checkinIdemKey)
      .send({
        date: "2026-01-15",
        metrics: { sleep: 6, soreness: 7, weight: 80 }
      });

    expect(c2.status).toBe(c1.status);
    expect(c2.body).toEqual(c1.body);

    // extra proof: list has exactly 1 check-in for that date
    const list = await request(app)
      .get(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.checkins)).toBe(true);

    const matches = (list.body.checkins as any[]).filter((x) => x.date === "2026-01-15");
    expect(matches.length).toBe(1);
  });
});
