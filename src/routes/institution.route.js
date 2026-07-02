import express from "express";
import { getInstitutions } from "../controllers/institution.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/institution:
 *   get:
 *     summary: Lấy danh sách cơ sở giáo dục Việt Nam (Institution)
 *     description: >
 *       Trả về các Institution có country_code='VN' và type='education'
 *       (đúng scope=vn_universities dùng cho Article), hỗ trợ tìm kiếm theo display_name.
 *     tags:
 *       - Institution
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
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm theo display_name
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       500:
 *         description: Lỗi hệ thống
 */
router.get("/", getInstitutions);

export default router;
