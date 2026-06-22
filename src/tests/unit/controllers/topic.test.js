import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";

test.after(async () => {
  await pool.end();
});

import {
  getTopics,
  getTopicById,
  createTopic,
  getArticlesByTopic,
  updateTopic,
  deleteTopic,
  restoreTopic,
  topicServiceRef,
  subjectAreaServiceRef,
  subjectCategoryServiceRef
} from "../../../controllers/topic.controller.js";
import logger from "../../../utils/logger.js";

describe("Topic Controller Unit Tests (GET, POST, Update, Delete, Restore)", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const createMockResponse = () => {
    const res = {};
    res.status = mock.fn((statusCode) => {
      res.statusCode = statusCode;
      return res;
    });
    res.json = mock.fn((jsonData) => {
      res.body = jsonData;
      return res;
    });
    return res;
  };

  // ==========================================
  // 1. getTopics
  // ==========================================
  describe("getTopics", () => {
    test("Thất bại khi sort_by không hợp lệ", async () => {
      const req = { query: { sort_by: "invalid_field" } };
      const res = createMockResponse();

      await getTopics(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.code, "INVALID_FILTER");
    });

    test("Thất bại khi subject_area_id không tồn tại", async () => {
      mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => false);
      const req = { query: { subject_area_id: 999 } };
      const res = createMockResponse();

      await getTopics(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.code, "INVALID_FILTER");
    });

    test("Thất bại khi subject_category_id không tồn tại", async () => {
      mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => false);
      const req = { query: { subject_category_id: 999 } };
      const res = createMockResponse();

      await getTopics(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.code, "INVALID_FILTER");
    });

    test("Thành công lấy danh sách topic khi không có filter", async () => {
      const mockResult = { items: [{ topic_id: "1" }], total: 1 };
      mock.method(topicServiceRef, "getTopics", async () => mockResult);
      
      const req = { query: { page: 1, limit: 10 } };
      const res = createMockResponse();

      await getTopics(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_TOPICS_SUCCESS");
    });

    test("Lỗi 500 khi server gặp sự cố", async () => {
      mock.method(topicServiceRef, "getTopics", async () => { throw new Error("DB Error"); });
      const req = { query: {} };
      const res = createMockResponse();

      await getTopics(req, res);

      assert.strictEqual(res.statusCode, 500);
    });
  });

  // ==========================================
  // 2. getTopicById
  // ==========================================
  describe("getTopicById", () => {
    test("Thành công lấy chi tiết topic", async () => {
      const mockTopic = { topic_id: "1" };
      mock.method(topicServiceRef, "getTopicById", async () => mockTopic);
      
      const req = { params: { id: "1" } };
      const res = createMockResponse();

      await getTopicById(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_TOPIC_SUCCESS");
      assert.deepStrictEqual(res.body.data, mockTopic);
    });

    test("Thất bại khi không tìm thấy topic", async () => {
      mock.method(topicServiceRef, "getTopicById", async () => null);
      
      const req = { params: { id: "99" } };
      const res = createMockResponse();

      await getTopicById(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "TOPIC_NOT_FOUND");
    });
  });

  // ==========================================
  // 3. createTopic
  // ==========================================
  describe("createTopic", () => {
    test("Thất bại khi display_name trống", async () => {
      const req = { body: { display_name: "" } };
      const res = createMockResponse();

      await createTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
    });

    test("Thất bại khi tên bị trùng lặp", async () => {
      mock.method(topicServiceRef, "checkDuplicateTopic", async () => ({ duplicateName: true }));
      const req = { body: { display_name: "Test" } };
      const res = createMockResponse();

      await createTopic(req, res);

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.code, "TOPIC_NAME_DUPLICATED");
    });

    test("Thành công tạo mới topic", async () => {
      const mockTopic = { topic_id: "1", display_name: "Test" };
      mock.method(topicServiceRef, "checkDuplicateTopic", async () => ({ duplicateName: false }));
      mock.method(topicServiceRef, "createTopic", async () => mockTopic);
      
      const req = { body: { display_name: "Test" } };
      const res = createMockResponse();

      await createTopic(req, res);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "TOPIC_CREATED");
      assert.deepStrictEqual(res.body.data, mockTopic);
    });
  });

  // ==========================================
  // 4. getArticlesByTopic
  // ==========================================
  describe("getArticlesByTopic", () => {
    test("Thất bại khi topic không tồn tại", async () => {
      mock.method(topicServiceRef, "getTopicById", async () => null);
      
      const req = { params: { id: "99" }, query: {} };
      const res = createMockResponse();

      await getArticlesByTopic(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    test("Thất bại khi page không hợp lệ", async () => {
      mock.method(topicServiceRef, "getTopicById", async () => ({ topic_id: 1 }));
      const req = { params: { id: "1" }, query: { page: "abc" } };
      const res = createMockResponse();

      await getArticlesByTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
    });

    test("Thất bại khi limit không hợp lệ", async () => {
      mock.method(topicServiceRef, "getTopicById", async () => ({ topic_id: 1 }));
      const req = { params: { id: "1" }, query: { page: 1, limit: -5 } };
      const res = createMockResponse();

      await getArticlesByTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
    });

    test("Thành công lấy danh sách bài báo của topic", async () => {
      mock.method(topicServiceRef, "getTopicById", async () => ({ topic_id: 1, display_name: "Topic 1" }));
      mock.method(topicServiceRef, "getArticlesByTopicId", async () => [{ article_id: 1, title: "A", publication_year: 2024, doi: "doi/123" }]);
      mock.method(topicServiceRef, "countArticlesByTopicId", async () => 1);

      const req = { params: { id: "1" }, query: {} };
      const res = createMockResponse();

      await getArticlesByTopic(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.deepStrictEqual(res.body.data.articles, [{ article_id: 1, title: "A", publication_year: 2024, doi: "doi/123" }]);
      assert.strictEqual(res.body.data.pagination.total, 1);
    });

    test("Lỗi 500 khi server gặp sự cố", async () => {
      mock.method(topicServiceRef, "getTopicById", async () => { throw new Error("DB Error"); });
      const req = { params: { id: "1" }, query: {} };
      const res = createMockResponse();

      await getArticlesByTopic(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ==========================================
  // updateTopic
  // ==========================================
  describe("updateTopic", () => {
    test("Thất bại khi display_name không hợp lệ", async () => {
      const req = { params: { id: "1" }, body: { display_name: "" } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
    });

    test("Thất bại khi score nhỏ hơn 0", async () => {
      const req = { params: { id: "1" }, body: { score: -0.1 } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
    });

    test("Thất bại khi score lớn hơn 1", async () => {
      const req = { params: { id: "1" }, body: { score: 1.1 } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
    });

    test("Thất bại khi subject_area_id không hợp lệ", async () => {
      const req = { params: { id: "1" }, body: { subject_area_id: "abc" } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
    });

    test("Thất bại khi subject_category_id không hợp lệ", async () => {
      const req = { params: { id: "1" }, body: { subject_category_id: -5 } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
    });

    test("Thất bại khi subject_area_id không tồn tại trong DB", async () => {
      mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => false);
      const req = { params: { id: "1" }, body: { subject_area_id: 999 } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
      assert.strictEqual(res.body.message, "subject_area_id không tồn tại trong hệ thống");
    });

    test("Thất bại khi subject_category_id không tồn tại trong DB", async () => {
      mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => false);
      const req = { params: { id: "1" }, body: { subject_category_id: 999 } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOPIC_DATA");
      assert.strictEqual(res.body.message, "subject_category_id không tồn tại trong hệ thống");
    });

    test("Thất bại khi topic không tồn tại", async () => {
      mock.method(topicServiceRef, "topicExists", async () => false);
      const req = { params: { id: "99" }, body: { display_name: "Test" } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "TOPIC_NOT_FOUND");
    });

    test("Thất bại khi topic đã bị xóa mềm", async () => {
      mock.method(topicServiceRef, "topicExists", async () => true);
      mock.method(topicServiceRef, "topicIsDeleted", async () => true);
      const req = { params: { id: "1" }, body: { display_name: "Test" } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "TOPIC_DELETED");
    });

    test("Thất bại khi cập nhật không có data thay đổi hợp lệ", async () => {
      mock.method(topicServiceRef, "topicExists", async () => true);
      mock.method(topicServiceRef, "topicIsDeleted", async () => false);
      mock.method(topicServiceRef, "updateTopic", async () => null);
      
      const req = { params: { id: "1" }, body: { display_name: "Test" } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "NO_DATA_UPDATED");
    });

    test("Thành công cập nhật thông tin topic", async () => {
      const mockTopic = { topic_id: "1", display_name: "New", score: 0.8, subject_area_id: 1, subject_category_id: 2 };
      mock.method(subjectAreaServiceRef, "subjectAreaExist", async () => true);
      mock.method(subjectCategoryServiceRef, "subjectCategoryExist", async () => true);
      mock.method(topicServiceRef, "topicExists", async () => true);
      mock.method(topicServiceRef, "topicIsDeleted", async () => false);
      const mockUpdate = mock.method(topicServiceRef, "updateTopic", async () => mockTopic);
      
      const req = { params: { id: "1" }, body: { display_name: "New", score: 0.8, subject_area_id: 1, subject_category_id: 2 } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "TOPIC_UPDATED");
      assert.deepStrictEqual(res.body.data, mockTopic);
      assert.deepStrictEqual(mockUpdate.mock.calls[0].arguments, ["1", { display_name: "New", score: 0.8, subject_area_id: 1, subject_category_id: 2 }]);
    });

    test("Lỗi 500 khi server gặp sự cố", async () => {
      mock.method(topicServiceRef, "topicExists", async () => { throw new Error("DB error"); });
      mock.method(logger, "error", () => {});
      
      const req = { params: { id: "1" }, body: { display_name: "Test" } };
      const res = createMockResponse();

      await updateTopic(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "SERVER_ERROR");
    });
  });

  // ==========================================
  // deleteTopic
  // ==========================================
  describe("deleteTopic", () => {
    test("Thất bại khi topic không tồn tại", async () => {
      mock.method(topicServiceRef, "topicExists", async () => false);
      const req = { params: { id: "99" } };
      const res = createMockResponse();

      await deleteTopic(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "TOPIC_NOT_FOUND");
    });

    test("Thất bại khi topic đã bị xóa mềm trước đó", async () => {
      mock.method(topicServiceRef, "topicExists", async () => true);
      mock.method(topicServiceRef, "topicIsDeleted", async () => true);
      const req = { params: { id: "1" } };
      const res = createMockResponse();

      await deleteTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "TOPIC_ALREADY_DELETED");
    });

    test("Thành công xóa mềm topic", async () => {
      const mockTopic = { topic_id: "1", is_deleted: true };
      mock.method(topicServiceRef, "topicExists", async () => true);
      mock.method(topicServiceRef, "topicIsDeleted", async () => false);
      mock.method(topicServiceRef, "deleteTopic", async () => mockTopic);
      
      const req = { params: { id: "1" } };
      const res = createMockResponse();

      await deleteTopic(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "TOPIC_DELETED");
      assert.deepStrictEqual(res.body.data, mockTopic);
    });
  });

  // ==========================================
  // restoreTopic
  // ==========================================
  describe("restoreTopic", () => {
    test("Thất bại khi topic không tồn tại", async () => {
      mock.method(topicServiceRef, "topicExists", async () => false);
      const req = { params: { id: "99" } };
      const res = createMockResponse();

      await restoreTopic(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "TOPIC_NOT_FOUND");
    });

    test("Thất bại khi topic chưa bị xóa mềm", async () => {
      mock.method(topicServiceRef, "topicExists", async () => true);
      mock.method(topicServiceRef, "topicIsDeleted", async () => false);
      const req = { params: { id: "1" } };
      const res = createMockResponse();

      await restoreTopic(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "TOPIC_NOT_DELETED");
    });

    test("Thành công khôi phục topic", async () => {
      const mockTopic = { topic_id: "1", is_deleted: false };
      mock.method(topicServiceRef, "topicExists", async () => true);
      mock.method(topicServiceRef, "topicIsDeleted", async () => true);
      mock.method(topicServiceRef, "restoreTopic", async () => mockTopic);
      
      const req = { params: { id: "1" } };
      const res = createMockResponse();

      await restoreTopic(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "TOPIC_RESTORED");
      assert.deepStrictEqual(res.body.data, mockTopic);
    });
  });
});
