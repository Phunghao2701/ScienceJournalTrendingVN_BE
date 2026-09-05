import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Láº¥y danh sÃ¡ch Issue, há»— trá»£ lá»c theo volume_id hoáº·c journal_id vÃ  phÃ¢n trang.
 * @param {object} params - CÃ¡c tham sá»‘ lá»c vÃ  phÃ¢n trang.
 * @param {number} [params.page=1] - Trang hiá»‡n táº¡i.
 * @param {number} [params.limit=10] - Sá»‘ lÆ°á»£ng káº¿t quáº£ má»—i trang.
 * @param {string|number} [params.volume_id] - Lá»c theo Volume ID.
 * @param {string|number} [params.journal_id] - Lá»c theo Journal ID.
 * @returns {Promise<{items: Array, pagination: object}>}
 */
export const getIssues = async ({ page = 1, limit = 10, volume_id, journal_id }) => {
    try {
        const offset = (page - 1) * limit;
        const values = [];
        const whereClauses = ['i.is_deleted = false'];

        if (volume_id) {
            values.push(Number(volume_id));
            whereClauses.push(`i.volume_id = $${values.length}`);
        }

        // ThÃªm logic lá»c theo journal_id
        if (journal_id) {
            values.push(Number(journal_id));
            whereClauses.push(`v.journal_id = $${values.length}`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const dataQuery = `
            SELECT 
                i.issue_id::text, i.volume_id::text, i.issue_number, i.publication_year,
                v.journal_id::text, v.volume_number
            FROM "Issue" i
            JOIN "Volume" v ON i.volume_id = v.volume_id
            ${whereSql}
            ORDER BY i.publication_year DESC, i.issue_number DESC
            LIMIT $${values.length + 1} OFFSET $${values.length + 2};
        `;

        const countQuery = `
            SELECT COUNT(i.issue_id) AS total
            FROM "Issue" i
            JOIN "Volume" v ON i.volume_id = v.volume_id
            ${whereSql};
        `;

        const [dataResult, countResult] = await Promise.all([
            prisma.$queryRawUnsafe(dataQuery, ...values, limit, offset),
            prisma.$queryRawUnsafe(countQuery, ...values)
        ]);

        const total = parseInt(countResult[0].total, 10);

        return {
            items: dataResult,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('[Issue Service] Lá»—i khi láº¥y danh sÃ¡ch Issue:', error);
        throw error;
    }
};

/**
 * Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a má»™t Issue.
 */
export const issueExist = async (id) => {
    try {
        const query = `SELECT 1 FROM "Issue" WHERE issue_id = $1`;
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result.length > 0;
    } catch (error) {
        logger.error(`Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a Issue vá»›i ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Kiá»ƒm tra xem Issue cÃ³ Ä‘ang bá»‹ xÃ³a má»m hay khÃ´ng.
 */
export const issueIsDeleted = async (id) => {
    try {
        const query = `SELECT 1 FROM "Issue" WHERE issue_id = $1 AND is_deleted = true`;
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result.length > 0;
    } catch (error) {
        logger.error(`Lá»—i khi kiá»ƒm tra tráº¡ng thÃ¡i xÃ³a má»m cá»§a Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Kiá»ƒm tra trÃ¹ng láº·p Issue trong cÃ¹ng Volume.
 */
export const checkDuplicateIssue = async (volume_id, issue_number, excludeId = null) => {
    try {
        let query = `SELECT 1 FROM "Issue" WHERE volume_id = $1 AND issue_number = $2 AND is_deleted = false`;
        const params = [BigInt(volume_id), parseInt(issue_number, 10)];
        if (excludeId !== null) {
            query += ` AND issue_id != $3`;
            params.push(BigInt(excludeId));
        }
        const result = await prisma.$queryRawUnsafe(query, ...params);
        return result.length > 0;
    } catch (error) {
        logger.error("Lá»—i khi kiá»ƒm tra trÃ¹ng láº·p issue:", error.message);
        throw error;
    }
};

/**
 * Táº¡o má»›i má»™t Issue.
 */
export const createIssue = async (data) => {
    try {
        const { volume_id, issue_number, publication_year } = data;
        const query = `
            INSERT INTO "Issue" (volume_id, issue_number, publication_year, is_deleted)
            VALUES ($1, $2, $3, false)
            RETURNING issue_id::text, volume_id::text, issue_number, publication_year, is_deleted;
        `;
        const values = [BigInt(volume_id), parseInt(issue_number, 10), parseInt(publication_year, 10)];
        const result = await prisma.$queryRawUnsafe(query, ...values);
        return result[0];
    } catch (error) {
        logger.error("Lá»—i khi táº¡o má»›i Issue:", error.message);
        throw error;
    }
};

/**
 * Láº¥y thÃ´ng tin chi tiáº¿t má»™t Issue.
 */
export const getIssueById = async (id) => {
    try {
        const query = `
            SELECT 
                i.issue_id::text, i.volume_id::text, i.issue_number, i.publication_year, i.is_deleted,
                v.journal_id::text, v.volume_number
            FROM "Issue" i
            JOIN "Volume" v ON i.volume_id = v.volume_id
            WHERE i.issue_id = $1 AND i.is_deleted = false;
        `;
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result[0] || null;
    } catch (error) {
        logger.error(`Lá»—i khi láº¥y chi tiáº¿t Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Cáº­p nháº­t thÃ´ng tin Issue.
 */
export const updateIssue = async (id, data) => {
    try {
        const allowedFields = ["issue_number", "publication_year"];
        const updateParts = [];
        const values = [];
        let placeholderIndex = 1;
        for (const field of allowedFields) {
            if (data[field] !== undefined && data[field] !== null) {
                updateParts.push(`"${field}" = $${placeholderIndex}`);
                values.push(parseInt(data[field], 10));
                placeholderIndex++;
            }
        }
        if (updateParts.length === 0) return null;
        values.push(BigInt(id));
        const query = `
            UPDATE "Issue" SET ${updateParts.join(", ")}
            WHERE issue_id = $${placeholderIndex} AND is_deleted = false
            RETURNING issue_id::text, volume_id::text, issue_number, publication_year, is_deleted;
        `;
        const result = await prisma.$queryRawUnsafe(query, ...values);
        return result[0] || null;
    } catch (error) {
        logger.error(`Lá»—i khi cáº­p nháº­t Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * XÃ³a má»m má»™t Issue.
 */
export const deleteIssue = async (id) => {
    try {
        const query = `
            UPDATE "Issue" SET is_deleted = true
            WHERE issue_id = $1 AND is_deleted = false
            RETURNING issue_id::text, volume_id::text, issue_number, publication_year, is_deleted;
        `;
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result[0] || null;
    } catch (error) {
        logger.error(`Lá»—i khi xÃ³a má»m Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * KhÃ´i phá»¥c má»™t Issue Ä‘Ã£ bá»‹ xÃ³a má»m.
 */
export const restoreIssue = async (id) => {
    try {
        const query = `
            UPDATE "Issue" SET is_deleted = false
            WHERE issue_id = $1 AND is_deleted = true
            RETURNING issue_id::text, volume_id::text, issue_number, publication_year, is_deleted;
        `;
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result[0] || null;
    } catch (error) {
        logger.error(`Lá»—i khi khÃ´i phá»¥c Issue ID ${id}:`, error.message);
        throw error;
    }
};


