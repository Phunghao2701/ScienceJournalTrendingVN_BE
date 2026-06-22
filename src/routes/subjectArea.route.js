import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createSubjectArea,
  getSubjectAreas,
  getSubjectAreaById,
  updateSubjectArea,
  deleteSubjectArea,
  restoreSubjectArea,
  getSubjectAreaStatistics
} from "../controllers/subjectArea.controller.js";
import {
  validateSubjectAreaId,
  validateCreateSubjectArea,
  validateUpdateSubjectArea,
  validatePagination
} from "../middlewares/subjectAreaValidation.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/subject-areas:
 *   post:
 *     summary: Tạo mới một Subject Area
 *     description: Tạo mới một lĩnh vực học thuật (Subject Area). Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Area
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
 *                 example: "Computer Science"
 *                 description: Tên hiển thị duy nhất của lĩnh vực
 *               description:
 *                 type: string
 *                 example: "All related fields in computing and information systems"
 *                 description: Mô tả chi tiết lĩnh vực
 *     responses:
 *       201:
 *         description: Tạo Subject Area thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc bị trùng lặp display_name
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi hệ thống
 */
router.post("/", requireAuth, validateCreateSubjectArea, createSubjectArea);

/**
 * @swagger
 * /api/v1/subject-areas:
 *   get:
 *     summary: Lấy danh sách Subject Area có hỗ trợ phân trang và tìm kiếm
 *     description: Trả về danh sách các Subject Area chưa bị xóa mềm trong hệ thống.
 *     tags:
 *       - Subject Area
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
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
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [subject_area_id, display_name]
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
 *         description: Lấy danh sách subject area thành công
 *       400:
 *         description: Tham số phân trang không hợp lệ
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/", validatePagination, getSubjectAreas);

/**
 * @swagger
 * /api/v1/subject-areas/{id}:
 *   get:
 *     summary: Lấy chi tiết một Subject Area theo ID
 *     description: Trả về thông tin chi tiết của một Subject Area chưa bị xóa mềm.
 *     tags:
 *       - Subject Area
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Area cần lấy chi tiết
 *     responses:
 *       200:
 *         description: Lấy chi tiết subject area thành công
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Subject Area không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/:id", validateSubjectAreaId, getSubjectAreaById);

/**
 * @swagger
 * /api/v1/subject-areas/{id}:
 *   put:
 *     summary: Cập nhật thông tin một Subject Area theo ID
 *     description: Cập nhật display_name hoặc description của một Subject Area. Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Area
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Area cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *                 example: "Computer Science and Engineering"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *     responses:
 *       200:
 *         description: Cập nhật Subject Area thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc gây trùng lặp với bản ghi khác
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Subject Area không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.put(
  "/:id",
  requireAuth,
  validateSubjectAreaId,
  validateUpdateSubjectArea,
  updateSubjectArea
);

/**
 * @swagger
 * /api/v1/subject-areas/{id}:
 *   delete:
 *     summary: Xóa mềm một Subject Area theo ID
 *     description: Đánh dấu Subject Area là đã bị xóa mềm bằng cách đặt `is_deleted = true`. Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Area
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Area cần xóa
 *     responses:
 *       200:
 *         description: Xóa Subject Area thành công
 *       400:
 *         description: Subject Area đã bị xóa từ trước hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Subject Area không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete("/:id", requireAuth, validateSubjectAreaId, deleteSubjectArea);

/**
 * @swagger
 * /api/v1/subject-areas/{id}/restore:
 *   patch:
 *     summary: Khôi phục Subject Area đã xóa mềm theo ID
 *     description: Khôi phục một Subject Area bằng cách đặt `is_deleted = false`. Yêu cầu đăng nhập.
 *     tags:
 *       - Subject Area
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Area cần khôi phục
 *     responses:
 *       200:
 *         description: Khôi phục Subject Area thành công
 *       400:
 *         description: Subject Area chưa bị xóa mềm hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Subject Area không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch("/:id/restore", requireAuth, validateSubjectAreaId, restoreSubjectArea);

/**
 * @swagger
 * /api/v1/subject-areas/{id}/statistics:
 *   get:
 *     summary: Thống kê số lượng journal, article, author theo Subject Area
 *     description: Tính toán và trả về tổng số Journal, Article, Author đang hoạt động liên quan tới Subject Area.
 *     tags:
 *       - Subject Area
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Subject Area cần lấy thống kê
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
 *                   example: "Lấy thống kê subject area thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     subject_area_id:
 *                       type: string
 *                       example: "1"
 *                     display_name:
 *                       type: string
 *                       example: "Medicine"
 *                     total_journals:
 *                       type: integer
 *                       example: 15
 *                     total_articles:
 *                       type: integer
 *                       example: 120
 *                     total_authors:
 *                       type: integer
 *                       example: 45
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Subject Area không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/:id/statistics", validateSubjectAreaId, getSubjectAreaStatistics);

export default router;
