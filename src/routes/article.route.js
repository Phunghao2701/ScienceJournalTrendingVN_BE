import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { 
    createArticle, 
    getArticle, 
    getArticleById, 
    getArticlesByKeywords, 
    getArticles, 
    updateArticle,
    deleteArticle,
    restoreArticle
} from '../controllers/article.controller.js';
import { validateCreateArticle, validateId, validateUpdateArticle } from '../middlewares/articleValidation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/articles:
 *   get:
 *     summary: Lấy danh sách hoặc tìm kiếm bài báo tổng hợp
 *     description: >
 *       Nếu KHÔNG truyền tham số `keywords`: trả về danh sách bài báo công khai, hỗ trợ `search`, phân trang và sắp xếp.
 *       Nếu CÓ truyền tham số `keywords`: API chuyển sang chế độ tìm kiếm nâng cao theo từ khóa chuyên biệt (yêu cầu xác thực Bearer Token).
 *     tags:
 *       - Article
 *     parameters:
 *       - in: query
 *         name: keywords
 *         schema:
 *           type: string
 *         description: Danh sách từ khóa cách nhau bởi dấu phẩy. Nếu có trường này, bắt buộc phải gửi token.
 *         example: Machine Learning,Deep Learning
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Số lượng bài báo mỗi trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm bài báo theo tiêu đề (chỉ dùng trong chế độ public)
 *         example: cancer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [article_id, title, publication_year, created_at, doi]
 *           default: created_at
 *         description: Trường sắp xếp
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Lấy danh sách hoặc tìm kiếm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Tham số không hợp lệ
 *       401:
 *         description: Chưa xác thực (khi dùng tính năng keywords)
 *       500:
 *         description: Lỗi hệ thống
 */

/**
 * Route GET /api/v1/articles
 * Khớp nối & giải quyết xung đột:
 * - Kiểm tra nếu có param `keywords` -> Chạy qua lớp bảo mật `requireAuth` rồi gọi controller xử lý keyword.
 * - Nếu không đi kèm `keywords` -> Cho phép truy cập công khai (Public) thông qua hàm gộp tổng `getArticles`.
 */
router.get('/', async (req, res, next) => {
    if (req.query.keywords !== undefined && req.query.keywords.trim() !== '') {
        // Có keywords -> Bắt buộc kiểm tra token tài khoản
        return requireAuth(req, res, () => getArticlesByKeywords(req, res));
    }
    // Không có keywords -> Cho phép đi thẳng mà không cần token
    return getArticles(req, res);
});

/**
 * @swagger
 * /api/v1/articles/{id}:
 *   get:
 *     summary: Lấy chi tiết bài báo theo ID
 *     description: Lấy thông tin chi tiết của một bài báo theo `article_id`.
 *     tags:
 *       - Article
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bài báo cần lấy
 *         example: 123
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       404:
 *         description: Không tìm thấy bài báo
 *       500:
 *         description: Lỗi server
 */
router.get('/:id', validateId, getArticleById);

/**
 * @swagger
 * /api/v1/articles:
 *   post:
 *     summary: Tạo mới một bài báo
 *     description: Tạo một bài báo mới trong hệ thống. Yêu cầu dữ liệu bài báo, danh sách tác giả và từ khóa nếu có.
 *     tags:
 *       - Article
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               abstract:
 *                 type: string
 *               publication_year:
 *                 type: integer
 *               issue_id:
 *                 type: integer
 *               doi:
 *                 type: string
 *               primary_topic:
 *                 type: string
 *               sub_topic:
 *                 type: array
 *                 items:
 *                   type: string
 *               authors:
 *                 type: array
 *                 items:
 *                   type: integer
 *               keywords:
 *                 type: object
 *                 additionalProperties:
 *                   type: number
 *                 description: "Từ khóa kèm điểm score, ví dụ {\"Colorectal cancer\": 0.25}"
 *             required:
 *               - title
 *               - publication_year
 *               - issue_id
 *           example:
 *             title: "An Analysis of AI Trends"
 *             abstract: "This paper evaluates current deep learning paradigms..."
 *             publication_year: 2026
 *             issue_id: 1
 *             doi: "10.1109/TAI.2026.01"
 *             primary_topic: "Computer Science"
 *             sub_topic:
 *               - "Machine Learning"
 *               - "Neural Networks"
 *             authors:
 *               - 12
 *               - 15
 *             keywords:
 *               "Colorectal cancer": 0.25
 *               "demo 2": 0.25
 *     responses:
 *       201:
 *         description: Đã tạo bài báo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.post('/', requireAuth, validateCreateArticle, createArticle);

/**
 * @swagger
 * /api/v1/articles/{id}:
 *   put:
 *     summary: Cập nhật thông tin bài báo theo ID
 *     description: Cập nhật một bài báo hiện có. Các trường không bắt buộc có thể được cập nhật riêng lẻ.
 *     tags:
 *       - Article
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bài báo cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               abstract:
 *                 type: string
 *               publication_year:
 *                 type: integer
 *               issue_id:
 *                 type: integer
 *               doi:
 *                 type: string
 *               primary_topic:
 *                 type: string
 *               sub_topic:
 *                 type: array
 *                 items:
 *                   type: string
 *               authors:
 *                 type: array
 *                 items:
 *                   type: integer
 *               keywords:
 *                 type: object
 *                 additionalProperties:
 *                   type: number
 *                 description: "Từ khóa kèm điểm score, ví dụ {\"Colorectal cancer\": 0.25}"
 *           example:
 *             title: "An Updated Title"
 *             publication_year: 2026
 *             issue_id: 1
 *             doi: "10.1109/TAI.2026.02"
 *             primary_topic: "Computer Science"
 *             sub_topic:
 *               - "Neural Networks"
 *             authors:
 *               - 12
 *               - 15
 *             keywords:
 *               "Colorectal cancer": 0.25
 *               "demo 2": 0.25
 *     responses:
 *       200:
 *         description: Cập nhật bài báo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       404:
 *         description: Không tìm thấy bài báo
 *       500:
 *         description: Lỗi server
 */
router.put('/:id', requireAuth, validateUpdateArticle, updateArticle);

/**
 * @swagger
 * /api/v1/articles/{id}:
 *   delete:
 *     summary: Xóa mềm (soft delete) bài báo
 *     description: Xóa mềm một bài báo bằng cách đánh dấu `is_deleted = true`. Bài báo sẽ không xuất hiện trong danh sách nhưng vẫn có thể lấy chi tiết nếu biết ID. Yêu cầu xác thực.
 *     tags:
 *       - Article
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID bài báo cần xóa
 *     responses:
 *       200:
 *         description: Bài báo đã xóa thành công
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
 *                   example: "Article đã xóa thành công"
 *       404:
 *         description: Bài báo không tìm thấy
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.delete('/:id', requireAuth, validateId, deleteArticle);

/**
 * @swagger
 * /api/v1/articles/{id}/restore:
 *   patch:
 *     summary: Khôi phục bài báo đã bị xóa mềm
 *     description: Khôi phục (restore) một bài báo đã bị xóa mềm. Yêu cầu xác thực.
 *     tags:
 *       - Article
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID bài báo cần khôi phục
 *     responses:
 *       200:
 *         description: Bài báo đã khôi phục thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       404:
 *         description: Bài báo không tìm thấy hoặc không bị xóa
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.patch('/:id/restore', requireAuth, validateId, restoreArticle);

export default router;