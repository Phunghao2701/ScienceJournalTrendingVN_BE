import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../config/prisma.js';
import { emailHelper } from '../../../utils/email.js';

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
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive'
      }
    },
    select: { user_id: true, first_name: true, type: true }
  });

  // Để tránh lộ t� i khoản, nếu email không tồn tại, trả về success: true nhưng không l� m gì tiếp theo
  if (!user) {
    return {
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu sẽ được gửi đến email của bạn'
    };
  }

  // Chỉ cho phép reset password với t� i khoản type = LOCAL
  if (user.type !== 'LOCAL') {
    const error = new Error('T� i khoản không hỗ trợ reset password bằng email/password');
    error.statusCode = 403;
    error.code = 'RESET_PASSWORD_NOT_SUPPORTED';
    throw error;
  }

  // Tạo reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(resetToken);

  // Set hạn sử dụng 15 phút
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Lưu token đã hash v� o database
  await prisma.password_Reset_Token.create({
    data: {
      user_id: user.user_id,
      token_hash: tokenHash,
      expires_at: expiresAt
    }
  });

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
  const tokenData = await prisma.password_Reset_Token.findFirst({
    where: { token_hash: tokenHash },
    select: { token_id: true, user_id: true, expires_at: true, used_at: true }
  });

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

  // Bắt đầu transaction để update password v�  cập nhật trạng thái token
  await prisma.$transaction([
    prisma.user.update({
      where: { user_id: tokenData.user_id },
      data: { password: passwordHash }
    }),
    prisma.password_Reset_Token.update({
      where: { token_id: tokenData.token_id },
      data: { used_at: new Date() }
    })
  ]);

  return {
    success: true,
    message: 'Đặt lại mật khẩu th� nh công'
  };
};




