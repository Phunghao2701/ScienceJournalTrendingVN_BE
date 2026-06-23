import express from 'express';
import { verifyAdmin, verifyToken } from '../middlewares/auth.middleware.js';
import { summary, publicationTrends, getRecentActivities, getVolumeIssueStatus, exportVolumeIssueStatusCSV, getJournalRepositorySummary } from '../controllers/admin.controller.js';
import { adminUpdateUser, getUsers, getUserDetail, createUser } from '../controllers/user.controller.js';
import { validateJournalId } from '../middlewares/journalValidation.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/admin/dashboard/summary:
 *   get:
 *     summary: Lấy số liệu thống kê tổng quan cho Admin Dashboard
 *     description: Trả về tổng số Journal, Article, User đang hoạt động và số lượng đồng bộ mới (growth) của Journal, Article trong ngày hôm nay. Yêu cầu quyền ADMINISTRATOR.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy số liệu thống kê tổng quan thành công
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
 *                   example: "GET_SUMMARY_SUCCESS"
 *                 message:
 *                   type: string
 *                   example: "Lấy số liệu thống kê tổng quan thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_journals:
 *                       type: integer
 *                     journal_growth:
 *                       type: integer
 *                     total_articles:
 *                       type: integer
 *                     article_growth:
 *                       type: integer
 *                     pending_reviews:
 *                       type: integer
 *                     active_users:
 *                       type: integer
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       403:
 *         description: Bạn không có quyền truy cập tài nguyên này (yêu cầu role ADMINISTRATOR)
 *       500:
 *         description: Lỗi hệ thống server
 */
router.get('/dashboard/summary', verifyToken, verifyAdmin, summary);

/**
 * @swagger
 * /api/v1/admin/dashboard/publication-trends:
 *   get:
 *     summary: Lấy dữ liệu biểu đồ xu hướng xuất bản
 *     description: Trả về số lượng bài báo được đồng bộ/xuất bản (manuscripts) theo từng năm, mặc định là 5 năm gần nhất.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Năm mốc kết thúc (mặc định là năm hiện tại nếu không truyền)
 *         example: 2024
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số lượng năm muốn thống kê lùi lại (mặc định là 5)
 *         example: 5
 *     responses:
 *       200:
 *         description: Lấy dữ liệu biểu đồ thành công
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
 *                   example: "GET_PUBLICATION_TRENDS_SUCCESS"
 *                 message:
 *                   type: string
 *                   example: "Lấy dữ liệu biểu đồ xu hướng xuất bản thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     target_year:
 *                       type: integer
 *                       example: 2024
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           year:
 *                             type: integer
 *                             example: 2024
 *                           manuscripts:
 *                             type: integer
 *                             example: 20
 *                           published:
 *                             type: integer
 *                             example: 12
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/dashboard/publication-trends', verifyToken, verifyAdmin, publicationTrends);

/**
 * @swagger
 * /api/v1/admin/dashboard/volume-issue-status:
 *   get:
 *     summary: Lấy danh sách trạng thái Volume & Issue cho Dashboard
 *     description: Trả về danh sách các Volume cùng với trạng thái, số lượng Issue, và tiến độ, có hỗ trợ phân trang.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng bản ghi trên mỗi trang
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
 *                 code:
 *                   type: string
 *                   example: "GET_VOLUME_ISSUE_STATUS_SUCCESS"
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách Volume & Issue Status thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                      type: object
 *                      properties:
 *                          volume_id: { type: "string" }
 *                          volume_number: { type: "integer" }
 *                          publication_year: { type: "integer" }
 *                          journal_name: { type: "string" }
 *                          total_issues: { type: "integer" }
 *                          status: { type: "string", example: "PUBLISHED" }
 *                          progress: { type: "integer", example: 50 }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                      total: { type: "integer" }
 *                      page: { type: "integer" }
 *                      limit: { type: "integer" }
 *                      totalPages: { type: "integer" }
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/dashboard/volume-issue-status', verifyToken, verifyAdmin, getVolumeIssueStatus);

/**
 * @swagger
 * /api/v1/admin/dashboard/recent-activities:
 *   get:
 *     summary: Lấy danh sách hoạt động gần đây của hệ thống
 *     description: Trả về timeline các hoạt động gần đây nhất được ghi lại trong system_log, có hỗ trợ phân trang.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng bản ghi trên mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách hoạt động thành công
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
 *                   example: "GET_RECENT_ACTIVITIES_SUCCESS"
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách hoạt động gần đây thành công"
 *                 data:
 *                   type: array
 *                   items:
 *                      type: object
 *                      properties:
 *                          log_id: { type: "integer" }
 *                          user_id: { type: "string", format: "uuid" }
 *                          user_role: { type: "string" }
 *                          action: { type: "string", example: "UPDATE" }
 *                          level: { type: "string", example: "INFO" }
 *                          source: { type: "string", example: "ADMIN_PANEL" }
 *                          entity_table: { type: "string", example: "Journal" }
 *                          entity_id: { type: "string", example: "123" }
 *                          message: { type: "string", example: "Admin admin@example.com đã cập nhật Journal có ID: 123" }
 *                          metadata: { type: "object" }
 *                          created_at: { type: "string", format: "date-time" }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                      total: { type: "integer" }
 *                      page: { type: "integer" }
 *                      limit: { type: "integer" }
 *                      totalPages: { type: "integer" }
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/dashboard/recent-activities', verifyToken, verifyAdmin, getRecentActivities);

/**
 * @swagger
 * /api/v1/admin/dashboard/volume-issue-status/export:
 *   get:
 *     summary: Export danh sách trạng thái Volume & Issue thành CSV
 *     description: Trả về file CSV chứa toàn bộ dữ liệu Volume & Issue Status.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tải file CSV thành công
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/dashboard/volume-issue-status/export', verifyToken, verifyAdmin, exportVolumeIssueStatusCSV);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   put:
 *     summary: "[ADMIN] Cập nhật toàn bộ thông tin người dùng"
 *     description: Cho phép Quản trị viên cập nhật bất kỳ thuộc tính nào của User bao gồm role, status, email và password.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: ['STUDENT', 'LECTURER', 'RESEARCHER', 'ADMINISTRATOR']
 *               status:
 *                 type: string
 *                 enum: ['INACTIVE', 'ACTIVE', 'BANNED']
 *               type:
 *                 type: string
 *                 enum: ['LOCAL', 'GOOGLE', 'GITHUB']
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: boolean
 *               url_image:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin cập nhật thành công (Password không bị lộ ra ngoài response)
 *       400:
 *         description: Dữ liệu enum gửi lên không hợp lệ, hoặc trùng email
 *       403:
 *         description: Không có quyền truy cập
 */
