import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { updateComment, deleteComment } from '../controllers/comment.controller.js';
import { validateCommentId, validateUpdateComment } from '../middlewares/commentValidation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/comments/{commentId}:
 *   put:
 *     summary: Cập nhật nội dung comment (chỉ chủ sở hữu)
 *     tags:
 *       - Comment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của comment cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Nội dung comment đã chỉnh sửa"
 *     responses:
 *       200:
 *         description: Cập nhật comment thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy comment hoặc không có quyền chỉnh sửa
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/:commentId', requireAuth, validateUpdateComment, updateComment);

/**
 * @swagger
 * /api/v1/comments/{commentId}:
 *   delete:
 *     summary: Xóa comment (chỉ chủ sở hữu)
 *     tags:
 *       - Comment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của comment cần xóa
 *     responses:
 *       200:
 *         description: Xóa comment thành công
 *       400:
 *         description: ID comment không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy comment hoặc không có quyền xóa
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/:commentId', requireAuth, validateCommentId, deleteComment);

export default router;
