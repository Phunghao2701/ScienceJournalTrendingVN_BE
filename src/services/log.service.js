import pool from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Ghi một bản ghi log vào bảng system_log.
 * Hàm này được thiết kế để "fire-and-forget", nó sẽ tự bắt lỗi và ghi ra file log thay vì ném lỗi ra ngoài,
 * tránh làm gián đoạn luồng chính của ứng dụng khi việc ghi log thất bại.
 *
 * @async
 * @param {object} logData - Dữ liệu log cần ghi.
 * @param {string} [logData.userId] - ID của người dùng thực hiện hành động (UUID).
 * @param {string} [logData.userRole] - Role của người dùng (lấy từ enum role_account).
 * @param {'CREATE'|'UPDATE'|'DELETE'|'LOGIN'|'LOGOUT'|'VIEW'|'EXPORT'|'IMPORT'|'ERROR'|'SYSTEM'} logData.action - Loại hành động (bắt buộc).
 * @param {'INFO'|'WARNING'|'ERROR'|'CRITICAL'} [logData.level='INFO'] - Mức độ của log.
 * @param {'API'|'ADMIN_PANEL'|'SYSTEM'|'CRON'} [logData.source='API'] - Nguồn gốc của log.
 * @param {string} [logData.entityTable] - Tên bảng của đối tượng bị ảnh hưởng.
 * @param {string|number} [logData.entityId] - ID của đối tượng bị ảnh hưởng.
 * @param {string} [logData.message] - Thông điệp log mô tả hành động.
 * @param {object} [logData.oldData] - Trạng thái cũ của dữ liệu (dạng object).
 * @param {object} [logData.newData] - Trạng thái mới của dữ liệu (dạng object).
 * @param {object} [logData.metadata] - Dữ liệu metadata khác (ví dụ: IP, user agent).
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
        logger.error('[Log Service] Lỗi: `action` là trường bắt buộc khi ghi log.');
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
            String(entityId), // Ép kiểu sang string để phù hợp với DB
            message,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            metadata ? JSON.stringify(metadata) : null
        ];

        await pool.query(query, values);

    } catch (error) {
        // Ghi lỗi ra file log, tránh tạo vòng lặp vô hạn nếu chính hàm ghi log bị lỗi DB
        logger.error('Lỗi nghiêm trọng khi ghi log vào CSDL:', error);
    }
};

/**
 * Lấy danh sách log từ hệ thống với các tùy chọn lọc và phân trang.
 *
 * @async
 * @param {object} [options={}] - Tùy chọn truy vấn.
 * @param {number} [options.page=1] - Trang hiện tại.
 * @param {number} [options.limit=20] - Số lượng log trên mỗi trang.
 * @param {string} [options.userId] - Lọc theo ID người dùng.
 * @param {string} [options.action] - Lọc theo hành động.
 * @param {string} [options.level] - Lọc theo mức độ log.
 * @param {string} [options.entityTable] - Lọc theo bảng.
 * @param {string|number} [options.entityId] - Lọc theo ID của đối tượng.
 * @param {string} [options.sortBy='created_at'] - Sắp xếp theo trường.
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - Thứ tự sắp xếp.
 * @returns {Promise<{logs: Array<object>, pagination: object}>}
 * @throws {Error} Ném lỗi nếu truy vấn CSDL thất bại.
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
            pool.query(countQuery, countParams),
            pool.query(dataQuery, dataParams)
        ]);

        const total = parseInt(countResult.rows[0].count, 10);

        return { logs: dataResult.rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
        logger.error('Lỗi khi lấy danh sách log từ CSDL:', error);
        throw error;
    }
};