import request from "supertest";
import app from "../app";
import { getPostgresPool, disconnectPostgres } from "../config/postgres";

async function resetDb() {
  const pool = getPostgresPool();
  // Order matters because refresh_tokens references users
  await pool.query("TRUNCATE TABLE refresh_tokens RESTART IDENTITY CASCADE;");
  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE;");
}

describe("Auth integration (register/login/refresh/logout + RBAC)", () => {
  beforeAll(async () => {
    if (!process.env.POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not set for tests");
    }
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not set for tests");
    }
    await resetDb();
  });

  afterAll(async () => {
    await disconnectPostgres();
  });

  test("register -> 201", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "client@example.com", password: "password123", role: "client" });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: "client@example.com",
      role: "client"
    });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test("login -> returns access + refresh", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "client@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.refreshToken.length).toBeGreaterThan(20);
    expect(res.body.user).toMatchObject({ email: "client@example.com", role: "client" });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test("access protected route with access token -> 200", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "client@example.com", password: "password123" });

    const accessToken = login.body.accessToken as string;

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user).toHaveProperty("role", "client");
  });

  test("refresh -> returns new access + refresh; old refresh becomes invalid (rotation)", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "client@example.com", password: "password123" });

    const oldRefresh = login.body.refreshToken as string;

    const refresh1 = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: oldRefresh });

    expect(refresh1.status).toBe(200);
    expect(typeof refresh1.body.accessToken).toBe("string");
    expect(typeof refresh1.body.refreshToken).toBe("string");

    const newRefresh = refresh1.body.refreshToken as string;
    expect(newRefresh).not.toEqual(oldRefresh);

    // Using old refresh again should fail (rotation is the key signal)
    const refreshOldAgain = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: oldRefresh });

    expect(refreshOldAgain.status).toBe(401);
    expect(refreshOldAgain.body).toHaveProperty("code", "UNAUTHORIZED");
  });

  test("logout -> refresh with same token fails", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "client@example.com", password: "password123" });

    const refreshToken = login.body.refreshToken as string;

    const logout = await request(app)
      .post("/auth/logout")
      .send({ refreshToken });

    expect(logout.status).toBe(200);

    const refreshAfterLogout = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body).toHaveProperty("code", "UNAUTHORIZED");
  });

  test("coach-only route: client token -> 403, coach token -> 200", async () => {
    // create coach user
    const regCoach = await request(app)
      .post("/auth/register")
      .send({ email: "coach@example.com", password: "password123", role: "coach" });
    expect(regCoach.status).toBe(201);

    // client login
    const clientLogin = await request(app)
      .post("/auth/login")
      .send({ email: "client@example.com", password: "password123" });

    const clientToken = clientLogin.body.accessToken as string;

    const clientHit = await request(app)
      .get("/users/coach-only")
      .set("Authorization", `Bearer ${clientToken}`);

    expect(clientHit.status).toBe(403);
    expect(clientHit.body).toHaveProperty("code", "FORBIDDEN");

    // coach login
    const coachLogin = await request(app)
      .post("/auth/login")
      .send({ email: "coach@example.com", password: "password123" });

    const coachToken = coachLogin.body.accessToken as string;

    const coachHit = await request(app)
      .get("/users/coach-only")
      .set("Authorization", `Bearer ${coachToken}`);

    expect(coachHit.status).toBe(200);
    expect(coachHit.body).toHaveProperty("message");
  });
});
