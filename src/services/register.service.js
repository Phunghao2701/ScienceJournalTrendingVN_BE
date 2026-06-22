import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { emailHelper } from '../utils/email.js';
import logger from '../utils/logger.js';

/**
 * Đăng ký tài khoản người dùng mới bằng Email và Mật khẩu truyền thống
 * @param {Object} userData - Thông tin tài khoản đăng ký
 * @param {string} userData.email - Email đăng ký
 * @param {string} userData.password - Mật khẩu đăng ký
 * @param {string} [userData.first_name] - Tên người dùng
 * @param {string} [userData.last_name] - Họ người dùng
 * @param {string} [userData.date_of_birth] - Ngày sinh
 * @param {boolean} [userData.gender] - Giới tính
 * @param {string} [userData.role] - Vai trò
 * @returns {Promise<Object>} Trả về thông tin người dùng vừa được tạo trong CSDL (status = INACTIVE)
 * @throws {Error} Ném lỗi 409 nếu email đã tồn tại trong hệ thống
 */
export const registerWithEmailPassword = async ({
  email,
  password,
  first_name,
  last_name,
  date_of_birth,
  gender,
  role
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Kiểm tra email đã tồn tại hay chưa
  const checkQuery = `SELECT 1 FROM "user" WHERE LOWER("email") = $1 LIMIT 1`;
  const checkResult = await pool.query(checkQuery, [normalizedEmail]);

  if (checkResult.rows.length > 0) {
    const error = new Error('Email đã tồn tại');
    error.statusCode = 409;
    throw error;
  }

  // 2. Băm mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  // 3. Insert user mới vào Database với trạng thái mặc định là 'INACTIVE'
  const insertQuery = `
    INSERT INTO "user" (
      "user_id",
      "email",
      "password",
      "type",
      "status",
      "role",
      "first_name",
      "last_name",
      "date_of_birth",
      "gender"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING
      "user_id",
      "email",
      "type",
      "status",
      "role",
      "first_name",
      "last_name",
      "date_of_birth",
      "gender"
  `;

  const insertResult = await pool.query(insertQuery, [
    userId,
    normalizedEmail,
    hashedPassword,
    'LOCAL',
    'INACTIVE', // Đổi từ ACTIVE thành INACTIVE để bắt buộc xác thực email
    role,
    first_name || null,
    last_name || null,
    date_of_birth || null,
    gender !== undefined ? gender : null
  ]);

  const newUser = insertResult.rows[0];

  // 4. Tạo token kích hoạt tài khoản bằng JWT (thời hạn 24 giờ)
  const activationToken = jwt.sign(
    { user_id: newUser.user_id, email: newUser.email },
    process.env.JWT_SECRET || 'scientific_journal_secret_key',
    { expiresIn: '24h' }
  );

  // 5. Gửi email kích hoạt (không block luồng đăng ký chính nếu gửi lỗi/thành công)
  try {
    await emailHelper.sendActivationEmail(newUser.email, newUser.first_name || 'User', activationToken);
  } catch (emailError) {
    // Không ném lỗi ra ngoài làm hỏng luồng đăng ký, chỉ ghi log để tránh ngắt quãng luồng
    logger.error('Lỗi gửi email kích hoạt trong register service:', emailError);
  }

  return newUser;
};

/**
 * Xác thực token kích hoạt nhận được từ email và cập nhật trạng thái người dùng thành ACTIVE
 * @param {string} token - Chuỗi Activation JWT Token lấy được từ email liên kết kích hoạt
 * @returns {Promise<Object>} Đối tượng chứa thuộc tính alreadyActive biểu thị tài khoản đã kích hoạt từ trước hay chưa, và email tương ứng
 * @throws {Error} Ném lỗi 400 nếu token hết hạn/không hợp lệ, hoặc lỗi 403 nếu tài khoản đã bị khóa (BANNED)
 */
export const activateAccount = async (token) => {
  if (!token) {
    const error = new Error('Token kích hoạt không được để trống');
    error.statusCode = 400;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'scientific_journal_secret_key');
  } catch (err) {
    const error = new Error('Token kích hoạt không hợp lệ hoặc đã hết hạn');
    error.statusCode = 400;
    throw error;
  }

  const { user_id } = decoded;

  // Tìm thông tin trạng thái hiện tại của user trong database
  const userQuery = `SELECT "user_id", "status" FROM "user" WHERE "user_id" = $1 LIMIT 1`;
  const userResult = await pool.query(userQuery, [user_id]);
  const user = userResult.rows[0];

  if (!user) {
    const error = new Error('Không tìm thấy tài khoản tương ứng với token này');
    error.statusCode = 400;
    throw error;
  }

  if (user.status === 'ACTIVE') {
    return { alreadyActive: true, email: user.email };
  }

  if (user.status === 'BANNED') {
    const error = new Error('Tài khoản này đã bị khóa, không thể kích hoạt');
    error.statusCode = 403;
    throw error;
  }

  // Cập nhật trạng thái người dùng thành ACTIVE
  const updateQuery = `UPDATE "user" SET "status" = 'ACTIVE' WHERE "user_id" = $1 RETURNING "email"`;
  const updateResult = await pool.query(updateQuery, [user_id]);
  const activatedEmail = updateResult.rows[0]?.email || user.email;

  return { alreadyActive: false, email: activatedEmail };
};
