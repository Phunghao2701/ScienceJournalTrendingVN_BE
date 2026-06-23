import express from 'express';
import { checkAuth, login, logout, refreshToken } from '../controllers/login.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Đăng nhập người dùng bằng email và mật khẩu
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
 *                 description: Email đăng nhập của người dùng
 *               password:
 *                 type: string
 *                 example: "123456"
 *                 description: Mật khẩu của người dùng
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về JWT Token và thông tin người dùng
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
 *                   example: "Đăng nhập thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     user:
 *                       type: object
 *                       properties:
 *                         user_id:
 *                           type: string
 *                           format: uuid
 *                           example: "a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7"
 *                         email:
 *                           type: string
 *                           example: "user@gmail.com"
 *                         role:
 *                           type: string
 *                           example: "STUDENT"
 *                         status:
 *                           type: string
 *                           example: "ACTIVE"
 *       400:
 *         description: Lỗi dữ liệu đầu vào không hợp lệ (thiếu email/password, sai định dạng email)
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
 *                   example: "Email không được để trống"
 *       401:
 *         description: Sai thông tin đăng nhập (email không tồn tại hoặc sai mật khẩu)
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
 *                   example: "Email hoặc mật khẩu không đúng"
 *       403:
 *         description: Tài khoản không được phép truy cập (bị khóa hoặc chưa kích hoạt)
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
 *                   example: "Tài khoản đã bị khóa"
 *       500:
 *         description: Lỗi hệ thống server
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
 *                   example: "Có lỗi xảy ra ở server"
 */
/**
 * Route POST /api/v1/auth/login
 * Đăng nhập người dùng bằng email và mật khẩu truyền thống
 */
router.post('/login', login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   get:
 *     summary: Cấp lại Access Token mới (Refresh Token)
 *     description: API này đọc `refresh_token` và `access_token` từ Cookie. Sau đó xác thực và cấp lại một `access_token` mới, đồng thời tự động set cookie `access_token` mới vào trình duyệt.
 *     tags: 
 *       - Auth
 *     parameters:
 *       - in: cookie
 *         name: refresh_token
 *         schema:
 *           type: string
 *         required: true
 *         description: Refresh token hợp lệ để xin cấp lại access token.
 *       - in: cookie
 *         name: access_token
 *         schema:
 *           type: string
 *         required: true
 *         description: Access token cũ (có thể đã hết hạn).
 *     responses:
 *       200:
 *         description: Cấp lại token thành công.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: access_token=abc.def.ghi; Path=/; HttpOnly; SameSite=none; Max-Age=86400
 *             description: Cookie chứa Access Token mới.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: string
 *                   example: REFRESH_TOKEN_SUCCESS
 *                 message:
 *                   type: string
 *                   example: Refresh token thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Lỗi xác thực (Thiếu token hoặc token bị giả mạo).
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
 *                   example: REFRESH_TOKEN_REQUIRED
 *                 message:
 *                   type: string
 *                   example: Refresh token không được để trống
 *             examples:
 *               MissingToken:
 *                 summary: Thiếu Refresh Token
 *                 value:
 *                   success: false
 *                   code: REFRESH_TOKEN_REQUIRED
 *                   message: Refresh token không được để trống
 *               InvalidOldToken:
 *                 summary: Access token cũ không hợp lệ
 *                 value:
 *                   success: false
 *                   code: INVALID_ACCESS_TOKEN
 *                   message: Access token cũ không hợp lệ hoặc bị giả mạo
 *       500:
 *         description: Lỗi hệ thống từ phía server.
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
 *                   example: REFRESH_TOKEN_FAILED
 */
router.get('/refresh', refreshToken);
 
/**
 * @swagger
 * /api/v1/auth/check-auth:
 *   get:
 *     summary: Kiểm tra trạng thái xác thực
 *     description: API này dùng để kiểm tra xem Access Token trong cookie có tồn tại và hợp lệ hay không.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: cookie
 *         name: access_token
 *         schema:
 *           type: string
 *         required: true
 *         description: Access token của người dùng
 *     responses:
 *       200:
 *         description: Đã xác thực thành công.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 authenticated:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Access Token không tồn tại, không hợp lệ hoặc đã hết hạn.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 authenticated:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: "ACCESS_TOKEN_MISSING"
 *                 message:
 *                   type: string
 *                   example: "Access token không tồn tại"
 */
router.get('/check-auth', checkAuth);
router.post('/logout', logout);

/**
 * Route POST /api/v1/auth/logout
 * Đăng xuất người dùng bằng cách xóa các token lưu trong cookie
 */
router.post('/logout', logout);

export default router;
