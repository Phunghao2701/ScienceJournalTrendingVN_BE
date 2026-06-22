import express from 'express';
import { forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { validateForgotPassword, validateResetPassword } from '../middlewares/authValidation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Gửi yêu cầu đặt lại mật khẩu qua email
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@example.com
 *                 description: Email của tài khoản cần đặt lại mật khẩu
 *     responses:
 *       200:
 *         description: Trả về thông báo thành công chung (không phụ thuộc email tồn tại hay không)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu sẽ được gửi đến email của bạn"
 *       400:
 *         description: Email không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "INVALID_EMAIL"
 *                 message:
 *                   type: string
 *                   example: "Email không hợp lệ"
 *       403:
 *         description: Tài khoản không hỗ trợ reset password bằng email/password (không phải LOCAL)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "RESET_PASSWORD_NOT_SUPPORTED"
 *                 message:
 *                   type: string
 *                   example: "Tài khoản không hỗ trợ reset password bằng email/password"
 *       500:
 *         description: Lỗi hệ thống server hoặc gửi email
 */
router.post('/forgot-password', validateForgotPassword, forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - new_password
 *             properties:
 *               token:
 *                 type: string
 *                 example: "reset_token_from_email"
 *                 description: Token đặt lại mật khẩu nhận từ email
 *               new_password:
 *                 type: string
 *                 example: "newPassword123"
 *                 description: Mật khẩu mới cần thiết lập (tối thiểu 6 ký tự)
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Đặt lại mật khẩu thành công"
 *       400:
 *         description: Token không hợp lệ/hết hạn hoặc mật khẩu mới không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "INVALID_OR_EXPIRED_TOKEN"
 *                 message:
 *                   type: string
 *                   example: "Token không hợp lệ hoặc đã hết hạn"
 *       500:
 *         description: Lỗi hệ thống server
 */
router.post('/reset-password', validateResetPassword, resetPassword);

export default router;
