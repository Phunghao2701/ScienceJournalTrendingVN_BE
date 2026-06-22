import express from 'express';
import {
    getTopics,
    getTopicById,
    createTopic,
    getArticlesByTopic,
    updateTopic,
    deleteTopic,
    restoreTopic
} from '../controllers/topic.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateTopicId } from '../middlewares/topicValidation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Topic
 *   description: API Quản lý Chủ đề bài báo (Topics)
 */

/**
 * @swagger
 * /api/v1/topics:
 *   get:
 *     summary: Lấy danh sách Topic
 *     tags: [Topic]
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
 *         description: Số lượng bản ghi trên một trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo display_name
 *       - in: query
 *         name: subject_area_id
 *         schema:
 *           type: integer
 *         description: Lọc theo Subject Area ID
 *       - in: query
 *         name: subject_category_id
 *         schema:
 *           type: integer
 *         description: Lọc theo Subject Category ID
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           default: "display_name"
 *         description: Sắp xếp theo trường nào (topic_id, display_name, score)
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: "asc"
 *         description: Hướng sắp xếp
 *     responses:
 *       200:
 *         description: Thành công
 *       500:
 *         description: Lỗi Server
 */
router.get('/', getTopics);

/**
 * @swagger
 * /api/v1/topics/{id}:
 *   get:
 *     summary: Lấy chi tiết Topic
 *     tags: [Topic]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của Topic
 *     responses:
 *       200:
 *         description: Thành công
 *       404:
 *         description: Không tìm thấy Topic
 *       500:
 *         description: Lỗi Server
 */
router.get('/:id', validateTopicId, getTopicById);

/**
 * @swagger
 * /api/v1/topics/{id}/articles:
 *   get:
 *     summary: Lấy danh sách bài báo thuộc Topic
 *     description: Lấy danh sách các bài báo được gắn với Topic này (bao gồm cả primary topic và sub topic).
 *     tags: [Topic]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của Topic
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
 *         description: Số lượng bài báo trên một trang
 *     responses:
 *       200:
 *         description: Thành công
 *       404:
 *         description: Không tìm thấy Topic
 *       500:
 *         description: Lỗi Server
 */
router.get('/:id/articles', validateTopicId, getArticlesByTopic);

/**
 * @swagger
 * /api/v1/topics:
 *   post:
 *     summary: Tạo mới Topic
 *     tags: [Topic]
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
 *                 example: "Quantum Physics"
 *               score:
 *                 type: number
 *                 example: 0.95
 *               subject_area_id:
 *                 type: integer
 *                 example: 1
 *               subject_category_id:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: Tạo mới thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       409:
 *         description: Tên Topic bị trùng lặp
 *       500:
 *         description: Lỗi Server
 */
router.post('/', requireAuth, createTopic);

/**
 * @swagger
 * /api/v1/topics/{id}:
 *   put:
 *     summary: Cập nhật thông tin Topic
 *     description: Cập nhật tên hoặc mô tả của Topic dựa theo ID. Topic đã xóa mềm sẽ không thể cập nhật. Yêu cầu đăng nhập.
 *     tags:
 *       - Topic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Topic cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *                 example: "Machine Learning Concepts"
 *               score:
 *                 type: number
 *                 example: 0.95
 *               subject_area_id:
 *                 type: integer
 *                 example: 1
 *               subject_category_id:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Cập nhật Topic thành công
 *       400:
 *         description: Dữ liệu gửi lên không hợp lệ, hoặc Topic đã bị xóa
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Topic không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/:id', requireAuth, validateTopicId, updateTopic);

/**
 * @swagger
 * /api/v1/topics/{id}:
 *   delete:
 *     summary: Xóa mềm một Topic theo ID
 *     description: Đánh dấu Topic là đã bị xóa mềm bằng cách đặt `is_deleted = true`. Yêu cầu đăng nhập.
 *     tags:
 *       - Topic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Topic cần xóa
 *     responses:
 *       200:
 *         description: Xóa Topic thành công
 *       400:
 *         description: Topic đã bị xóa từ trước hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Topic không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/:id', requireAuth, validateTopicId, deleteTopic);

/**
 * @swagger
 * /api/v1/topics/{id}/restore:
 *   patch:
 *     summary: Khôi phục Topic đã xóa mềm theo ID
 *     description: Khôi phục một Topic bằng cách đặt `is_deleted = false`. Yêu cầu đăng nhập.
 *     tags:
 *       - Topic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Topic cần khôi phục
 *     responses:
 *       200:
 *         description: Khôi phục Topic thành công
 *       400:
 *         description: Topic chưa bị xóa mềm hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Topic không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch('/:id/restore', requireAuth, validateTopicId, restoreTopic);

export default router;
