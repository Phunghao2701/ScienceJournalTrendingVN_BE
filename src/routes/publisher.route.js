import express from 'express';
import { verifyToken, verifyAdmin } from '../middlewares/auth.middleware.js';
import {
    getPublishers,
    getPublisherById,
    createPublisher,
    updatePublisher,
    deletePublisher,
    restorePublisher
} from '../controllers/publisher.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/publishers:
 *   get:
 *     summary: Lấy danh sách nhà xuất bản (Publisher)
 *     description: Lấy danh sách nhà xuất bản, hỗ trợ tìm kiếm và phân trang
 *     tags:
 *       - Publisher
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Tìm kiếm theo tên (display_name)
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/', getPublishers);

/**
 * @swagger
 * /api/v1/publishers/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết nhà xuất bản theo ID
 *     tags:
 *       - Publisher
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *       404:
 *         description: Không tìm thấy nhà xuất bản
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/:id', getPublisherById);

/**
 * @swagger
 * /api/v1/publishers:
 *   post:
 *     summary: Tạo nhà xuất bản mới (chỉ Admin)
 *     tags:
 *       - Publisher
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
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.post('/', verifyToken, verifyAdmin, createPublisher);

/**
 * @swagger
 * /api/v1/publishers/{id}:
 *   put:
 *     summary: Cập nhật thông tin nhà xuất bản (chỉ Admin)
 *     tags:
 *       - Publisher
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put('/:id', verifyToken, verifyAdmin, updatePublisher);

/**
 * @swagger
 * /api/v1/publishers/{id}:
 *   delete:
 *     summary: Xóa nhà xuất bản (chỉ Admin)
 *     tags:
 *       - Publisher
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
 *         description: Xóa thành công
 */
router.delete('/:id', verifyToken, verifyAdmin, deletePublisher);

/**
 * @swagger
 * /api/v1/publishers/{id}/restore:
 *   patch:
 *     summary: Khôi phục nhà xuất bản đã bị xóa mềm (chỉ Admin)
 *     tags:
 *       - Publisher
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
 *         description: Khôi phục thành công
 */
router.patch('/:id/restore', verifyToken, verifyAdmin, restorePublisher);

export default router;