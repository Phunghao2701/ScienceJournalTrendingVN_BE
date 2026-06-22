import test from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../../app.js";
import pool from "../../../config/database.js";

const JWT_SECRET = process.env.JWT_SECRET || "scientific_journal_secret_key";
const userId = "a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7";
const testToken = jwt.sign({ user_id: userId, role: "STUDENT" }, JWT_SECRET);

test.after(async () => {
  await pool.end();
});

test.describe("Subject Category API - Integration / Endpoint Test Suite", () => {
  test.afterEach(() => {
    mock.reset();
  });

  // ==========================================
  // 1. POST /api/v1/subject-categories - Tạo mới
  // ==========================================
  test.describe("POST /api/v1/subject-categories", () => {
    test("Thất bại: Lỗi 401 - Chưa xác thực (Không truyền Token)", async () => {
      const res = await request(app)
        .post("/api/v1/subject-categories")
        .send({ subject_area_id: "1", display_name: "Artificial Intelligence" });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test("Thất bại: Lỗi 400 - Thiếu subject_area_id", async () => {
      const res = await request(app)
        .post("/api/v1/subject-categories")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ display_name: "AI" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_SUBJECT_AREA_ID");
    });

    test("Thất bại: Lỗi 400 - Thiếu display_name", async () => {
      const res = await request(app)
        .post("/api/v1/subject-categories")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ subject_area_id: "1" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_DISPLAY_NAME");
    });

    test("Thất bại: Lỗi 400 - subject_area_id không tồn tại", async () => {
      mock.method(pool, "query", async (sql) => {
        if (sql.includes("\"Subject_Area\"") && sql.includes("subject_area_id")) {
          return { rows: [] }; // Không tồn tại
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/subject-categories")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ subject_area_id: "999", display_name: "AI" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_SUBJECT_AREA_ID");
    });

    test("Thất bại: Lỗi 400 - display_name trùng lặp trong cùng Subject Area", async () => {
      mock.method(pool, "query", async (sql) => {
        if (sql.includes("\"Subject_Area\"") && sql.includes("subject_area_id")) {
          if (sql.includes("is_deleted = true")) {
            return { rows: [] }; // Chưa bị xóa
          }
          return { rows: [{ 1: 1 }] }; // Tồn tại
        }
        if (sql.includes("\"Subject_Category\"") && sql.includes("display_name = $2")) {
          return { rows: [{ 1: 1 }] }; // Trùng lặp
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/subject-categories")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ subject_area_id: "1", display_name: "Duplicate Name" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "DUPLICATE_DISPLAY_NAME");
    });

    test("Thành công: Tạo mới Subject Category", async () => {
      const mockResult = {
        subject_category_id: "100",
        subject_area_id: "1",
        display_name: "Artificial Intelligence",
        description: "AI Description",
        is_deleted: false
      };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("\"Subject_Area\"") && sql.includes("subject_area_id")) {
          if (sql.includes("is_deleted = true")) {
            return { rows: [] };
          }
          return { rows: [{ 1: 1 }] }; // Tồn tại
        }
        if (sql.includes("\"Subject_Category\"") && sql.includes("display_name = $2")) {
          return { rows: [] }; // Không trùng
        }
        if (sql.includes("INSERT INTO \"Subject_Category\"")) {
          return { rows: [mockResult] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/subject-categories")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ subject_area_id: "1", display_name: "Artificial Intelligence", description: "AI Description" });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "CREATE_SUBJECT_CATEGORY_SUCCESS");
      assert.deepStrictEqual(res.body.data, mockResult);
    });
  });

  // ==========================================
  // 2. GET /api/v1/subject-categories - Lấy danh sách
  // ==========================================
  test.describe("GET /api/v1/subject-categories", () => {
    test("Thất bại: Lỗi 400 - page hoặc limit không hợp lệ", async () => {
      const res = await request(app)
        .get("/api/v1/subject-categories?page=-1");

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_PAGE");
    });

    test("Thành công: Lấy danh sách phân trang, tìm kiếm và lọc", async () => {
      const mockItems = [
        { subject_category_id: "1", subject_area_id: "1", display_name: "AI", description: null, is_deleted: false }
      ];

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: 1 }] };
        }
        return { rows: mockItems };
      });

      const res = await request(app)
        .get("/api/v1/subject-categories?page=1&limit=10&search=ai&subject_area_id=1");

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_SUBJECT_CATEGORIES_SUCCESS");
      assert.deepStrictEqual(res.body.data.items, mockItems);
      assert.strictEqual(res.body.data.pagination.total, 1);
    });
  });

  // ==========================================
  // 3. GET /api/v1/subject-categories/:id - Chi tiết
  // ==========================================
  test.describe("GET /api/v1/subject-categories/:id", () => {
    test("Thất bại: Lỗi 400 - ID không hợp lệ", async () => {
      const res = await request(app)
        .get("/api/v1/subject-categories/abc");

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.code, "INVALID_ID");
    });

    test("Thành công: Lấy chi tiết với JOIN", async () => {
      const mockItem = {
        subject_category_id: "1",
        subject_area_id: "1",
        display_name: "AI",
        description: null,
        is_deleted: false,
        subject_area_name: "Computer Science"
      };

      mock.method(pool, "query", async () => {
        return { rows: [mockItem] };
      });

      const res = await request(app)
        .get("/api/v1/subject-categories/1");

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_SUBJECT_CATEGORY_SUCCESS");
      assert.deepStrictEqual(res.body.data, mockItem);
    });
  });

  // ==========================================
  // 4. PUT /api/v1/subject-categories/:id - Cập nhật
  // ==========================================
  test.describe("PUT /api/v1/subject-categories/:id", () => {
    test("Thất bại: Lỗi 401 - Chưa xác thực", async () => {
      const res = await request(app)
        .put("/api/v1/subject-categories/1")
        .send({ display_name: "Updated Name" });

      assert.strictEqual(res.status, 401);
    });

    test("Thành công: Cập nhật thành công", async () => {
      const mockUpdated = {
        subject_category_id: "1",
        subject_area_id: "1",
        display_name: "AI Edited",
        description: "Updated desc",
        is_deleted: false
      };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("SELECT 1 FROM \"Subject_Category\" WHERE subject_category_id = $1")) {
          if (sql.includes("is_deleted = true")) {
            return { rows: [] }; // Chưa xóa mềm
          }
          return { rows: [{ 1: 1 }] }; // Tồn tại
        }
        if (sql.includes("SELECT subject_area_id, display_name FROM \"Subject_Category\" WHERE subject_category_id = $1")) {
          return { rows: [{ subject_area_id: 1, display_name: "AI" }] };
        }
        if (sql.includes("\"Subject_Category\"") && sql.includes("display_name = $2")) {
          return { rows: [] }; // Không trùng tên
        }
        if (sql.includes("UPDATE")) {
          return { rows: [mockUpdated] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .put("/api/v1/subject-categories/1")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ display_name: "AI Edited", description: "Updated desc" });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "UPDATE_SUBJECT_CATEGORY_SUCCESS");
      assert.deepStrictEqual(res.body.data, mockUpdated);
    });
  });

  // ==========================================
  // 5. DELETE /api/v1/subject-categories/:id - Xóa mềm
  // ==========================================
  test.describe("DELETE /api/v1/subject-categories/:id", () => {
    test("Thành công: Xóa mềm thành công", async () => {
      const mockDeleted = {
        subject_category_id: "1",
        subject_area_id: "1",
        display_name: "AI",
        description: null,
        is_deleted: true
      };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("SELECT 1 FROM \"Subject_Category\" WHERE subject_category_id = $1")) {
          if (sql.includes("is_deleted = true")) {
            return { rows: [] }; // Chưa bị xóa mềm
          }
          return { rows: [{ 1: 1 }] }; // Tồn tại
        }
        if (sql.includes("UPDATE")) {
          return { rows: [mockDeleted] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .delete("/api/v1/subject-categories/1")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "DELETE_SUBJECT_CATEGORY_SUCCESS");
      assert.strictEqual(res.body.data.is_deleted, true);
    });
  });

  // ==========================================
  // 6. PATCH /api/v1/subject-categories/:id/restore - Khôi phục
  // ==========================================
  test.describe("PATCH /api/v1/subject-categories/:id/restore", () => {
    test("Thành công: Khôi phục thành công", async () => {
      const mockRestored = {
        subject_category_id: "1",
        subject_area_id: "1",
        display_name: "AI",
        description: null,
        is_deleted: false
      };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("SELECT 1 FROM \"Subject_Category\" WHERE subject_category_id = $1")) {
          if (sql.includes("is_deleted = true")) {
            return { rows: [{ 1: 1 }] }; // Đã bị xóa mềm
          }
          return { rows: [{ 1: 1 }] }; // Tồn tại
        }
        if (sql.includes("UPDATE")) {
          return { rows: [mockRestored] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .patch("/api/v1/subject-categories/1/restore")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "RESTORE_SUBJECT_CATEGORY_SUCCESS");
      assert.strictEqual(res.body.data.is_deleted, false);
    });
  });

  // ==========================================
  // 7. GET /api/v1/subject-categories/:id/statistics - Thống kê
  // ==========================================
  test.describe("GET /api/v1/subject-categories/:id/statistics", () => {
    test("Thành công: Lấy thống kê", async (t) => {
      mock.method(pool, "query", async (sql) => {
        if (sql.includes("SELECT 1 FROM \"Subject_Category\" WHERE subject_category_id = $1")) {
          if (sql.includes("is_deleted = true")) {
            return { rows: [] }; // Chưa bị xóa mềm
          }
          return { rows: [{ 1: 1 }] }; // Tồn tại
        }
        if (sql.includes("SELECT display_name FROM \"Subject_Category\"")) {
          return { rows: [{ display_name: "Artificial Intelligence" }] };
        }
        if (sql.includes("COUNT(DISTINCT j.journal_id)")) {
          return { rows: [{ count: 12 }] };
        }
        if (sql.includes("COUNT(DISTINCT a.article_id)")) {
          return { rows: [{ count: 85 }] };
        }
        if (sql.includes("COUNT(DISTINCT aa.author_id)")) {
          return { rows: [{ count: 42 }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .get("/api/v1/subject-categories/1/statistics");

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_SUBJECT_CATEGORY_STATISTICS_SUCCESS");
      assert.strictEqual(res.body.data.total_journals, 12);
      assert.strictEqual(res.body.data.total_articles, 85);
      assert.strictEqual(res.body.data.total_authors, 42);
    });
  });
});
