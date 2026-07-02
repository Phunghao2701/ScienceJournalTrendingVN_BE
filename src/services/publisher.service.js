import pool from "../config/database.js";
import logger from "../utils/logger.js";

/**
 * Kiểm tra Nhà xuất bản có tồn tại trong hệ thống hay không
 * @param {string|number} id - ID của nhà xuất bản
 * @returns {Promise<boolean>} true nếu tồn tại, false nếu không
 */
export const publisherExist = async (id) => {
    try {
    
        const query = `
            SELECT EXISTS (
                SELECT 1 FROM "Publisher" WHERE publisher_id = $1
            ) AS "exists";
        `;

        const result = await pool.query(query, [id]);
        
        return result.rows[0]?.exists || false;

    } catch (error) {
        logger.error(`[Service Error] Lỗi khi kiểm tra publisherExist với ID ${id}:`, error);
        throw error; 
    }
};

/**
 * Kiểm tra Nhà xuất bản có đang bị xóa mềm (is_deleted = true) hay không
 * @param {string|number} id
 * @returns {Promise<boolean>}
 */
export const publisherIsDeleted = async (id) => {
    try {
        const query = `SELECT 1 FROM "Publisher" WHERE publisher_id = $1 AND is_deleted = true`;
        const result = await pool.query(query, [id]);
        return result.rows.length > 0;
    } catch (error) {
        logger.error(`[Service Error] Lỗi khi kiểm tra publisherIsDeleted với ID ${id}:`, error);
        throw error;
    }
};

/**
 * Lấy danh sách Nhà xuất bản có phân trang và tìm kiếm
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export const getPublishers = async ({ page = 1, limit = 100, search = '' }) => {
    try {
        const offset = (page - 1) * limit;
        const searchParam = `%${search}%`;

        const query = `
            SELECT publisher_id::text, display_name, image_url, created_at
            FROM "Publisher"
            WHERE display_name ILIKE $1 AND is_deleted = false
            ORDER BY display_name ASC
            LIMIT $2 OFFSET $3;
        `;
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM "Publisher"
            WHERE display_name ILIKE $1 AND is_deleted = false;
        `;

        const [dataResult, countResult] = await Promise.all([
            pool.query(query, [searchParam, limit, offset]),
            pool.query(countQuery, [searchParam])
        ]);

        const total = parseInt(countResult.rows[0].total, 10);

        return {
            data: dataResult.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                total_pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('[Service Error] Lỗi khi lấy danh sách publisher:', error);
        throw error;
    }
};

export const getPublisherById = async (id) => {
    try {
        const query = `SELECT publisher_id::text, display_name, image_url, created_at FROM "Publisher" WHERE publisher_id = $1 AND is_deleted = false`;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lỗi khi lấy publisher ${id}:`, error);
        throw error;
    }
};

export const createPublisher = async (data) => {
    try {
        const query = `
            INSERT INTO "Publisher" (display_name, image_url)
            VALUES ($1, $2)
            RETURNING publisher_id::text, display_name, image_url, created_at;
        `;
        const result = await pool.query(query, [data.display_name, data.image_url]);
        return result.rows[0];
    } catch (error) {
        logger.error('[Service Error] Lỗi khi tạo publisher:', error);
        throw error;
    }
};

export const updatePublisher = async (id, data) => {
    try {
        const query = `
            UPDATE "Publisher"
            SET display_name = COALESCE($1, display_name),
                image_url = COALESCE($2, image_url)
            WHERE publisher_id = $3 AND is_deleted = false
            RETURNING publisher_id::text, display_name, image_url, created_at;
        `;
        const result = await pool.query(query, [data.display_name, data.image_url, id]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lỗi khi cập nhật publisher ${id}:`, error);
        throw error;
    }
};

export const deletePublisher = async (id) => {
    try {
        const query = `
            UPDATE "Publisher" 
            SET is_deleted = true 
            WHERE publisher_id = $1 AND is_deleted = false 
            RETURNING publisher_id::text;
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lỗi khi xóa publisher ${id}:`, error);
        throw error;
    }
};

export const restorePublisher = async (id) => {
    try {
        const query = `
            UPDATE "Publisher" 
            SET is_deleted = false 
            WHERE publisher_id = $1 AND is_deleted = true 
            RETURNING publisher_id::text, display_name, image_url, created_at;
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lỗi khi khôi phục publisher ${id}:`, error);
        throw error;
    }
};