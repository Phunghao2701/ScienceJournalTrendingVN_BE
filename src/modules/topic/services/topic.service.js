import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import {
    buildArticleFilter,
    normalizeArticleSort,
} from '../../article/services/articleFilter.service.js';

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
    const result = await prisma.$queryRawUnsafe(query, BigInt(topicId));
    return result[0] || null;
};

/**
 * Kiểm tra xem có Topic n� o khác đang hoạt động trùng lặp display_name không.
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
        const resName = await prisma.$queryRawUnsafe(queryName, ...paramsName);

        return {
            duplicateName: resName.length > 0
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
        const result = await prisma.$queryRawUnsafe(query, 
            trimmedName,
            score,
            subject_area_id ? BigInt(subject_area_id) : null,
            subject_category_id ? BigInt(subject_category_id) : null
        );
        return result[0];
    } catch (error) {
        logger.error("Lỗi khi tạo mới Topic:", error.message);
        throw error;
    }
};

/**
 * Lấy danh sách Topic hỗ trợ tìm kiếm, phân trang, lọc v�  sắp xếp.
 * Chỉ lấy bản ghi chưa bị xóa mềm (is_deleted = false).
 * 
 * @async
 * @param {Object} params - Tham số đầu v� o.
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
        const countRes = await prisma.$queryRawUnsafe(countQuery, ...queryParams);
        const total = countRes[0]?.total || 0;

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

        const dataRes = await prisma.$queryRawUnsafe(dataQuery, ...queryParams);
        return {
            items: dataRes,
            total
        };
    } catch (error) {
        logger.error("Lỗi khi lấy danh sách Topic:", error.message);
        throw error;
    }
};

/**
 * Lấy danh sách b� i báo thuộc một topic (qua primary_topic hoặc Sub_Topic).
 *
 * Luồng JOIN:
 *   - Article.primary_topic = topic_id  (b� i báo có primary topic trùng)
 *   - Sub_Topic(article_id, topic_id)   (b� i báo được gắn sub-topic)
 *
 * @async
 * @param {number} topicId - ID của topic.
 * @param {number} limit   - Số b� i tối đa trả về.
 * @param {number} offset  - Vị trí bắt đầu (phân trang).
 * @returns {Promise<Array<Object>>} Danh sách b� i báo.
 */
export const getArticlesByTopicId = async (topicId, limit = 10, offset = 0, { scope = 'all', sortBy = 'publication_year', sortOrder = 'desc' } = {}) => {
    const articleFilter = buildArticleFilter({ scope });
    const { column, sortOrder: safeOrder } = normalizeArticleSort(sortBy, sortOrder, {
        allowedColumns: {
            publication_year: 'a."publication_year"',
            title: 'a."title"',
            created_at: 'a."created_at"',
        },
        defaultSort: 'publication_year',
        throwOnInvalid: true,
    });
    const values = [...articleFilter.values, topicId, limit, offset];
    const topicIndex = articleFilter.values.length + 1;
    const limitIndex = articleFilter.values.length + 2;
    const offsetIndex = articleFilter.values.length + 3;
    const query = `
        SELECT
            a."article_id"::text,
            a."version",
            a."issue_id"::text,
            a."title",
            a."abstract",
            a."publication_year",
            a."doi",
            a."primary_topic"::text,
            t."display_name" AS "topic_name",
            a."created_at",
            j."journal_id"::text,
            j."display_name" AS "journal_name",
            j."issn" AS "journal_issn",
            p."publisher_id"::text AS "publisher_id",
            p."display_name" AS "publisher_name",
            v."volume_id"::text AS "volume_id",
            v."volume_number",
            i."issue_number",
            COALESCE(j."is_open_access", false) AS "is_open_access",
            a."citation_count",
            a."reference_count",
            COALESCE(
                (
                    SELECT json_agg(json_build_object(
                        'author_id', au."author_id"::text,
                        'display_name', au."display_name"
                    ))
                    FROM "Author_Article" aa
                    JOIN "Author" au ON au."author_id" = aa."author_id"
                    WHERE aa."article_id" = a."article_id"
                      AND COALESCE(au."is_deleted", false) = false
                ),
                '[]'::json
            ) AS "authors"
        FROM "Article" a
        LEFT JOIN "Sub_Topic" st ON st."article_id" = a."article_id"
        LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
        LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
        LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
        LEFT JOIN "Publisher" p ON p."publisher_id" = j."publisher_id"
        LEFT JOIN "Topic" t   ON t."topic_id"   = a."primary_topic"
        WHERE ${articleFilter.whereSql}
          AND (a."primary_topic" = $${topicIndex} OR st."topic_id" = $${topicIndex})
        ORDER BY ${column} ${safeOrder} NULLS LAST, a."article_id" DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result;
};

/**
 * Đếm tổng số b� i báo thuộc một topic.
 *
 * @async
 * @param {number} topicId - ID của topic.
 * @returns {Promise<number>} Tổng số b� i báo.
 */
export const countArticlesByTopicId = async (topicId, { scope = 'all' } = {}) => {
    const articleFilter = buildArticleFilter({ scope });
    const values = [...articleFilter.values, topicId];
    const topicIndex = values.length;
    const query = `
        SELECT COUNT(DISTINCT a."article_id") AS "total"
        FROM "Article" a
        LEFT JOIN "Sub_Topic" st ON st."article_id" = a."article_id"
        LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
        LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
        LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
        WHERE ${articleFilter.whereSql}
          AND (a."primary_topic" = $${topicIndex} OR st."topic_id" = $${topicIndex})
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);
    return parseInt(result[0].total);
};

