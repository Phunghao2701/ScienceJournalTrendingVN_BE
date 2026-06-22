import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";

test.after(async () => {
  await pool.end();
});

import {
  createSubjectCategory,
  getSubjectCategories,
  getSubjectCategoryById,
  updateSubjectCategory,
  deleteSubjectCategory,
  restoreSubjectCategory,
  getSubjectCategoryStatistics,
  subjectCategoryServiceRef
} from "../../../controllers/subjectCategory.controller.js";
import logger from "../../../utils/logger.js";

describe("Subject Category Controller Unit Test Suite", () => {
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

  test("createSubjectCategory: Thành công tạo mới một subject category", async () => {
    const mockSubjectCategory = {
      subject_category_id: "10",
      subject_area_id: "1",
      display_name: "Artificial Intelligence",
      description: "AI description",
      is_deleted: false
    };

    const mockCreate = mock.method(subjectCategoryServiceRef, "createSubjectCategory", async () => mockSubjectCategory);
    mock.method(logger, "error", () => {});

    const req = {
      body: {
        subject_area_id: "1",
        display_name: "Artificial Intelligence",
        description: "AI description"
      }
    };
    const res = createMockResponse();

    await createSubjectCategory(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "CREATE_SUBJECT_CATEGORY_SUCCESS");
    assert.strictEqual(res.body.message, "Tạo Subject Category thành công");
    assert.deepStrictEqual(res.body.data, mockSubjectCategory);
    assert.deepStrictEqual(mockCreate.mock.calls[0].arguments, [
      { subject_area_id: "1", display_name: "Artificial Intelligence", description: "AI description" }
    ]);
  });

  test("getSubjectCategories: Thành công lấy danh sách subject categories với phân trang và lọc", async () => {
    const mockList = {
      items: [
        {
          subject_category_id: "1",
          subject_area_id: "1",
          display_name: "Machine Learning",
          description: null,
          is_deleted: false
        }
      ],
      total: 1
    };

    const mockGet = mock.method(subjectCategoryServiceRef, "getSubjectCategories", async () => mockList);
    mock.method(logger, "error", () => {});

    const req = {
      query: {
        page: "1",
        limit: "10",
        search: "Machine",
        subject_area_id: "1"
      }
    };
    const res = createMockResponse();

    await getSubjectCategories(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "GET_SUBJECT_CATEGORIES_SUCCESS");
    assert.strictEqual(res.body.message, "Lấy danh sách subject category thành công");
    assert.deepStrictEqual(res.body.data.items, mockList.items);
    assert.strictEqual(res.body.data.pagination.page, 1);
    assert.strictEqual(res.body.data.pagination.limit, 10);
    assert.strictEqual(res.body.data.pagination.total, 1);
    assert.deepStrictEqual(mockGet.mock.calls[0].arguments, [
      {
        page: "1",
        limit: "10",
        search: "Machine",
        subject_area_id: "1",
        sort_by: undefined,
        sort_order: undefined
      }
    ]);
  });

  test("getSubjectCategoryById: Thành công lấy chi tiết subject category", async () => {
    const mockSubjectCategory = {
      subject_category_id: "1",
      subject_area_id: "1",
      display_name: "Machine Learning",
      description: null,
      is_deleted: false,
      subject_area_name: "Computer Science"
    };

    const mockGetById = mock.method(subjectCategoryServiceRef, "getSubjectCategoryById", async () => mockSubjectCategory);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await getSubjectCategoryById(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "GET_SUBJECT_CATEGORY_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockSubjectCategory);
  });

  test("getSubjectCategoryById: Thất bại khi không tìm thấy", async () => {
    mock.method(subjectCategoryServiceRef, "getSubjectCategoryById", async () => null);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "999" }
    };
    const res = createMockResponse();

    await getSubjectCategoryById(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "SUBJECT_CATEGORY_NOT_FOUND");
    assert.strictEqual(res.body.data, null);
  });

  test("updateSubjectCategory: Thành công cập nhật subject category", async () => {
    const mockUpdated = {
      subject_category_id: "1",
      subject_area_id: "1",
      display_name: "Deep Learning",
      description: "Updated description",
      is_deleted: false
    };

    const mockUpdate = mock.method(subjectCategoryServiceRef, "updateSubjectCategory", async () => mockUpdated);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" },
      body: {
        display_name: "Deep Learning",
        description: "Updated description"
      }
    };
    const res = createMockResponse();

    await updateSubjectCategory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "UPDATE_SUBJECT_CATEGORY_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockUpdated);
  });

  test("deleteSubjectCategory: Thành công xóa mềm", async () => {
    const mockDeleted = {
      subject_category_id: "1",
      subject_area_id: "1",
      display_name: "Machine Learning",
      description: null,
      is_deleted: true
    };

    mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => true);
    mock.method(subjectCategoryServiceRef, "subjectCategoryIsDeleted", async () => false);
    mock.method(subjectCategoryServiceRef, "deleteSubjectCategory", async () => mockDeleted);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await deleteSubjectCategory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "DELETE_SUBJECT_CATEGORY_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockDeleted);
  });

  test("deleteSubjectCategory: Thất bại khi đã xóa mềm trước đó", async () => {
    mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => true);
    mock.method(subjectCategoryServiceRef, "subjectCategoryIsDeleted", async () => true);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await deleteSubjectCategory(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "SUBJECT_CATEGORY_ALREADY_DELETED");
    assert.strictEqual(res.body.data, null);
  });

  test("restoreSubjectCategory: Thành công khôi phục", async () => {
    const mockRestored = {
      subject_category_id: "1",
      subject_area_id: "1",
      display_name: "Machine Learning",
      description: null,
      is_deleted: false
    };

    mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => true);
    mock.method(subjectCategoryServiceRef, "subjectCategoryIsDeleted", async () => true);
    mock.method(subjectCategoryServiceRef, "restoreSubjectCategory", async () => mockRestored);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await restoreSubjectCategory(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "RESTORE_SUBJECT_CATEGORY_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockRestored);
  });

  test("restoreSubjectCategory: Thất bại khi chưa bị xóa", async () => {
    mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => true);
    mock.method(subjectCategoryServiceRef, "subjectCategoryIsDeleted", async () => false);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await restoreSubjectCategory(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, "SUBJECT_CATEGORY_NOT_DELETED");
    assert.strictEqual(res.body.data, null);
  });

  test("getSubjectCategoryStatistics: Thành công lấy thống kê", async () => {
    const mockStats = {
      subject_category_id: "1",
      display_name: "Machine Learning",
      total_journals: 5,
      total_articles: 20,
      total_authors: 10
    };

    mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => true);
    mock.method(subjectCategoryServiceRef, "subjectCategoryIsDeleted", async () => false);
    mock.method(subjectCategoryServiceRef, "getSubjectCategoryStatistics", async () => mockStats);
    mock.method(logger, "error", () => {});

    const req = {
      params: { id: "1" }
    };
    const res = createMockResponse();

    await getSubjectCategoryStatistics(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, "GET_SUBJECT_CATEGORY_STATISTICS_SUCCESS");
    assert.deepStrictEqual(res.body.data, mockStats);
  });
});
