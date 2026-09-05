import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Ghi má»™t báº£n ghi log vÃ o báº£ng system_log.
 * HÃ m nÃ y Ä‘Æ°á»£c thiáº¿t káº¿ Ä‘á»ƒ "fire-and-forget", nÃ³ sáº½ tá»± báº¯t lá»—i vÃ  ghi ra file log thay vÃ¬ nÃ©m lá»—i ra ngoÃ i,
 * trÃ¡nh lÃ m giÃ¡n Ä‘oáº¡n luá»“ng chÃ­nh cá»§a á»©ng dá»¥ng khi viá»‡c ghi log tháº¥t báº¡i.
 *
 * @async
 * @param {object} logData - Dá»¯ liá»‡u log cáº§n ghi.
 * @param {string} [logData.userId] - ID cá»§a ngÆ°á»i dÃ¹ng thá»±c hiá»‡n hÃ nh Ä‘á»™ng (UUID).
 * @param {string} [logData.userRole] - Role cá»§a ngÆ°á»i dÃ¹ng (láº¥y tá»« enum role_account).
 * @param {'CREATE'|'UPDATE'|'DELETE'|'LOGIN'|'LOGOUT'|'VIEW'|'EXPORT'|'IMPORT'|'ERROR'|'SYSTEM'} logData.action - Loáº¡i hÃ nh Ä‘á»™ng (báº¯t buá»™c).
 * @param {'INFO'|'WARNING'|'ERROR'|'CRITICAL'} [logData.level='INFO'] - Má»©c Ä‘á»™ cá»§a log.
 * @param {'API'|'ADMIN_PANEL'|'SYSTEM'|'CRON'} [logData.source='API'] - Nguá»“n gá»‘c cá»§a log.
 * @param {string} [logData.entityTable] - TÃªn báº£ng cá»§a Ä‘á»‘i tÆ°á»£ng bá»‹ áº£nh hÆ°á»Ÿng.
 * @param {string|number} [logData.entityId] - ID cá»§a Ä‘á»‘i tÆ°á»£ng bá»‹ áº£nh hÆ°á»Ÿng.
 * @param {string} [logData.message] - ThÃ´ng Ä‘iá»‡p log mÃ´ táº£ hÃ nh Ä‘á»™ng.
 * @param {object} [logData.oldData] - Tráº¡ng thÃ¡i cÅ© cá»§a dá»¯ liá»‡u (dáº¡ng object).
 * @param {object} [logData.newData] - Tráº¡ng thÃ¡i má»›i cá»§a dá»¯ liá»‡u (dáº¡ng object).
 * @param {object} [logData.metadata] - Dá»¯ liá»‡u metadata khÃ¡c (vÃ­ dá»¥: IP, user agent).
 * @returns {Promise<void>}
 */
export const createLog = async (logData) => {
    const {
        userId = null,
        userRole = null,
        action,
        level = 'INFO',
        source = 'API',
        entityTable = null,
        entityId = null,
        message = null,
        oldData = null,
        newData = null,
        metadata = null
    } = logData;

    if (!action) {
        logger.error('[Log Service] Lá»—i: `action` lÃ  trÆ°á»ng báº¯t buá»™c khi ghi log.');
        return;
    }

    try {
        const query = `
            INSERT INTO system_log (
                user_id, user_role, action, level, source, 
                entity_table, entity_id, message, old_data, new_data, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        const values = [
            userId,
            userRole,
            action,
            level,
            source,
            entityTable,
            String(entityId), // Ã‰p kiá»ƒu sang string Ä‘á»ƒ phÃ¹ há»£p vá»›i DB
            message,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            metadata ? JSON.stringify(metadata) : null
        ];

        await prisma.$queryRawUnsafe(query, ...values);

    } catch (error) {
        // Ghi lá»—i ra file log, trÃ¡nh táº¡o vÃ²ng láº·p vÃ´ háº¡n náº¿u chÃ­nh hÃ m ghi log bá»‹ lá»—i DB
        logger.error('Lá»—i nghiÃªm trá»ng khi ghi log vÃ o CSDL:', error);
    }
};

/**
 * Láº¥y danh sÃ¡ch log tá»« há»‡ thá»‘ng vá»›i cÃ¡c tÃ¹y chá»n lá»c vÃ  phÃ¢n trang.
 *
 * @async
 * @param {object} [options={}] - TÃ¹y chá»n truy váº¥n.
 * @param {number} [options.page=1] - Trang hiá»‡n táº¡i.
 * @param {number} [options.limit=20] - Sá»‘ lÆ°á»£ng log trÃªn má»—i trang.
 * @param {string} [options.userId] - Lá»c theo ID ngÆ°á»i dÃ¹ng.
 * @param {string} [options.action] - Lá»c theo hÃ nh Ä‘á»™ng.
 * @param {string} [options.level] - Lá»c theo má»©c Ä‘á»™ log.
 * @param {string} [options.entityTable] - Lá»c theo báº£ng.
 * @param {string|number} [options.entityId] - Lá»c theo ID cá»§a Ä‘á»‘i tÆ°á»£ng.
 * @param {string} [options.sortBy='created_at'] - Sáº¯p xáº¿p theo trÆ°á»ng.
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - Thá»© tá»± sáº¯p xáº¿p.
 * @returns {Promise<{logs: Array<object>, pagination: object}>}
 * @throws {Error} NÃ©m lá»—i náº¿u truy váº¥n CSDL tháº¥t báº¡i.
 */
export const getLogs = async (options = {}) => {
    const {
        page = 1, limit = 20, userId, action, level, entityTable, entityId,
        sortBy = 'created_at', sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const queryParams = [];
    const whereClauses = [];
    let paramIndex = 1;

    if (userId) { whereClauses.push(`user_id = $${paramIndex++}`); queryParams.push(userId); }
    if (action) { whereClauses.push(`action = $${paramIndex++}`); queryParams.push(action); }
    if (level) { whereClauses.push(`level = $${paramIndex++}`); queryParams.push(level); }
    if (entityTable) { whereClauses.push(`entity_table = $${paramIndex++}`); queryParams.push(entityTable); }
    if (entityId) { whereClauses.push(`entity_id = $${paramIndex++}`); queryParams.push(String(entityId)); }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const allowedSortBy = ['created_at', 'level', 'action', 'user_id', 'entity_table'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `SELECT COUNT(*) FROM system_log ${whereString}`;
    const dataQuery = `
        SELECT log_id, user_id, user_role, action, level, source, entity_table, entity_id, message, metadata, created_at 
        FROM system_log 
        ${whereString} 
        ORDER BY "${safeSortBy}" ${safeSortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    try {
        const countParams = queryParams.slice();
        const dataParams = [...queryParams, limit, offset];

        const [countResult, dataResult] = await Promise.all([
            prisma.$queryRawUnsafe(countQuery, ...countParams),
            prisma.$queryRawUnsafe(dataQuery, ...dataParams)
        ]);

        const total = parseInt(countResult[0].count, 10);

        return { logs: dataResult, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
        logger.error('Lá»—i khi láº¥y danh sÃ¡ch log tá»« CSDL:', error);
        throw error;
    }
};


