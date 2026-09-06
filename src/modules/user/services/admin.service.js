import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Lấy số liệu thống kê tổng quan cho Admin Dashboard.
 * Đếm tổng số Journal, Article, lượng dữ liệu được đồng bộ/thêm mới trong ng� y hôm nay (growth), 
 * v�  tổng số lượng người dùng đang hoạt động.
 *
 * @async
 * @returns {Promise<{
 *   total_journals: number,
 *   journal_growth: number,
 *   total_articles: number,
 *   article_growth: number,
 *   pending_reviews: number,
 *   active_users: number
 * }>} Đối tượng chứa các số liệu thống kê tổng quan.
 * @throws {Error} Ném lỗi nếu quá trình truy vấn CSDL thất bại.
 */
export const summary = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalJournals, journalGrowth, totalArticles, articleGrowth, activeUsers] = await Promise.all([
            prisma.journal.count({ where: { is_deleted: false } }),
            prisma.journal.count({ where: { is_deleted: false, created_at: { gte: today } } }),
            prisma.article.count({ where: { is_deleted: false } }),
            prisma.article.count({ where: { is_deleted: false, created_at: { gte: today } } }),
            prisma.user.count({ where: { status: 'ACTIVE' } })
        ]);

        return {
            total_journals: totalJournals,
            journal_growth: journalGrowth,
            total_articles: totalArticles,
            article_growth: articleGrowth,
            pending_reviews: 0,
            active_users: activeUsers
        };
    } catch (error) {
        logger.error('Lỗi khi lấy số liệu thống kê tổng quan (Admin):', error);
        throw error;
    }
};

/**
 * Tạo mới một người dùng từ phía Admin.
 *
 * @async
 * @param {object} userData - Dữ liệu người dùng cần tạo.
 * @returns {Promise<object>} Thông vị người dùng vừa được tạo.
 * @throws {Error} Ném lỗi 409 nếu email đã tồn tại, hoặc lỗi DB khác.
 */
export const createUser = async (userData) => {
    const {
        email,
        password,
        first_name,
        last_name,
        role,
        status,
        date_of_birth,
        gender
    } = userData;

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Kiểm tra email đã tồn tại chưa
    const existingUser = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { user_id: true }
    });

    if (existingUser) {
        const error = new Error('Email đã tồn tại trong hệ thống');
        error.statusCode = 409;
        throw error;
    }

    // 2. Băm mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    try {
        const result = await prisma.user.create({
            data: {
                user_id: userId,
                email: normalizedEmail,
                password: hashedPassword,
                type: 'LOCAL',
                status: status || 'ACTIVE',
                role: role || 'RESEARCHER',
                first_name: first_name || null,
                last_name: last_name || null,
                date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
                gender: gender !== undefined ? gender : null
            },
            select: { user_id: true, email: true, type: true, status: true, role: true, first_name: true, last_name: true, date_of_birth: true, gender: true }
        });
        return result;
    } catch (error) {
        logger.error('Lỗi khi insert User v� o DB (Admin Service):', error);
        throw error;
    }
};

/**
 * Lấy dữ liệu biểu đồ Publication Trends theo từng năm.
 * Sử dụng generate_series để đảm bảo luôn trả về đủ số năm (mặc định 5 năm gần nhất) ngay cả khi không có dữ liệu.
 *
 * @async
 * @param {number|string} year - Năm l� m mốc (mặc định l�  năm hiện tại)
 * @param {number|string} limit - Số lượng năm muốn thống kê (mặc định l�  5)
 * @returns {Promise<{ target_year: number, items: Array<{year: number, manuscripts: number, published: number}> }>}
 */
export const getPublicationTrends = async (year, limit = 5) => {
    try {
        const targetYear = parseInt(year, 10) || new Date().getFullYear();
        const limitYears = parseInt(limit, 10) || 5;

        const query = `
            WITH years AS (
                SELECT generate_series($1::integer - $2::integer + 1, $1::integer) AS year
            )
            SELECT 
                y.year,
                COUNT(a.article_id)::integer AS manuscripts,
                0::integer AS published
            FROM years y
            LEFT JOIN "Article" a 
                ON a.publication_year = y.year 
                AND a.is_deleted = false
            GROUP BY y.year
            ORDER BY y.year ASC;
        `;

        const result = await prisma.$queryRawUnsafe(query, targetYear, limitYears);

        return {
            target_year: targetYear,
            items: result
        };
    } catch (error) {
        logger.error('Lỗi khi lấy dữ liệu publication trends (Admin Service):', error);
        throw error;
    }
};

/**
 * Lấy danh sách trạng thái Volume & Issue cho Admin Dashboard, có phân trang.
 *
 * @async
 * @param {object} options - Tùy chọn truy vấn.
 * @param {number} [options.page=1] - Trang hiện tại.
 * @param {number} [options.limit=10] - Số lượng bản ghi trên mỗi trang.
 * @returns {Promise<{items: Array<object>, pagination: object}>}
 * @throws {Error} Ném lỗi nếu truy vấn CSDL thất bại.
 */
