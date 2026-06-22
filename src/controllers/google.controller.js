import { getTokenId, loginOrCreateWithGoogle } from "../services/google.service.js";
import { signRefreshToken } from "../services/login.service.js";
import logger from "../utils/logger.js";

/**
 * API Đăng nhập hoặc Đăng ký tài khoản tự động bằng Google ID Token gửi từ phía Client
 * @param {Object} req - Express request object
 * @param {Object} req.body - Dữ liệu yêu cầu từ client
 * @param {string} req.body.idToken - Google ID Token do client lấy sau khi người dùng đăng nhập Google
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa JWT token và thông tin tài khoản người dùng
 */
export const googleLogin = async (req, res) => {
  try {
    const { code } = req.body;

    //check code
    if (!code) {
      return res.status(400).json({
        success: false,
        code: "GOOGLE_LOGIN_CODE_REQUIRED",
        message: "Code không được để trống",
      });
    }
    
    //call service get id_token
    const idToken = await getTokenId(code);

    const data = await loginOrCreateWithGoogle(idToken);
    const refreshToken = signRefreshToken(data.user);

    logger.info(
      `[Google Auth]: Đăng nhập/Đăng ký Google thành công cho tài khoản: ${data.user.email}`,
    );

    return res.status(200)
      .cookie("access_token", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: process.env.COOKIE_ACCESS_MAX_AGE,
      })
      .cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: process.env.COOKIE_REFRESH_MAX_AGE,
      })
      .json({
        success: true,
        code: "GOOGLE_LOGIN_SUCCESS",
        message: "Đăng nhập bằng Google thành công",
        data,
      });
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lỗi hệ thống trong controller đăng nhập Google:", error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      code:
        error.statusCode === 400
          ? "GOOGLE_LOGIN_ERROR"
          : "GOOGLE_LOGIN_SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở server",
    });
  }
};
