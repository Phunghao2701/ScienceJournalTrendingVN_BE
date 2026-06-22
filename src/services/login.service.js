import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

/**
 * Tạo đối tượng lỗi phản hồi khi thông tin đăng nhập sai (Mã lỗi 401)
 * @returns {Error} Lỗi với thông tin "Email hoặc mật khẩu không đúng" và status 401
 */
const buildLoginError = () => {
  const error = new Error('Email hoặc mật khẩu không đúng');
  error.statusCode = 401;
  return error;
};

/**
 * Sinh token JWT chứa ID, email và vai trò của user phục vụ cho phiên đăng nhập
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
 * Thực hiện xác thực đăng nhập người dùng bằng email và mật khẩu truyền thống
 * @param {Object} credentials - Thông tin đăng nhập
 * @param {string} credentials.email - Địa chỉ email đăng nhập
 * @param {string} credentials.password - Mật khẩu đăng nhập
 * @returns {Promise<Object>} Đối tượng chứa chuỗi JWT access token và thông tin chi tiết user
 * @throws {Error} Ném lỗi 401 nếu sai mật khẩu/email, hoặc 403 nếu tài khoản bị khóa/chưa kích hoạt
 */
export const loginWithEmailPassword = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const query = `
    SELECT
      "user_id",
      "email",
      "password",
      "type",
      "status",
      "role",
      "last_name",
      "first_name",
      "url_image",
      "date_of_birth",
      "gender"
    FROM "user"
    WHERE LOWER("email") = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [normalizedEmail]);
  const user = result.rows[0];

  if (!user) {
    throw buildLoginError();
  }

  if (user.type !== 'LOCAL') {
    const error = new Error('Tài khoản này không hỗ trợ đăng nhập bằng mật khẩu');
    error.statusCode = 403;
    throw error;
  }

  if (user.status !== 'ACTIVE') {
    const error = new Error(
      user.status === 'BANNED'
        ? 'Tài khoản đã bị khóa'
        : 'Tài khoản chưa được kích hoạt'
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
