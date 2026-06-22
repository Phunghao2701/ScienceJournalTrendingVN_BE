import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';


/**
 * Middleware xác thực người dùng bằng JWT Token
 * Kiểm tra sự tồn tại của Authorization header chứa Bearer token, giải mã và gán thông tin giải mã vào req.user.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Headers của request
 * @param {string} [req.headers.authorization] - Chuỗi Authorization header dạng: "Bearer <token>"
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void|Object} Gọi hàm next() nếu xác thực thành công, ngược lại trả về response lỗi 401 hoặc 500
 */
export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy token xác thực hoặc token không hợp lệ'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi cấu hình JWT trên server'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Dữ liệu giải mã: { user_id, role, ... }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ hoặc đã hết hạn'
    });
  }
};

/**
 * Middleware xác thực và kiểm tra token của người dùng
 * Giải mã Bearer token từ Authorization header, gán decoded payload vào req.user, và ghi nhật ký (logs) sự kiện.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Headers của request
 * @param {string} [req.headers.authorization] - Chuỗi Authorization header dạng: "Bearer <token>"
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void|Object} Gọi hàm next() nếu xác thực thành công, ngược lại trả về response lỗi 401
 */
export const verifyToken = (req, res, next) => {
  let accessToken = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.split(' ')[1];
  }

  if (!accessToken && req.cookies) {
    accessToken = req.cookies.access_token;
  }

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      code: "ACCESS_TOKEN_MISSING",
      message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn"
    });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

    req.user = decoded; 
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: "ACCESS_TOKEN_EXPIRED",
      message: "Access token không hợp lệ hoặc đã hết hạn"
    });
  }
};

