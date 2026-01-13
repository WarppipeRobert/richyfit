import request from "supertest";
import app from "../app";
import { getPostgresPool, disconnectPostgres } from "../config/postgres";

async function resetDb() {
  const pool = getPostgresPool();
  // order matters due to FKs
  await pool.query("TRUNCATE TABLE coach_clients RESTART IDENTITY CASCADE;");
  await pool.query("TRUNCATE TABLE clients RESTART IDENTITY CASCADE;");
  await pool.query("TRUNCATE TABLE coaches RESTART IDENTITY CASCADE;");
  await pool.query("TRUNCATE TABLE refresh_tokens RESTART IDENTITY CASCADE;");
  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE;");
}

async function registerAndLogin(email: string, role: "coach" | "client") {
  const reg = await request(app)
    .post("/auth/register")
    .send({ email, password: "password123", role });

  expect([201, 409]).toContain(reg.status); // in case you reuse emails locally

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "password123" });

  expect(login.status).toBe(200);
  expect(typeof login.body.accessToken).toBe("string");
  return login.body.accessToken as string;
}

describe("Clients RBAC + ownership (integration)", () => {
  beforeAll(async () => {
    if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is not set for tests");
    if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test_secret";
    if (!process.env.JWT_ACCESS_TTL) process.env.JWT_ACCESS_TTL = "15m";
    await resetDb();
  });

  afterAll(async () => {
    await disconnectPostgres();
  });

  test("coach creates client -> 201", async () => {
    const coachToken = await registerAndLogin("coach1@example.com", "coach");

    const res = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Alice Client", email: "alice@example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("clientId");
    expect(typeof res.body.clientId).toBe("string");
  });

  test("coach lists clients -> includes created client", async () => {
    const coachToken = await registerAndLogin("coach2@example.com", "coach");

    // create
    const created = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Bob Client", email: "bob@example.com" });

    expect(created.status).toBe(201);
    const clientId = created.body.clientId as string;

    // list
    const list = await request(app)
      .get("/clients?limit=10")
      .set("Authorization", `Bearer ${coachToken}`);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);

    const ids = list.body.items.map((c: any) => c.id);
    expect(ids).toContain(clientId);
  });

  test("coach fetches client -> 200", async () => {
    const coachToken = await registerAndLogin("coach3@example.com", "coach");

    const created = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Cara Client" });

    const clientId = created.body.clientId as string;

    const getOne = await request(app)
      .get(`/clients/${clientId}`)
      .set("Authorization", `Bearer ${coachToken}`);

    expect(getOne.status).toBe(200);
    expect(getOne.body).toHaveProperty("client");
    expect(getOne.body.client).toMatchObject({
      id: clientId,
      display_name: "Cara Client"
    });
  });

  test("another coach fetches same client -> 404", async () => {
    const coachAToken = await registerAndLogin("coachA@example.com", "coach");
    const coachBToken = await registerAndLogin("coachB@example.com", "coach");

    const created = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachAToken}`)
      .send({ name: "Dana Client" });

    const clientId = created.body.clientId as string;

    const otherCoachFetch = await request(app)
      .get(`/clients/${clientId}`)
      .set("Authorization", `Bearer ${coachBToken}`);

    // ✅ Ownership enforced in query => looks like "not found"
    expect(otherCoachFetch.status).toBe(404);
    expect(otherCoachFetch.body).toHaveProperty("code", "NOT_FOUND");
  });

  test("client-role user calls POST /clients -> 403", async () => {
    const clientToken = await registerAndLogin("client1@example.com", "client");

    const res = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ name: "Should Fail" });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("code", "FORBIDDEN");
  });
});
