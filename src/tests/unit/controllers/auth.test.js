import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import pool from "../../../config/database.js";
import {
  forgotPassword,
  resetPassword,
  authServiceRef
} from "../../../controllers/auth.controller.js";
import logger from "../../../utils/logger.js";

test.after(async () => {
  await pool.end();
});

describe("Auth Controller Unit Test Suite", () => {
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

  describe("forgotPassword API", () => {
    test("Thành công gửi yêu cầu forgot-password", async () => {
      const mockResult = {
        success: true,
        message: "Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu sẽ được gửi đến email của bạn"
      };

      const mockRequest = mock.method(authServiceRef, "requestPasswordReset", async () => mockResult);
      mock.method(logger, "error", () => {});

      const req = {
        body: {
          email: "student@example.com"
        }
      };
      const res = createMockResponse();

      await forgotPassword(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, mockResult.message);
      assert.deepStrictEqual(mockRequest.mock.calls[0].arguments, ["student@example.com"]);
    });

    test("Thất bại khi tài khoản không phải LOCAL (403)", async () => {
      const error = new Error("Tài khoản không hỗ trợ reset password bằng email/password");
      error.statusCode = 403;
      error.code = "RESET_PASSWORD_NOT_SUPPORTED";

      mock.method(authServiceRef, "requestPasswordReset", async () => {
        throw error;
      });
      mock.method(logger, "error", () => {});

      const req = {
        body: {
          email: "googleuser@example.com"
        }
      };
      const res = createMockResponse();

      await forgotPassword(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "RESET_PASSWORD_NOT_SUPPORTED");
    });

    test("Thất bại khi lỗi server (500)", async () => {
      mock.method(authServiceRef, "requestPasswordReset", async () => {
        throw new Error("SMTP error");
      });
      mock.method(logger, "error", () => {});

      const req = {
        body: {
          email: "student@example.com"
        }
      };
      const res = createMockResponse();

      await forgotPassword(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "SERVER_ERROR");
    });
  });

  describe("resetPassword API", () => {
    test("Thành công đặt lại mật khẩu", async () => {
      const mockResult = {
        success: true,
        message: "Đặt lại mật khẩu thành công"
      };

      const mockReset = mock.method(authServiceRef, "resetPassword", async () => mockResult);
      mock.method(logger, "error", () => {});

      const req = {
        body: {
          token: "valid_token",
          new_password: "newPassword123"
        }
      };
      const res = createMockResponse();

      await resetPassword(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, mockResult.message);
      assert.deepStrictEqual(mockReset.mock.calls[0].arguments, ["valid_token", "newPassword123"]);
    });

    test("Thất bại khi token không hợp lệ hoặc hết hạn (400)", async () => {
      const error = new Error("Token không hợp lệ hoặc đã hết hạn");
      error.statusCode = 400;
      error.code = "INVALID_OR_EXPIRED_TOKEN";

      mock.method(authServiceRef, "resetPassword", async () => {
        throw error;
      });
      mock.method(logger, "error", () => {});

      const req = {
        body: {
          token: "expired_token",
          new_password: "newPassword123"
        }
      };
      const res = createMockResponse();

      await resetPassword(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, "INVALID_OR_EXPIRED_TOKEN");
    });
  });
});
