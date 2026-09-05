import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Láº¥y sá»‘ liá»‡u thá»‘ng kÃª tá»•ng quan cho Admin Dashboard.
 * Äáº¿m tá»•ng sá»‘ Journal, Article, lÆ°á»£ng dá»¯ liá»‡u Ä‘Æ°á»£c Ä‘á»“ng bá»™/thÃªm má»›i trong ngÃ y hÃ´m nay (growth), 
 * vÃ  tá»•ng sá»‘ lÆ°á»£ng ngÆ°á»i dÃ¹ng Ä‘ang hoáº¡t Ä‘á»™ng.
 *
 * @async
 * @returns {Promise<{
 *   total_journals: number,
 *   journal_growth: number,
 *   total_articles: number,
 *   article_growth: number,
 *   pending_reviews: number,
 *   active_users: number
 * }>} Äá»‘i tÆ°á»£ng chá»©a cÃ¡c sá»‘ liá»‡u thá»‘ng kÃª tá»•ng quan.
 * @throws {Error} NÃ©m lá»—i náº¿u quÃ¡ trÃ¬nh truy váº¥n CSDL tháº¥t báº¡i.
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
        logger.error('Lá»—i khi láº¥y sá»‘ liá»‡u thá»‘ng kÃª tá»•ng quan (Admin):', error);
        throw error;
    }
};

/**
 * Táº¡o má»›i má»™t ngÆ°á»i dÃ¹ng tá»« phÃ­a Admin.
 *
 * @async
 * @param {object} userData - Dá»¯ liá»‡u ngÆ°á»i dÃ¹ng cáº§n táº¡o.
 * @returns {Promise<object>} ThÃ´ng vá»‹ ngÆ°á»i dÃ¹ng vá»«a Ä‘Æ°á»£c táº¡o.
 * @throws {Error} NÃ©m lá»—i 409 náº¿u email Ä‘Ã£ tá»“n táº¡i, hoáº·c lá»—i DB khÃ¡c.
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

    // 1. Kiá»ƒm tra email Ä‘Ã£ tá»“n táº¡i chÆ°a
    const existingUser = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { user_id: true }
    });

    if (existingUser) {
        const error = new Error('Email Ä‘Ã£ tá»“n táº¡i trong há»‡ thá»‘ng');
        error.statusCode = 409;
        throw error;
    }

    // 2. BÄƒm máº­t kháº©u
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
        logger.error('Lá»—i khi insert User vÃ o DB (Admin Service):', error);
        throw error;
    }
};

/**
 * Láº¥y dá»¯ liá»‡u biá»ƒu Ä‘á»“ Publication Trends theo tá»«ng nÄƒm.
 * Sá»­ dá»¥ng generate_series Ä‘á»ƒ Ä‘áº£m báº£o luÃ´n tráº£ vá» Ä‘á»§ sá»‘ nÄƒm (máº·c Ä‘á»‹nh 5 nÄƒm gáº§n nháº¥t) ngay cáº£ khi khÃ´ng cÃ³ dá»¯ liá»‡u.
 *
 * @async
 * @param {number|string} year - NÄƒm lÃ m má»‘c (máº·c Ä‘á»‹nh lÃ  nÄƒm hiá»‡n táº¡i)
 * @param {number|string} limit - Sá»‘ lÆ°á»£ng nÄƒm muá»‘n thá»‘ng kÃª (máº·c Ä‘á»‹nh lÃ  5)
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
        logger.error('Lá»—i khi láº¥y dá»¯ liá»‡u publication trends (Admin Service):', error);
        throw error;
    }
};

/**
 * Láº¥y danh sÃ¡ch tráº¡ng thÃ¡i Volume & Issue cho Admin Dashboard, cÃ³ phÃ¢n trang.
 *
 * @async
 * @param {object} options - TÃ¹y chá»n truy váº¥n.
 * @param {number} [options.page=1] - Trang hiá»‡n táº¡i.
 * @param {number} [options.limit=10] - Sá»‘ lÆ°á»£ng báº£n ghi trÃªn má»—i trang.
 * @returns {Promise<{items: Array<object>, pagination: object}>}
 * @throws {Error} NÃ©m lá»—i náº¿u truy váº¥n CSDL tháº¥t báº¡i.
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
        logger.error('Lá»—i khi láº¥y Volume & Issue Status (Admin Service):', error);
        throw error;
    }
};

/**
 * Láº¥y toÃ n bá»™ danh sÃ¡ch tráº¡ng thÃ¡i Volume & Issue Ä‘á»ƒ export CSV.
 *
 * @async
 * @returns {Promise<Array<object>>}
 * @throws {Error} NÃ©m lá»—i náº¿u truy váº¥n CSDL tháº¥t báº¡i.
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
        logger.error('Lá»—i khi láº¥y dá»¯ liá»‡u Volume & Issue Status Ä‘á»ƒ export (Admin Service):', error);
        throw error;
    }
};

/**
 * Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng (User) dÃ nh cho Admin, há»— trá»£ tÃ¬m kiáº¿m, lá»c, sáº¯p xáº¿p vÃ  phÃ¢n trang.
 *
 * @async
 * @param {object} options - TÃ¹y chá»n truy váº¥n.
 * @param {string} [options.search] - Tá»« khÃ³a tÃ¬m kiáº¿m (email, first_name, last_name).
 * @param {string} [options.role] - Lá»c theo role.
 * @param {string} [options.status] - Lá»c theo status.
 * @param {number} [options.page=1] - Trang hiá»‡n táº¡i.
 * @param {number} [options.limit=10] - Sá»‘ lÆ°á»£ng báº£n ghi trÃªn má»—i trang.
 * @param {string} [options.sortBy='email'] - TrÆ°á»ng cáº§n sáº¯p xáº¿p.
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - Thá»© tá»± sáº¯p xáº¿p.
 * @returns {Promise<{items: Array<object>, pagination: object}>}
 * @throws {Error} NÃ©m lá»—i náº¿u truy váº¥n CSDL tháº¥t báº¡i.
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
        logger.error('Lá»—i khi láº¥y danh sÃ¡ch User (Admin Service):', error);
        throw error;
    }
};

/**
 * Láº¥y thÃ´ng tin chi tiáº¿t cá»§a má»™t ngÆ°á»i dÃ¹ng theo ID.
 *
 * @async
 * @param {string} userId - UUID cá»§a ngÆ°á»i dÃ¹ng.
 * @returns {Promise<object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng ngÆ°á»i dÃ¹ng hoáº·c null náº¿u khÃ´ng tÃ¬m tháº¥y.
 * @throws {Error} NÃ©m lá»—i náº¿u truy váº¥n CSDL tháº¥t báº¡i.
 */
export const getUserDetailById = async (userId) => {
    try {
        const user = await prisma.user.findUnique({
            where: { user_id: userId },
            select: { user_id: true, email: true, type: true, status: true, role: true, last_name: true, first_name: true, url_image: true, date_of_birth: true, gender: true }
        });
        return user;
    } catch (error) {
        logger.error(`Lá»—i khi láº¥y chi tiáº¿t User ID ${userId} (Admin Service):`, error);
        throw error;
    }
};

/**
 * Admin cáº­p nháº­t thÃ´ng tin ngÆ°á»i dÃ¹ng báº¥t ká»³
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


