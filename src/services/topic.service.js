import pool from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Tìm Topic theo ID.
 *
 * @async
 * @param {number|string} topicId - ID của topic cần tra cứu.
 * @returns {Promise<Object|null>} Đối tượng topic hoặc null nếu không tìm thấy.
 */
export const getTopicById = async (topicId) => {
    const query = `
        SELECT 
            t.topic_id::text AS topic_id, 
            t.display_name, 
            t.score,
            t.subject_area_id::text AS subject_area_id,
            t.subject_category_id::text AS subject_category_id,
            t.is_deleted,
            sa.display_name AS subject_area_name,
            sc.display_name AS subject_category_name
        FROM "Topic" t
        LEFT JOIN "Subject_Area" sa ON t.subject_area_id = sa.subject_area_id
        LEFT JOIN "Subject_Category" sc ON t.subject_category_id = sc.subject_category_id
        WHERE t.topic_id = $1 AND t.is_deleted = false
    `;
    const result = await pool.query(query, [BigInt(topicId)]);
    return result.rows[0] || null;
};

/**
 * Kiểm tra xem có Topic nào khác đang hoạt động trùng lặp display_name không.
 * 
 * @async
 * @param {string} displayName - Tên cần kiểm tra.
 * @param {number|string} [excludeId=null] - ID cần loại trừ (trong trường hợp update).
 * @returns {Promise<{ duplicateName: boolean }>} Đối tượng chứa kết quả trùng lặp.
 */
export const checkDuplicateTopic = async (displayName, excludeId = null) => {
    try {
        let queryName = `SELECT 1 FROM "Topic" WHERE display_name = $1 AND is_deleted = false`;
        const paramsName = [displayName.trim()];
        if (excludeId !== null) {
            queryName += ` AND topic_id != $2`;
            paramsName.push(BigInt(excludeId));
        }
        const resName = await pool.query(queryName, paramsName);

        return {
            duplicateName: resName.rows.length > 0
        };
    } catch (error) {
        logger.error("Lỗi khi kiểm tra trùng lặp Topic:", error.message);
        throw error;
    }
};

/**
 * Tạo mới một Topic.
 * 
 * @async
 * @param {Object} data - Dữ liệu tạo.
 * @param {string} data.display_name - Tên hiển thị.
 * @param {number} [data.score] - Điểm đánh giá (mặc định 0).
 * @param {number|string} [data.subject_area_id] - ID Subject Area.
 * @param {number|string} [data.subject_category_id] - ID Subject Category.
 * @returns {Promise<Object>} Trả về đối tượng vừa tạo.
 */
export const createTopic = async (data) => {
    try {
        const { display_name, score = 0, subject_area_id, subject_category_id } = data;
        const trimmedName = display_name.trim();

        const query = `
            INSERT INTO "Topic" (display_name, score, subject_area_id, subject_category_id, is_deleted)
            VALUES ($1, $2, $3, $4, false)
            RETURNING 
                topic_id::text AS topic_id, 
                display_name, 
                score,
                subject_area_id::text AS subject_area_id,
                subject_category_id::text AS subject_category_id,
                is_deleted;
        `;
        const result = await pool.query(query, [
            trimmedName,
            score,
            subject_area_id ? BigInt(subject_area_id) : null,
            subject_category_id ? BigInt(subject_category_id) : null
        ]);
        return result.rows[0];
    } catch (error) {
        logger.error("Lỗi khi tạo mới Topic:", error.message);
        throw error;
    }
};

/**
 * Lấy danh sách Topic hỗ trợ tìm kiếm, phân trang, lọc và sắp xếp.
 * Chỉ lấy bản ghi chưa bị xóa mềm (is_deleted = false).
 * 
 * @async
 * @param {Object} params - Tham số đầu vào.
 * @returns {Promise<{ items: Array<Object>, total: number }>}
 */
