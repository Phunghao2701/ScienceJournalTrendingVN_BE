import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createIssue,
  getIssues,
  getIssueById,
  updateIssue,
  deleteIssue,
  restoreIssue
} from "../controllers/issue.controller.js";
import {
  validateIssueId,
  validateCreateIssue,
  validateUpdateIssue,
  validatePagination,
  validateVolumeFilter
} from "../middlewares/issueValidation.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/issues:
 *   post:
 *     summary: Tạo mới một Issue
 *     description: Tạo mới một số phát hành (Issue) thuộc một Volume. Yêu cầu đăng nhập.
 *     tags:
 *       - Issue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - volume_id
 *               - issue_number
 *               - publication_year
 *             properties:
 *               volume_id:
 *                 type: string
 *                 example: "1"
 *                 description: ID của Volume liên kết
 *               issue_number:
 *                 type: integer
 *                 example: 3
 *                 description: Số issue (phải lớn hơn 0)
 *               publication_year:
 *                 type: integer
 *                 example: 2025
 *                 description: Năm xuất bản
 *     responses:
 *       201:
 *         description: Tạo Issue thành công
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
 *                   example: "ISSUE_CREATED"
 *                 message:
 *                   type: string
 *                   example: "Tạo Issue thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     issue_id:
 *                       type: string
 *                       example: "10"
 *                     volume_id:
 *                       type: string
 *                       example: "1"
 *                     issue_number:
 *                       type: integer
 *                       example: 3
 *                     publication_year:
 *                       type: integer
 *                       example: 2025
 *                     is_deleted:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc bị trùng lặp
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi hệ thống
 */
router.post("/", requireAuth, validateCreateIssue, createIssue);

/**
 * @swagger
 * /api/v1/issues:
 *   get:
 *     summary: Lấy danh sách Issue có hỗ trợ phân trang, tìm kiếm và lọc
 *     description: Trả về danh sách các Issue chưa bị xóa mềm trong hệ thống. Yêu cầu đăng nhập.
 *     tags:
 *       - Issue
 *     security:
 *       - bearerAuth: []
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
 *         name: volume_id
 *         schema:
 *           type: string
 *         description: Lọc theo ID của Volume
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo số issue
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [issue_id, issue_number, publication_year]
 *           default: issue_number
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
 *         description: Lấy danh sách Issue thành công
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
 *                   example: "ISSUES_FETCHED"
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách issue thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           issue_id:
 *                             type: string
 *                             example: "1"
 *                           volume_id:
 *                             type: string
 *                             example: "1"
 *                           issue_number:
 *                             type: integer
 *                             example: 3
 *                           publication_year:
 *                             type: integer
 *                             example: 2025
 *                           is_deleted:
 *                             type: boolean
 *                             example: false
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         total:
 *                           type: integer
 *                           example: 100
 *       400:
 *         description: Tham số phân trang hoặc volume_id không hợp lệ (ví dụ chứa chữ)
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: volume_id được dùng để lọc không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/", requireAuth, validatePagination, validateVolumeFilter, getIssues);

/**
 * @swagger
 * /api/v1/issues/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một Issue theo ID
 *     description: Trả về thông tin chi tiết của một Issue kèm thông tin Volume và Journal liên quan. Yêu cầu đăng nhập.
 *     tags:
 *       - Issue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Issue cần lấy
 *     responses:
 *       200:
 *         description: Lấy chi tiết issue thành công
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Issue không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/:id", requireAuth, validateIssueId, getIssueById);

/**
 * @swagger
 * /api/v1/issues/{id}:
 *   put:
 *     summary: Cập nhật thông tin Issue theo ID
 *     description: Cập nhật thông tin issue_number hoặc publication_year của một Issue. Yêu cầu đăng nhập.
 *     tags:
 *       - Issue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Issue cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               issue_number:
 *                 type: integer
 *                 example: 5
 *               publication_year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: Cập nhật Issue thành công
 *       400:
 *         description: Dữ liệu cập nhật không hợp lệ hoặc gây trùng lặp
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Issue không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.put("/:id", requireAuth, validateIssueId, validateUpdateIssue, updateIssue);

/**
 * @swagger
 * /api/v1/issues/{id}:
 *   delete:
 *     summary: Xóa mềm một Issue theo ID
 *     description: Đánh dấu Issue là đã bị xóa mềm bằng cách đặt `is_deleted = true`. Yêu cầu đăng nhập.
 *     tags:
 *       - Issue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Issue cần xóa
 *     responses:
 *       200:
 *         description: Xóa Issue thành công
 *       400:
 *         description: Issue đã bị xóa từ trước hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Issue không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete("/:id", requireAuth, validateIssueId, deleteIssue);

/**
 * @swagger
 * /api/v1/issues/{id}/restore:
 *   patch:
 *     summary: Khôi phục Issue đã xóa mềm theo ID
 *     description: Khôi phục một Issue bằng cách đặt `is_deleted = false`. Yêu cầu đăng nhập.
 *     tags:
 *       - Issue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Issue cần khôi phục
 *     responses:
 *       200:
 *         description: Khôi phục Issue thành công
 *       400:
 *         description: Issue chưa bị xóa mềm hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Issue không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch("/:id/restore", requireAuth, validateIssueId, restoreIssue);

export default router;
