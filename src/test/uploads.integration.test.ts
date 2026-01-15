// tests/uploads.integration.test.ts
import request from "supertest";
import { z } from "zod";

import { disconnectPostgres, getPostgresPool } from "../config/postgres";
import { registerAndLogin, resetDb } from "./utils";
import app from "../app";

// ✅ Mock storage provider so tests never hit real S3
jest.mock("../storage", () => {
  return {
    getStorageProvider: () => ({
      getPresignedPutUrl: async (key: string, contentType: string, expiresSeconds: number) => {
        return `https://mock-s3.local/put?key=${encodeURIComponent(key)}&ct=${encodeURIComponent(
          contentType
        )}&exp=${expiresSeconds}`;
      },
      getPublicUrl: (key: string) => `https://mock-s3.local/public/${encodeURIComponent(key)}`
    })
  };
});

const uuidSchema = z.uuid();

describe("Uploads + ownership enforcement (integration)", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
    process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
    process.env.JWT_REFRESH_DAYS = process.env.JWT_REFRESH_DAYS || "7";

    // presign expiry bounds: 60..300 required by service
    process.env.S3_PRESIGN_EXPIRES_SECONDS = process.env.S3_PRESIGN_EXPIRES_SECONDS || "300";

    // reset tables used in these tests
    await resetDb(getPostgresPool(), [
      "attachments",
      "coach_clients",
      "clients",
      "coaches",
      "refresh_tokens",
      "users"
    ]);
  });

  afterAll(async () => {
    await disconnectPostgres();
  });

  test("coach requests upload URL for owned client -> 201 with attachmentId and putUrl", async () => {
    const coachToken = await registerAndLogin("coach-upload-1@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Client A", email: "clientA@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;
    expect(clientId).toBeTruthy();
    expect(uuidSchema.safeParse(clientId).success).toBe(true);

    const resp = await request(app)
      .post(`/clients/${clientId}/uploads`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ type: "progress_photo", contentType: "image/jpeg" });

    expect(resp.status).toBe(201);
    expect(resp.body).toHaveProperty("attachmentId");
    expect(resp.body).toHaveProperty("putUrl");
    expect(resp.body).toHaveProperty("s3Key");

    expect(uuidSchema.safeParse(resp.body.attachmentId).success).toBe(true);
    expect(typeof resp.body.putUrl).toBe("string");
    expect(resp.body.putUrl).toContain("https://mock-s3.local/put?");
    expect(typeof resp.body.s3Key).toBe("string");
    expect(resp.body.s3Key).toContain(`clients/${clientId}/`);
    expect(resp.body.s3Key).toMatch(/\.jpg$/);
  });

  test("other coach requests upload URL for same client -> 404", async () => {
    const coach1Token = await registerAndLogin("coach-upload-owner@example.com", "coach");
    const coach2Token = await registerAndLogin("coach-upload-other@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coach1Token}`)
      .send({ name: "Client Owned", email: "owned@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;

    const resp = await request(app)
      .post(`/clients/${clientId}/uploads`)
      .set("Authorization", `Bearer ${coach2Token}`)
      .send({ type: "progress_photo", contentType: "image/jpeg" });

    // ✅ IMPORTANT: not owned => 404 (not 403)
    expect(resp.status).toBe(404);
  });

  test("invalid contentType -> 400", async () => {
    const coachToken = await registerAndLogin("coach-upload-invalid-ct@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Client B", email: "clientB@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;

    const resp = await request(app)
      .post(`/clients/${clientId}/uploads`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ type: "progress_photo", contentType: "image/gif" }); // not allowlisted

    expect(resp.status).toBe(400);
  });

  test("list attachments returns created record", async () => {
    const coachToken = await registerAndLogin("coach-upload-list@example.com", "coach");

    const createdClient = await request(app)
      .post("/clients")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ name: "Client C", email: "clientC@example.com" });

    expect(createdClient.status).toBe(201);
    const clientId = createdClient.body.clientId as string;

    const createdUpload = await request(app)
      .post(`/clients/${clientId}/uploads`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ type: "document", contentType: "application/pdf" });

    expect(createdUpload.status).toBe(201);
    const attachmentId = createdUpload.body.attachmentId as string;

    const listResp = await request(app)
      .get(`/clients/${clientId}/uploads`)
      .set("Authorization", `Bearer ${coachToken}`);

    expect(listResp.status).toBe(200);
    expect(listResp.body).toHaveProperty("attachments");
    expect(Array.isArray(listResp.body.attachments)).toBe(true);

    const found = (listResp.body.attachments as any[]).find((a) => a.id === attachmentId);
    expect(found).toBeTruthy();

    expect(found).toMatchObject({
      id: attachmentId,
      clientId,
      type: "document",
      contentType: "application/pdf"
    });

    expect(typeof found.s3Key).toBe("string");
    expect(found.s3Key).toMatch(/\.pdf$/);
    expect(typeof found.createdAt).toBe("string");
  });
});
