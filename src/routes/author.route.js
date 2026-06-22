import express from "express";
import {
  createAuthorController,
  deleteAuthorController,
  getAllAuthorsController,
  getAuthorAreasBreakdown,
  getAuthorArticles,
  getAuthorByIdController,
  getAuthorLeaderboard,
  restoreAuthorController,
  updateAuthorController,
} from "../controllers/author.controller.js";
import { requireAuth, verifyToken } from "../middlewares/auth.middleware.js";
import {
  validateAuthorId,
  validateCreateAuthor,
  validatePagination,
  validateUpdateAuthor,
} from "../middlewares/author.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/author/{id}/areas-breakdown:
 *   get:
 *     summary: Lấy phân tích lĩnh vực nghiên cứu của tác giả theo ID
 *     tags:
 *       - Author
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của tác giả
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Phân tích lĩnh vực nghiên cứu của tác giả thành công"
 *                 data:
 *                   type: object
 *                   required:
 *                     - author_id
 *                     - orcid
 *                     - display_name
 *                     - openalex_id
 *                     - works_count
 *                     - cited_by_count
 *                     - h_index
 *                     - i10_index
 *                     - last_known_institution
 *                     - last_known_institution_id
 *                     - openalex_synced_at
 *                     - breakdown
 *                   properties:
 *                     author_id:
 *                       type: string
 *                       example: "321"
 *                     orcid:
 *                       type: string
 *                       example: "https://orcid.org/0000-0002-1824-2337"
 *                     display_name:
 *                       type: string
 *                       example: "Jason R. Westin"
 *                     url_image:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     openalex_id:
 *                       type: string
 *                       example: "https://openalex.org/A5021496101"
 *                     works_count:
 *                       type: integer
 *                       example: 655
 *                     cited_by_count:
 *                       type: integer
 *                       example: 29763
 *                     h_index:
 *                       type: integer
 *                       example: 57
 *                     i10_index:
 *                       type: integer
 *                       example: 195
 *                     last_known_institution:
 *                       type: string
 *                       example: "The University of Texas MD Anderson Cancer Center"
 *                     last_known_institution_id:
 *                       type: string
 *                       example: "https://openalex.org/I1343551460"
 *                     homepage_url:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     openalex_synced_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-05-27T11:19:56.643Z"
 *                     breakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - subject_category_id
 *                           - category_name
 *                           - article_count
 *                           - percentage
 *                         properties:
 *                           subject_category_id:
 *                             type: string
 *                             example: "2"
 *                           category_name:
 *                             type: string
 *                             example: "Oncology"
 *                           article_count:
 *                             type: string
 *                             example: "1"
 *                           percentage:
 *                             type: number
 *                             format: float
 *                             example: 100
 *       400:
 *         description: ID tác giả không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi hệ thống server
 */
router.get("/:id/areas-breakdown", validateAuthorId, getAuthorAreasBreakdown);

/**
 * @swagger
 * /api/v1/author/{id}/articles:
 *   get:
 *     summary: Lấy danh sách bài viết của tác giả theo ID
 *     tags:
 *       - Author
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của tác giả
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 10
 *         description: Số lượng bài viết tối đa trên một trang (0 hoặc không cung cấp sử dụng giá trị mặc định 10)
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Trang thứ mấy (bắt đầu từ 1)
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - pagination
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy bài viết của tác giả thành công"
 *                 pagination:
 *                   type: object
 *                   required:
 *                     - page
 *                     - limit
 *                     - total
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required:
 *                       - article_id
 *                       - title
 *                       - abstract
 *                       - publication_year
 *                       - doi
 *                       - primary_topic
 *                       - created_at
 *                     properties:
 *                       article_id:
 *                         type: string
 *                         example: "123"
 *                       title:
 *                         type: string
 *                         example: "Advances in Cancer Immunotherapy"
 *                       abstract:
 *                         type: string
 *                         example: "This study explores novel approaches to cancer immunotherapy..."
 *                       publication_year:
 *                         type: integer
 *                         example: 2025
 *                       doi:
 *                         type: string
 *                         example: "10.1038/s41591-025-02134-z"
 *                       primary_topic:
 *                         type: string
 *                         nullable: true
 *                         example: "Oncology"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-05-27T11:19:56.643Z"
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ (ID tác giả, limit, hoặc page không hợp lệ)
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi hệ thống server
 */
router.get("/:id/articles", validateAuthorId, getAuthorArticles);

