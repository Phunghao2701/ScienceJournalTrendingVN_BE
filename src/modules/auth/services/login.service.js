import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../../config/prisma.js';

/**
 * Tạo đối tượng lỗi phản hồi khi thông tin đăng nhập sai (Mã lỗi 401)
 * @returns {Error} Lỗi với thông tin "Email hoặc mật khẩu không đúng" v�  status 401
 */
const buildLoginError = () => {
  const error = new Error('Email hoặc mật khẩu không đúng');
  error.statusCode = 401;
  return error;
};

/**
 * Sinh token JWT chứa ID, email v�  vai trò của user phục vụ cho phiên đăng nhập
 * @param {Object} user - Đối tượng user cần tạo token
 * @returns {string} Chuỗi JWT token
 * @throws {Error} Ném lỗi nếu chưa định nghĩa JWT_SECRET trong môi trường
 */
export const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET in environment variables');
  }

  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
};

export const signRefreshToken = (user) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('Missing JWT_REFRESH_SECRET in environment variables');
  }

  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    }
  );
};

/**
 * Thực hiện xác thực đăng nhập người dùng bằng email v�  mật khẩu truyền thống
 * @param {Object} credentials - Thông tin đăng nhập
 * @param {string} credentials.email - Địa chỉ email đăng nhập
 * @param {string} credentials.password - Mật khẩu đăng nhập
 * @returns {Promise<Object>} Đối tượng chứa chuỗi JWT access token v�  thông tin chi tiết user
 * @throws {Error} Ném lỗi 401 nếu sai mật khẩu/email, hoặc 403 nếu t� i khoản bị khóa/chưa kích hoạt
 */
export const loginWithEmailPassword = async ({ email, password }) => {
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
      password: true,
      type: true,
      status: true,
      role: true,
      last_name: true,
      first_name: true,
      url_image: true,
      date_of_birth: true,
      gender: true
    }
  });

  if (!user) {
    throw buildLoginError();
  }

  if (user.type !== 'LOCAL') {
    const error = new Error('T� i khoản n� y không hỗ trợ đăng nhập bằng mật khẩu');
    error.statusCode = 403;
    throw error;
  }

  if (user.status !== 'ACTIVE') {
    const error = new Error(
      user.status === 'BANNED'
        ? 'T� i khoản đã bị khóa'
        : 'T� i khoản chưa được kích hoạt'
    );
    error.statusCode = 403;
    throw error;
  }

  if (!user.password) {
    throw buildLoginError();
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw buildLoginError();
  }

  const token = signToken(user);

  return {
    token: token,
    user: {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    }
  };
};


