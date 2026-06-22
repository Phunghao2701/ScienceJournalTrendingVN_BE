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