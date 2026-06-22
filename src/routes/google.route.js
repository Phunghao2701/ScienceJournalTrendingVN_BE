import express from 'express';
import { googleLogin } from '../controllers/google.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/google:
 *   post:
 *     summary: Đăng nhập hoặc đăng ký tài khoản bằng Google ID Token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: ID Token nhận được từ Google Sign-in ở phía client (Mobile/Web)
 *                 example: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFhMmIzY..."
 *     responses:
 *       200:
 *         description: Đăng nhập/Đăng ký thành công bằng Google, trả về JWT Token và thông tin người dùng
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
 *                   example: "Đăng nhập bằng Google thành công"
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
 *                           example: "cubinvinh@gmail.com"
 *                         role:
 *                           type: string
 *                           example: "STUDENT"
 *                         status:
 *                           type: string
 *                           example: "ACTIVE"
 *       400:
 *         description: Lỗi Token không hợp lệ hoặc thiếu idToken
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
 *                   example: "idToken không được để trống"
 *       403:
 *         description: Tài khoản này đã bị khóa (BANNED)
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
 *         description: Lỗi hệ thống server hoặc không kết nối được Google API
 */
/**
 * Route POST /api/v1/auth/google
 * Sử dụng Google ID Token để đăng nhập hoặc đăng ký tài khoản tự động
 */
router.post('/google', googleLogin);

export default router;
