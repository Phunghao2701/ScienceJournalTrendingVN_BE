import express from 'express';
import { keywordValidation } from '../middlewares/searchValidation.middleware.js';
import { search } from '../controllers/search.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/search/{keyword}:
 *   get:
 *     summary: Tìm kiếm theo từ khóa
 *     description: Tìm kiếm Journal, Author, Article, Keyword, Subject Area và Subject Category theo từ khóa.
 *     tags: [Search]
 *     parameters:
 *       - in: path
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *         description: Từ khóa cần tìm kiếm
 *         example: AI Technology
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số lượng kết quả tối đa trả về
 *         example: 50
 *
 *     responses:
 *       200:
 *         description: Tìm kiếm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "123"
 *                       name:
 *                         type: string
 *                         example: "Artificial Intelligence"
 *                       type:
 *                         type: string
 *                         enum:
 *                           - JOURNAL
 *                           - AUTHOR
 *                           - ARTICLE
 *                           - KEYWORD
 *                           - AREA
 *                           - CATEGORY
 *
 *       400:
 *         description: Keyword hoặc limit không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: INVALID_REQUEST
 *                 message:
 *                   type: string
 *                   example: Keyword không được để trống
 *
 *       500:
 *         description: Lỗi hệ thống trong quá trình tìm kiếm
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 message:
 *                   type: string
 *                   example: Lỗi hệ thống khi tìm kiếm
 */
router.get('/:keyword', keywordValidation, search);

export default router;