export const getTopics = async ({
    page = 1,
    limit = 10,
    search,
    subject_area_id,
    subject_category_id,
    sort_by = "display_name",
    sort_order = "asc"
} = {}) => {
    try {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        let baseQuery = `
            FROM "Topic" t
            LEFT JOIN "Subject_Area" sa ON t.subject_area_id = sa.subject_area_id
            LEFT JOIN "Subject_Category" sc ON t.subject_category_id = sc.subject_category_id
            WHERE t.is_deleted = false
        `;
        const queryParams = [];

        // Lọc theo subject_area_id
        if (subject_area_id !== undefined && subject_area_id !== null && subject_area_id.toString().trim() !== "") {
            queryParams.push(BigInt(subject_area_id));
            baseQuery += ` AND t.subject_area_id = $${queryParams.length}`;
        }

        // Lọc theo subject_category_id
        if (subject_category_id !== undefined && subject_category_id !== null && subject_category_id.toString().trim() !== "") {
            queryParams.push(BigInt(subject_category_id));
            baseQuery += ` AND t.subject_category_id = $${queryParams.length}`;
        }

        // Tìm kiếm theo display_name
        if (search !== undefined && search !== null && search.toString().trim() !== "") {
            queryParams.push(`%${search.toString().trim()}%`);
            baseQuery += ` AND t.display_name ILIKE $${queryParams.length}`;
        }

        // Đếm tổng số bản ghi
        const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;
        const countRes = await pool.query(countQuery, queryParams);
        const total = countRes.rows[0]?.total || 0;

        // Sắp xếp
        const allowedSortFields = ["topic_id", "display_name", "score"];
        const sortField = allowedSortFields.includes(sort_by) ? sort_by : "display_name";
        const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

        // Phân trang
        queryParams.push(limitNum, offset);
        const dataQuery = `
            SELECT 
                t.topic_id::text AS topic_id, 
                t.display_name, 
                t.score,
                t.subject_area_id::text AS subject_area_id,
                t.subject_category_id::text AS subject_category_id,
                t.is_deleted,
                sa.display_name AS subject_area_name,
                sc.display_name AS subject_category_name
            ${baseQuery}
            ORDER BY t."${sortField}" ${sortDir}
            LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
        `;

        const dataRes = await pool.query(dataQuery, queryParams);
        return {
            items: dataRes.rows,
            total
        };
    } catch (error) {
        logger.error("Lỗi khi lấy danh sách Topic:", error.message);
        throw error;
    }
};

/**
 * Lấy danh sách bài báo thuộc một topic (qua primary_topic hoặc Sub_Topic).
 *
 * Luồng JOIN:
 *   - Article.primary_topic = topic_id  (bài báo có primary topic trùng)
 *   - Sub_Topic(article_id, topic_id)   (bài báo được gắn sub-topic)
 *
 * @async
 * @param {number} topicId - ID của topic.
 * @param {number} limit   - Số bài tối đa trả về.
 * @param {number} offset  - Vị trí bắt đầu (phân trang).
 * @returns {Promise<Array<Object>>} Danh sách bài báo.
 */
