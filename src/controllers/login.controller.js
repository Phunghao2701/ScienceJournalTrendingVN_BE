import { loginWithEmailPassword, signRefreshToken, signToken } from "../services/login.service.js";
import logger from "../utils/logger.js";
import jwt from 'jsonwebtoken';

/**
 * Kiểm tra định dạng của một chuỗi email có hợp lệ hay không
 * @param {string} email - Chuỗi email cần kiểm tra
 * @returns {boolean} Trả về true nếu định dạng hợp lệ, ngược lại là false
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * API Đăng nhập cho tài khoản Local bằng Email và Mật khẩu
 * @param {Object} req - Express request object
 * @param {Object} req.body - Dữ liệu yêu cầu đăng nhập của người dùng
 * @param {string} req.body.email - Địa chỉ email đăng nhập
 * @param {string} req.body.password - Mật khẩu đăng nhập
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa access token và thông tin người dùng
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const remember = req.body.remember ?? false; // Lấy trạng thái từ Frontend gửi lên

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, code: 'EMAIL_REQUIRED', message: 'Email không được để trống' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, code: "EMAIL_INVALID", message: "Email không đúng định dạng" });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ success: false, code: "PASSWORD_REQUIRED", message: "Password không được để trống" });
    }

    // Thực hiện đăng nhập lấy thông tin user và access token ngắn hạn
    const data = await loginWithEmailPassword({ email, password });

    // 1. Luôn luôn set Access Token vào cookie (vì dù có ghi nhớ hay không thì vẫn phải có quyền truy cập)
    res.cookie('access_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: Number(process.env.COOKIE_ACCESS_MAX_AGE) // Ép kiểu Number để tránh lỗi cookie
    });

    if (remember === true) {
      const refreshToken = signRefreshToken(data.user);
      
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',  
        maxAge: Number(process.env.COOKIE_REFRESH_MAX_AGE) // Sống dài ngày (ví dụ 30 ngày)
      });
    } else {
      // 💡 MẸO AN TOÀN: Nếu người dùng ĐÃ TỪNG tích chọn remember trước đó, 
      // nhưng lần này họ đăng nhập tài khoản khác và BỎ TÍCH, ta chủ động xóa cái cookie cũ đi cho chắc ăn.
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none'
      });
    }

    // 3. Trả kết quả JSON về cho Frontend
    return res.status(200).json({
      success: true,
      code: "LOGIN_SUCCESS",
      message: "Đăng nhập thành công",
      data: {
        token: data.token,
      }
    });

  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lỗi hệ thống trong controller đăng nhập:", error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "LOGIN_FAILED",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở server",
    });
  }
};

/**
 * @description Xử lý yêu cầu cấp lại Access Token mới dựa trên Refresh Token.
 * Hàm này đọc `refresh_token` và `access_token` (cũ) từ cookies, 
 * giải mã `access_token` cũ (bỏ qua hạn sử dụng) để lấy payload (user_id, email, role), 
 * sau đó tạo và trả về một `access_token` mới thông qua HTTP-only cookie và JSON.
 *
 * @async
 * @function refreshToken
 * @param {import('express').Request} req - Đối tượng Request của Express. Chứa `refresh_token` và `access_token` trong ``req.cookies``.
 * @param {import('express').Response} res - Đối tượng Response của Express. Dùng để set cookie và trả về kết quả JSON.
 * @returns {Promise<import('express').Response>} Trả về object chứa mã trạng thái và JSON:
 * - 200: Cấp lại token thành công, kèm `access_token` mới.
 * - 401: Thiếu refresh token hoặc access token cũ không hợp lệ/bị giả mạo.
 * - 500: Lỗi hệ thống trong quá trình xử lý.
 */
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        code: "REFRESH_TOKEN_REQUIRED",
        message: "Refresh token không được để trống",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
        ignoreExpiration: true,
      });
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        code: "INVALID_ACCESS_TOKEN",
        message: "Refresh token cũ không hợp lệ hoặc bị giả mạo",
      });
    }

    const newAccessToken = signToken({
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
    });

    return res
      .status(200)
      .cookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: process.env.COOKIE_ACCESS_MAX_AGE,
      })
      .json({
        success: true,
        code: "REFRESH_TOKEN_SUCCESS",
        message: "Refresh token thành công",
        data: {
          token: newAccessToken,
        },
      });
  }catch (error) {
    logger.error("Lỗi hệ thống trong controller đăng nhập:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "REFRESH_TOKEN_FAILED",
    });
  }
}

/**
 * Kiểm tra trạng thái xác thực của người dùng thông qua Access Token trong Cookie.
 * Hàm này kiểm tra sự tồn tại của `access_token` trong cookie và trả về thông tin trạng thái xác thực.
 *
 * @param {import('express').Request} req - Đối tượng request của Express, chứa dữ liệu gửi lên bao gồm cookies.
 * @param {import('express').Response} res - Đối tượng response của Express dùng để trả về dữ liệu.
 * @returns {import('express').Response} Trả về response dạng JSON chứa trạng thái xác thực:
 * - `200`: Nếu access token tồn tại (authenticated: true).
 * - `401`: Nếu access token không tồn tại hoặc xảy ra lỗi (authenticated: false).
 */
export const checkAuth = (req, res) => {
  try {
    const accessToken = req.cookies?.access_token;


    if (!accessToken) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        code: "ACCESS_TOKEN_MISSING",
        message: "Access token không tồn tại",
      });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      access_token: accessToken,
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      code: "ACCESS_TOKEN_INVALID",
      message: "Access token không hợp lệ hoặc đã hết hạn",
    });
  }
};

/**
 * Đăng xuất người dùng bằng cách xóa toàn bộ cookie xác thực.
 * FE cần gọi endpoint này vì access/refresh token đang được lưu trong
 * HTTP-only cookie, JavaScript phía client không tự xóa trực tiếp được.
 */
export const logout = (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
  };

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);

  return res.status(200).json({
    success: true,
    code: 'LOGOUT_SUCCESS',
    message: 'Đăng xuất thành công',
  });
};
