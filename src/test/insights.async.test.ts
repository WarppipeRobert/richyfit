// tests/insights.async.int.test.ts
import request from "supertest";
import { disconnectPostgres, getPostgresPool } from "../config/postgres";
import { registerAndLogin, resetDb } from "./utils";
import app from "../app";

import { connectRedis, disconnectRedis, getRedis } from "../config/redis";

import { startInsightWorker, stopInsightWorker } from "../workers/insight.worker";
import { connectMongo, disconnectMongo, getMongoClient } from "../config/mongo/mongo";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function poll<T>(fn: () => Promise<T>, opts: { attempts: number; intervalMs: number }) {
  let lastErr: any = null;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await sleep(opts.intervalMs);
    }
  }
  throw lastErr ?? new Error("poll: exhausted");
}

describe("Insights async flow (integration)", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
    process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
    process.env.JWT_REFRESH_DAYS = process.env.JWT_REFRESH_DAYS || "7";

    await resetDb(getPostgresPool(), [
      "workout_items",
      "workouts",
      "plans",
      "exercises",
      "coach_clients",
      "clients",
      "coaches",
      "refresh_tokens",
      "users"
    ]);

    await connectRedis();
    await connectMongo();

    await getRedis().flushdb();
    const dbName = process.env.MONGO_DB || "admin";
    await getMongoClient().db(dbName).dropDatabase();

    // worker must run in test process for end-to-end async proof
    startInsightWorker();
  });

  afterAll(async () => {
    await stopInsightWorker();
    await disconnectRedis();
    await disconnectMongo();
    await disconnectPostgres();
  });

  test("create check-ins -> POST /insights 202 -> GET /insights returns computed summary", async () => {
    const coachToken = await registerAndLogin("coach-insight-happy@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Insight Client", email: "insight-client@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;
    expect(clientId).toBeTruthy();

    // Oldest in range
    const c1 = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        date: "2026-01-01",
        metrics: { sleep: 6, soreness: 7, weight: 80 }
      });
    expect(c1.status).toBe(201);

    // Newest in range (lower weight -> downward trend)
    const c2 = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        date: "2026-01-07",
        metrics: { sleep: 6, soreness: 7, weight: 78 }
      });
    expect(c2.status).toBe(201);

    const enq = await request(app)
      .post(`/clients/${clientId}/insights`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ from: "2026-01-01", to: "2026-01-07" });

    expect(enq.status).toBe(202);
    expect(enq.body).toHaveProperty("jobId");
    expect(typeof enq.body.jobId).toBe("string");

    // Poll GET until worker writes Mongo doc (200 instead of 404)
    const insightRes = await poll(
      async () => {
        const r = await request(app)
          .get(`/clients/${clientId}/insights`)
          .set("Authorization", `Bearer ${coachToken}`)
          .query({ from: "2026-01-01", to: "2026-01-07" });

        if (r.status !== 200) throw new Error(`not ready: ${r.status}`);
        return r;
      },
      { attempts: 40, intervalMs: 250 }
    );

    expect(insightRes.status).toBe(200);
    expect(insightRes.body).toHaveProperty("insight");

    const insight = insightRes.body.insight as any;

    expect(insight).toMatchObject({
      clientId,
      from: "2026-01-01",
      to: "2026-01-07"
    });

    // deterministic aggregates from worker logic
    expect(insight.avgSleep).toBeCloseTo(6, 5);
    expect(insight.avgSoreness).toBeCloseTo(7, 5);
    expect(insight.weightDelta).toBeCloseTo(-2, 5);

    // deterministic rule-based summary
    expect(typeof insight.summary).toBe("string");
    expect(insight.summary).toContain("Recovery warning");
    expect(insight.summary).toContain("Weight trend: down 2.0");
  });
});