router.put('/users/:id', verifyToken, verifyAdmin, adminUpdateUser);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: "[ADMIN] Lấy danh sách tài khoản User"
 *     description: "Trả về danh sách người dùng với các bộ lọc, phân trang. **LƯU Ý: Chỉ tài khoản có quyền ADMINISTRATOR mới được phép gọi API này.**"
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên hoặc email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Lọc theo vai trò (ví dụ RESEARCHER, LECTURER, ADMINISTRATOR)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Lọc theo trạng thái (ví dụ ACTIVE, INACTIVE, BANNED)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số bản ghi mỗi trang
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: email
 *         description: Trường dùng để sắp xếp
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa đăng nhập hoặc Token không hợp lệ
 *       403:
 *         description: Bạn không có quyền Administrator để truy cập tài nguyên này
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/users', verifyToken, verifyAdmin, getUsers);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: "[ADMIN] Lấy chi tiết một User theo ID"
 *     description: "Trả về thông tin chi tiết của một người dùng bất kỳ. **LƯU Ý: Chỉ tài khoản có quyền ADMINISTRATOR mới được phép gọi API này.**"
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID của người dùng cần lấy thông tin
 *     responses:
 *       200:
 *         description: Lấy thông tin chi tiết thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Bạn không có quyền Administrator để truy cập tài nguyên này
 *       404:
 *         description: Không tìm thấy người dùng
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/users/:id', verifyToken, verifyAdmin, getUserDetail);

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: "[ADMIN] Tạo tài khoản người dùng mới"
 *     description: "Tạo tài khoản mới với đầy đủ quyền hạn (Role, Status). Mật khẩu sẽ tự động được mã hóa. **LƯU Ý: Chỉ tài khoản có quyền ADMINISTRATOR mới được phép gọi API này.**"
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "Elen"
 *               last_name:
 *                 type: string
 *                 example: "Smith"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "elen@example.com"
 *               role:
 *                 type: string
 *                 enum: ["STUDENT", "LECTURER", "RESEARCHER", "ADMINISTRATOR"]
 *                 example: "RESEARCHER"
 *               status:
 *                 type: string
 *                 enum: ["INACTIVE", "ACTIVE", "BANNED"]
 *                 example: "ACTIVE"
 *               password:
 *                 type: string
 *                 example: "StrongPassword123"
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *               gender:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Tạo người dùng thành công
 *       400:
 *         description: Thông tin không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Bạn không có quyền Administrator để truy cập tài nguyên này
 *       409:
 *         description: Email đã tồn tại
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/users', verifyToken, verifyAdmin, createUser);

/**
 * @swagger
 * /api/v1/admin/repositories/journals/{journalId}/summary:
 *   get:
 *     summary: Lấy dữ liệu tổng quan cho một tạp chí trong Repository Management
 *     description: Trả về các số liệu thống kê chính của một tạp chí, bao gồm tổng số Volume, Issue, Bài viết và ngày phát hành tiếp theo. Yêu cầu quyền ADMINISTRATOR.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: journalId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tạp chí cần lấy thông tin tổng quan.
 *     responses:
 *       200:
 *         description: Lấy dữ liệu tổng quan thành công.
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
 *                   example: "Lấy dữ liệu tổng quan của kho lưu trữ thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_volumes:
 *                       type: integer
 *                     active_issues:
 *                       type: integer
 *                     total_publications:
 *                       type: integer
 *                     next_release:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 */
router.get('/repositories/journals/:journalId/summary', verifyToken, verifyAdmin, validateJournalId, getJournalRepositorySummary);

export default router;