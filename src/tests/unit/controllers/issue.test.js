import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";

test.after(async () => {
  await pool.end();
});

import {
  createIssue,
  getIssues,
  getIssueById,
  updateIssue,
  deleteIssue,
  restoreIssue,
  issueServiceRef
} from "../../../controllers/issue.controller.js";
import logger from "../../../utils/logger.js";

describe("Issue Controller Unit Test Suite", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const createMockResponse = () => {
    const res = {};
    res.status = (statusCode) => {
      res.statusCode = statusCode;
      return res;
    };
    res.json = (jsonData) => {
      res.body = jsonData;
      return res;
    };
    return res;
  };

  // ==========================================
  // createIssue
  // ==========================================
  test("createIssue: Thành công tạo mới một issue", async () => {
    const mockIssue = {
      issue_id: "10",
      volume_id: "1",
      issue_number: 3,
      publication_year: 2025,
      is_deleted: false
    };

    const mockCreate = mock.method(issueServiceRef, "createIssue", async () => mockIssue);
    mock.method(logger, "error", () => {});

    const req = {
      body: {
        volume_id: "1",
        issue_number: 3,
        publication_year: 2025
      }
    };
    const res = createMockResponse();

    await createIssue(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "ISSUE_CREATED");
    assert.strictEqual(res.body.message, "Tạo Issue thành công");
    assert.deepStrictEqual(res.body.data, mockIssue);
    assert.deepStrictEqual(mockCreate.mock.calls[0].arguments, [
      { volume_id: "1", issue_number: 3, publication_year: 2025 }
    ]);
  });

  test("createIssue: Lỗi 500 khi service throw error", async () => {
    mock.method(issueServiceRef, "createIssue", async () => {
      throw new Error("DB error");
    });
    mock.method(logger, "error", () => {});

    const req = {
      body: { volume_id: "1", issue_number: 3, publication_year: 2025 }
    };
    const res = createMockResponse();

    await createIssue(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "SERVER_ERROR");
  });

  // ==========================================
  // getIssues
  // ==========================================
  test("getIssues: Thành công lấy danh sách issue với phân trang", async () => {
    const mockList = {
      items: [
        {
          issue_id: "1",
          volume_id: "1",
          issue_number: 3,
          publication_year: 2025,
          is_deleted: false
        }
      ],
      total: 1
    };

    const mockGet = mock.method(issueServiceRef, "getIssues", async () => mockList);
    mock.method(logger, "error", () => {});

    const req = {
      query: {
        page: "1",
        limit: "10",
        volume_id: "1"
      }
    };
    const res = createMockResponse();

    await getIssues(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "ISSUES_FETCHED");
    assert.strictEqual(res.body.message, "Lấy danh sách issue thành công");
    assert.deepStrictEqual(res.body.data.items, mockList.items);
    assert.strictEqual(res.body.data.pagination.total, 1);
    assert.deepStrictEqual(mockGet.mock.calls[0].arguments, [
      {
        page: "1",
        limit: "10",
        search: undefined,
        volume_id: "1",
        sort_by: undefined,
        sort_order: undefined
      }
    ]);
  });

  // ==========================================
  // getIssueById
  // ==========================================
  test("getIssueById: Thành công lấy chi tiết issue", async () => {
    const mockIssue = {
      issue_id: "1",
      volume_id: "1",
      issue_number: 3,
      publication_year: 2025,
      is_deleted: false,
      volume_number: 12,
      journal_id: "1",
      journal_name: "Test Journal"
    };

    const mockGetById = mock.method(issueServiceRef, "getIssueById", async () => mockIssue);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await getIssueById(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "ISSUE_FETCHED");
    assert.deepStrictEqual(res.body.data, mockIssue);
    assert.deepStrictEqual(mockGetById.mock.calls[0].arguments, ["1"]);
  });

  test("getIssueById: Thất bại khi không tìm thấy issue", async () => {
    mock.method(issueServiceRef, "getIssueById", async () => null);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await getIssueById(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "ISSUE_NOT_FOUND");
  });

  // ==========================================
  // updateIssue
  // ==========================================
  test("updateIssue: Thành công cập nhật thông tin issue", async () => {
    const mockIssue = {
      issue_id: "1",
      volume_id: "1",
      issue_number: 5,
      publication_year: 2026,
      is_deleted: false
    };

    const mockUpdate = mock.method(issueServiceRef, "updateIssue", async () => mockIssue);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" },
      body: {
        issue_number: 5,
        publication_year: 2026
      }
    };
    const res = createMockResponse();

    await updateIssue(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "ISSUE_UPDATED");
    assert.deepStrictEqual(res.body.data, mockIssue);
    assert.deepStrictEqual(mockUpdate.mock.calls[0].arguments, [
      "1",
      { issue_number: 5, publication_year: 2026 }
    ]);
  });

  // ==========================================
  // deleteIssue
  // ==========================================
  test("deleteIssue: Thất bại khi issue không tồn tại", async () => {
    mock.method(issueServiceRef, "issueExists", async () => false);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await deleteIssue(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "ISSUE_NOT_FOUND");
  });

  test("deleteIssue: Thất bại khi issue đã bị xóa mềm trước đó", async () => {
    mock.method(issueServiceRef, "issueExists", async () => true);
    mock.method(issueServiceRef, "issueIsDeleted", async () => true);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await deleteIssue(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "ISSUE_ALREADY_DELETED");
    assert.strictEqual(res.body.message, "Không delete issue đã bị delete");
  });

  test("deleteIssue: Thành công xóa mềm issue", async () => {
    const mockIssue = {
      issue_id: "1",
      volume_id: "1",
      issue_number: 3,
      publication_year: 2025,
      is_deleted: true
    };

    mock.method(issueServiceRef, "issueExists", async () => true);
    mock.method(issueServiceRef, "issueIsDeleted", async () => false);
    mock.method(issueServiceRef, "deleteIssue", async () => mockIssue);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await deleteIssue(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "ISSUE_DELETED");
    assert.strictEqual(res.body.message, "Xóa Issue thành công");
    assert.deepStrictEqual(res.body.data, mockIssue);
  });

  // ==========================================
  // restoreIssue
  // ==========================================
  test("restoreIssue: Thất bại khi issue không tồn tại", async () => {
    mock.method(issueServiceRef, "issueExists", async () => false);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await restoreIssue(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "ISSUE_NOT_FOUND");
  });

  test("restoreIssue: Thất bại khi issue chưa bị xóa mềm (đang hoạt động)", async () => {
    mock.method(issueServiceRef, "issueExists", async () => true);
    mock.method(issueServiceRef, "issueIsDeleted", async () => false);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await restoreIssue(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "ISSUE_NOT_DELETED");
    assert.strictEqual(res.body.message, "Không khôi phục issue chưa bị delete");
  });

  test("restoreIssue: Thành công khôi phục issue", async () => {
    const mockIssue = {
      issue_id: "1",
      volume_id: "1",
      issue_number: 3,
      publication_year: 2025,
      is_deleted: false
    };

    mock.method(issueServiceRef, "issueExists", async () => true);
    mock.method(issueServiceRef, "issueIsDeleted", async () => true);
    mock.method(issueServiceRef, "restoreIssue", async () => mockIssue);
    mock.method(logger, "error", () => {});

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await restoreIssue(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "ISSUE_RESTORED");
    assert.strictEqual(res.body.message, "Khôi phục Issue thành công");
    assert.deepStrictEqual(res.body.data, mockIssue);
  });
});
