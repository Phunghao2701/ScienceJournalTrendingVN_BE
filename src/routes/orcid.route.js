import express from "express";
import {
  getOrcidScanJobPublicationPage,
  getOrcidScanJobStatus,
  scanAuthorWorksByOrcid,
} from "../controllers/orcidScan.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validateOrcidScan } from "../middlewares/orcidScanValidation.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/orcid/scan:
 *   post:
 *     summary: Tạo job tìm và lưu tối đa 100 bài báo tạp chí theo ORCID
 *     tags: [ORCID]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orcid]
 *             properties:
 *               orcid:
 *                 type: string
 *                 example: "0000-0002-1825-0097"
 *     responses:
 *       202:
 *         description: Job đã được tạo hoặc một job cùng ORCID đang chạy
 *       400:
 *         description: ORCID không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       409:
 *         description: User đang có một job ORCID khác
 *       503:
 *         description: Queue tạm thời không khả dụng
 */
router.post(
  "/scan",
  requireAuth,
  validateOrcidScan,
  scanAuthorWorksByOrcid,
);

/**
 * @swagger
 * /api/v1/orcid/scan/{jobId}:
 *   get:
 *     summary: Lấy trạng thái và tiến độ ORCID scan job
 *     tags: [ORCID]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Trạng thái job
 *       400:
 *         description: Job ID không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy job
 */
router.get(
  "/scan/:jobId/publications",
  requireAuth,
  getOrcidScanJobPublicationPage,
);
router.get("/scan/:jobId", requireAuth, getOrcidScanJobStatus);

export default router;
