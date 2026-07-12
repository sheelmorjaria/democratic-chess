import { describe, expect, it } from "vitest";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "../app.js";
import { getPrisma } from "../../db/prisma.js";
import { findUserByEmail } from "../../db/repositories/users.js";

const db: PrismaClient = getPrisma();
const app = createApp({ db });

const unique = () => Math.random().toString(36).slice(2, 10);

describe("auth routes", () => {
  it("registers a new user and returns tokens", async () => {
    const email = `user_${unique()}@example.com`;
    const res = await request(app)
      .post("/auth/register")
      .send({ username: `u_${unique()}`, email, password: "supersecret" });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
    expect(res.body.user.email).toBe(email);
    expect(await findUserByEmail(db, email)).not.toBeNull();
  });

  it("rejects a duplicate email with 409", async () => {
    const email = `dup_${unique()}@example.com`;
    await request(app)
      .post("/auth/register")
      .send({ username: `u_${unique()}`, email, password: "supersecret" });
    const res = await request(app)
      .post("/auth/register")
      .send({ username: `u_${unique()}`, email, password: "supersecret" });
    expect(res.status).toBe(409);
  });

  it("logs in and reaches /me with the access token", async () => {
    const email = `login_${unique()}@example.com`;
    const username = `u_${unique()}`;
    await request(app)
      .post("/auth/register")
      .send({ username, email, password: "supersecret" });

    const login = await request(app)
      .post("/auth/login")
      .send({ email, password: "supersecret" });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken as string}`);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe(username);
  });

  it("issues a new access token from a refresh token", async () => {
    const reg = await request(app)
      .post("/auth/register")
      .send({ username: `u_${unique()}`, email: `ref_${unique()}@example.com`, password: "supersecret" });
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: reg.body.refreshToken as string });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });
});
