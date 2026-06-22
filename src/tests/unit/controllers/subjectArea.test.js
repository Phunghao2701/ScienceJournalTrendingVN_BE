import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";

test.after(async () => {
  await pool.end();
});

import {
  createSubjectArea,
  getSubjectAreas,
  getSubjectAreaById,
  updateSubjectArea,
  deleteSubjectArea,
  restoreSubjectArea,
  getSubjectAreaStatistics,
  subjectAreaServiceRef
} from "../../../controllers/subjectArea.controller.js";
import logger from "../../../utils/logger.js";

describe("Subject Area Controller Unit Test Suite", () => {
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

  test("createSubjectArea: Thành công tạo mới một subject area", async () => {
    const mockSubjectArea = {
      subject_area_id: "10",
      display_name: "Computer Science",
      description: "CS description",
      is_deleted: false
    };

    const mockCreate = mock.method(subjectAreaServiceRef, "createSubjectArea", async () => mockSubjectArea);
    mock.method(logger, "error", () => {});

    const req = {
      body: {
        display_name: "Computer Science",
        description: "CS description"
      }
    };
    const res = createMockResponse();

    await createSubjectArea(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "CREATE_SUBJECT_AREA_SUCCESS");
    assert.strictEqual(res.body.message, "Tạo Subject Area thành công");
    assert.deepStrictEqual(res.body.data, mockSubjectArea);
    assert.deepStrictEqual(mockCreate.mock.calls[0].arguments, [
      { display_name: "Computer Science", description: "CS description" }
    ]);
  });

  test("getSubjectAreas: Thành công lấy danh sách subject areas với phân trang", async () => {
    const mockList = {
      items: [
        {
          subject_area_id: "1",
          display_name: "Medicine",
          description: null,
          is_deleted: false
        }
      ],
      total: 1
    };

    const mockGet = mock.method(subjectAreaServiceRef, "getSubjectAreas", async () => mockList);
    mock.method(logger, "error", () => {});

    const req = {
      query: {
        page: "1",
        limit: "10",
        search: "Medicine"
      }
    };
    const res = createMockResponse();

    await getSubjectAreas(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "GET_SUBJECT_AREAS_SUCCESS");
    assert.strictEqual(res.body.message, "Lấy danh sách subject area thành công");
    assert.deepStrictEqual(res.body.data.items, mockList.items);
    assert.strictEqual(res.body.data.pagination.page, 1);
    assert.strictEqual(res.body.data.pagination.limit, 10);
    assert.strictEqual(res.body.data.pagination.total, 1);
  });

  test("getSubjectAreaById: Thành công lấy chi tiết subject area", async () => {
    const mockSubjectArea = {
      subject_area_id: "1",
      display_name: "Medicine",
      description: null,
      is_deleted: false
    };

    const mockGetById = mock.method(subjectAreaServiceRef, "getSubjectAreaById", async () => mockSubjectArea);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await getSubjectAreaById(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "GET_SUBJECT_AREA_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockSubjectArea);
  });

  test("getSubjectAreaById: Thất bại khi không tìm thấy", async () => {
    mock.method(subjectAreaServiceRef, "getSubjectAreaById", async () => null);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "999" }
    };
    const res = createMockResponse();

    await getSubjectAreaById(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "SUBJECT_AREA_NOT_FOUND");
    assert.strictEqual(res.body.data, null);
  });

  test("updateSubjectArea: Thành công cập nhật subject area", async () => {
    const mockUpdated = {
      subject_area_id: "1",
      display_name: "Medicine Edited",
      description: "Updated description",
      is_deleted: false
    };

    const mockUpdate = mock.method(subjectAreaServiceRef, "updateSubjectArea", async () => mockUpdated);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" },
      body: {
        display_name: "Medicine Edited",
        description: "Updated description"
      }
    };
    const res = createMockResponse();

    await updateSubjectArea(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "UPDATE_SUBJECT_AREA_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockUpdated);
  });

  test("deleteSubjectArea: Thành công xóa mềm", async () => {
    const mockDeleted = {
      subject_area_id: "1",
      display_name: "Medicine",
      description: null,
      is_deleted: true
    };

    mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => true);
    mock.method(subjectAreaServiceRef, "subjectAreaIsDeleted", async () => false);
    mock.method(subjectAreaServiceRef, "deleteSubjectArea", async () => mockDeleted);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await deleteSubjectArea(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "DELETE_SUBJECT_AREA_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockDeleted);
  });

  test("deleteSubjectArea: Thất bại khi đã xóa mềm trước đó", async () => {
    mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => true);
    mock.method(subjectAreaServiceRef, "subjectAreaIsDeleted", async () => true);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await deleteSubjectArea(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "SUBJECT_AREA_ALREADY_DELETED");
    assert.strictEqual(res.body.data, null);
  });

  test("restoreSubjectArea: Thành công khôi phục", async () => {
    const mockRestored = {
      subject_area_id: "1",
      display_name: "Medicine",
      description: null,
      is_deleted: false
    };

    mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => true);
    mock.method(subjectAreaServiceRef, "subjectAreaIsDeleted", async () => true);
    mock.method(subjectAreaServiceRef, "restoreSubjectArea", async () => mockRestored);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await restoreSubjectArea(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "RESTORE_SUBJECT_AREA_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockRestored);
  });

  test("restoreSubjectArea: Thất bại khi chưa bị xóa", async () => {
    mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => true);
    mock.method(subjectAreaServiceRef, "subjectAreaIsDeleted", async () => false);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await restoreSubjectArea(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "SUBJECT_AREA_NOT_DELETED");
    assert.strictEqual(res.body.data, null);
  });

  test("getSubjectAreaStatistics: Thành công lấy thống kê", async () => {
    const mockStats = {
      subject_area_id: "1",
      display_name: "Medicine",
      total_journals: 5,
      total_articles: 20,
      total_authors: 10
    };

    mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => true);
    mock.method(subjectAreaServiceRef, "subjectAreaIsDeleted", async () => false);
    mock.method(subjectAreaServiceRef, "getSubjectAreaStatistics", async () => mockStats);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await getSubjectAreaStatistics(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "GET_SUBJECT_AREA_STATISTICS_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockStats);
  });
});
