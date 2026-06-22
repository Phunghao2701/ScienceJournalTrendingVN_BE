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

test.describe("Subject Area API - Integration / Endpoint Test Suite", () => {
  test.afterEach(() => {
    mock.reset();
  });

  // ==========================================
  // 1. POST /api/v1/subject-areas - Tạo mới
  // ==========================================
  test.describe("POST /api/v1/subject-areas", () => {
    test("Thất bại: Lỗi 401 - Chưa xác thực (Không truyền Token)", async () => {
      const res = await request(app)
        .post("/api/v1/subject-areas")
        .send({ display_name: "New Name" });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    test("Thất bại: Lỗi 400 - Thiếu display_name", async () => {
      const res = await request(app)
        .post("/api/v1/subject-areas")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ description: "Missing name" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_DISPLAY_NAME");
      assert.strictEqual(res.body.data, null);
    });

    test("Thành công: Tạo mới Subject Area", async () => {
      const mockResult = {
        subject_area_id: "100",
        display_name: "New Name",
        description: "Desc",
        is_deleted: false
      };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("INSERT INTO \"Subject_Area\"")) {
          return { rows: [mockResult] };
        }
        return { rows: [] }; // Không trùng lặp
      });

      const res = await request(app)
        .post("/api/v1/subject-areas")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ display_name: "New Name", description: "Desc" });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "CREATE_SUBJECT_AREA_SUCCESS");
      assert.deepStrictEqual(res.body.data, mockResult);
    });
  });

  // ==========================================
  // 2. GET /api/v1/subject-areas - Lấy danh sách
  // ==========================================
  test.describe("GET /api/v1/subject-areas", () => {
    test("Thất bại: Lỗi 400 - page hoặc limit không hợp lệ", async () => {
      const res = await request(app)
        .get("/api/v1/subject-areas?page=-1");

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_PAGE");
      assert.strictEqual(res.body.data, null);
    });

    test("Thành công: Lấy danh sách phân trang và tìm kiếm", async () => {
      const mockItems = [
        { subject_area_id: "1", display_name: "Medicine", description: null, is_deleted: false }
      ];

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: 1 }] };
        }
        return { rows: mockItems };
      });

      const res = await request(app)
        .get("/api/v1/subject-areas?page=1&limit=10&search=med");

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_SUBJECT_AREAS_SUCCESS");
      assert.deepStrictEqual(res.body.data.items, mockItems);
      assert.strictEqual(res.body.data.pagination.total, 1);
    });
  });

  // ==========================================
  // 3. GET /api/v1/subject-areas/:id - Chi tiết
  // ==========================================
  test.describe("GET /api/v1/subject-areas/:id", () => {
    test("Thất bại: Lỗi 400 - ID không hợp lệ", async () => {
      const res = await request(app)
        .get("/api/v1/subject-areas/abc");

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.code, "INVALID_ID");
      assert.strictEqual(res.body.data, null);
    });

    test("Thành công: Lấy chi tiết", async () => {
      const mockItem = { subject_area_id: "1", display_name: "Medicine", description: null, is_deleted: false };

      mock.method(pool, "query", async () => {
        return { rows: [mockItem] };
      });

      const res = await request(app)
        .get("/api/v1/subject-areas/1");

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_SUBJECT_AREA_SUCCESS");
      assert.deepStrictEqual(res.body.data, mockItem);
    });
  });

  // ==========================================
  // 4. PUT /api/v1/subject-areas/:id - Cập nhật
  // ==========================================
  test.describe("PUT /api/v1/subject-areas/:id", () => {
    test("Thất bại: Lỗi 401 - Chưa xác thực", async () => {
      const res = await request(app)
        .put("/api/v1/subject-areas/1")
        .send({ display_name: "Updated Name" });

      assert.strictEqual(res.status, 401);
    });

    test("Thành công: Cập nhật thành công", async () => {
      const mockUpdated = { subject_area_id: "1", display_name: "Updated Name", description: null, is_deleted: false };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("is_deleted = true")) {
          // check is_deleted
          return { rows: [] };
        }
        if (sql.includes("SELECT 1 FROM \"Subject_Area\" WHERE subject_area_id = $1")) {
          // check exist
          return { rows: [{ 1: 1 }] };
        }
        if (sql.includes("SELECT display_name FROM")) {
          // get current
          return { rows: [{ display_name: "Medicine" }] };
        }
        if (sql.includes("UPDATE")) {
          return { rows: [mockUpdated] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .put("/api/v1/subject-areas/1")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ display_name: "Updated Name" });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "UPDATE_SUBJECT_AREA_SUCCESS");
      assert.deepStrictEqual(res.body.data, mockUpdated);
    });
  });

  // ==========================================
  // 5. DELETE /api/v1/subject-areas/:id - Xóa mềm
  // ==========================================
  test.describe("DELETE /api/v1/subject-areas/:id", () => {
    test("Thành công: Xóa mềm thành công", async () => {
      const mockDeleted = { subject_area_id: "1", display_name: "Medicine", description: null, is_deleted: true };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("SELECT 1 FROM \"Subject_Area\" WHERE subject_area_id = $1")) {
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
        .delete("/api/v1/subject-areas/1")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "DELETE_SUBJECT_AREA_SUCCESS");
      assert.strictEqual(res.body.data.is_deleted, true);
    });
  });

  // ==========================================
  // 6. PATCH /api/v1/subject-areas/:id/restore - Khôi phục
  // ==========================================
  test.describe("PATCH /api/v1/subject-areas/:id/restore", () => {
    test("Thành công: Khôi phục thành công", async () => {
      const mockRestored = { subject_area_id: "1", display_name: "Medicine", description: null, is_deleted: false };

      mock.method(pool, "query", async (sql) => {
        if (sql.includes("SELECT 1 FROM \"Subject_Area\" WHERE subject_area_id = $1")) {
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
        .patch("/api/v1/subject-areas/1/restore")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "RESTORE_SUBJECT_AREA_SUCCESS");
      assert.strictEqual(res.body.data.is_deleted, false);
    });
  });

  // ==========================================
  // 7. GET /api/v1/subject-areas/:id/statistics - Thống kê
  // ==========================================
  test.describe("GET /api/v1/subject-areas/:id/statistics", () => {
    test("Thành công: Lấy thống kê", async () => {
      mock.method(pool, "query", async (sql) => {
        if (sql.includes("SELECT 1 FROM \"Subject_Area\"")) {
          if (sql.includes("is_deleted = true")) {
            return { rows: [] }; // Chưa bị xóa mềm
          }
          return { rows: [{ 1: 1 }] }; // Tồn tại
        }
        if (sql.includes("SELECT display_name FROM")) {
          return { rows: [{ display_name: "Medicine" }] };
        }
        if (sql.includes("COUNT(DISTINCT j.journal_id)")) {
          return { rows: [{ count: 5 }] };
        }
        if (sql.includes("COUNT(DISTINCT a.article_id)")) {
          return { rows: [{ count: 20 }] };
        }
        if (sql.includes("COUNT(DISTINCT aa.author_id)")) {
          return { rows: [{ count: 10 }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .get("/api/v1/subject-areas/1/statistics");

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.code, "GET_SUBJECT_AREA_STATISTICS_SUCCESS");
      assert.strictEqual(res.body.data.total_journals, 5);
      assert.strictEqual(res.body.data.total_articles, 20);
      assert.strictEqual(res.body.data.total_authors, 10);
    });
  });
});
