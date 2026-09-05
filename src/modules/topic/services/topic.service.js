import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import {
    buildArticleFilter,
    normalizeArticleSort,
} from '../../article/services/articleFilter.service.js';

/**
 * TÃ¬m Topic theo ID.
 *
 * @async
 * @param {number|string} topicId - ID cá»§a topic cáº§n tra cá»©u.
 * @returns {Promise<Object|null>} Äá»‘i tÆ°á»£ng topic hoáº·c null náº¿u khÃ´ng tÃ¬m tháº¥y.
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
 * Kiá»ƒm tra xem cÃ³ Topic nÃ o khÃ¡c Ä‘ang hoáº¡t Ä‘á»™ng trÃ¹ng láº·p display_name khÃ´ng.
 * 
 * @async
 * @param {string} displayName - TÃªn cáº§n kiá»ƒm tra.
 * @param {number|string} [excludeId=null] - ID cáº§n loáº¡i trá»« (trong trÆ°á»ng há»£p update).
 * @returns {Promise<{ duplicateName: boolean }>} Äá»‘i tÆ°á»£ng chá»©a káº¿t quáº£ trÃ¹ng láº·p.
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
        logger.error("Lá»—i khi kiá»ƒm tra trÃ¹ng láº·p Topic:", error.message);
        throw error;
    }
};

/**
 * Táº¡o má»›i má»™t Topic.
 * 
 * @async
 * @param {Object} data - Dá»¯ liá»‡u táº¡o.
 * @param {string} data.display_name - TÃªn hiá»ƒn thá»‹.
 * @param {number} [data.score] - Äiá»ƒm Ä‘Ã¡nh giÃ¡ (máº·c Ä‘á»‹nh 0).
 * @param {number|string} [data.subject_area_id] - ID Subject Area.
 * @param {number|string} [data.subject_category_id] - ID Subject Category.
 * @returns {Promise<Object>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng vá»«a táº¡o.
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
        logger.error("Lá»—i khi táº¡o má»›i Topic:", error.message);
        throw error;
    }
};

/**
 * Láº¥y danh sÃ¡ch Topic há»— trá»£ tÃ¬m kiáº¿m, phÃ¢n trang, lá»c vÃ  sáº¯p xáº¿p.
 * Chá»‰ láº¥y báº£n ghi chÆ°a bá»‹ xÃ³a má»m (is_deleted = false).
 * 
 * @async
 * @param {Object} params - Tham sá»‘ Ä‘áº§u vÃ o.
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

        // Lá»c theo subject_area_id
        if (subject_area_id !== undefined && subject_area_id !== null && subject_area_id.toString().trim() !== "") {
            queryParams.push(BigInt(subject_area_id));
            baseQuery += ` AND t.subject_area_id = $${queryParams.length}`;
        }

        // Lá»c theo subject_category_id
        if (subject_category_id !== undefined && subject_category_id !== null && subject_category_id.toString().trim() !== "") {
            queryParams.push(BigInt(subject_category_id));
            baseQuery += ` AND t.subject_category_id = $${queryParams.length}`;
        }

        // TÃ¬m kiáº¿m theo display_name
        if (search !== undefined && search !== null && search.toString().trim() !== "") {
            queryParams.push(`%${search.toString().trim()}%`);
            baseQuery += ` AND t.display_name ILIKE $${queryParams.length}`;
        }

        // Äáº¿m tá»•ng sá»‘ báº£n ghi
        const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;
        const countRes = await prisma.$queryRawUnsafe(countQuery, ...queryParams);
        const total = countRes[0]?.total || 0;

        // Sáº¯p xáº¿p
        const allowedSortFields = ["topic_id", "display_name", "score"];
        const sortField = allowedSortFields.includes(sort_by) ? sort_by : "display_name";
        const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

        // PhÃ¢n trang
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
        logger.error("Lá»—i khi láº¥y danh sÃ¡ch Topic:", error.message);
        throw error;
    }
};

/**
 * Láº¥y danh sÃ¡ch bÃ i bÃ¡o thuá»™c má»™t topic (qua primary_topic hoáº·c Sub_Topic).
 *
 * Luá»“ng JOIN:
 *   - Article.primary_topic = topic_id  (bÃ i bÃ¡o cÃ³ primary topic trÃ¹ng)
 *   - Sub_Topic(article_id, topic_id)   (bÃ i bÃ¡o Ä‘Æ°á»£c gáº¯n sub-topic)
 *
 * @async
 * @param {number} topicId - ID cá»§a topic.
 * @param {number} limit   - Sá»‘ bÃ i tá»‘i Ä‘a tráº£ vá».
 * @param {number} offset  - Vá»‹ trÃ­ báº¯t Ä‘áº§u (phÃ¢n trang).
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch bÃ i bÃ¡o.
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
 * Äáº¿m tá»•ng sá»‘ bÃ i bÃ¡o thuá»™c má»™t topic.
 *
 * @async
 * @param {number} topicId - ID cá»§a topic.
 * @returns {Promise<number>} Tá»•ng sá»‘ bÃ i bÃ¡o.
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
        // 1. Kiá»ƒm tra Ä‘áº§u vÃ o, náº¿u máº£ng rá»—ng thÃ¬ thoÃ¡t sá»›m
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
            logger.info('KhÃ´ng cÃ³ chá»§ Ä‘á» phá»¥ nÃ o há»£p lá»‡ Ä‘á»ƒ thÃªm (hoáº·c Ä‘Ã£ bá»‹ trÃ¹ng vá»›i Chá»§ Ä‘á» chÃ­nh).');
            return;
        }

        const query = `
            INSERT INTO "Sub_Topic" (article_id, topic_id)
            SELECT $1, unnest($2::bigint[])
            ON CONFLICT DO NOTHING
        `;


        await prisma.$queryRawUnsafe(query, articleId, uniqueTopicIds);

        logger.info(
            `ÄÃ£ táº¡o ${uniqueTopicIds.length} quan há»‡ chá»§ Ä‘á» phá»¥ - bÃ i bÃ¡o`
        );

    } catch (error) {
        logger.error(
            'Lá»—i khi táº¡o quan há»‡ chá»§ Ä‘á» phá»¥ - bÃ i bÃ¡o:',
            error
        );
        throw error;
    }
};

/**
 * Cáº­p nháº­t toÃ n bá»™ má»‘i quan há»‡ chá»§ Ä‘á» phá»¥ cho bÃ i bÃ¡o (Chuáº©n RESTful PUT)
 * - BÆ°á»›c 1: XÃ³a toÃ n bá»™ quan há»‡ chá»§ Ä‘á» phá»¥ cÅ© cá»§a bÃ i bÃ¡o nÃ y
 * - BÆ°á»›c 2: Gá»i láº¡i hÃ m create Ä‘á»ƒ chÃ¨n danh sÃ¡ch má»›i sáº¡ch sáº½
 * * @param {number|string} articleId - ID cá»§a bÃ i bÃ¡o cáº§n cáº­p nháº­t
 * @param {number[]} topicIds - Máº£ng cÃ¡c ID chá»§ Ä‘á» phá»¥ má»›i (vÃ­ dá»¥: [3, 4, 5])
 * @param {number|string|null} primaryTopicId - ID chá»§ Ä‘á» chÃ­nh Ä‘á»ƒ Ä‘á»‘i chiáº¿u lá»c trÃ¹ng
 */
