import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../../../config/prisma.js';
import { emailHelper } from '../../../utils/email.js';
import logger from '../../../utils/logger.js';

/**
 * Đăng ký t� i khoản người dùng mới bằng Email v�  Mật khẩu truyền thống
 * @param {Object} userData - Thông tin t� i khoản đăng ký
 * @param {string} userData.email - Email đăng ký
 * @param {string} userData.password - Mật khẩu đăng ký
 * @param {string} [userData.first_name] - Tên người dùng
 * @param {string} [userData.last_name] - Họ người dùng
 * @param {string} [userData.date_of_birth] - Ng� y sinh
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
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive'
      }
    },
    select: { user_id: true }
  });

  if (existingUser) {
    const error = new Error('Email đã tồn tại');
    error.statusCode = 409;
    throw error;
  }

  // 2. Băm mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  // 3. Insert user mới v� o Database với trạng thái mặc định l�  'INACTIVE'
  const newUser = await prisma.user.create({
    data: {
      user_id: userId,
      email: normalizedEmail,
      password: hashedPassword,
      type: 'LOCAL',
      status: 'INACTIVE', // Đổi từ ACTIVE th� nh INACTIVE để bắt buộc xác thực email
      role: role || null,
      first_name: first_name || null,
      last_name: last_name || null,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      gender: gender !== undefined ? gender : null
    },
    select: {
      user_id: true,
      email: true,
      type: true,
      status: true,
      role: true,
      first_name: true,
      last_name: true,
      date_of_birth: true,
      gender: true
    }
  });

  // 4. Tạo token kích hoạt t� i khoản bằng JWT (thời hạn 24 giờ)
  const activationToken = jwt.sign(
    { user_id: newUser.user_id, email: newUser.email },
    process.env.JWT_SECRET || 'scientific_journal_secret_key',
    { expiresIn: '24h' }
  );

  // 5. Gửi email kích hoạt v�  trả đúng trạng thái giao nhận cho controller/frontend.
  let activationEmailSent = true;
  try {
    await emailHelper.sendActivationEmail(newUser.email, newUser.first_name || 'User', activationToken);
  } catch (emailError) {
    activationEmailSent = false;
    logger.error('Lỗi gửi email kích hoạt trong register service:', emailError);
  }

  return {
    ...newUser,
    activation_email_sent: activationEmailSent
  };
};

/**
 * Gửi lại email kích hoạt cho t� i khoản LOCAL đang ở trạng thái INACTIVE.
 * @param {string} email - Email t� i khoản cần nhận lại liên kết kích hoạt.
 * @returns {Promise<Object>} Email đã gửi th� nh công.
 */
export const resendActivationEmail = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive'
      }
    },
    select: {
      user_id: true,
      email: true,
      first_name: true,
      status: true,
      type: true
    }
  });

  if (!user) {
    const error = new Error('Không tìm thấy t� i khoản với email n� y');
    error.statusCode = 404;
    error.code = 'ACCOUNT_NOT_FOUND';
    throw error;
  }

  if (user.type !== 'LOCAL') {
    const error = new Error('T� i khoản n� y không sử dụng xác thực email');
    error.statusCode = 400;
    error.code = 'ACTIVATION_NOT_SUPPORTED';
    throw error;
  }

  if (user.status === 'ACTIVE') {
    const error = new Error('T� i khoản đã được kích hoạt');
    error.statusCode = 409;
    error.code = 'ACCOUNT_ALREADY_ACTIVE';
    throw error;
  }

  if (user.status === 'BANNED') {
    const error = new Error('T� i khoản đã bị khóa, không thể kích hoạt');
    error.statusCode = 403;
    error.code = 'ACCOUNT_BANNED';
    throw error;
  }

  const activationToken = jwt.sign(
    { user_id: user.user_id, email: user.email },
    process.env.JWT_SECRET || 'scientific_journal_secret_key',
    { expiresIn: '24h' }
  );

  await emailHelper.sendActivationEmail(
    user.email,
    user.first_name || 'User',
    activationToken
  );

  return { email: user.email };
};

/**
 * Xác thực token kích hoạt nhận được từ email v�  cập nhật trạng thái người dùng th� nh ACTIVE
 * @param {string} token - Chuỗi Activation JWT Token lấy được từ email liên kết kích hoạt
 * @returns {Promise<Object>} Đối tượng chứa thuộc tính alreadyActive biểu thị t� i khoản đã kích hoạt từ trước hay chưa, v�  email tương ứng
 * @throws {Error} Ném lỗi 400 nếu token hết hạn/không hợp lệ, hoặc lỗi 403 nếu t� i khoản đã bị khóa (BANNED)
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
  const user = await prisma.user.findUnique({
    where: { user_id: user_id },
    select: { user_id: true, status: true, email: true }
  });

  if (!user) {
    const error = new Error('Không tìm thấy t� i khoản tương ứng với token n� y');
    error.statusCode = 400;
    throw error;
  }

  if (user.status === 'ACTIVE') {
    return { alreadyActive: true, email: user.email };
  }

  if (user.status === 'BANNED') {
    const error = new Error('T� i khoản n� y đã bị khóa, không thể kích hoạt');
    error.statusCode = 403;
    throw error;
  }

  // Cập nhật trạng thái người dùng th� nh ACTIVE
  const updateResult = await prisma.user.update({
    where: { user_id: user_id },
    data: { status: 'ACTIVE' },
    select: { email: true }
  });

  return { alreadyActive: false, email: updateResult.email };
};




