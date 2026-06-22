import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createSubjectCategory,
  getSubjectCategories,
  getSubjectCategoryById,
  updateSubjectCategory,
  deleteSubjectCategory,
  restoreSubjectCategory,
  getSubjectCategoryStatistics
} from "../controllers/subjectCategory.controller.js";
import {
  validateSubjectCategoryId,
  validateCreateSubjectCategory,
  validateUpdateSubjectCategory,
  validatePagination
} from "../middlewares/subjectCategoryValidation.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/subject-categories:
 *   post:
 *     summary: Tạo mới một Subject Category
 *     description: Tạo mới một chuyên ngành hẹp (Subject Category). Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Category
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject_area_id
 *               - display_name
 *             properties:
 *               subject_area_id:
 *                 type: string
 *                 example: "1"
 *                 description: ID của Subject Area quản lý category này
 *               display_name:
 *                 type: string
 *                 example: "Artificial Intelligence"
 *                 description: Tên hiển thị duy nhất trong lĩnh vực học thuật đó
 *               description:
 *                 type: string
 *                 example: "Sub-field focusing on machine learning, deep learning, NLP, etc."
 *                 description: Mô tả chi tiết chuyên ngành hẹp
 *     responses:
 *       201:
 *         description: Tạo Subject Category thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc bị trùng lặp display_name
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi hệ thống
 */
router.post("/", requireAuth, validateCreateSubjectCategory, createSubjectCategory);

/**
 * @swagger
 * /api/v1/subject-categories:
 *   get:
 *     summary: Lấy danh sách Subject Category có hỗ trợ phân trang, tìm kiếm và lọc theo Subject Area
 *     description: Trả về danh sách các Subject Category chưa bị xóa mềm trong hệ thống.
 *     tags:
 *       - Subject Category
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Trang hiện tại cần lấy
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Số lượng bản ghi mỗi trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo display_name (không phân biệt hoa thường)
 *       - in: query
 *         name: subject_area_id
 *         schema:
 *           type: string
 *         description: Lọc danh sách theo ID của Subject Area cha
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [subject_category_id, display_name, subject_area_id]
 *           default: display_name
 *         description: Sắp xếp theo trường nào
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Hướng sắp xếp (asc hoặc desc)
 *     responses:
 *       200:
 *         description: Lấy danh sách subject category thành công
 *       400:
 *         description: Tham số phân trang không hợp lệ
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/", validatePagination, getSubjectCategories);

/**
 * @swagger
 * /api/v1/subject-categories/{id}:
 *   get:
 *     summary: Lấy chi tiết một Subject Category theo ID
 *     description: Trả về thông tin chi tiết của một Subject Category chưa bị xóa mềm, có kèm thông tin Subject Area cha.
 *     tags:
 *       - Subject Category
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Category cần lấy chi tiết
 *     responses:
 *       200:
 *         description: Lấy chi tiết subject category thành công
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Subject Category không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/:id", validateSubjectCategoryId, getSubjectCategoryById);

/**
 * @swagger
 * /api/v1/subject-categories/{id}:
 *   put:
 *     summary: Cập nhật thông tin một Subject Category theo ID
 *     description: Cập nhật display_name, description hoặc subject_area_id của một Subject Category. Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Category cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject_area_id:
 *                 type: string
 *                 example: "1"
 *                 description: ID của Subject Area cha mới
 *               display_name:
 *                 type: string
 *                 example: "Machine Learning"
 *                 description: Tên hiển thị mới
 *               description:
 *                 type: string
 *                 example: "Updated sub-field description"
 *                 description: Mô tả mới
 *     responses:
 *       200:
 *         description: Cập nhật Subject Category thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc gây trùng lặp với bản ghi khác trong cùng Subject Area
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Subject Category không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.put(
  "/:id",
  requireAuth,
  validateSubjectCategoryId,
  validateUpdateSubjectCategory,
  updateSubjectCategory
);

/**
 * @swagger
 * /api/v1/subject-categories/{id}:
 *   delete:
 *     summary: Xóa mềm một Subject Category theo ID
 *     description: Đánh dấu Subject Category là đã bị xóa mềm bằng cách đặt `is_deleted = true`. Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Category cần xóa
 *     responses:
 *       200:
 *         description: Xóa Subject Category thành công
 *       400:
 *         description: Subject Category đã bị xóa từ trước hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Subject Category không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete("/:id", requireAuth, validateSubjectCategoryId, deleteSubjectCategory);

/**
 * @swagger
 * /api/v1/subject-categories/{id}/restore:
 *   patch:
 *     summary: Khôi phục Subject Category đã xóa mềm theo ID
 *     description: Khôi phục một Subject Category bằng cách đặt `is_deleted = false`. Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Category cần khôi phục
 *     responses:
 *       200:
 *         description: Khôi phục Subject Category thành công
 *       400:
 *         description: Subject Category chưa bị xóa mềm hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Subject Category không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch("/:id/restore", requireAuth, validateSubjectCategoryId, restoreSubjectCategory);

/**
 * @swagger
 * /api/v1/subject-categories/{id}/statistics:
 *   get:
 *     summary: Thống kê số lượng journal, article, author theo Subject Category
 *     description: Tính toán và trả về tổng số Journal, Article, Author đang hoạt động liên quan trực tiếp tới Subject Category.
 *     tags:
 *       - Subject Category
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Category cần lấy thống kê
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
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
 *                   example: "Lấy thống kê subject category thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     subject_category_id:
 *                       type: string
 *                       example: "1"
 *                     display_name:
 *                       type: string
 *                       example: "Artificial Intelligence"
 *                     total_journals:
 *                       type: integer
 *                       example: 45
 *                     total_articles:
 *                       type: integer
 *                       example: 12500
 *                     total_authors:
 *                       type: integer
 *                       example: 3200
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Subject Category không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/:id/statistics", validateSubjectCategoryId, getSubjectCategoryStatistics);

export default router;