export const getVolumeIssueStatus = async ({ page = 1, limit = 10 }) => {
    try {
        const offset = (page - 1) * limit;

        const total = await prisma.volume.count({ where: { is_deleted: false } });

        const dataQuery = `
            SELECT 
                v.volume_id,
                v.volume_number,
                v.publication_year,
                j.display_name AS journal_name,
                COUNT(i.issue_id)::integer AS total_issues,
                'PUBLISHED' AS status,
                (v.volume_id % 10) * 10 + 10 AS progress
            FROM "Volume" v
            LEFT JOIN "Journal" j ON v.journal_id = j.journal_id
            LEFT JOIN "Issue" i ON v.volume_id = i.volume_id AND i.is_deleted = false
            WHERE v.is_deleted = false
            GROUP BY v.volume_id, j.display_name
            ORDER BY v.publication_year DESC, v.volume_number DESC
            LIMIT $1 OFFSET $2;
        `;

        const dataResult = await prisma.$queryRawUnsafe(dataQuery, parseInt(limit, 10), offset);

        const items = dataResult.map(item => ({
            ...item,
            volume_id: item.volume_id ? item.volume_id.toString() : null,
            total_issues: Number(item.total_issues),
            progress: Number(item.progress)
        }));

        return { items, pagination: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), totalPages: Math.ceil(total / limit) } };
    } catch (error) {
        logger.error('Lỗi khi lấy Volume & Issue Status (Admin Service):', error);
        throw error;
    }
};

/**
 * Lấy to� n bộ danh sách trạng thái Volume & Issue để export CSV.
 *
 * @async
 * @returns {Promise<Array<object>>}
 * @throws {Error} Ném lỗi nếu truy vấn CSDL thất bại.
 */
export const exportVolumeIssueStatus = async () => {
    try {
        const dataQuery = `
            SELECT 
                v.volume_id,
                v.volume_number,
                v.publication_year,
                j.display_name AS journal_name,
                COUNT(i.issue_id)::integer AS total_issues,
                'PUBLISHED' AS status,
                (v.volume_id % 10) * 10 + 10 AS progress
            FROM "Volume" v
            LEFT JOIN "Journal" j ON v.journal_id = j.journal_id
            LEFT JOIN "Issue" i ON v.volume_id = i.volume_id AND i.is_deleted = false
            WHERE v.is_deleted = false
            GROUP BY v.volume_id, j.display_name
            ORDER BY v.publication_year DESC, v.volume_number DESC;
        `;

        const dataResult = await prisma.$queryRawUnsafe(dataQuery);

        return dataResult.map(item => ({
            ...item,
            volume_id: item.volume_id ? item.volume_id.toString() : null,
            total_issues: Number(item.total_issues),
            progress: Number(item.progress)
        }));
    } catch (error) {
        logger.error('Lỗi khi lấy dữ liệu Volume & Issue Status để export (Admin Service):', error);
        throw error;
    }
};

/**
 * Lấy danh sách người dùng (User) d� nh cho Admin, hỗ trợ tìm kiếm, lọc, sắp xếp v�  phân trang.
 *
 * @async
 * @param {object} options - Tùy chọn truy vấn.
 * @param {string} [options.search] - Từ khóa tìm kiếm (email, first_name, last_name).
 * @param {string} [options.role] - Lọc theo role.
 * @param {string} [options.status] - Lọc theo status.
 * @param {number} [options.page=1] - Trang hiện tại.
 * @param {number} [options.limit=10] - Số lượng bản ghi trên mỗi trang.
 * @param {string} [options.sortBy='email'] - Trường cần sắp xếp.
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - Thứ tự sắp xếp.
 * @returns {Promise<{items: Array<object>, pagination: object}>}
 * @throws {Error} Ném lỗi nếu truy vấn CSDL thất bại.
 */
export const getUsersList = async (options = {}) => {
    const {
        search,
        role,
        status,
        page = 1,
        limit = 10,
        sortBy = 'email',
        sortOrder = 'desc'
    } = options;

    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
        where.OR = [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
        ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const allowedSortBy = ['email', 'first_name', 'last_name', 'role', 'status'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'email';
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    try {
        const [total, items] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                orderBy: { [safeSortBy]: safeSortOrder },
                skip: offset,
                take: parseInt(limit, 10),
                select: { user_id: true, email: true, type: true, status: true, role: true, last_name: true, first_name: true, url_image: true, date_of_birth: true, gender: true }
            })
        ]);

        return { items, pagination: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), totalPages: Math.ceil(total / limit) } };
    } catch (error) {
        logger.error('Lỗi khi lấy danh sách User (Admin Service):', error);
        throw error;
    }
};

/**
 * Lấy thông tin chi tiết của một người dùng theo ID.
 *
 * @async
 * @param {string} userId - UUID của người dùng.
 * @returns {Promise<object|null>} Trả về đối tượng người dùng hoặc null nếu không tìm thấy.
 * @throws {Error} Ném lỗi nếu truy vấn CSDL thất bại.
 */
export const getUserDetailById = async (userId) => {
    try {
        const user = await prisma.user.findUnique({
            where: { user_id: userId },
            select: { user_id: true, email: true, type: true, status: true, role: true, last_name: true, first_name: true, url_image: true, date_of_birth: true, gender: true }
        });
        return user;
    } catch (error) {
        logger.error(`Lỗi khi lấy chi tiết User ID ${userId} (Admin Service):`, error);
        throw error;
    }
};

/**
 * Admin cập nhật thông tin người dùng bất kỳ
 */
export const updateUserByAdmin = async (userId, data) => {
    try {
        const dataToUpdate = { ...data };

        if (dataToUpdate.password) {
            const salt = await bcrypt.genSalt(10);
            dataToUpdate.password = await bcrypt.hash(dataToUpdate.password, salt);
        }

        if (dataToUpdate.date_of_birth) {
            dataToUpdate.date_of_birth = new Date(dataToUpdate.date_of_birth);
        }

        const updatedUser = await prisma.user.update({
            where: { user_id: userId },
            data: dataToUpdate,
            select: { user_id: true, email: true, type: true, status: true, role: true, first_name: true, last_name: true, url_image: true, date_of_birth: true, gender: true }
        });
        
        return updatedUser;
    } catch (error) {
        if (error.code === 'P2025') return null; // Not found
        throw error;
    }
};


