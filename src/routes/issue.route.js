import express from 'express';
import { requireAuth, verifyToken } from '../middlewares/auth.middleware.js';
import { getIssues, getIssueById, createIssue, updateIssue, deleteIssue, restoreIssue } from '../controllers/issue.controller.js';
import { validateIssueId, validateCreateIssue, validateUpdateIssue } from '../middlewares/issueValidation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/issues:
 *   get:
 *     summary: Lấy danh sách các số báo (Issue)
 *     description: Trả về danh sách các số báo, hỗ trợ lọc theo Volume hoặc lọc nhanh toàn bộ Issue của một Journal.
 *     tags:
 *       - Issue
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng kết quả trên mỗi trang.
 *       - in: query
 *         name: volume_id
 *         schema:
 *           type: integer
 *         description: Lọc các Issue thuộc về một Volume cụ thể.
 *       - in: query
 *         name: journal_id
 *         schema:
 *           type: integer
 *         description: Lọc nhanh toàn bộ Issue của một Tạp chí (không cần qua Volume).
 *     responses:
 *       200:
 *         description: Lấy danh sách Issue thành công.
 *       500:
 *         description: Lỗi hệ thống.
 */
router.get('/', getIssues);

/**
 * @swagger
 * /api/v1/issues:
 *   post:
 *     summary: Tạo mới một Issue
 *     description: Tạo mới một số báo (Issue) thuộc một Volume cụ thể. Yêu cầu đăng nhập.
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
 *                 example: "12"
 *                 description: ID của Volume liên kết
 *               issue_number:
 *                 type: integer
 *                 example: 1
 *                 description: Số báo
 *               publication_year:
 *                 type: integer
 *                 example: 2025
 *                 description: Năm xuất bản
 *     responses:
 *       201:
 *         description: Tạo Issue thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc bị trùng lặp
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/', verifyToken, validateCreateIssue, createIssue);

/**
 * @swagger
 * /api/v1/issues/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một Issue theo ID
 *     description: Trả về thông tin chi tiết của một Issue. Yêu cầu đăng nhập.
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
 *         description: Lấy chi tiết Issue thành công
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Issue không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/:id', verifyToken, validateIssueId, getIssueById);

/**
 * @swagger
 * /api/v1/issues/{id}:
 *   put:
 *     summary: Cập nhật thông tin Issue theo ID
 *     description: Cập nhật thông tin issue_number hoặc publication_year. Yêu cầu đăng nhập.
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
 *                 example: 2
 *               publication_year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: Cập nhật Issue thành công
 *       400:
 *         description: Dữ liệu cập nhật không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Issue không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/:id', verifyToken, validateIssueId, validateUpdateIssue, updateIssue);

/**
 * @swagger
 * /api/v1/issues/{id}:
 *   delete:
 *     summary: Xóa mềm một Issue theo ID
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
 *     responses:
 *       200:
 *         description: Xóa Issue thành công
 *       400:
 *         description: Issue đã bị xóa từ trước
 */
router.delete('/:id', verifyToken, validateIssueId, deleteIssue);

/**
 * @swagger
 * /api/v1/issues/{id}/restore:
 *   patch:
 *     summary: Khôi phục Issue đã xóa mềm theo ID
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
 *     responses:
 *       200:
 *         description: Khôi phục Issue thành công
 */
router.patch('/:id/restore', verifyToken, validateIssueId, restoreIssue);

export default router;