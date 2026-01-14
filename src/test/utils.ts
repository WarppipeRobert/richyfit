import { Pool } from "pg";
import request from "supertest";
import app from "../app";

export async function resetDb(pool: Pool, tables: string[]) {
  for (const table of tables) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
  }
}

export async function registerAndLogin(email: string, role: "coach" | "client") {
  await request(app)
    .post("/auth/register")
    .send({ email, password: "password123", role });

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "password123" });

  return login.body.accessToken as string;
}
