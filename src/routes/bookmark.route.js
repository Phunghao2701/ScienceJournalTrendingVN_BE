import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { getBookmarks, addBookmark, removeBookmark } from '../controllers/bookmark.controller.js';
import { validateAddBookmark, validateArticleIdParam } from '../middlewares/bookmarkValidation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/bookmarks:
 *   get:
 *     summary: Lấy danh sách bài báo đã bookmark của người dùng đang đăng nhập
 *     tags:
 *       - Bookmark
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
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
 *                   example: "Lấy danh sách bookmark thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bookmark_id:
 *                         type: string
 *                       article_id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       abstract:
 *                         type: string
 *                       publication_year:
 *                         type: integer
 *                       doi:
 *                         type: string
 *                       bookmarked_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/', requireAuth, getBookmarks);

/**
 * @swagger
 * /api/v1/bookmarks:
 *   post:
 *     summary: Thêm bookmark cho một bài báo
 *     tags:
 *       - Bookmark
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - article_id
 *             properties:
 *               article_id:
 *                 type: integer
 *                 example: 123
 *     responses:
 *       201:
 *         description: Thêm bookmark thành công
 *       400:
 *         description: article_id không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy bài báo
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/', requireAuth, validateAddBookmark, addBookmark);

/**
 * @swagger
 * /api/v1/bookmarks/{articleId}:
 *   delete:
 *     summary: Bỏ bookmark một bài báo
 *     tags:
 *       - Bookmark
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID bài báo cần bỏ bookmark
 *     responses:
 *       200:
 *         description: Bỏ bookmark thành công
 *       400:
 *         description: article_id không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy bookmark
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/:articleId', requireAuth, validateArticleIdParam, removeBookmark);

export default router;
