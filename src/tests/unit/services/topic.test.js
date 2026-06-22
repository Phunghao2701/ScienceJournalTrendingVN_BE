import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";
import logger from "../../../utils/logger.js";
import * as topicService from "../../../services/topic.service.js";

test.after(async () => {
  await pool.end();
});

describe("Topic Service Unit Tests (Update, Delete, Restore, GET, POST)", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  describe("getTopicById", () => {
    test("should return topic if found", async () => {
      const mockResult = { topic_id: "1", display_name: "Test" };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await topicService.getTopicById(1);
      assert.deepStrictEqual(result, mockResult);
      assert.strictEqual(mockQuery.mock.calls.length, 1);
    });

    test("should return null if not found", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));

      const result = await topicService.getTopicById(99);
      assert.strictEqual(result, null);
    });
  });

  describe("getTopics", () => {
    test("should return list of topics and total", async () => {
      const mockItems = [{ topic_id: "1", display_name: "Test" }];
      const mockQuery = mock.method(pool, "query", async (queryStr) => {
        if (queryStr.includes("COUNT")) return { rows: [{ total: 1 }] };
        return { rows: mockItems };
      });

      const result = await topicService.getTopics({ page: 1, limit: 10 });
      assert.deepStrictEqual(result.items, mockItems);
      assert.strictEqual(result.total, 1);
      assert.strictEqual(mockQuery.mock.calls.length, 2);
    });
  });

  describe("checkDuplicateTopic", () => {
    test("should return true if duplicated", async () => {
      mock.method(pool, "query", async () => ({ rows: [{}] }));

      const result = await topicService.checkDuplicateTopic("Test");
      assert.strictEqual(result.duplicateName, true);
    });

    test("should return false if not duplicated", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));

      const result = await topicService.checkDuplicateTopic("Test");
      assert.strictEqual(result.duplicateName, false);
    });
  });

  describe("createTopic", () => {
    test("should create topic and return data", async () => {
      const mockResult = { topic_id: "1", display_name: "Test", score: 0.5 };
      mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await topicService.createTopic({ display_name: "Test", score: 0.5 });
      assert.deepStrictEqual(result, mockResult);
    });
  });

  describe("updateTopic", () => {
    test("should dynamically build update query and return updated topic", async () => {
      const mockData = { display_name: "New Name", score: 0.9 };
      const mockResult = { topic_id: "1", ...mockData };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await topicService.updateTopic(1, mockData);
      assert.deepStrictEqual(result, mockResult);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], ["New Name", 0.9, 1n]);
    });

    test("should return null if no allowed fields are provided", async () => {
      const mockQuery = mock.method(pool, "query", async () => {});
      const result = await topicService.updateTopic(1, { invalid_field: "test" });
      assert.strictEqual(result, null);
      assert.strictEqual(mockQuery.mock.calls.length, 0);
    });

    test("should return null if topic is not found or already deleted", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await topicService.updateTopic(1, { display_name: "Test" });
      assert.strictEqual(result, null);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await topicService.updateTopic(1, { display_name: "Test" }),
        { message: "DB Error" }
      );
    });
  });

  describe("deleteTopic", () => {
    test("should set is_deleted to true and return topic", async () => {
      const mockResult = { topic_id: "1", is_deleted: true };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await topicService.deleteTopic(1);
      assert.deepStrictEqual(result, mockResult);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n]);
    });

    test("should return null if topic not found", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await topicService.deleteTopic(1);
      assert.strictEqual(result, null);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await topicService.deleteTopic(1),
        { message: "DB Error" }
      );
    });
  });

  describe("restoreTopic", () => {
    test("should set is_deleted to false and return topic", async () => {
      const mockResult = { topic_id: "1", is_deleted: false };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await topicService.restoreTopic(1);
      assert.deepStrictEqual(result, mockResult);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n]);
    });

    test("should return null if topic not found", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await topicService.restoreTopic(1);
      assert.strictEqual(result, null);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await topicService.restoreTopic(1),
        { message: "DB Error" }
      );
    });
  });

  describe("topicIsDeleted", () => {
    test("should return true if topic is soft deleted", async () => {
      mock.method(pool, "query", async () => ({ rows: [{ "?column?": 1 }] }));
      const result = await topicService.topicIsDeleted(1);
      assert.strictEqual(result, true);
    });

    test("should return false if topic is not soft deleted", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await topicService.topicIsDeleted(1);
      assert.strictEqual(result, false);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await topicService.topicIsDeleted(1),
        { message: "DB Error" }
      );
    });
  });
});