export const updateSubTopicArticleRelationships = async (articleId, topicIds, primaryTopicId) => {
    try {
        if (!articleId) {
            throw new Error('Thiáº¿u articleId khi gá»i hÃ m updateSubTopicArticleRelationships');
        }

        const deleteQuery = `
            DELETE FROM "Sub_Topic"
            WHERE "article_id" = $1;
        `;
        await prisma.$queryRawUnsafe(deleteQuery, articleId);

        await createSubTopicArticleRelationships(articleId, topicIds, primaryTopicId);

        logger.info(`ÄÃ£ cáº­p nháº­t lÃ m má»›i toÃ n bá»™ quan há»‡ chá»§ Ä‘á» phá»¥ cho bÃ i bÃ¡o ID: ${articleId}`);

    } catch (error) {
        logger.error(`Lá»—i khi cáº­p nháº­t quan há»‡ chá»§ Ä‘á» phá»¥ cho bÃ i bÃ¡o ID ${articleId}:`, error);
        throw error;
    }
};

export const topicExists = async (topicId) => {
    try {
        const queryText = `SELECT 1 FROM "Topic" WHERE "topic_id" = $1`;
        const res = await prisma.$queryRawUnsafe(queryText, topicId);
        return res.length > 0;
    } catch (error) {
        logger.error('Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a chá»§ Ä‘á»:', error);
        throw error;
    }
}

