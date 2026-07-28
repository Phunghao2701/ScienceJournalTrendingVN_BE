import { after, afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

import pool from "../../config/database.js";
import redis from "../../config/redis.js";
import articleRouter from "../../routes/article.route.js";
import { articleReferenceHydrationServiceRef } from "../../controllers/article.controller.js";

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "reference-hydration-test-secret";

const app = express();
app.use(express.json());
app.use("/api/v1/articles", articleRouter);

describe("POST /api/v1/articles/:id/references/hydrate", () => {
  afterEach(() => mock.restoreAll());
  after(async () => {
    process.env.JWT_SECRET = originalJwtSecret;
    redis.disconnect();
    await pool.end();
  });

  test("requires authentication", async () => {
    const response = await request(app).post(
      "/api/v1/articles/1/references/hydrate",
    );
    assert.equal(response.status, 401);
  });

  test("returns a 200 partial summary for FE to refetch public GET", async () => {
    mock.method(
      articleReferenceHydrationServiceRef,
      "hydrateArticleReferences",
      async () => ({
        partial: true,
        noReferences: false,
        summary: {
          requested: 3,
          resolved: 2,
          inserted: 2,
          already_available: 1,
          failed: 1,
        },
      }),
    );
    const token = jwt.sign(
      { user_id: 1, role: "USER" },
      process.env.JWT_SECRET,
    );
    const response = await request(app)
      .post("/api/v1/articles/1/references/hydrate")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(
      response.body.code,
      "ARTICLE_REFERENCES_HYDRATED_PARTIAL",
    );
    assert.deepEqual(response.body.data.summary, {
      requested: 3,
      resolved: 2,
      inserted: 2,
      already_available: 1,
      failed: 1,
    });
  });

  test("returns service 404 for missing or soft-deleted articles", async () => {
    mock.method(
      articleReferenceHydrationServiceRef,
      "hydrateArticleReferences",
      async () => {
        throw Object.assign(new Error("Không tìm thấy bài báo"), {
          statusCode: 404,
          code: "ARTICLE_NOT_FOUND",
        });
      },
    );
    const token = jwt.sign(
      { user_id: 1, role: "USER" },
      process.env.JWT_SECRET,
    );
    const response = await request(app)
      .post("/api/v1/articles/999/references/hydrate")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "ARTICLE_NOT_FOUND");
  });
});
