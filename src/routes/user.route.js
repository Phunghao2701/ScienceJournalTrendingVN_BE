import express from 'express';
import { deleteMe, getMe, updateMe, updateUserById } from '../controllers/user.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/users/me:
 *   delete:
 *     summary: Tự xóa tài khoản cá nhân của người dùng hiện tại
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Xóa tài khoản thành công
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
 *                   example: "Xóa tài khoản user@gmail.com thành công!"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                       example: "a8e9c612-40db-4ff0-87a0-0f8b3b4f6cf7"
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       404:
 *         description: Không tìm thấy tài khoản để xóa
 *       500:
 *         description: Lỗi hệ thống server
 */
router.delete('/me', verifyToken, deleteMe);

/**
 * @swagger
 * /api/v1/users/me:
 *   put:
 *     summary: Cập nhật thông tin cá nhân của người dùng hiện tại
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "Hao"
 *               last_name:
 *                 type: string
 *                 example: "Phung"
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1999-01-27"
 *               gender:
 *                 type: boolean
 *                 example: true
 *               url_image:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Cập nhật thông tin cá nhân thành công
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
 *                   example: "Cập nhật thông tin cá nhân thành công!"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     first_name:
 *                       type: string
 *                     last_name:
 *                       type: string
 *                     date_of_birth:
 *                       type: string
 *                     gender:
 *                       type: boolean
 *                     url_image:
 *                       type: string
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       404:
 *         description: Không tìm thấy tài khoản để cập nhật
 *       500:
 *         description: Lỗi hệ thống server
 */
router.put('/me', verifyToken, updateMe);

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Lấy thông tin cá nhân của người dùng hiện tại
 *     description: Lấy thông tin chi tiết (profile) của người dùng đang đăng nhập. Yêu cầu phải có token hợp lệ (thông qua Header Authorization hoặc Cookie tùy cấu hình hệ thống).
 *     tags: 
 *       - Users
 *     security:
 *       - bearerAuth: [] 
 *       # Lưu ý: Nếu hệ thống của bạn dùng Cookie thay vì Bearer Token, bạn có thể thiết lập lại scheme security (ví dụ: cookieAuth: [])
 *     responses:
 *       200:
 *         description: Lấy thông tin người dùng thành công.
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
 *                   example: Lấy thông tin người dùng thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "64a2b9..."
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     role:
 *                       type: string
 *                       example: "USER"
 *                     name:
 *                       type: string
 *                       example: "Nguyễn Văn A"
 *                     # Bạn có thể bổ sung thêm các field khác mà hàm getMe trả về (avatar, sdt,...)
 *       401:
 *         description: Lỗi xác thực (Chưa đăng nhập, thiếu token hoặc token đã hết hạn/không hợp lệ).
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
 *                   example: UNAUTHORIZED
 *                 message:
 *                   type: string
 *                   example: Token không hợp lệ hoặc đã hết hạn
 *       404:
 *         description: Không tìm thấy người dùng (Token hợp lệ nhưng user đã bị xóa khỏi database).
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
 *                   example: Người dùng không tồn tại
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
 *                 message:
 *                   type: string
 *                   example: Lỗi máy chủ cục bộ
 */
router.get('/me', verifyToken, getMe);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Tự cập nhật hồ sơ cá nhân qua ID (Chỉ chính chủ)
 *     description: API cho phép người dùng tự sửa đổi các thông tin cá nhân. Bỏ qua các trường như email, password, role hay status nhằm đảm bảo an toàn.
 *     tags: 
 *       - Users
 *     security:
 *       - bearerAuth: [] 
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID của người dùng cần cập nhật (phải trùng với ID trong token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1999-01-27"
 *               gender:
 *                 type: boolean
 *                 example: true
 *               url_image:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Cập nhật thành công (Trang bị whitelist lọc fields an toàn)
 *       400:
 *         description: Dữ liệu gửi lên rỗng hoặc không đúng chuẩn
 *       401:
 *         description: Chưa xác thực (Unauthorized)
 *       403:
 *         description: Bị chặn (Forbidden) do sửa nhầm ID của người khác
 *       404:
 *         description: Không tìm thấy người dùng
 *       500:
 *         description: Lỗi từ máy chủ
 */
router.put('/:id', verifyToken, updateUserById);

export default router;