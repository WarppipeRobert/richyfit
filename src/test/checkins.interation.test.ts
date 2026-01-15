// tests/checkins.int.test.ts
import request from "supertest";
import { disconnectPostgres, getPostgresPool } from "../config/postgres";
import { registerAndLogin, resetDb } from "./utils";
import app from "../app";

import { connectRedis, disconnectRedis, getRedis } from "../config/redis";
import { connectMongo, disconnectMongo, getMongoClient } from "../config/mongo/mongo";

describe("Checkins + ownership enforcement (integration)", () => {
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

    // ensure clean state for integration runs
    await getRedis().flushdb();

    const dbName = process.env.MONGO_DB || "admin";
    await getMongoClient().db(dbName).dropDatabase();
  });

  afterAll(async () => {
    await disconnectRedis();
    await disconnectMongo();
    await disconnectPostgres();
  });

  test("coach posts check-in -> 201", async () => {
    const coachToken = await registerAndLogin("coach-checkin-1@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Client A", email: "clientA-checkin@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;
    expect(clientId).toBeTruthy();

    const created = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        date: "2025-01-01",
        metrics: { weight: 80, mood: "ok" },
        notes: "Day 1"
      });

    expect(created.status).toBe(201);
    expect(created.body).toHaveProperty("checkinId");
    expect(typeof created.body.checkinId).toBe("string");
  });

  test("coach posts same date -> 200 (upsert)", async () => {
    const coachToken = await registerAndLogin("coach-checkin-upsert@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Client Upsert", email: "client-upsert@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;

    const first = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        date: "2025-01-10",
        metrics: { weight: 80 },
        notes: "Initial"
      });

    expect(first.status).toBe(201);
    const checkinId1 = first.body.checkinId as string;
    expect(checkinId1).toBeTruthy();

    const second = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        date: "2025-01-10",
        metrics: { weight: 81, soreness: 3 },
        notes: "Updated"
      });

    expect(second.status).toBe(200);
    const checkinId2 = second.body.checkinId as string;
    expect(checkinId2).toBeTruthy();
    expect(checkinId2).toBe(checkinId1);
  });

  test("coach queries range -> returns expected entries", async () => {
    const coachToken = await registerAndLogin("coach-checkin-range@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Client Range", email: "client-range@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;

    const c1 = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        date: "2025-01-02",
        metrics: { weight: 80, steps: 7000 }
      });
    expect(c1.status).toBe(201);

    const c2 = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        date: "2025-01-05",
        metrics: { weight: 79.5, steps: 9000 },
        notes: "Felt good"
      });
    expect(c2.status).toBe(201);

    const list = await request(app)
      .get(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachToken}`)
      .query({ from: "2025-01-01", to: "2025-01-31", limit: 30 });

    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty("items");
    expect(Array.isArray(list.body.items)).toBe(true);

    const items = list.body.items as any[];
    expect(items.length).toBe(2);

    // repo sorts by date desc
    expect(items[0]).toMatchObject({ clientId, date: "2025-01-05" });
    expect(items[0].metrics).toMatchObject({ weight: 79.5, steps: 9000 });
    expect(items[0].notes).toBe("Felt good");

    expect(items[1]).toMatchObject({ clientId, date: "2025-01-02" });
    expect(items[1].metrics).toMatchObject({ weight: 80, steps: 7000 });

    expect(list.body).toHaveProperty("nextCursor");
    expect(list.body.nextCursor).toBeNull();
  });

  test("other coach queries same client -> 404", async () => {
    const coachAToken = await registerAndLogin("coach-checkin-A@example.com", "coach");
    const coachBToken = await registerAndLogin("coach-checkin-B@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachAToken}`)
      .send({ name: "Owned Client", email: "owned-checkin@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;

    const created = await request(app)
      .post(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachAToken}`)
      .send({
        date: "2025-02-01",
        metrics: { weight: 82 }
      });
    expect(created.status).toBe(201);

    const otherCoachList = await request(app)
      .get(`/clients/${clientId}/checkins`)
      .set("Authorization", `Bearer ${coachBToken}`)
      .query({ from: "2025-02-01", to: "2025-02-28" });

    expect(otherCoachList.status).toBe(404);
    expect(otherCoachList.body).toHaveProperty("code", "NOT_FOUND");
  });
});
