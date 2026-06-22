import {
  describe,
  test,
  afterEach,
  before,
  beforeEach,
  after,
  mock,
} from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";
import * as keywordService from "../../../services/keyword.service.js";

after(async () => {
  await pool.end();
});

// ============================================================
// Helper: Tạo mock Response object cho unit test
// ============================================================
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

// ============================================================
// 1. Keyword Management - getKeywordById Controller Test
// ============================================================
describe("Keyword Controller - getKeywordById()", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("Thất bại: Trả về 400 khi keyword_id không hợp lệ", async () => {
    const { getKeywordByIdController } =
      await import("../../../controllers/keyword.controller.js");
    const req = { params: { id: "abc" } };
    const res = createMockResponse();

    await getKeywordByIdController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, "ID không hợp lệ");
  });

  test("Thành công: Trả về keyword khi ID hợp lệ", async () => {
    mock.restoreAll();
    const { getKeywordByIdController } =
      await import("../../../controllers/keyword.controller.js");
    const mockKeyword = { keyword_id: 1, display_name: "Machine Learning" };

    mock.method(keywordService, "getKeywordById", async () => mockKeyword);

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await getKeywordByIdController(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, mockKeyword);
  });

  test("Thất bại: Trả về 404 khi keyword không tồn tại", async () => {
    mock.restoreAll();
    const { getKeywordByIdController } =
      await import("../../../controllers/keyword.controller.js");

    const error = new Error("Keyword không tồn tại trong hệ thống");
    error.statusCode = 404;
    mock.method(keywordService, "getKeywordById", async () => {
      throw error;
    });

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await getKeywordByIdController(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Trả về 500 khi service throw lỗi", async () => {
    mock.restoreAll();
    const { getKeywordByIdController } =
      await import("../../../controllers/keyword.controller.js");
    mock.method(keywordService, "getKeywordById", async () => {
      throw new Error("Database error");
    });

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await getKeywordByIdController(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
  });
});

// ============================================================
// 2. Keyword Management - getAllKeywords Controller Test
// ============================================================
describe("Keyword Controller - getAllKeywords()", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("Thành công: Trả về danh sách keywords với pagination mặc định", async () => {
    mock.restoreAll();
    const { getAllKeywordsController } =
      await import("../../../controllers/keyword.controller.js");
    const mockResult = {
      data: [
        { keyword_id: 1, display_name: "AI" },
        { keyword_id: 2, display_name: "Machine Learning" },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        total_pages: 1,
      },
    };

    mock.method(keywordService, "getAllKeywords", async () => mockResult);

    const req = { query: {} };
    const res = createMockResponse();

    await getAllKeywordsController(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 2);
    assert.strictEqual(res.body.pagination.page, 1);
  });

  test("Thành công: Tìm kiếm keywords theo search parameter", async () => {
    mock.restoreAll();
    const { getAllKeywordsController } =
      await import("../../../controllers/keyword.controller.js");
    const mockResult = {
      data: [{ keyword_id: 1, display_name: "Machine Learning" }],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        total_pages: 1,
      },
    };

    mock.method(keywordService, "getAllKeywords", async () => mockResult);

    const req = { query: { search: "machine", page: "1", limit: "10" } };
    const res = createMockResponse();

    await getAllKeywordsController(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data[0].display_name, "Machine Learning");
  });

  test("Thành công: Trả về danh sách rỗng khi không có kết quả", async () => {
    mock.restoreAll();
    const { getAllKeywordsController } =
      await import("../../../controllers/keyword.controller.js");
    const mockResult = {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 0,
      },
    };

    mock.method(keywordService, "getAllKeywords", async () => mockResult);

    const req = { query: { search: "nonexistent" } };
    const res = createMockResponse();

    await getAllKeywordsController(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body.data, []);
  });
});

// ============================================================
// 3. Keyword Management - createKeyword Controller Test
// ============================================================
describe("Keyword Controller - createKeyword()", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("Thành công: Tạo keyword mới", async () => {
    mock.restoreAll();
    const { createKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const mockKeyword = { keyword_id: 10, display_name: "Deep Learning" };

    mock.method(keywordService, "createKeyword", async () => mockKeyword);

    const req = { body: { display_name: "Deep Learning" } };
    const res = createMockResponse();

    await createKeywordController(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, mockKeyword);
  });

  test("Thất bại: Ném lỗi khi display_name không được cung cấp", async () => {
    const { createKeywordController } =
      await import("../../../controllers/keyword.controller.js");

    const req = { body: { display_name: "" } };
    const res = createMockResponse();

    await createKeywordController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi khi display_name quá ngắn (< 2 ký tự)", async () => {
    const { createKeywordController } =
      await import("../../../controllers/keyword.controller.js");

    const req = { body: { display_name: "A" } };
    const res = createMockResponse();

    await createKeywordController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi 409 khi keyword đã tồn tại", async () => {
    mock.restoreAll();
    const { createKeywordController } =
      await import("../../../controllers/keyword.controller.js");

    const error = new Error("Keyword đã tồn tại");
    error.statusCode = 409;
    mock.method(keywordService, "createKeyword", async () => {
      throw error;
    });

    const req = { body: { display_name: "Machine Learning" } };
    const res = createMockResponse();

    await createKeywordController(req, res);

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.success, false);
  });
});

