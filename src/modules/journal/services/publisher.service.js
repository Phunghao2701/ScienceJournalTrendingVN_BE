import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Kiá»ƒm tra NhÃ  xuáº¥t báº£n cÃ³ tá»“n táº¡i trong há»‡ thá»‘ng hay khÃ´ng
 * @param {string|number} id - ID cá»§a nhÃ  xuáº¥t báº£n
 * @returns {Promise<boolean>} true náº¿u tá»“n táº¡i, false náº¿u khÃ´ng
 */
export const publisherExist = async (id) => {
    try {
    
        const query = `
            SELECT EXISTS (
                SELECT 1 FROM "Publisher" WHERE publisher_id = $1
            ) AS "exists";
        `;

        const result = await prisma.$queryRawUnsafe(query, id);
        
        return result[0]?.exists || false;

    } catch (error) {
        logger.error(`[Service Error] Lá»—i khi kiá»ƒm tra publisherExist vá»›i ID ${id}:`, error);
        throw error; 
    }
};

/**
 * Kiá»ƒm tra NhÃ  xuáº¥t báº£n cÃ³ Ä‘ang bá»‹ xÃ³a má»m (is_deleted = true) hay khÃ´ng
 * @param {string|number} id
 * @returns {Promise<boolean>}
 */
export const publisherIsDeleted = async (id) => {
    try {
        const query = `SELECT 1 FROM "Publisher" WHERE publisher_id = $1 AND is_deleted = true`;
        const result = await prisma.$queryRawUnsafe(query, id);
        return result.length > 0;
    } catch (error) {
        logger.error(`[Service Error] Lá»—i khi kiá»ƒm tra publisherIsDeleted vá»›i ID ${id}:`, error);
        throw error;
    }
};

/**
 * Láº¥y danh sÃ¡ch NhÃ  xuáº¥t báº£n cÃ³ phÃ¢n trang vÃ  tÃ¬m kiáº¿m
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
            prisma.$queryRawUnsafe(query, searchParam, limit, offset),
            prisma.$queryRawUnsafe(countQuery, searchParam)
        ]);

        const total = parseInt(countResult[0].total, 10);

        return {
            data: dataResult,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                total_pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('[Service Error] Lá»—i khi láº¥y danh sÃ¡ch publisher:', error);
        throw error;
    }
};

export const getPublisherById = async (id) => {
    try {
        const query = `SELECT publisher_id::text, display_name, image_url, created_at FROM "Publisher" WHERE publisher_id = $1 AND is_deleted = false`;
        const result = await prisma.$queryRawUnsafe(query, id);
        return result[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lá»—i khi láº¥y publisher ${id}:`, error);
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
        const result = await prisma.$queryRawUnsafe(query, data.display_name, data.image_url);
        return result[0];
    } catch (error) {
        logger.error('[Service Error] Lá»—i khi táº¡o publisher:', error);
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
        const result = await prisma.$queryRawUnsafe(query, data.display_name, data.image_url, id);
        return result[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lá»—i khi cáº­p nháº­t publisher ${id}:`, error);
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
        const result = await prisma.$queryRawUnsafe(query, id);
        return result[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lá»—i khi xÃ³a publisher ${id}:`, error);
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
        const result = await prisma.$queryRawUnsafe(query, id);
        return result[0] || null;
    } catch (error) {
        logger.error(`[Service Error] Lá»—i khi khÃ´i phá»¥c publisher ${id}:`, error);
        throw error;
    }
};


