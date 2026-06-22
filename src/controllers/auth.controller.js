import * as authService from '../services/auth.service.js';
import logger from '../utils/logger.js';

// Export reference to support mocking in unit tests
export const authServiceRef = { ...authService };

/**
 * API Gửi yêu cầu quên mật khẩu
 * @param {Object} req
 * @param {Object} res
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authServiceRef.requestPasswordReset(email);
    return res.status(200).json(result);
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error('[Auth Controller] Lỗi khi gửi yêu cầu quên mật khẩu:', error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'SERVER_ERROR',
      message: error.statusCode ? error.message : 'Có lỗi xảy ra ở server'
    });
  }
};

/**
 * API Đặt lại mật khẩu
 * @param {Object} req
 * @param {Object} res
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    const result = await authServiceRef.resetPassword(token, new_password);
    return res.status(200).json(result);
  } catch (error) {
    if (!error.statusCode || error.statusCode === 500) {
      logger.error('[Auth Controller] Lỗi khi đặt lại mật khẩu:', error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'SERVER_ERROR',
      message: error.statusCode ? error.message : 'Có lỗi xảy ra ở server'
    });
  }
};
