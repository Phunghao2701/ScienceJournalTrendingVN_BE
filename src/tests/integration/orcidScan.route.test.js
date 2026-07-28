import { after, afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

import pool from "../../config/database.js";
import redis from "../../config/redis.js";
import authorRouter from "../../routes/author.route.js";
import orcidRouter from "../../routes/orcid.route.js";
import { orcidScanJobServiceRef } from "../../controllers/orcidScan.controller.js";

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "orcid-scan-test-secret";
const userId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";

const app = express();
app.use(express.json());
app.use("/api/v1/author", authorRouter);
app.use("/api/v1/orcid", orcidRouter);

const token = () =>
  jwt.sign({ user_id: userId, role: "USER" }, process.env.JWT_SECRET);

const queuedJob = (overrides = {}) => ({
  job_id: jobId,
  orcid: "0000-0002-1825-0097",
  requested_by: userId,
  status: "queued",
  stage: "queued",
  progress: 0,
  source_progress: {},
  source_status: {},
  summary: {},
  author_id: null,
  ...overrides,
});

describe("asynchronous ORCID scan routes", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    process.env.JWT_SECRET = originalJwtSecret;
    redis.disconnect();
    await pool.end();
  });

  test("requires an authenticated user", async () => {
    const response = await request(app)
      .post("/api/v1/orcid/scan")
      .send({ orcid: "0000-0002-1825-0097" });

    assert.equal(response.status, 401);
  });

  test("rejects an invalid ORCID before creating a job", async () => {
    const create = mock.method(
      orcidScanJobServiceRef,
      "createOrReuseOrcidScanJob",
      async () => assert.fail("job must not be created"),
    );

    const response = await request(app)
      .post("/api/v1/orcid/scan")
      .set("Authorization", `Bearer ${token()}`)
      .send({ orcid: "0000-0002-1825-0098" });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "ORCID_INVALID");
    assert.equal(create.mock.calls.length, 0);
  });

  test("returns 202 and enqueues a new full scan job", async () => {
    const create = mock.method(
      orcidScanJobServiceRef,
      "createOrReuseOrcidScanJob",
      async () => ({ job: queuedJob(), reused: false }),
    );
    const enqueue = mock.method(
      orcidScanJobServiceRef,
      "enqueueOrcidScanJob",
      async () => ({ id: jobId }),
    );

    const response = await request(app)
      .post("/api/v1/orcid/scan")
      .set("Authorization", `Bearer ${token()}`)
      .send({ orcid: "https://orcid.org/0000-0002-1825-0097" });

    assert.equal(response.status, 202);
    assert.equal(response.body.code, "ORCID_SCAN_QUEUED");
    assert.equal(response.body.data.job_id, jobId);
    assert.equal(response.body.data.reused, false);
    assert.equal(response.body.data.status_url, `/api/v1/orcid/scan/${jobId}`);
    assert.equal(create.mock.calls[0].arguments[0].requestedBy, userId);
    assert.equal(enqueue.mock.calls.length, 1);
  });

  test("reuses an active job without enqueueing it twice", async () => {
    mock.method(
      orcidScanJobServiceRef,
      "createOrReuseOrcidScanJob",
      async () => ({
        job: queuedJob({ status: "running", progress: 43 }),
        reused: true,
      }),
    );
    const enqueue = mock.method(
      orcidScanJobServiceRef,
      "enqueueOrcidScanJob",
      async () => assert.fail("active job must not be enqueued twice"),
    );

    const response = await request(app)
      .post("/api/v1/orcid/scan")
      .set("Authorization", `Bearer ${token()}`)
      .send({ orcid: "0000-0002-1825-0097" });

    assert.equal(response.status, 202);
    assert.equal(response.body.code, "ORCID_SCAN_ALREADY_RUNNING");
    assert.equal(response.body.data.reused, true);
    assert.equal(response.body.data.progress, 43);
    assert.equal(enqueue.mock.calls.length, 0);
  });

  test("returns terminal job status with author articles URL", async () => {
    mock.method(
      orcidScanJobServiceRef,
      "getOrcidScanJobById",
      async () =>
        queuedJob({
          status: "completed",
          stage: "completed",
          progress: 100,
          author_id: "36611",
          summary: {
            discovered: 275,
            created: 200,
            available_publications: 275,
          },
        }),
    );

    const response = await request(app)
      .get(`/api/v1/orcid/scan/${jobId}`)
      .set("Authorization", `Bearer ${token()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.code, "ORCID_SCAN_COMPLETED");
    assert.equal(response.body.data.progress, 100);
    assert.equal(response.body.data.author_id, "36611");
    assert.equal(response.body.data.counts.available_publications, 275);
    assert.equal(
      response.body.data.articles_url,
      "/api/v1/author/36611/articles?page=1&limit=20",
    );
    assert.equal(
      response.body.data.publications_url,
      `/api/v1/orcid/scan/${jobId}/publications?cursor=0&limit=20`,
    );
  });

  test("returns committed publications with cursor pagination while running", async () => {
    mock.method(
      orcidScanJobServiceRef,
      "getOrcidScanJobById",
      async () => queuedJob({
        status: "running",
        stage: "persisting",
        progress: 72,
        author_id: "36611",
      }),
    );
    const publications = mock.method(
      orcidScanJobServiceRef,
      "getOrcidScanJobPublications",
      async () => ({
        articles: [{
          item_id: "101",
          article_id: "24736",
          title: "Progressive result",
        }],
        pagination: {
          cursor: "100",
          next_cursor: "101",
          limit: 20,
          total_available: 25,
          has_next: true,
        },
      }),
    );

    const response = await request(app)
      .get(`/api/v1/orcid/scan/${jobId}/publications?cursor=100&limit=20`)
      .set("Authorization", `Bearer ${token()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.articles[0].article_id, "24736");
    assert.equal(response.body.data.pagination.next_cursor, "101");
    assert.equal(response.body.data.pagination.total_available, 25);
    assert.deepEqual(
      publications.mock.calls[0].arguments[1],
      { cursor: "100", limit: 20 },
    );
  });

  test("does not expose the removed author-scoped legacy route", async () => {
    const response = await request(app)
      .post("/api/v1/author/orcid/scan")
      .set("Authorization", `Bearer ${token()}`)
      .send({ orcid: "0000-0002-1825-0097" });

    assert.equal(response.status, 404);
  });
});
