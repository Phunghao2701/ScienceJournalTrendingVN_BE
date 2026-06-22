import {
  registerWithEmailPassword,
  activateAccount,
} from "../services/register.service.js";
import logger from "../utils/logger.js";

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
 * API Đăng ký tài khoản người dùng mới bằng Email và Mật khẩu
 * @param {Object} req - Express request object
 * @param {Object} req.body - Dữ liệu yêu cầu đăng ký của người dùng
 * @param {string} req.body.email - Địa chỉ email đăng ký
 * @param {string} req.body.password - Mật khẩu đăng ký (tối thiểu 6 ký tự)
 * @param {string} [req.body.first_name] - Tên người dùng
 * @param {string} [req.body.last_name] - Họ người dùng
 * @param {string} [req.body.date_of_birth] - Ngày sinh (YYYY-MM-DD)
 * @param {boolean} [req.body.gender] - Giới tính (true: Nam, false: Nữ/Khác)
 * @param {string} [req.body.role] - Vai trò của người dùng (STUDENT, LECTURER, RESEARCHER, ADMINISTRATOR)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa thông tin tài khoản đăng ký ở trạng thái INACTIVE
 */
export const register = async (req, res) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      date_of_birth,
      gender,
      role,
    } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_REQUIRED",
        message: "Email không được để trống",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_INVALID",
        message: "Email không đúng định dạng",
      });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_REQUIRED",
        message: "Password không được để trống",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_TOO_SHORT",
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    if (
      role &&
      !["STUDENT", "LECTURER", "RESEARCHER", "ADMINISTRATOR"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        code: "ROLE_INVALID",
        message: "Vai trò tài khoản không hợp lệ",
      });
    }

    const data = await registerWithEmailPassword({
      email,
      password,
      first_name,
      last_name,
      date_of_birth,
      gender,
      role,
    });

    logger.info(
      `[Register]: Đăng ký thành công cho tài khoản: ${data.email} (Trạng thái: INACTIVE)`,
    );

    return res.status(201).json({
      success: true,
      code: "REGISTER_SUCCESS",
      message:
        "Đăng ký tài khoản thành công. Vui lòng kiểm tra email để kích hoạt tài khoản.",
      data,
    });
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lỗi hệ thống trong controller đăng ký:", error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở server",
    });
  }
};

/**
 * API Xác thực tài khoản qua Token kích hoạt gửi đến Email người dùng
 * @param {Object} req - Express request object
 * @param {Object} req.query - Các tham số truy vấn trên URL
 * @param {string} req.query.token - Token kích hoạt nhận được từ email
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response thông báo kết quả kích hoạt tài khoản
 */
export const verify = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        code: "ACTIVATION_TOKEN_REQUIRED",
        message: "Token kích hoạt không được để trống",
      });
    }

    const result = await activateAccount(token);

    if (result.alreadyActive) {
      logger.warn(
        `[Register]: Tài khoản ${result.email} đã được kích hoạt trước đó.`,
      );
      return res.status(200).json({
        success: true,
        code: "ACCOUNT_ALREADY_ACTIVE",
        message: "Tài khoản đã được kích hoạt từ trước. Bạn có thể đăng nhập.",
      });
    }

    logger.info(
      `[Register]: Kích hoạt tài khoản thành công cho email: ${result.email}`,
    );

    return res.status(200).json({
      success: true,
      code: "ACCOUNT_ACTIVATION_SUCCESS",
      message: "Kích hoạt tài khoản thành công! Bây giờ bạn có thể đăng nhập.",
    });
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error("Lỗi hệ thống trong controller xác thực tài khoản:", error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      code:
        error.statusCode === 400 ? "ACCOUNT_ACTIVATION_ERROR" : "SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở server",
    });
  }
};
