import express from "express";
import { getTopJournals } from "../controllers/trendingVn.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/trending-vn/top-journals:
 *   get:
 *     summary: Lấy Top Journals VN theo trích dẫn trong 2 năm gần nhất
 *     description: |
 *       Xếp hạng journal dựa trên các bài báo trong N năm xuất bản gần nhất,
 *       mặc định là 2 năm. Thứ hạng được sắp xếp theo tổng số trích dẫn
 *       của các bài báo thuộc journal trong khoảng thời gian đó.
 *       API cũng trả về keyword/topic xuất hiện nhiều nhất trong cùng tập bài báo.
 *     tags:
 *       - Trending VN
 *     parameters:
 *       - in: query
 *         name: years
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 2
 *         description: Số năm xuất bản gần nhất cần lấy, tính từ năm publication_year lớn nhất trong DB
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Số lượng journal tối đa trả về
 *     responses:
 *       200:
 *         description: Lấy Top Journals VN thành công
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
 *                   example: TRENDING_VN_TOP_JOURNALS_SUCCESS
 *                 message:
 *                   type: string
 *                   example: Lấy danh sách top journal VN thành công!
 *                 data:
 *                   type: object
 *                   properties:
 *                     window:
 *                       type: object
 *                       properties:
 *                         from_year:
 *                           type: integer
 *                           nullable: true
 *                           example: 2025
 *                         to_year:
 *                           type: integer
 *                           nullable: true
 *                           example: 2026
 *                         years:
 *                           type: integer
 *                           example: 2
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rank:
 *                             type: integer
 *                             example: 1
 *                           journal_id:
 *                             type: string
 *                             example: "2"
 *                           journal_name:
 *                             type: string
 *                             example: Acta Mathematica Vietnamica
 *                           issn:
 *                             type: string
 *                             nullable: true
 *                             example: 2315-4144, 0251-4184
 *                           journal_type:
 *                             type: string
 *                             nullable: true
 *                             example: journal
 *                           journal_is_open_access:
 *                             type: boolean
 *                             nullable: true
 *                             example: true
 *                           publisher_name:
 *                             type: string
 *                             nullable: true
 *                             example: Springer Science and Business Media LLC
 *                           recent_articles_count:
 *                             type: integer
 *                             example: 18
 *                           total_recent_citations:
 *                             type: integer
 *                             example: 2
 *                           avg_recent_citations:
 *                             type: number
 *                             format: float
 *                             example: 0.11
 *                           latest_publication_year:
 *                             type: integer
 *                             example: 2026
 *                           earliest_publication_year:
 *                             type: integer
 *                             example: 2025
 *                           open_access_articles_count:
 *                             type: integer
 *                             example: 18
 *                           top_keywords:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 keyword_id:
 *                                   type: string
 *                                   example: "101"
 *                                 display_name:
 *                                   type: string
 *                                   example: Fixed Point Theory
 *                                 count:
 *                                   type: integer
 *                                   example: 5
 *                           top_topics:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 topic_id:
 *                                   type: string
 *                                   example: "8"
 *                                 display_name:
 *                                   type: string
 *                                   example: Mathematics
 *                                 count:
 *                                   type: integer
 *                                   example: 12
 *       500:
 *         description: Lỗi hệ thống khi lấy Top Journals VN
 */
router.get("/top-journals", getTopJournals);

export default router;
