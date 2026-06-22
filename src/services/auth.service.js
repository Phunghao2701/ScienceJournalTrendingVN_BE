import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { emailHelper } from '../utils/email.js';

// Helper to hash token using SHA-256
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Gửi yêu cầu quên mật khẩu
 * @param {string} email
 * @returns {Promise<Object>}
 */
export const requestPasswordReset = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Tìm user theo email
  const userQuery = `
    SELECT "user_id", "first_name", "type" 
    FROM "user" 
    WHERE LOWER("email") = $1
    LIMIT 1
  `;
  const userResult = await pool.query(userQuery, [normalizedEmail]);
  const user = userResult.rows[0];

  // Để tránh lộ tài khoản, nếu email không tồn tại, trả về success: true nhưng không làm gì tiếp theo
  if (!user) {
    return {
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu sẽ được gửi đến email của bạn'
    };
  }

  // Chỉ cho phép reset password với tài khoản type = LOCAL
  if (user.type !== 'LOCAL') {
    const error = new Error('Tài khoản không hỗ trợ reset password bằng email/password');
    error.statusCode = 403;
    error.code = 'RESET_PASSWORD_NOT_SUPPORTED';
    throw error;
  }

  // Tạo reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(resetToken);

  // Set hạn sử dụng 15 phút
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Lưu token đã hash vào database
  const insertQuery = `
    INSERT INTO "Password_Reset_Token" ("user_id", "token_hash", "expires_at")
    VALUES ($1, $2, $3)
    RETURNING "token_id"
  `;
  await pool.query(insertQuery, [user.user_id, tokenHash, expiresAt]);

  // Gửi email chứa link reset password cho người dùng
  await emailHelper.sendResetPasswordEmail(normalizedEmail, user.first_name, resetToken);

  return {
    success: true,
    message: 'Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu sẽ được gửi đến email của bạn'
  };
};

/**
 * Đặt lại mật khẩu
 * @param {string} token
 * @param {string} newPassword
 * @returns {Promise<Object>}
 */
export const resetPassword = async (token, newPassword) => {
  const tokenHash = hashToken(token);

  // Truy vấn lấy token thông tin
  const tokenQuery = `
    SELECT "token_id", "user_id", "expires_at", "used_at"
    FROM "Password_Reset_Token"
    WHERE "token_hash" = $1
    LIMIT 1
  `;
  const tokenResult = await pool.query(tokenQuery, [tokenHash]);
  const tokenData = tokenResult.rows[0];

  if (!tokenData) {
    const error = new Error('Token không hợp lệ hoặc đã hết hạn');
    error.statusCode = 400;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    throw error;
  }

  // Kiểm tra đã sử dụng
  if (tokenData.used_at) {
    const error = new Error('Token không hợp lệ hoặc đã hết hạn');
    error.statusCode = 400;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    throw error;
  }

  // Kiểm tra hết hạn
  const now = new Date();
  if (new Date(tokenData.expires_at) <= now) {
    const error = new Error('Token không hợp lệ hoặc đã hết hạn');
    error.statusCode = 400;
    error.code = 'INVALID_OR_EXPIRED_TOKEN';
    throw error;
  }

  // Hash mật khẩu mới bằng bcryptjs
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  // Bắt đầu transaction để update password và cập nhật trạng thái token
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cập nhật mật khẩu mới cho user
    const updateUserQuery = `
      UPDATE "user"
      SET "password" = $1
      WHERE "user_id" = $2
    `;
    await client.query(updateUserQuery, [passwordHash, tokenData.user_id]);

    // Đánh dấu token đã sử dụng bằng used_at
    const updateTokenQuery = `
      UPDATE "Password_Reset_Token"
      SET "used_at" = NOW()
      WHERE "token_id" = $1
    `;
    await client.query(updateTokenQuery, [tokenData.token_id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    success: true,
    message: 'Đặt lại mật khẩu thành công'
  };
};
