import express from 'express';
import { register, verify } from '../controllers/register.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản người dùng mới
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
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@gmail.com
 *                 description: Email đăng ký của người dùng
 *               password:
 *                 type: string
 *                 example: "123456"
 *                 description: Mật khẩu (tối thiểu 6 ký tự)
 *               first_name:
 *                 type: string
 *                 example: "Văn A"
 *               last_name:
 *                 type: string
 *                 example: "Nguyễn"
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1999-01-01"
 *               gender:
 *                 type: boolean
 *                 example: true
 *               role:
 *                 type: string
 *                 enum: [STUDENT, LECTURER, RESEARCHER, ADMINISTRATOR]
 *                 example: "STUDENT"
 *     responses:
 *       201:
 *         description: Đăng ký thành công, trả về thông tin tài khoản dạng INACTIVE kèm chỉ thị kích hoạt email
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
 *                   example: "Đăng ký tài khoản thành công. Vui lòng kiểm tra email để kích hoạt tài khoản."
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                       example: "a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7"
 *                     email:
 *                       type: string
 *                       example: "user@gmail.com"
 *                     type:
 *                       type: string
 *                       example: "LOCAL"
 *                     status:
 *                       type: string
 *                       example: "INACTIVE"
 *                     role:
 *                       type: string
 *                       example: "STUDENT"
 *       400:
 *         description: Dữ liệu đầu vào thiếu hoặc sai định dạng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Mật khẩu phải có ít nhất 6 ký tự"
 *       409:
 *         description: Email đăng ký đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email đã tồn tại"
 *       500:
 *         description: Lỗi hệ thống server
 */
/**
 * Route POST /api/v1/auth/register
 * Đăng ký tài khoản người dùng mới (Trạng thái mặc định INACTIVE và gửi email kích hoạt)
 */
router.post('/register', register);

/**
 * @swagger
 * /api/v1/auth/verify:
 *   get:
 *     summary: Xác thực kích hoạt tài khoản qua Token được gửi trong Email
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token xác thực được nhận qua email (định dạng JWT)
 *     responses:
 *       200:
 *         description: Kích hoạt tài khoản thành công hoặc tài khoản đã kích hoạt từ trước
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
 *                   example: "Kích hoạt tài khoản thành công! Bây giờ bạn có thể đăng nhập."
 *       400:
 *         description: Token thiếu, không hợp lệ hoặc đã hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Token kích hoạt không hợp lệ hoặc đã hết hạn"
 *       403:
 *         description: Tài khoản đã bị khóa không thể kích hoạt
 *       500:
 *         description: Lỗi hệ thống server
 */
/**
 * Route GET /api/v1/auth/verify
 * Xác thực token gửi qua Email để kích hoạt tài khoản
 */
router.get('/verify', verify);

export default router;