export const createSubTopicArticleRelationships = async (articleId, topicIds, primaryTopicId) => {
    try {
        // 1. Kiểm tra đầu v� o, nếu mảng rỗng thì thoát sớm
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
            logger.info('Không có chủ đề phụ n� o hợp lệ để thêm (hoặc đã bị trùng với Chủ đề chính).');
            return;
        }

        const query = `
            INSERT INTO "Sub_Topic" (article_id, topic_id)
            SELECT $1, unnest($2::bigint[])
            ON CONFLICT DO NOTHING
        `;


        await prisma.$queryRawUnsafe(query, articleId, uniqueTopicIds);

        logger.info(
            `Đã tạo ${uniqueTopicIds.length} quan hệ chủ đề phụ - b� i báo`
        );

    } catch (error) {
        logger.error(
            'Lỗi khi tạo quan hệ chủ đề phụ - b� i báo:',
            error
        );
        throw error;
    }
};

/**
 * Cập nhật to� n bộ mối quan hệ chủ đề phụ cho b� i báo (Chuẩn RESTful PUT)
 * - Bước 1: Xóa to� n bộ quan hệ chủ đề phụ cũ của b� i báo n� y
 * - Bước 2: Gọi lại h� m create để chèn danh sách mới sạch sẽ
 * * @param {number|string} articleId - ID của b� i báo cần cập nhật
 * @param {number[]} topicIds - Mảng các ID chủ đề phụ mới (ví dụ: [3, 4, 5])
 * @param {number|string|null} primaryTopicId - ID chủ đề chính để đối chiếu lọc trùng
 */
export const updateSubTopicArticleRelationships = async (articleId, topicIds, primaryTopicId) => {
    try {
        if (!articleId) {
            throw new Error('Thiếu articleId khi gọi h� m updateSubTopicArticleRelationships');
        }

        const deleteQuery = `
            DELETE FROM "Sub_Topic"
            WHERE "article_id" = $1;
        `;
        await prisma.$queryRawUnsafe(deleteQuery, articleId);

        await createSubTopicArticleRelationships(articleId, topicIds, primaryTopicId);

        logger.info(`Đã cập nhật l� m mới to� n bộ quan hệ chủ đề phụ cho b� i báo ID: ${articleId}`);

    } catch (error) {
        logger.error(`Lỗi khi cập nhật quan hệ chủ đề phụ cho b� i báo ID ${articleId}:`, error);
        throw error;
    }
};

export const topicExists = async (topicId) => {
    try {
        const queryText = `SELECT 1 FROM "Topic" WHERE "topic_id" = $1`;
        const res = await prisma.$queryRawUnsafe(queryText, topicId);
        return res.length > 0;
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
 * @returns {Promise<Object|null>} Trả về Topic sau cập nhật, hoặc null nếu không th� nh công.
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

        const result = await prisma.$queryRawUnsafe(query, ...values);
        return result.length > 0 ? result[0] : null;
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
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result.length > 0 ? result[0] : null;
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
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result.length > 0 ? result[0] : null;
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
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result.length > 0;
    } catch (error) {
        logger.error(`Lỗi khi kiểm tra trạng thái xóa mềm của Topic với ID ${id}:`, error.message);
        throw error;
    }
};




