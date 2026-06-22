import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getCountryStats,
  getRegionStats,
  getCountryRegionsStats,
} from "../controllers/zone.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/zones/countries/stats:
 *   get:
 *     summary: Lấy danh sách thống kê sản lượng bài viết theo quốc gia
 *     description: Trả về danh sách các quốc gia cùng tổng số lượng bài báo khoa học được xuất bản, hỗ trợ phân trang.
 *     tags:
 *       - Zone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Trang hiện tại cần truy vấn
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Số lượng quốc gia hiển thị trên mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
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
 *                   example: "Lấy danh sách thống kê quốc gia thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       zone_id:
 *                         type: string
 *                         example: "3"
 *                       code:
 *                         type: string
 *                         example: "US"
 *                       name:
 *                         type: string
 *                         example: "United States"
 *                       iso_code:
 *                         type: string
 *                         example: "USA"
 *                       article_count:
 *                         type: integer
 *                         example: 1250
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 139
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 14
 *       400:
 *         description: Tham số đầu vào không hợp lệ
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/countries/stats", getCountryStats);

/**
 * @swagger
 * /api/v1/zones/regions/stats:
 *   get:
 *     summary: Lấy thống kê sản lượng bài viết theo phân vùng (Region) toàn cầu hoặc theo quốc gia
 *     description: Trả về danh sách các phân vùng (Vùng địa lý lớn như Western Europe, Latin America...) kèm theo tổng số bài báo. Hỗ trợ lọc theo mã quốc gia thông qua Query Parameter.
 *     tags:
 *       - Zone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: country_code
 *         schema:
 *           type: string
 *         description: Mã quốc gia (ví dụ US, VN) để lọc phân vùng
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thống kê thành công
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
 *                   example: "Lấy danh sách phân vùng toàn cầu thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       zone_id:
 *                         type: string
 *                         example: "2"
 *                       code:
 *                         type: string
 *                         example: "WE"
 *                       name:
 *                         type: string
 *                         example: "Western Europe"
 *                       iso_code:
 *                         type: string
 *                         example: "WEU"
 *                       article_count:
 *                         type: integer
 *                         example: 840
 *       404:
 *         description: Không tìm thấy quốc gia với mã đã cho
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/regions/stats", getRegionStats);

/**
 * @swagger
 * /api/v1/zones/countries/{code}/regions/stats:
 *   get:
 *     summary: Lấy thống kê sản lượng bài viết của các phân vùng nội bộ (Region) thuộc một quốc gia cụ thể
 *     description: Lấy danh sách các phân vùng lớn liên kết với tạp chí của quốc gia dựa trên mã quốc gia (ví dụ US, VN) trên URL.
 *     tags:
 *       - Zone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Mã quốc gia cần tra cứu (ví dụ US, VN...)
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công
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
 *                   example: "Lấy thống kê region theo quốc gia thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     country:
 *                       type: object
 *                       properties:
 *                         zone_id:
 *                           type: string
 *                           example: "89"
 *                         code:
 *                           type: string
 *                           example: "VN"
 *                         iso_code:
 *                           type: string
 *                           example: "VNM"
 *                         name:
 *                           type: string
 *                           example: "Vietnam"
 *                     regions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           zone_id:
 *                             type: string
 *                             example: "10"
 *                           code:
 *                             type: string
 *                             example: "HCM"
 *                           name:
 *                             type: string
 *                             example: "Ho Chi Minh City"
 *                           iso_code:
 *                             type: string
 *                             example: ""
 *                           article_count:
 *                             type: integer
 *                             example: 120
 *       400:
 *         description: Mã quốc gia không hợp lệ hoặc để trống
 *       404:
 *         description: Mã quốc gia không tồn tại trong hệ thống
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/countries/:code/regions/stats", getCountryRegionsStats);

export default router;
