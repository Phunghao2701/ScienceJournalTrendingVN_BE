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

test.describe("Volume API - Integration / Endpoint Test Suite", () => {
  test.afterEach(() => {
    mock.reset();
  });

  // ==========================================
  // 1. POST /api/v1/volumes - Tạo mới Volume
  // ==========================================
  test.describe("POST /api/v1/volumes", () => {
    test("Thất bại: Lỗi 401 - Chưa xác thực (Không truyền Token)", async () => {
      const res = await request(app)
        .post("/api/v1/volumes")
        .send({ journal_id: "1", volume_number: 12, publication_year: 2025 });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, "Không tìm thấy token xác thực hoặc token không hợp lệ");
    });

    test("Thất bại: Lỗi 400 - Invalid journal_id (không phải số nguyên)", async () => {
      const res = await request(app)
        .post("/api/v1/volumes")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ journal_id: "abc", volume_number: 12, publication_year: 2025 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_JOURNAL_ID");
    });

    test("Thất bại: Lỗi 400 - Tạp chí không tồn tại hoặc đã bị xóa mềm", async () => {
      mock.method(pool, "query", async (sql) => {
        // Mock query kiểm tra journal_id tồn tại
        if (sql.includes("Journal")) {
          return { rows: [] }; // Không tìm thấy journal
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/volumes")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ journal_id: "999", volume_number: 12, publication_year: 2025 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "JOURNAL_NOT_FOUND");
    });

    test("Thất bại: Lỗi 400 - volume_number <= 0", async () => {
      mock.method(pool, "query", async (sql) => {
        if (sql.includes("Journal")) {
          return { rows: [{ 1: 1 }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/volumes")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ journal_id: "1", volume_number: 0, publication_year: 2025 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_VOLUME_NUMBER");
    });

    test("Thất bại: Lỗi 400 - Invalid publication_year", async () => {
      mock.method(pool, "query", async (sql) => {
        if (sql.includes("Journal")) {
          return { rows: [{ 1: 1 }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/volumes")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ journal_id: "1", volume_number: 12, publication_year: -2025 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_PUBLICATION_YEAR");
    });

    test("Thất bại: Lỗi 400 - Duplicate volume_number trong cùng journal", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (sql.includes("Journal")) {
          return { rows: [{ 1: 1 }] };
        }
        if (sql.includes("Volume")) {
          return { rows: [{ 1: 1 }] }; // Có trùng lặp volume
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/volumes")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ journal_id: "1", volume_number: 12, publication_year: 2025 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "DUPLICATE_VOLUME");
    });

    test("Thành công: Tạo mới Volume thành công", async () => {
      let queryCallCount = 0;
      const mockNewVolume = {
        volume_id: "10",
        journal_id: "1",
        volume_number: 12,
        publication_year: 2025,
        is_deleted: false
      };

      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (sql.includes("Journal")) {
          return { rows: [{ 1: 1 }] };
        }
        if (sql.includes("SELECT 1 FROM \"Volume\"")) {
          return { rows: [] }; // Không trùng lặp
        }
        if (sql.includes("INSERT INTO \"Volume\"")) {
          return { rows: [mockNewVolume] }; // Trả về volume vừa tạo
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/volumes")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ journal_id: "1", volume_number: 12, publication_year: 2025 });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.volume_id, "10");
    });
  });

  // ==========================================
  // 2. GET /api/v1/volumes - Lấy danh sách Volume
  // ==========================================
  test.describe("GET /api/v1/volumes", () => {
    test("Thành công: Lấy danh sách Volume có phân trang", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (sql.includes("COUNT")) {
          return { rows: [{ total: 1 }] };
        }
        return {
          rows: [
            {
              volume_id: "1",
              journal_id: "1",
              volume_number: 227,
              publication_year: 1970,
              is_deleted: false
            }
          ]
        };
      });

      const res = await request(app)
        .get("/api/v1/volumes")
        .set("Authorization", `Bearer ${testToken}`)
        .query({ page: 1, limit: 10 });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.items.length, 1);
      assert.strictEqual(res.body.data.pagination.total, 1);
    });
  });

  // ==========================================
  // 3. GET /api/v1/volumes/:id - Chi tiết Volume
  // ==========================================
  test.describe("GET /api/v1/volumes/:id", () => {
    test("Thất bại: Lỗi 400 - ID volume không hợp lệ", async () => {
      const res = await request(app)
        .get("/api/v1/volumes/abc")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_VOLUME_ID");
    });

    test("Thất bại: Lỗi 404 - Volume không tồn tại hoặc đã bị xóa mềm", async () => {
      mock.method(pool, "query", async () => {
        return { rows: [] };
      });

      const res = await request(app)
        .get("/api/v1/volumes/999")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "VOLUME_NOT_FOUND");
    });

    test("Thành công: Lấy chi tiết Volume thành công", async () => {
      mock.method(pool, "query", async () => {
        return {
          rows: [
            {
              volume_id: "1",
              journal_id: "1",
              volume_number: 227,
              publication_year: 1970,
              is_deleted: false
            }
          ]
        };
      });

      const res = await request(app)
        .get("/api/v1/volumes/1")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.volume_id, "1");
    });
  });

  // ==========================================
  // 4. PUT /api/v1/volumes/:id - Cập nhật Volume
  // ==========================================
  test.describe("PUT /api/v1/volumes/:id", () => {
    test("Thất bại: Lỗi 404 - Update volume không tồn tại", async () => {
      mock.method(pool, "query", async () => {
        return { rows: [] }; // Không tìm thấy volume
      });

      const res = await request(app)
        .put("/api/v1/volumes/999")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ volume_number: 15 });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "VOLUME_NOT_FOUND");
    });

    test("Thất bại: Lỗi 400 - Duplicate volume_number trong cùng journal", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          // Lấy thông tin volume hiện tại
          return {
            rows: [
              {
                volume_id: "1",
                journal_id: "1",
                volume_number: 10,
                publication_year: 2024,
                is_deleted: false
              }
            ]
          };
        }
        // Kiểm tra trùng lặp volume
        return { rows: [{ 1: 1 }] };
      });

      const res = await request(app)
        .put("/api/v1/volumes/1")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ volume_number: 15 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "DUPLICATE_VOLUME");
    });

    test("Thành công: Cập nhật volume thành công", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return {
            rows: [
              {
                volume_id: "1",
                journal_id: "1",
                volume_number: 10,
                publication_year: 2024,
                is_deleted: false
              }
            ]
          };
        }
        if (sql.includes("SELECT 1 FROM \"Volume\"")) {
          return { rows: [] }; // Không trùng lặp
        }
        return {
          rows: [
            {
              volume_id: "1",
              journal_id: "1",
              volume_number: 15,
              publication_year: 2024,
              is_deleted: false
            }
          ]
        };
      });

      const res = await request(app)
        .put("/api/v1/volumes/1")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ volume_number: 15 });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.volume_number, 15);
    });
  });

  // ==========================================
  // 5. DELETE /api/v1/volumes/:id - Xóa mềm Volume
  // ==========================================
  test.describe("DELETE /api/v1/volumes/:id", () => {
    test("Thất bại: Lỗi 404 - Delete volume không tồn tại", async () => {
      mock.method(pool, "query", async () => {
        return { rows: [] }; // Không tìm thấy volume khi kiểm tra tồn tại
      });

      const res = await request(app)
        .delete("/api/v1/volumes/999")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "VOLUME_NOT_FOUND");
    });

    test("Thất bại: Lỗi 400 - Delete volume đã soft delete", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return { rows: [{ 1: 1 }] }; // volumeExist = true
        }
        return { rows: [{ 1: 1 }] }; // volumeIsDeleted = true
      });

      const res = await request(app)
        .delete("/api/v1/volumes/1")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "VOLUME_ALREADY_DELETED");
    });

    test("Thành công: Xóa mềm volume thành công", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return { rows: [{ 1: 1 }] }; // volumeExist = true
        }
        if (queryCallCount === 2) {
          return { rows: [] }; // volumeIsDeleted = false
        }
        return {
          rows: [
            {
              volume_id: "1",
              journal_id: "1",
              volume_number: 10,
              publication_year: 2024,
              is_deleted: true
            }
          ]
        };
      });

      const res = await request(app)
        .delete("/api/v1/volumes/1")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.is_deleted, true);
    });
  });

  // ==========================================
  // 6. PATCH /api/v1/volumes/:id/restore - Khôi phục Volume
  // ==========================================
  test.describe("PATCH /api/v1/volumes/:id/restore", () => {
    test("Thất bại: Lỗi 404 - Restore volume không tồn tại", async () => {
      mock.method(pool, "query", async () => {
        return { rows: [] }; // Không tìm thấy volume khi kiểm tra tồn tại
      });

      const res = await request(app)
        .patch("/api/v1/volumes/999/restore")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "VOLUME_NOT_FOUND");
    });

    test("Thất bại: Lỗi 400 - Restore volume chưa bị delete", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return { rows: [{ 1: 1 }] }; // volumeExist = true
        }
        return { rows: [] }; // volumeIsDeleted = false
      });

      const res = await request(app)
        .patch("/api/v1/volumes/1/restore")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "VOLUME_NOT_DELETED");
    });

    test("Thành công: Khôi phục volume thành công", async () => {
      let queryCallCount = 0;
      mock.method(pool, "query", async (sql) => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return { rows: [{ 1: 1 }] }; // volumeExist = true
        }
        if (queryCallCount === 2) {
          return { rows: [{ 1: 1 }] }; // volumeIsDeleted = true
        }
        return {
          rows: [
            {
              volume_id: "1",
              journal_id: "1",
              volume_number: 10,
              publication_year: 2024,
              is_deleted: false
            }
          ]
        };
      });

      const res = await request(app)
        .patch("/api/v1/volumes/1/restore")
        .set("Authorization", `Bearer ${testToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.is_deleted, false);
    });
  });
});