/**
 * Cáº­p nháº­t thÃ´ng tin Topic.
 * Dynamic update â€” chá»‰ cáº­p nháº­t cÃ¡c field Ä‘Æ°á»£c gá»­i lÃªn.
 *
 * @async
 * @param {number|string} id - ID cá»§a Topic cáº§n cáº­p nháº­t.
 * @param {Object} data - Dá»¯ liá»‡u cáº§n cáº­p nháº­t.
 * @param {string} [data.display_name] - TÃªn topic má»›i.
 * @param {number} [data.score] - Äiá»ƒm Ä‘Ã¡nh giÃ¡.
 * @param {number|string} [data.subject_area_id] - ID Subject Area.
 * @param {number|string} [data.subject_category_id] - ID Subject Category.
 * @returns {Promise<Object|null>} Tráº£ vá» Topic sau cáº­p nháº­t, hoáº·c null náº¿u khÃ´ng thÃ nh cÃ´ng.
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
            return null; // KhÃ´ng cÃ³ gÃ¬ Ä‘á»ƒ cáº­p nháº­t
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
        logger.error(`Lá»—i khi cáº­p nháº­t Topic ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * XÃ³a má»m má»™t Topic (Ä‘áº·t is_deleted = true).
 *
 * @async
 * @param {number|string} id - ID cá»§a Topic cáº§n xÃ³a má»m.
 * @returns {Promise<Object|null>} Tráº£ vá» thÃ´ng tin Topic Ä‘Ã£ xÃ³a má»m, hoáº·c null.
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
        logger.error(`Lá»—i khi xÃ³a má»m Topic ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * KhÃ´i phá»¥c má»™t Topic Ä‘Ã£ bá»‹ xÃ³a má»m (Ä‘áº·t is_deleted = false).
 *
 * @async
 * @param {number|string} id - ID cá»§a Topic cáº§n khÃ´i phá»¥c.
 * @returns {Promise<Object|null>} Tráº£ vá» thÃ´ng tin Topic Ä‘Ã£ khÃ´i phá»¥c, hoáº·c null.
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
        logger.error(`Lá»—i khi khÃ´i phá»¥c Topic ID ${id}:`, error.message);
        throw error;
    }
};

/**
 * Kiá»ƒm tra xem Topic cÃ³ Ä‘ang bá»‹ xÃ³a má»m (is_deleted = true) hay khÃ´ng.
 *
 * @async
 * @param {number|string} id - ID cá»§a Topic cáº§n kiá»ƒm tra.
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u Topic Ä‘Ã£ bá»‹ xÃ³a má»m, ngÆ°á»£c láº¡i false.
 */
export const topicIsDeleted = async (id) => {
    try {
        const query = `SELECT 1 FROM "Topic" WHERE topic_id = $1 AND is_deleted = true`;
        const result = await prisma.$queryRawUnsafe(query, BigInt(id));
        return result.length > 0;
    } catch (error) {
        logger.error(`Lá»—i khi kiá»ƒm tra tráº¡ng thÃ¡i xÃ³a má»m cá»§a Topic vá»›i ID ${id}:`, error.message);
        throw error;
    }
};




