import pool from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Lấy danh sách Issue, hỗ trợ lọc theo volume_id hoặc journal_id và phân trang.
 * @param {object} params - Các tham số lọc và phân trang.
 * @param {number} [params.page=1] - Trang hiện tại.
 * @param {number} [params.limit=10] - Số lượng kết quả mỗi trang.
 * @param {string|number} [params.volume_id] - Lọc theo Volume ID.
 * @param {string|number} [params.journal_id] - Lọc theo Journal ID.
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

        // Thêm logic lọc theo journal_id
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
            pool.query(dataQuery, [...values, limit, offset]),
            pool.query(countQuery, values)
        ]);

        const total = parseInt(countResult.rows[0].total, 10);

        return {
            items: dataResult.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('[Issue Service] Lỗi khi lấy danh sách Issue:', error);
        throw error;
    }
};

/**
 * Kiểm tra sự tồn tại của một Issue.
 */
export const issueExist = async (id) => {
    try {
        const query = `SELECT 1 FROM "Issue" WHERE issue_id = $1`;
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows.length > 0;
    } catch (error) {
        logger.error(`Lỗi khi kiểm tra tồn tại của Issue với ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Kiểm tra xem Issue có đang bị xóa mềm hay không.
 */
export const issueIsDeleted = async (id) => {
    try {
        const query = `SELECT 1 FROM "Issue" WHERE issue_id = $1 AND is_deleted = true`;
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows.length > 0;
    } catch (error) {
        logger.error(`Lỗi khi kiểm tra trạng thái xóa mềm của Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Kiểm tra trùng lặp Issue trong cùng Volume.
 */
export const checkDuplicateIssue = async (volume_id, issue_number, excludeId = null) => {
    try {
        let query = `SELECT 1 FROM "Issue" WHERE volume_id = $1 AND issue_number = $2 AND is_deleted = false`;
        const params = [BigInt(volume_id), parseInt(issue_number, 10)];
        if (excludeId !== null) {
            query += ` AND issue_id != $3`;
            params.push(BigInt(excludeId));
        }
        const result = await pool.query(query, params);
        return result.rows.length > 0;
    } catch (error) {
        logger.error("Lỗi khi kiểm tra trùng lặp issue:", error.message);
        throw error;
    }
};

/**
 * Tạo mới một Issue.
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
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        logger.error("Lỗi khi tạo mới Issue:", error.message);
        throw error;
    }
};

/**
 * Lấy thông tin chi tiết một Issue.
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
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`Lỗi khi lấy chi tiết Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Cập nhật thông tin Issue.
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
        const result = await pool.query(query, values);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`Lỗi khi cập nhật Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Xóa mềm một Issue.
 */
export const deleteIssue = async (id) => {
    try {
        const query = `
            UPDATE "Issue" SET is_deleted = true
            WHERE issue_id = $1 AND is_deleted = false
            RETURNING issue_id::text, volume_id::text, issue_number, publication_year, is_deleted;
        `;
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`Lỗi khi xóa mềm Issue ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Khôi phục một Issue đã bị xóa mềm.
 */
export const restoreIssue = async (id) => {
    try {
        const query = `
            UPDATE "Issue" SET is_deleted = false
            WHERE issue_id = $1 AND is_deleted = true
            RETURNING issue_id::text, volume_id::text, issue_number, publication_year, is_deleted;
        `;
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`Lỗi khi khôi phục Issue ID ${id}:`, error.message);
        throw error;
    }
};