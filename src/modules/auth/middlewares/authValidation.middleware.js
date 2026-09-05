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
 * Middleware kiểm tra tính hợp lệ của dữ liệu yêu cầu quên mật khẩu.
 */
export const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;

  if (email === undefined || email === null || !email.trim()) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_EMAIL',
      message: 'Email không được để trống'
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_EMAIL',
      message: 'Email không hợp lệ'
    });
  }

  next();
};

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu yêu cầu đặt lại mật khẩu.
 */
export const validateResetPassword = (req, res, next) => {
  const { token, new_password } = req.body;

  if (token === undefined || token === null || !token.trim()) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Token không được để trống'
    });
  }

  if (new_password === undefined || new_password === null || !new_password.trim()) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PASSWORD',
      message: 'Mật khẩu mới không hợp lệ'
    });
  }

  if (new_password.length < 6) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PASSWORD',
      message: 'Mật khẩu mới không hợp lệ'
    });
  }

  next();
};