// ============================================================
// 4. Keyword Management - updateKeyword Controller Test
// ============================================================
describe("Keyword Controller - updateKeyword()", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("Thành công: Cập nhật keyword", async () => {
    mock.restoreAll();
    const { updateKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const mockUpdatedKeyword = { keyword_id: 1, display_name: "Updated KW" };

    mock.method(
      keywordService,
      "updateKeyword",
      async () => mockUpdatedKeyword,
    );

    const req = { params: { id: "1" }, body: { display_name: "Updated KW" } };
    const res = createMockResponse();

    await updateKeywordController(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, mockUpdatedKeyword);
  });

  test("Thất bại: Trả về 400 khi ID không hợp lệ", async () => {
    const { updateKeywordController } =
      await import("../../../controllers/keyword.controller.js");

    const req = { params: { id: "abc" }, body: { display_name: "Test" } };
    const res = createMockResponse();

    await updateKeywordController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi 404 khi keyword không tồn tại", async () => {
    mock.restoreAll();
    const { updateKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const error = new Error("Keyword không tồn tại trong hệ thống");
    error.statusCode = 404;

    mock.method(keywordService, "updateKeyword", async () => {
      throw error;
    });

    const req = { params: { id: "999" }, body: { display_name: "New Name" } };
    const res = createMockResponse();

    await updateKeywordController(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi 409 khi display_name đã tồn tại", async () => {
    mock.restoreAll();
    const { updateKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const error = new Error("Keyword đã tồn tại trong hệ thống");
    error.statusCode = 409;

    mock.method(keywordService, "updateKeyword", async () => {
      throw error;
    });

    const req = { params: { id: "1" }, body: { display_name: "Existing KW" } };
    const res = createMockResponse();

    await updateKeywordController(req, res);

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.success, false);
  });
});

// ============================================================
// 5. Keyword Management - deleteKeyword Controller Test
// ============================================================
describe("Keyword Controller - deleteKeyword()", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("Thành công: Soft delete keyword", async () => {
    mock.restoreAll();
    const { deleteKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    mock.method(keywordService, "deleteKeyword", async () => ({}));

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await deleteKeywordController(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, "Xóa keyword thành công");
  });

  test("Thất bại: Trả về 400 khi ID không hợp lệ", async () => {
    const { deleteKeywordController } =
      await import("../../../controllers/keyword.controller.js");

    const req = { params: { id: "invalid" } };
    const res = createMockResponse();

    await deleteKeywordController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi 404 khi keyword không tồn tại", async () => {
    mock.restoreAll();
    const { deleteKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const error = new Error("Keyword không tồn tại");
    error.statusCode = 404;

    mock.method(keywordService, "deleteKeyword", async () => {
      throw error;
    });

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await deleteKeywordController(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi 400 khi keyword đã bị xóa trước đó", async () => {
    mock.restoreAll();
    const { deleteKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const error = new Error("Keyword đã bị xóa trước đó");
    error.statusCode = 400;

    mock.method(keywordService, "deleteKeyword", async () => {
      throw error;
    });

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await deleteKeywordController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });
});

// ============================================================
// 6. Keyword Management - restoreKeyword Controller Test
// ============================================================
describe("Keyword Controller - restoreKeyword()", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("Thành công: Restore keyword đã bị soft delete", async () => {
    mock.restoreAll();
    const { restoreKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const mockRestoredKeyword = {
      keyword_id: 1,
      display_name: "Machine Learning",
      is_deleted: false,
    };

    mock.method(
      keywordService,
      "restoreKeyword",
      async () => mockRestoredKeyword,
    );

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await restoreKeywordController(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, "Khôi phục keyword thành công");
  });

  test("Thất bại: Trả về 400 khi ID không hợp lệ", async () => {
    const { restoreKeywordController } =
      await import("../../../controllers/keyword.controller.js");

    const req = { params: { id: "invalid" } };
    const res = createMockResponse();

    await restoreKeywordController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi 404 khi keyword không tồn tại", async () => {
    mock.restoreAll();
    const { restoreKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const error = new Error("Keyword không tồn tại");
    error.statusCode = 404;

    mock.method(keywordService, "restoreKeyword", async () => {
      throw error;
    });

    const req = { params: { id: "999" } };
    const res = createMockResponse();

    await restoreKeywordController(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
  });

  test("Thất bại: Ném lỗi 400 khi keyword đang active (không cần restore)", async () => {
    mock.restoreAll();
    const { restoreKeywordController } =
      await import("../../../controllers/keyword.controller.js");
    const error = new Error("Keyword này đang active, không cần restore");
    error.statusCode = 400;

    mock.method(keywordService, "restoreKeyword", async () => {
      throw error;
    });

    const req = { params: { id: "1" } };
    const res = createMockResponse();

    await restoreKeywordController(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });
});
