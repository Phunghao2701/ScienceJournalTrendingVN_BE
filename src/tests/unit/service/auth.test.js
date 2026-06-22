import test from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import request from "supertest";
import app from "../../../app.js";
import pool from "../../../config/database.js";

test.after(async () => {
  await pool.end();
});

test.describe("Auth API - Forgot & Reset Password Integration Test Suite", () => {
  test.afterEach(() => {
    mock.reset();
  });

  // ====================================================
  // 1. POST /api/v1/auth/forgot-password
  // ====================================================
  test.describe("POST /api/v1/auth/forgot-password", () => {
    test("Thất bại: Lỗi 400 - Email không được để trống", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({});

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_EMAIL");
    });

    test("Thất bại: Lỗi 400 - Email không hợp lệ", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "invalid-email" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_EMAIL");
    });

    test("Thành công giả: Trả về 200 khi email không tồn tại", async () => {
      mock.method(pool, "query", async () => {
        return { rows: [] }; // Không tìm thấy user
      });

      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, "Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu sẽ được gửi đến email của bạn");
    });

    test("Thất bại: Lỗi 403 - Tài khoản không phải LOCAL (ví dụ GOOGLE)", async () => {
      mock.method(pool, "query", async () => {
        return {
          rows: [
            {
              user_id: "a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7",
              first_name: "Google User",
              type: "GOOGLE"
            }
          ]
        };
      });

      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "googleuser@example.com" });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "RESET_PASSWORD_NOT_SUPPORTED");
    });

    test("Thành công: Lưu token vào DB và gửi mail cho user LOCAL", async () => {
      let queryCalls = [];
      mock.method(pool, "query", async (sql, params) => {
        queryCalls.push({ sql, params });
        if (sql.includes("SELECT")) {
          return {
            rows: [
              {
                user_id: "a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7",
                first_name: "Local User",
                type: "LOCAL"
              }
            ]
          };
        }
        if (sql.includes("INSERT")) {
          return { rows: [{ token_id: "token-uuid" }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "localuser@example.com" });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, "Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu sẽ được gửi đến email của bạn");
      
      // Xác nhận đã truy vấn tìm user và đã insert token
      const hasSelect = queryCalls.some(c => c.sql.includes("SELECT"));
      const hasInsert = queryCalls.some(c => c.sql.includes("INSERT"));
      assert.strictEqual(hasSelect, true);
      assert.strictEqual(hasInsert, true);
    });
  });

  // ====================================================
  // 2. POST /api/v1/auth/reset-password
  // ====================================================
  test.describe("POST /api/v1/auth/reset-password", () => {
    test("Thất bại: Lỗi 400 - Token không được để trống", async () => {
      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ new_password: "newPassword123" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_TOKEN");
    });

    test("Thất bại: Lỗi 400 - Mật khẩu mới không được để trống", async () => {
      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "some_token" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_PASSWORD");
    });

    test("Thất bại: Lỗi 400 - Mật khẩu ngắn hơn 6 ký tự", async () => {
      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "some_token", new_password: "123" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_PASSWORD");
    });

    test("Thất bại: Lỗi 400 - Token không tồn tại", async () => {
      mock.method(pool, "query", async () => {
        return { rows: [] }; // Token không tồn tại trong DB
      });

      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "nonexistent_token", new_password: "newPassword123" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_OR_EXPIRED_TOKEN");
    });

    test("Thất bại: Lỗi 400 - Token đã được sử dụng trước đó", async () => {
      mock.method(pool, "query", async () => {
        return {
          rows: [
            {
              token_id: "token-uuid",
              user_id: "user-uuid",
              expires_at: new Date(Date.now() + 100000),
              used_at: new Date() // Đã dùng
            }
          ]
        };
      });

      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "used_token", new_password: "newPassword123" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_OR_EXPIRED_TOKEN");
    });

    test("Thất bại: Lỗi 400 - Token đã hết hạn", async () => {
      mock.method(pool, "query", async () => {
        return {
          rows: [
            {
              token_id: "token-uuid",
              user_id: "user-uuid",
              expires_at: new Date(Date.now() - 100000), // Đã hết hạn từ trước
              used_at: null
            }
          ]
        };
      });

      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "expired_token", new_password: "newPassword123" });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_OR_EXPIRED_TOKEN");
    });

    test("Thành công: Đặt lại mật khẩu thành công và đánh dấu token", async () => {
      // Mock truy vấn tìm token
      mock.method(pool, "query", async (sql) => {
        if (sql.includes("Password_Reset_Token")) {
          return {
            rows: [
              {
                token_id: "token-uuid",
                user_id: "user-uuid",
                expires_at: new Date(Date.now() + 600000), // Chưa hết hạn
                used_at: null
              }
            ]
          };
        }
        return { rows: [] };
      });

      // Mock pool.connect() cho transaction
      let transactionQueries = [];
      mock.method(pool, "connect", async () => {
        return {
          query: async (sql, params) => {
            transactionQueries.push({ sql, params });
            return { rows: [] };
          },
          release: () => {}
        };
      });

      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "valid_token", new_password: "newPassword123" });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, "Đặt lại mật khẩu thành công");

      // Xác nhận các câu lệnh trong transaction đã chạy
      const hasBegin = transactionQueries.some(q => q.sql === "BEGIN");
      const hasUpdateUser = transactionQueries.some(q => q.sql.includes("UPDATE \"user\""));
      const hasUpdateToken = transactionQueries.some(q => q.sql.includes("UPDATE \"Password_Reset_Token\""));
      const hasCommit = transactionQueries.some(q => q.sql === "COMMIT");

      assert.strictEqual(hasBegin, true);
      assert.strictEqual(hasUpdateUser, true);
      assert.strictEqual(hasUpdateToken, true);
      assert.strictEqual(hasCommit, true);
    });
  });
});