/**
 * @swagger
 * /api/v1/author/leaderboard:
 *   get:
 *     summary: Lấy bảng xếp hạng tác giả
 *     tags:
 *       - Author
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 10
 *         description: Số lượng tác giả tối đa trên mỗi trang
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Trang thứ mấy
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy bảng xếp hạng tác giả thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       author_id:
 *                         type: integer
 *                         example: 123
 *                       orcid:
 *                         type: string
 *                         example: "https://orcid.org/0000-0002-1824-2337"
 *                       display_name:
 *                         type: string
 *                         example: "Jason R. Westin"
 *                       url_image:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       works_count:
 *                         type: integer
 *                         example: 655
 *                       cited_by_count:
 *                         type: integer
 *                         example: 29763
 *                       h_index:
 *                         type: integer
 *                         example: 57
 *                       i10_index:
 *                         type: integer
 *                         example: 195
 *                       final_rank:
 *                         type: integer
 *                         example: 1
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi hệ thống server
 */
router.get("/leaderboard", getAuthorLeaderboard);



/**
 * @swagger
 * /api/v1/author:
 *   get:
 *     summary: Lấy danh sách tác giả
 *     tags:
 *       - Author
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
 *         description: Số lượng mỗi trang (tối đa 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm theo display_name hoặc last_known_institution
 *     responses:
 *       200:
 *         description: Lấy danh sách tác giả thành công
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
 *                   example: AUTHOR_LIST_FETCHED
 *                 message:
 *                   type: string
 *                   example: Lấy danh sách tác giả thành công
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     total_pages:
 *                       type: integer
 *                       example: 10
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.get("/", validatePagination, getAllAuthorsController);

/**
 * @swagger
 * /api/v1/author:
 *   post:
 *     summary: Tạo mới tác giả
 *     tags:
 *       - Author
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
 *                 example: Nguyen Van A
 *               orcid:
 *                 type: string
 *                 example: https://orcid.org/0000-0000-0000-0001
 *               url_image:
 *                 type: string
 *                 example: https://example.com/image.jpg
 *               homepage_url:
 *                 type: string
 *                 example: https://example.com
 *               works_count:
 *                 type: integer
 *                 example: 10
 *               cited_by_count:
 *                 type: integer
 *                 example: 100
 *               h_index:
 *                 type: integer
 *                 example: 5
 *               i10_index:
 *                 type: integer
 *                 example: 3
 *               last_known_institution:
 *                 type: string
 *                 example: Hanoi University
 *               last_known_institution_id:
 *                 type: string
 *                 example: https://openalex.org/I123
 *     responses:
 *       201:
 *         description: Tạo tác giả thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.post("/", requireAuth, validateCreateAuthor, createAuthorController);

/**
 * @swagger
 * /api/v1/author/{id}/restore:
 *   patch:
 *     summary: Khôi phục tác giả đã bị xóa mềm
 *     tags:
 *       - Author
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của tác giả
 *     responses:
 *       200:
 *         description: Khôi phục thành công
 *       400:
 *         description: ID không hợp lệ hoặc tác giả đang active
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Tác giả không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.patch(
  "/:id/restore",
  requireAuth,
  validateAuthorId,
  restoreAuthorController,
);

/**
 * @swagger
 * /api/v1/author/{id}:
 *   get:
 *     summary: Lấy thông tin tác giả theo ID
 *     tags:
 *       - Author
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của tác giả
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Tác giả không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get("/:id", validateAuthorId, getAuthorByIdController);

/**
 * @swagger
 * /api/v1/author/{id}:
 *   put:
 *     summary: Cập nhật thông tin tác giả
 *     tags:
 *       - Author
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của tác giả
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *               orcid:
 *                 type: string
 *               works_count:
 *                 type: integer
 *               cited_by_count:
 *                 type: integer
 *               h_index:
 *                 type: integer
 *               i10_index:
 *                 type: integer
 *               last_known_institution:
 *                 type: string
 *               last_known_institution_id:
 *                 type: string
 *               homepage_url:
 *                 type: string
 *               url_image:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Tác giả không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.put(
  "/:id",
  requireAuth,
  validateAuthorId,
  validateUpdateAuthor,
  updateAuthorController,
);

/**
 * @swagger
 * /api/v1/author/{id}:
 *   delete:
 *     summary: Xóa mềm tác giả
 *     tags:
 *       - Author
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID của tác giả
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       400:
 *         description: ID không hợp lệ hoặc đã bị xóa trước đó
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Tác giả không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.delete("/:id", requireAuth, validateAuthorId, deleteAuthorController);

export default router;
