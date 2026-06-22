import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createVolume,
  getVolumes,
  getVolumeById,
  updateVolume,
  deleteVolume,
  restoreVolume
} from "../controllers/volume.controller.js";
import {
  validateVolumeId,
  validateCreateVolume,
  validateUpdateVolume
} from "../middlewares/volumeValidation.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/volumes:
 *   post:
 *     summary: Tạo mới một Volume
 *     description: Tạo mới một số tập (Volume) thuộc một tạp chí. Yêu cầu đăng nhập.
 *     tags:
 *       - Volume
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - journal_id
 *               - volume_number
 *               - publication_year
 *             properties:
 *               journal_id:
 *                 type: string
 *                 example: "1"
 *                 description: ID của tạp chí liên kết (Journal)
 *               volume_number:
 *                 type: integer
 *                 example: 12
 *                 description: Số volume (phải lớn hơn 0)
 *               publication_year:
 *                 type: integer
 *                 example: 2025
 *                 description: Năm xuất bản
 *     responses:
 *       201:
 *         description: Tạo Volume thành công
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
 *                   example: "Tạo Volume thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     volume_id:
 *                       type: string
 *                       example: "10"
 *                     journal_id:
 *                       type: string
 *                       example: "1"
 *                     volume_number:
 *                       type: integer
 *                       example: 12
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
router.post("/", requireAuth, validateCreateVolume, createVolume);

/**
 * @swagger
 * /api/v1/volumes:
 *   get:
 *     summary: Lấy danh sách Volume có hỗ trợ phân trang, tìm kiếm và lọc
 *     description: Trả về danh sách các Volume chưa bị xóa mềm trong hệ thống. Yêu cầu đăng nhập.
 *     tags:
 *       - Volume
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
 *         name: journal_id
 *         schema:
 *           type: string
 *         description: Lọc theo ID của Journal
 *       - in: query
 *         name: publication_year
 *         schema:
 *           type: integer
 *         description: Lọc theo năm xuất bản
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo số volume
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [volume_id, volume_number, publication_year]
 *           default: volume_number
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
 *         description: Lấy danh sách Volume thành công
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
 *                   example: "Lấy danh sách volume thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           volume_id:
 *                             type: string
 *                             example: "1"
 *                           journal_id:
 *                             type: string
 *                             example: "1"
 *                           volume_number:
 *                             type: integer
 *                             example: 227
 *                           publication_year:
 *                             type: integer
 *                             example: 1970
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
 *                           example: 13141
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/", requireAuth, getVolumes);

/**
 * @swagger
 * /api/v1/volumes/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một Volume theo ID
 *     description: Trả về thông tin chi tiết của một Volume dựa trên ID. Yêu cầu đăng nhập.
 *     tags:
 *       - Volume
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Volume cần lấy
 *     responses:
 *       200:
 *         description: Lấy chi tiết volume thành công
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Volume không tồn tại hoặc đã bị xóa mềm
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/:id", requireAuth, validateVolumeId, getVolumeById);

/**
 * @swagger
 * /api/v1/volumes/{id}:
 *   put:
 *     summary: Cập nhật thông tin Volume theo ID
 *     description: Cập nhật thông tin volume_number hoặc publication_year của một Volume. Yêu cầu đăng nhập.
 *     tags:
 *       - Volume
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Volume cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               volume_number:
 *                 type: integer
 *                 example: 15
 *               publication_year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: Cập nhật Volume thành công
 *       400:
 *         description: Dữ liệu cập nhật không hợp lệ hoặc gây trùng lặp
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Volume không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.put("/:id", requireAuth, validateVolumeId, validateUpdateVolume, updateVolume);

/**
 * @swagger
 * /api/v1/volumes/{id}:
 *   delete:
 *     summary: Xóa mềm một Volume theo ID
 *     description: Đánh dấu Volume là đã bị xóa mềm bằng cách đặt `is_deleted = true`. Yêu cầu đăng nhập.
 *     tags:
 *       - Volume
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Volume cần xóa
 *     responses:
 *       200:
 *         description: Xóa Volume thành công
 *       400:
 *         description: Volume đã bị xóa từ trước hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Volume không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete("/:id", requireAuth, validateVolumeId, deleteVolume);

/**
 * @swagger
 * /api/v1/volumes/{id}/restore:
 *   patch:
 *     summary: Khôi phục Volume đã xóa mềm theo ID
 *     description: Khôi phục một Volume bằng cách đặt `is_deleted = false`. Yêu cầu đăng nhập.
 *     tags:
 *       - Volume
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của Volume cần khôi phục
 *     responses:
 *       200:
 *         description: Khôi phục Volume thành công
 *       400:
 *         description: Volume chưa bị xóa mềm hoặc ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Volume không tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.patch("/:id/restore", requireAuth, validateVolumeId, restoreVolume);

export default router;
