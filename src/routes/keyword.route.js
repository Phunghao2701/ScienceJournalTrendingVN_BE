import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  validateDeleteWatchedKeyword,
  validateUpdateWatchedKeywords,
  validateCreateWatchedKeyword,
  validateKeywordBody,
  validateKeywordId
} from "../middlewares/keyword.middleware.js";
import {
  getTrendingKeywords,
  getWatchedKeywordArticles,
  watchKeywords,
  getKeywordByIdController,
  getAllKeywordsController,
  createKeywordController,
  updateKeywordController,
  deleteKeywordController,
  restoreKeywordController,
  deleteWatchedKeyword,
  updateWatchedKeywords,
  getArticlesByKeywordController,
} from "../controllers/keyword.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Keywords
 *     description: API quản lý từ khóa trending và theo dõi theo từng Dự án
 *   - name: Keyword Management
 *     description: API CRUD quản lý danh mục bảng Keywords hệ thống
 */

// ==========================================
// 1. PROJECT WATCHED KEYWORDS ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/projects/{id}/keywords/trending:
 *   get:
 *     summary: Lấy Top 20 từ khóa trending của project
 *     tags: [Keywords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của project
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng từ khóa muốn lấy (tối đa 100)
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [count, score]
 *           default: count
 *         description: Sắp xếp theo tần suất (count) hoặc điểm (score)
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: ID dự án không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi hệ thống server
 */
router.get("/:id/keywords/trending", getTrendingKeywords);

/**
 * @swagger
 * /api/v1/projects/{id}/keywords/watch/articles:
 *   get:
 *     summary: Lấy luồng bài báo mới nhất từ các từ khóa đang theo dõi
 *     tags: [Keywords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của project
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng bài báo mỗi trang (tối đa 50)
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: ID dự án không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi hệ thống server
 */
router.get("/:id/keywords/watch/articles", getWatchedKeywordArticles);

/**
 * @swagger
 * /api/v1/projects/{id}/keywords/watch:
 *   post:
 *     summary: Thêm mới danh sách từ khóa vào danh sách theo dõi của dự án
 *     tags: [Keywords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyword_ids
 *             properties:
 *               keyword_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Danh sách ID của các từ khóa muốn thêm vào danh sách theo dõi
 *                 example: [123, 124, 125]
 *     responses:
 *       201:
 *         description: Thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Project không tồn tại hoặc không thuộc quyền sở hữu
 *       500:
 *         description: Lỗi server
 */
router.post("/:id/keywords/watch", requireAuth, validateCreateWatchedKeyword, watchKeywords);

/**
 * @swagger
 * /api/v1/projects/{id}/keywords/watch:
 *   put:
 *     summary: Cập nhật (ghi đè) danh sách từ khóa mà dự án theo dõi
 *     tags: [Keywords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyword_ids
 *             properties:
 *               keyword_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Mảng chứa toàn bộ các ID của từ khóa muốn theo dõi
 *                 example: [1, 5, 12]
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Project không tồn tại hoặc không thuộc quyền sở hữu
 *       500:
 *         description: Lỗi server
 */
router.put("/:id/keywords/watch", requireAuth, validateUpdateWatchedKeywords, updateWatchedKeywords);

/**
 * @swagger
 * /api/v1/projects/{id}/keywords/{keywordId}:
 *   delete:
 *     summary: Xóa một từ khóa khỏi danh sách theo dõi của dự án
 *     tags: [Keywords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của project
 *       - in: path
 *         name: keywordId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của từ khóa cần xóa
 *     responses:
 *       200:
 *         description: Đã xóa thành công
 *       400:
 *         description: ID dự án hoặc ID từ khóa không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy dự án, không có quyền, hoặc từ khóa không có trong list
 *       500:
 *         description: Lỗi server
 */
router.delete("/:id/keywords/:keywordId", requireAuth, validateDeleteWatchedKeyword, deleteWatchedKeyword);


// ==========================================
// 2. SYSTEM KEYWORD GLOBAL CRUD MANAGEMENT
// ==========================================

/**
 * @swagger
 * /api/v1/keywords:
 *   get:
 *     summary: Lấy danh sách toàn bộ hoặc tìm kiếm keywords hệ thống
 *     tags: [Keyword Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng mỗi trang (tối đa 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên keyword
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.get("/", getAllKeywordsController);

/**
 * @swagger
 * /api/v1/keywords:
 *   post:
 *     summary: Tạo mới một keyword vào hệ thống
 *     tags: [Keyword Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - display_name
 *             properties:
 *               display_name:
 *                 type: string
 *                 example: Machine Learning
 *     responses:
 *       201:
 *         description: Tạo keyword thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       409:
 *         description: Keyword đã tồn tại
 *       500:
 *         description: Lỗi server
 */
router.post("/", requireAuth, validateKeywordBody, createKeywordController);

/**
 * @swagger
 * /api/v1/keywords/{id}/restore:
 *   patch:
 *     summary: Khôi phục danh mục từ khóa đã bị xóa mềm
 *     tags: [Keyword Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của từ khóa cần khôi phục
 *     responses:
 *       200:
 *         description: Khôi phục thành công
 *       400:
 *         description: ID không hợp lệ hoặc từ khóa đang hoạt động
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy từ khóa
 *       500:
 *         description: Lỗi server
 */
router.patch("/:id/restore", requireAuth, validateKeywordId, restoreKeywordController);

/**
 * @swagger
 * /api/v1/keywords/{id}:
 *   get:
 *     summary: Lấy chi tiết thông tin từ khóa theo ID
 *     tags: [Keyword Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của keyword
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get("/:id/articles", validateKeywordId, getArticlesByKeywordController);

router.get("/:id", validateKeywordId, getKeywordByIdController);

/**
 * @swagger
 * /api/v1/keywords/{id}:
 *   put:
 *     summary: Cập nhật tên hiển thị của keyword theo ID
 *     tags: [Keyword Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của keyword
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - display_name
 *             properties:
 *               display_name:
 *                 type: string
 *                 example: Deep Learning
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy từ khóa
 *       409:
 *         description: Trùng tên từ khóa khác
 *       500:
 *         description: Lỗi server
 */
router.put("/:id", requireAuth, validateKeywordId, validateKeywordBody, updateKeywordController);

/**
 * @swagger
 * /api/v1/keywords/{id}:
 *   delete:
 *     summary: Xóa mềm từ khóa hệ thống theo ID
 *     tags: [Keyword Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của từ khóa hệ thống
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       400:
 *         description: ID không hợp lệ hoặc đã bị xóa trước đó
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy từ khóa
 *       500:
 *         description: Lỗi server
 */
router.delete("/:id", requireAuth, validateKeywordId, deleteKeywordController);

export default router;