export const getArticlesByTopicId = async (topicId, limit = 10, offset = 0) => {
    const query = `
        SELECT DISTINCT
            a."article_id",
            a."title",
            a."publication_year",
            a."doi"
        FROM "Article" a
        LEFT JOIN "Sub_Topic" st ON st."article_id" = a."article_id"
        WHERE (a."primary_topic" = $1 OR st."topic_id" = $1)
          AND a."is_deleted" = false
        ORDER BY a."publication_year" DESC NULLS LAST, a."article_id" DESC
        LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [topicId, limit, offset]);
    return result.rows;
};

/**
 * Đếm tổng số bài báo thuộc một topic.
 *
 * @async
 * @param {number} topicId - ID của topic.
 * @returns {Promise<number>} Tổng số bài báo.
 */
export const countArticlesByTopicId = async (topicId) => {
    const query = `
        SELECT COUNT(DISTINCT a."article_id") AS "total"
        FROM "Article" a
        LEFT JOIN "Sub_Topic" st ON st."article_id" = a."article_id"
        WHERE (a."primary_topic" = $1 OR st."topic_id" = $1)
          AND a."is_deleted" = false
    `;

    const result = await pool.query(query, [topicId]);
    return parseInt(result.rows[0].total);
};

export const createSubTopicArticleRelationships = async (articleId, topicIds, primaryTopicId) => {
    try {
        // 1. Kiểm tra đầu vào, nếu mảng rỗng thì thoát sớm
        if (!topicIds || topicIds.length === 0) {
            return;
        }

        const targetPrimaryId = primaryTopicId ? Number(primaryTopicId) : null;

        const uniqueTopicIds = [
            ...new Set(
                topicIds
                    .map(id => Number(id))
                    .filter(id => id !== targetPrimaryId)
            )
        ];

        if (uniqueTopicIds.length === 0) {
            logger.info('Không có chủ đề phụ nào hợp lệ để thêm (hoặc đã bị trùng với Chủ đề chính).');
            return;
        }

        const query = `
            INSERT INTO "Sub_Topic" (article_id, topic_id)
            SELECT $1, unnest($2::bigint[])
            ON CONFLICT DO NOTHING
        `;


        await pool.query(query, [articleId, uniqueTopicIds]);

        logger.info(
            `Đã tạo ${uniqueTopicIds.length} quan hệ chủ đề phụ - bài báo`
        );

    } catch (error) {
        logger.error(
            'Lỗi khi tạo quan hệ chủ đề phụ - bài báo:',
            error
        );
        throw error;
    }
};

/**
 * Cập nhật toàn bộ mối quan hệ chủ đề phụ cho bài báo (Chuẩn RESTful PUT)
 * - Bước 1: Xóa toàn bộ quan hệ chủ đề phụ cũ của bài báo này
 * - Bước 2: Gọi lại hàm create để chèn danh sách mới sạch sẽ
 * * @param {number|string} articleId - ID của bài báo cần cập nhật
 * @param {number[]} topicIds - Mảng các ID chủ đề phụ mới (ví dụ: [3, 4, 5])
 * @param {number|string|null} primaryTopicId - ID chủ đề chính để đối chiếu lọc trùng
 */
export const updateSubTopicArticleRelationships = async (articleId, topicIds, primaryTopicId) => {
    try {
        if (!articleId) {
            throw new Error('Thiếu articleId khi gọi hàm updateSubTopicArticleRelationships');
        }

        const deleteQuery = `
            DELETE FROM "Sub_Topic"
            WHERE "article_id" = $1;
        `;
        await pool.query(deleteQuery, [articleId]);

        await createSubTopicArticleRelationships(articleId, topicIds, primaryTopicId);

        logger.info(`Đã cập nhật làm mới toàn bộ quan hệ chủ đề phụ cho bài báo ID: ${articleId}`);

    } catch (error) {
        logger.error(`Lỗi khi cập nhật quan hệ chủ đề phụ cho bài báo ID ${articleId}:`, error);
        throw error;
    }
};

export const topicExists = async (topicId) => {
    try {
        const queryText = `SELECT 1 FROM "Topic" WHERE "topic_id" = $1`;
        const res = await pool.query(queryText, [topicId]);
        return res.rowCount > 0;
    } catch (error) {
        logger.error('Lỗi khi kiểm tra tồn tại của chủ đề:', error);
        throw error;
    }
}

/**
 * Cập nhật thông tin Topic.
 * Dynamic update — chỉ cập nhật các field được gửi lên.
 *
 * @async
 * @param {number|string} id - ID của Topic cần cập nhật.
 * @param {Object} data - Dữ liệu cần cập nhật.
 * @param {string} [data.display_name] - Tên topic mới.
 * @param {number} [data.score] - Điểm đánh giá.
 * @param {number|string} [data.subject_area_id] - ID Subject Area.
 * @param {number|string} [data.subject_category_id] - ID Subject Category.
 * @returns {Promise<Object|null>} Trả về Topic sau cập nhật, hoặc null nếu không thành công.
 */
export const updateTopic = async (id, data) => {
    try {
        const allowedFields = ["display_name", "score", "subject_area_id", "subject_category_id"];
        const updateParts = [];
        const values = [];
        let placeholderIndex = 1;

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateParts.push(`"${field}" = $${placeholderIndex}`);
                values.push(data[field]);
                placeholderIndex++;
            }
        }

        if (updateParts.length === 0) {
            return null; // Không có gì để cập nhật
        }

        values.push(BigInt(id));
        const query = `
            UPDATE "Topic"
            SET ${updateParts.join(", ")}
            WHERE topic_id = $${placeholderIndex} AND is_deleted = false
            RETURNING *;
        `;

        const result = await pool.query(query, values);
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        logger.error(`Lỗi khi cập nhật Topic ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Xóa mềm một Topic (đặt is_deleted = true).
 *
 * @async
 * @param {number|string} id - ID của Topic cần xóa mềm.
 * @returns {Promise<Object|null>} Trả về thông tin Topic đã xóa mềm, hoặc null.
 */
export const deleteTopic = async (id) => {
    try {
        const query = `
            UPDATE "Topic"
            SET is_deleted = true
            WHERE topic_id = $1 AND is_deleted = false
            RETURNING *;
        `;
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        logger.error(`Lỗi khi xóa mềm Topic ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Khôi phục một Topic đã bị xóa mềm (đặt is_deleted = false).
 *
 * @async
 * @param {number|string} id - ID của Topic cần khôi phục.
 * @returns {Promise<Object|null>} Trả về thông tin Topic đã khôi phục, hoặc null.
 */
export const restoreTopic = async (id) => {
    try {
        const query = `
            UPDATE "Topic"
            SET is_deleted = false
            WHERE topic_id = $1 AND is_deleted = true
            RETURNING *;
        `;
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        logger.error(`Lỗi khi khôi phục Topic ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Kiểm tra xem Topic có đang bị xóa mềm (is_deleted = true) hay không.
 *
 * @async
 * @param {number|string} id - ID của Topic cần kiểm tra.
 * @returns {Promise<boolean>} Trả về true nếu Topic đã bị xóa mềm, ngược lại false.
 */
export const topicIsDeleted = async (id) => {
    try {
        const query = `SELECT 1 FROM "Topic" WHERE topic_id = $1 AND is_deleted = true`;
        const result = await pool.query(query, [BigInt(id)]);
        return result.rows.length > 0;
    } catch (error) {
        logger.error(`Lỗi khi kiểm tra trạng thái xóa mềm của Topic với ID ${id}:`, error.message);
        throw error;
    }
};