import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";
import logger from "../../../utils/logger.js";
import * as issueService from "../../../services/issue.service.js";

test.after(async () => {
  await pool.end();
});

describe("Issue Service Unit Tests", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  describe("issueExists", () => {
    test("should return true if issue exists", async () => {
      const mockQuery = mock.method(pool, "query", async () => ({ rowCount: 1 }));
      const result = await issueService.issueExists(1);
      assert.strictEqual(result, true);
      assert.strictEqual(mockQuery.mock.calls.length, 1);
    });

    test("should return false if issue does not exist", async () => {
      const mockQuery = mock.method(pool, "query", async () => ({ rowCount: 0 }));
      const result = await issueService.issueExists(99);
      assert.strictEqual(result, false);
    });

    test("should throw error if database query fails", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      
      await assert.rejects(
        async () => await issueService.issueExists(1),
        { message: "DB Error" }
      );
    });
  });

  describe("issueIsDeleted", () => {
    test("should return true if issue is soft deleted", async () => {
      mock.method(pool, "query", async () => ({ rows: [{ "?column?": 1 }] }));
      const result = await issueService.issueIsDeleted(1);
      assert.strictEqual(result, true);
    });

    test("should return false if issue is not soft deleted", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await issueService.issueIsDeleted(1);
      assert.strictEqual(result, false);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.issueIsDeleted(1),
        { message: "DB Error" }
      );
    });
  });

  describe("checkDuplicateIssue", () => {
    test("should return true if duplicate issue exists", async () => {
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [{ "?column?": 1 }] }));
      const result = await issueService.checkDuplicateIssue(1, 2);
      assert.strictEqual(result, true);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n, 2]);
    });

    test("should include excludeId in query if provided", async () => {
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await issueService.checkDuplicateIssue(1, 2, 3);
      assert.strictEqual(result, false);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n, 2, 3n]);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.checkDuplicateIssue(1, 2),
        { message: "DB Error" }
      );
    });
  });

  describe("createIssue", () => {
    test("should create issue successfully and return it", async () => {
      const mockData = { volume_id: 1, issue_number: 2, publication_year: 2025 };
      const mockResult = { issue_id: "1", ...mockData, is_deleted: false };
      
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));
      
      const result = await issueService.createIssue(mockData);
      assert.deepStrictEqual(result, mockResult);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n, 2, 2025]);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.createIssue({ volume_id: 1 }),
        { message: "DB Error" }
      );
    });
  });

  describe("getIssues", () => {
    test("should return items and total", async () => {
      const mockItems = [{ issue_id: "1", issue_number: 1 }];
      let callCount = 0;
      mock.method(pool, "query", async () => {
        callCount++;
        if (callCount === 1) return { rows: [{ total: 10 }] }; // count
        if (callCount === 2) return { rows: mockItems }; // data
      });

      const result = await issueService.getIssues({ page: 1, limit: 5 });
      assert.deepStrictEqual(result.items, mockItems);
      assert.strictEqual(result.total, 10);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.getIssues(),
        { message: "DB Error" }
      );
    });
  });

  describe("getIssueById", () => {
    test("should return issue details if found", async () => {
      const mockIssue = { issue_id: "1", issue_number: 2 };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockIssue] }));
      
      const result = await issueService.getIssueById(1);
      assert.deepStrictEqual(result, mockIssue);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n]);
    });

    test("should return null if issue not found", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await issueService.getIssueById(1);
      assert.strictEqual(result, null);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.getIssueById(1),
        { message: "DB Error" }
      );
    });
  });

  describe("updateIssue", () => {
    test("should dynamically build update query and return updated issue", async () => {
      const mockData = { issue_number: 5, publication_year: 2030 };
      const mockResult = { issue_id: "1", ...mockData };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await issueService.updateIssue(1, mockData);
      assert.deepStrictEqual(result, mockResult);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [5, 2030, 1n]);
    });

    test("should return null if no allowed fields are provided", async () => {
      const mockQuery = mock.method(pool, "query", async () => {});
      const result = await issueService.updateIssue(1, { some_other_field: "test" });
      assert.strictEqual(result, null);
      assert.strictEqual(mockQuery.mock.calls.length, 0);
    });

    test("should return null if issue is not found or already deleted", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await issueService.updateIssue(1, { issue_number: 5 });
      assert.strictEqual(result, null);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.updateIssue(1, { issue_number: 5 }),
        { message: "DB Error" }
      );
    });
  });

  describe("deleteIssue", () => {
    test("should set is_deleted to true and return issue", async () => {
      const mockResult = { issue_id: "1", is_deleted: true };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await issueService.deleteIssue(1);
      assert.deepStrictEqual(result, mockResult);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n]);
    });

    test("should return null if issue not found", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await issueService.deleteIssue(1);
      assert.strictEqual(result, null);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.deleteIssue(1),
        { message: "DB Error" }
      );
    });
  });

  describe("restoreIssue", () => {
    test("should set is_deleted to false and return issue", async () => {
      const mockResult = { issue_id: "1", is_deleted: false };
      const mockQuery = mock.method(pool, "query", async () => ({ rows: [mockResult] }));

      const result = await issueService.restoreIssue(1);
      assert.deepStrictEqual(result, mockResult);
      assert.deepStrictEqual(mockQuery.mock.calls[0].arguments[1], [1n]);
    });

    test("should return null if issue not found", async () => {
      mock.method(pool, "query", async () => ({ rows: [] }));
      const result = await issueService.restoreIssue(1);
      assert.strictEqual(result, null);
    });

    test("should throw error on DB failure", async () => {
      mock.method(pool, "query", async () => { throw new Error("DB Error"); });
      mock.method(logger, "error", () => {});
      await assert.rejects(
        async () => await issueService.restoreIssue(1),
        { message: "DB Error" }
      );
    });
  });
});
