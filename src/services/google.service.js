import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database.js';
import logger from '../utils/logger.js';
import axios from 'axios';

/**
 * Tạo token JWT để duy trì phiên đăng nhập cho user
 * @param {Object} user - Đối tượng user cần tạo token
 * @param {string} user.user_id - ID của user
 * @param {string} user.email - Email của user
 * @param {string} user.role - Vai trò của user
 * @returns {string} Chuỗi JWT token
 * @throws {Error} Ném lỗi nếu chưa định nghĩa JWT_SECRET trong biến môi trường
 */
const signToken = (user) => {
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

/**
 * Xác thực Google ID Token gửi từ phía client bằng cách gọi trực tiếp Google Tokeninfo API
 * @param {string} idToken - Chuỗi Google ID Token nhận từ phía client
 * @returns {Promise<Object>} Trả về thông tin payload của user từ Google nếu token hợp lệ
 * @throws {Error} Ném lỗi 400 nếu token không hợp lệ hoặc lỗi 500 nếu không thể kết nối tới Google API
 */
export const verifyGoogleIdToken = async (idToken) => {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const error = new Error(errData.error_description || 'Mã xác thực Google không hợp lệ');
      error.statusCode = 400;
      throw error;
    }
    return await response.json();
  } catch (err) {
    if (err.statusCode) throw err;
    const error = new Error('Không thể kết nối đến dịch vụ xác thực Google');
    error.statusCode = 500;
    throw error;
  }
};

/**
 * Thực hiện đăng nhập hoặc đăng ký tài khoản tự động khi xác thực bằng Google ID Token
 * @param {string} idToken - Chuỗi Google ID Token nhận từ phía client
 * @returns {Promise<Object>} Trả về đối tượng chứa JWT access token và thông tin chi tiết người dùng
 * @throws {Error} Ném lỗi 403 nếu tài khoản bị khóa (BANNED) hoặc lỗi validation khác
 */
export const loginOrCreateWithGoogle = async (idToken) => {
  if (!idToken || !idToken.trim()) {
    const error = new Error('Token xác thực Google không được để trống');
    error.statusCode = 400;
    throw error;
  }

  // 1. Xác thực ID Token với Google
  const googleUser = await verifyGoogleIdToken(idToken);
  const email = googleUser.email.trim().toLowerCase();

  // 2. Tìm xem email đã tồn tại trong DB chưa
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
  const result = await pool.query(query, [email]);
  let user = result.rows[0];

  if (user) {
    // Nếu tài khoản bị khóa
    if (user.status === 'BANNED') {
      const error = new Error('Tài khoản đã bị khóa');
      error.statusCode = 403;
      throw error;
    }

    // Tự động kích hoạt tài khoản nếu trạng thái là INACTIVE
    if (user.status === 'INACTIVE') {
      const updateStatusQuery = `UPDATE "user" SET "status" = 'ACTIVE' WHERE "user_id" = $1`;
      await pool.query(updateStatusQuery, [user.user_id]);
      user.status = 'ACTIVE';
    }

    // Cập nhật auth_provider thành GOOGLE nếu chưa cập nhật
    if (user.type !== 'GOOGLE') {
      const updateTypeQuery = `UPDATE "user" SET "type" = 'GOOGLE' WHERE "user_id" = $1`;
      await pool.query(updateTypeQuery, [user.user_id]);
      user.type = 'GOOGLE';
    }
  } else {
    // Đăng ký mới tài khoản bằng Google
    const userId = crypto.randomUUID();
    const insertQuery = `
      INSERT INTO "user" (
        "user_id",
        "email",
        "type",
        "status",
        "role",
        "first_name",
        "last_name",
        "url_image"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        "user_id",
        "email",
        "type",
        "status",
        "role",
        "first_name",
        "last_name",
        "url_image"
    `;

    const insertResult = await pool.query(insertQuery, [
      userId,
      email,
      'GOOGLE',
      'ACTIVE',
      'STUDENT',
      googleUser.given_name || null,
      googleUser.family_name || null,
      googleUser.picture || null
    ]);
    user = insertResult.rows[0];
  }

  const token = signToken(user);

  return {
    token,
    user: {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    }
  };
};

/**
 * Hàm đổi Authorization Code lấy id_token từ Google
 * @param {string} code - Mã code nhận từ useGoogleLogin (chuỗi 4/0A...)
 * @returns {Promise<string|null>} - Trả về chuỗi id_token (JWT) nếu thành công
 */
export const getTokenId = async (code) => {
  // 1. Cấu hình các thông số cần thiết
  const tokenUrl = process.env.TOKEN_URL;
  
  const payload = {
    code: code,
    client_id: process.env.CLIENT_ID, 
    client_secret: process.env.CLIENT_SECRET, 
    redirect_uri: process.env.FRONTEND_URL,                    
    grant_type: 'authorization_code',
  };

  try {
    // 2. Thực hiện gọi API với định dạng x-www-form-urlencoded
    const response = await axios.post(tokenUrl, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // 3. Google trả về data thành công, lấy ra id_token
    if (response.data && response.data.id_token) {
      console.log('Lấy id_token thành công!');
      return response.data.id_token; // Đây là chuỗi JWT bạn cần đem về Backend
    }
    
    return null;
  } catch (error) {
    logger.error(
      'Lỗi khi đổi code lấy id_token:', 
      error.response?.data || error.message
    );
    throw error;
  }
};