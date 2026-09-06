import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import {
    buildArticleFilter,
    normalizeArticleSort,
    toOptionalNumber,
} from './articleFilter.service.js';

/**
 * Tìm các b� i báo có chứa các keyword người dùng nhập v� o trên to� n hệ thống
 * Luồng JOIN trong DB: Article → Keyword_Article → Keyword
 * @param {string[]} keywords - Mảng tên keyword (ví dụ: ["Machine Learning", "Deep Learning"])
 * @param {number} limit - Số b� i tối đa trả về
 * @param {number} offset - Vị trí bắt đầu (dùng cho phân trang)
 * @returns {Array} Danh sách b� i báo kèm keyword matched
 */
export const getArticlesByKeywords = async (keywords, limit = 20, offset = 0, params = {}) => {
    const filter = buildArticleFilter(params);
    const keywordPlaceholders = keywords
        .map((_, index) => `$${filter.values.length + index + 1}`)
        .join(', ');

    const values = [...filter.values, ...keywords, limit, offset];
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const query = `
        SELECT DISTINCT
            a."article_id",
            a."title",
            a."abstract",
            a."publication_year",
            a."doi",
            a."created_at"
        FROM "Article" a
        JOIN "Keyword_Article" ka ON ka."article_id" = a."article_id"
        JOIN "Keyword" k         ON k."keyword_id"   = ka."keyword_id"
        LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
        LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
        LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
        WHERE LOWER(k."display_name") IN (${keywordPlaceholders})
          AND ${filter.whereSql}
        ORDER BY a."publication_year" DESC NULLS LAST, a."created_at" DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result;
};

/**
 * Đếm số b� i báo khớp với danh sách từ khóa (case-insensitive).
 *
 * @param {string[]} keywords - Mảng tên keyword (sẽ được so sánh bằng LOWER)
 * @returns {Promise<number>} Tổng số b� i báo khớp
 */
export const countArticlesByKeywords = async (keywords, params = {}) => {
    const filter = buildArticleFilter(params);
    const keywordPlaceholders = keywords
        .map((_, index) => `$${filter.values.length + index + 1}`)
        .join(', ');

    const values = [...filter.values, ...keywords];

    const query = `
        SELECT COUNT(DISTINCT a."article_id") AS "total"
        FROM "Article" a
        JOIN "Keyword_Article" ka ON ka."article_id" = a."article_id"
        JOIN "Keyword" k         ON k."keyword_id"   = ka."keyword_id"
        LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
        LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
        LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
        WHERE LOWER(k."display_name") IN (${keywordPlaceholders})
          AND ${filter.whereSql}
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);
    return parseInt(result[0].total);
};

/**
 * Đếm tổng số b� i báo công khai theo cùng bộ lọc với trang Article List.
 * @param {Object} params
 */
export const countAllArticles = async (params = {}) => {
    const filter = buildArticleFilter(params);
    const query = `
        SELECT COUNT(*) AS "total"
        FROM "Article" a
        LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
        LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
        LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
        LEFT JOIN "Topic" t   ON t."topic_id"   = a."primary_topic"
        WHERE ${filter.whereSql}
    `;

    const result = await prisma.$queryRawUnsafe(query, ...filter.values);
    return parseInt(result[0].total, 10);
};

/**
 * Đếm tổng số b� i báo chưa bị xóa trong hệ thống.
 *
 * @returns {Promise<number>} Tổng số b� i báo
 */
export const getTotalArticles = async () => {
    try {
        const query = `SELECT COUNT(*) AS total FROM "Article" WHERE "is_deleted" = false;`;
        const result = await prisma.$queryRawUnsafe(query);
        return parseInt(result[0].total, 10);
    } catch (error) {
        logger.error('Lỗi khi đếm tổng số b� i báo:', error);
        throw error;
    }
};

export const getArticleListStats = async (params = {}) => {
    try {
        const filter = buildArticleFilter(params);
        const query = `
              WITH FilteredArticles AS (
                  SELECT a."article_id", a."is_open_access", a."primary_topic"
                  FROM "Article" a
                  LEFT JOIN "Issue" i ON i."issue_id" = a."issue_id" AND COALESCE(i."is_deleted", false) = false
                  LEFT JOIN "Volume" v ON v."volume_id" = i."volume_id" AND COALESCE(v."is_deleted", false) = false
                  LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
                  WHERE ${filter.whereSql}
              )
              SELECT
                  (SELECT COUNT(*)::integer FROM FilteredArticles) AS "totalArticles",
                  (SELECT COUNT(*)::integer FROM FilteredArticles WHERE "is_open_access" IS TRUE) AS "openAccessCount",
                  (SELECT COUNT(DISTINCT "primary_topic")::integer FROM FilteredArticles WHERE "primary_topic" IS NOT NULL) AS "topicsCount",
                  (SELECT COUNT(DISTINCT aa."author_id")::integer FROM "Author_Article" aa JOIN FilteredArticles fa ON aa."article_id" = fa."article_id") AS "authorsCount";
          `;
        const result = await prisma.$queryRawUnsafe(query, ...filter.values);
        return result[0] || {
            totalArticles: 0,
            openAccessCount: 0,
            authorsCount: 0,
            topicsCount: 0,
        };
    } catch (error) {
        logger.error('Lỗi khi lấy thống kê b� i báo:', error);
        throw error;
    }
};

/**
 * Lấy danh sách b� i báo công khai cho Article List Page.
 * Hỗ trợ search, filter, sort v�  JOIN metadata từ Issue → Volume → Journal → Topic.
 *
 * @param {Object|number} [firstParam={}] - Object params hoặc legacy numeric limit
 * @param {number} [offsetParam=0]
 * @param {string} [sortByParam='created_at']
 * @param {string} [sortOrderParam='DESC']
 * @returns {Promise<Array>} Mảng b� i báo đã enrich metadata
 */
export const getAllArticles = async (firstParam = {}, offsetParam = 0, sortByParam = 'created_at', sortOrderParam = 'DESC') => {
    try {
        const params = typeof firstParam === 'object' && firstParam !== null
            ? firstParam
            : {
                limit: firstParam !== undefined ? firstParam : 20,
                offset: offsetParam,
                sortBy: sortByParam,
                sortOrder: sortOrderParam,
            };

        const {
            limit = 10,
            offset = 0,
            search = '',
            sortBy = 'created_at',
            sortOrder = 'DESC',
            publicationYear,
            journalId,
            topicId,
            volumeId,
            issueId,
            isOpenAccess,
            countryId,
        } = params;

        const { column, sortOrder: order } = normalizeArticleSort(sortBy, sortOrder);
        const filter = buildArticleFilter(params);
        const values = [...filter.values];

        values.push(Number(limit));
        const limitIndex = values.length;
        values.push(toOptionalNumber(offset) ?? 0);
        const offsetIndex = values.length;

        const query = `
            WITH FilteredArticles AS (
                SELECT a."article_id"
                FROM "Article" a
                LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
                LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
                LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
                WHERE ${filter.whereSql}
                ORDER BY ${column} ${order} NULLS LAST, a."article_id" DESC
                LIMIT $${limitIndex} OFFSET $${offsetIndex}
            )
            SELECT
                a."article_id"::text,
                a."version",
                a."issue_id"::text,
                a."title",
                a."abstract",
                a."publication_year",
                a."doi",
                a."openalex_id",
                a."pdf_url",
                a."landing_url",
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
                a."is_open_access" AS "is_open_access",
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
                ) AS "authors",
                COALESCE(
                    (
                        SELECT json_agg(json_build_object(
                            'keyword_id', k."keyword_id"::text,
                            'display_name', k."display_name"
                        ) ORDER BY COALESCE(ka."score", 0) DESC, k."display_name" ASC)
                        FROM "Keyword_Article" ka
                        JOIN "Keyword" k ON k."keyword_id" = ka."keyword_id"
                        WHERE ka."article_id" = a."article_id"
                    ),
                    '[]'::json
                ) AS "keywords"
            FROM FilteredArticles fa
            JOIN "Article" a ON a."article_id" = fa."article_id"
            LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
            LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
            LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
            LEFT JOIN "Publisher" p ON p."publisher_id" = j."publisher_id"
            LEFT JOIN "Topic" t   ON t."topic_id"   = a."primary_topic"
            ORDER BY ${column} ${order} NULLS LAST, a."article_id" DESC;
        `;

        const result = await prisma.$queryRawUnsafe(query, ...values);
        return result;

    } catch (error) {
        logger.error('Lỗi khi lấy tất cả b� i báo (getAllArticles Service):', error);
        throw error;
    }
};

/**
 * Lấy thông tin chi tiết một b� i báo theo `article_id`.
 * Lưu ý: Trả về cả b� i báo đã bị xóa mềm (is_deleted = true).
 *
 * @param {number|string} articleId - ID b� i báo
 * @returns {Promise<Object|null>} Bản ghi b� i báo hoặc `null` nếu không tồn tại
 */
export const getArticleAnalytics = async (params = {}) => {
    try {
        const filter = buildArticleFilter(params);
        const baseFrom = `
            FROM "Article" a
            LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
            LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
            LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
            LEFT JOIN "Publisher" p ON p."publisher_id" = j."publisher_id"
            LEFT JOIN "Topic" t   ON t."topic_id"   = a."primary_topic"
            WHERE ${filter.whereSql}
        `;

        const totalsQuery = `
            SELECT
                COUNT(DISTINCT a."article_id")::integer AS "totalArticles",
                COUNT(DISTINCT a."article_id") FILTER (WHERE a."is_open_access" IS TRUE)::integer AS "openAccessCount",
                COUNT(DISTINCT a."article_id") FILTER (WHERE a."is_open_access" IS FALSE)::integer AS "closedAccessCount",
                COUNT(DISTINCT a."article_id") FILTER (WHERE a."is_open_access" IS NULL)::integer AS "unknownAccessCount"
            ${baseFrom};
        `;

        const yearQuery = `
            SELECT a."publication_year"::integer AS "year", COUNT(DISTINCT a."article_id")::integer AS "count"
            ${baseFrom}
            GROUP BY a."publication_year"
            ORDER BY a."publication_year" DESC NULLS LAST;
        `;

        const publisherQuery = `
            SELECT p."publisher_id"::text AS "publisher_id", p."display_name" AS "display_name", COUNT(DISTINCT a."article_id")::integer AS "article_count"
            ${baseFrom}
              AND p."publisher_id" IS NOT NULL
            GROUP BY p."publisher_id", p."display_name"
            ORDER BY "article_count" DESC, p."display_name" ASC
            LIMIT 10;
        `;

        const authorQuery = `
            WITH filtered_articles AS (
                SELECT DISTINCT a."article_id"
                ${baseFrom}
            )
            SELECT au."author_id"::text AS "author_id", au."display_name" AS "display_name", COUNT(DISTINCT fa."article_id")::integer AS "article_count"
            FROM filtered_articles fa
            JOIN "Author_Article" aa ON aa."article_id" = fa."article_id"
            JOIN "Author" au ON au."author_id" = aa."author_id" AND COALESCE(au."is_deleted", false) = false
            GROUP BY au."author_id", au."display_name"
            ORDER BY "article_count" DESC, au."display_name" ASC
            LIMIT 10;
        `;

        const topicQuery = `
            SELECT t."topic_id"::text AS "topic_id", t."display_name" AS "display_name", COUNT(DISTINCT a."article_id")::integer AS "article_count"
            ${baseFrom}
              AND t."topic_id" IS NOT NULL
            GROUP BY t."topic_id", t."display_name"
            ORDER BY "article_count" DESC, t."display_name" ASC
            LIMIT 10;
        `;

        const institutionQuery = `
            WITH filtered_articles AS (
                SELECT DISTINCT a."article_id", a."publication_year"
                ${baseFrom}
            )
            SELECT
                inst."institution_id"::text AS "institution_id",
                inst."display_name" AS "display_name",
                COUNT(DISTINCT fa."article_id")::integer AS "article_count"
            FROM filtered_articles fa
            JOIN "Author_Article" aa ON aa."article_id" = fa."article_id"
            JOIN "Author" au ON au."author_id" = aa."author_id" AND COALESCE(au."is_deleted", false) = false
            JOIN "Institution_Author" ia ON ia."author_id" = aa."author_id" AND ia."year" = fa."publication_year"
            JOIN "Institution" inst ON inst."institution_id" = ia."institution_id" AND COALESCE(inst."is_deleted", false) = false
            ${filter.scope === 'vn_universities' ? 'WHERE UPPER(TRIM(inst."country_code")) = \'VN\' AND LOWER(TRIM(inst."type")) = \'education\'' : ''}
            GROUP BY inst."institution_id", inst."display_name"
            ORDER BY "article_count" DESC, inst."display_name" ASC
            LIMIT 10;
        `;

        const keywordQuery = `
            WITH filtered_articles AS (
                SELECT DISTINCT a."article_id"
                ${baseFrom}
            )
            SELECT k."keyword_id"::text AS "keyword_id", k."display_name" AS "display_name", COUNT(DISTINCT fa."article_id")::integer AS "article_count"
            FROM filtered_articles fa
            JOIN "Keyword_Article" ka ON ka."article_id" = fa."article_id"
            JOIN "Keyword" k ON k."keyword_id" = ka."keyword_id"
            GROUP BY k."keyword_id", k."display_name"
            ORDER BY "article_count" DESC, k."display_name" ASC
            LIMIT 10;
        `;

        const [
            totals,
            years,
            publishers,
            authors,
            topics,
            institutions,
            keywords,
        ] = await Promise.all([
            prisma.$queryRawUnsafe(totalsQuery, ...filter.values),
            prisma.$queryRawUnsafe(yearQuery, ...filter.values),
            prisma.$queryRawUnsafe(publisherQuery, ...filter.values),
            prisma.$queryRawUnsafe(authorQuery, ...filter.values),
            prisma.$queryRawUnsafe(topicQuery, ...filter.values),
            prisma.$queryRawUnsafe(institutionQuery, ...filter.values),
            prisma.$queryRawUnsafe(keywordQuery, ...filter.values),
        ]);

        const totalRow = totals[0] || {};
        return {
            scope: filter.scope,
            totals: {
                totalArticles: totalRow.totalArticles || 0,
                openAccessCount: totalRow.openAccessCount || 0,
                closedAccessCount: totalRow.closedAccessCount || 0,
                unknownAccessCount: totalRow.unknownAccessCount || 0,
            },
            yearDistribution: years,
            topPublishers: publishers,
            topAuthors: authors,
            topTopics: topics,
            topInstitutions: institutions,
            topKeywords: keywords,
            accessDistribution: [
                { key: 'oa', label: 'Open access', count: totalRow.openAccessCount || 0 },
                { key: 'closed', label: 'Closed access', count: totalRow.closedAccessCount || 0 },
                { key: 'unknown', label: 'Unknown', count: totalRow.unknownAccessCount || 0 },
            ],
        };
    } catch (error) {
        logger.error('Lỗi khi lấy analytics b� i báo:', error);
        throw error;
    }
};

export const getArticleById = async (articleId) => {
    try {
        const detailQuery = `
            SELECT 
                a."article_id"::text AS "article_id",
                a."version",
                a."issue_id"::text AS "issue_id",
                a."title",
                a."abstract",
                a."publication_year",
                a."doi",
                a."openalex_id",
                a."pdf_url",
                a."landing_url",
                a."primary_topic"::text AS "primary_topic",
                pt."display_name" AS "topic_name",
                a."is_deleted",
                a."created_at",
                i."issue_number" AS "issue_number",
                v."volume_id"::text AS "volume_id",
                v."volume_number" AS "volume_number",
                j."journal_id"::text AS "journal_id",
                j."display_name" AS "journal_name",
                NULLIF(j."issn", '') AS "journal_issn",
                p."publisher_id"::text AS "publisher_id",
                p."display_name" AS "publisher_name",
                a."citation_count",
                a."citing_patents_count",
                a."citations_by_year",
                a."references",
                a."reference_count",
                (
                    SELECT COUNT(*)::integer
                    FROM "Article_Citing_Work" acw
                    WHERE acw."article_id" = a."article_id"
                ) AS "citing_works_count",
                (
                    SELECT COUNT(*)::integer
                    FROM "Article_Reference" ar
                    WHERE ar."article_id" = a."article_id"
                ) AS "available_references_count",
                a."is_open_access" AS "is_open_access",
                CASE
                    WHEN a."doi" IS NULL OR TRIM(a."doi") = '' THEN NULL
                    WHEN a."doi" ILIKE 'http%' THEN a."doi"
                    ELSE CONCAT('https://doi.org/', a."doi")
                END AS "source_url"
            FROM "Article" a
            LEFT JOIN "Issue" i   ON i."issue_id" = a."issue_id"
            LEFT JOIN "Volume" v  ON v."volume_id" = i."volume_id"
            LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id"
            LEFT JOIN "Publisher" p ON p."publisher_id" = j."publisher_id"
            LEFT JOIN "Topic" pt  ON pt."topic_id" = a."primary_topic"
            WHERE a."article_id" = $1::bigint;
        `;

        const detailResult = await prisma.$queryRawUnsafe(detailQuery, BigInt(articleId));
        const article = detailResult[0] || null;

        if (!article) {
            return null;
        }

        const authorsQuery = `
            SELECT 
                au."author_id"::text AS "author_id",
                au."display_name",
                au."orcid",
                au."url_image",
                au."last_known_institution",
                au."works_count",
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'institution_id', inst."institution_id"::text,
                            'display_name', inst."display_name",
                            'country_code', inst."country_code",
                            'type', inst."type"
                        )
                    ) FILTER (WHERE inst."institution_id" IS NOT NULL),
                    '[]'::json
                ) AS "institutions"
            FROM "Author_Article" aa
            JOIN "Author" au ON au."author_id" = aa."author_id"
            LEFT JOIN "Institution_Author" ia
              ON ia."author_id" = au."author_id"
             AND ia."year" = $2
            LEFT JOIN "Institution" inst
              ON inst."institution_id" = ia."institution_id"
             AND COALESCE(inst."is_deleted", false) = false
            WHERE aa."article_id" = $1
              AND COALESCE(au."is_deleted", false) = false
            GROUP BY
                au."author_id",
                au."display_name",
                au."orcid",
                au."url_image",
                au."last_known_institution",
                au."works_count"
            ORDER BY au."display_name" ASC;
        `;

        const keywordsQuery = `
            SELECT 
                k."keyword_id"::text AS "keyword_id",
                k."display_name",
                ka."score"
            FROM "Keyword_Article" ka
            JOIN "Keyword" k ON k."keyword_id" = ka."keyword_id"
            WHERE ka."article_id" = $1
            ORDER BY COALESCE(ka."score", 0) DESC, k."display_name" ASC;
        `;

        const topicsQuery = `
            SELECT 
                t."topic_id"::text AS "topic_id",
                t."display_name",
                (t."topic_id" = a."primary_topic") AS "is_primary"
            FROM "Article" a
            JOIN (
                SELECT "article_id", "topic_id" FROM "Sub_Topic"
                UNION
                SELECT "article_id", "primary_topic" AS "topic_id"
                FROM "Article"
                WHERE "primary_topic" IS NOT NULL
            ) at ON at."article_id" = a."article_id"
            JOIN "Topic" t ON t."topic_id" = at."topic_id"
            WHERE a."article_id" = $1::bigint AND COALESCE(t."is_deleted", false) = false
            ORDER BY "is_primary" DESC, t."display_name" ASC;
        `;

        const [authorsResult, keywordsResult, topicsResult] = await Promise.all([
            prisma.$queryRawUnsafe(authorsQuery, BigInt(articleId), article.publication_year),
            prisma.$queryRawUnsafe(keywordsQuery, BigInt(articleId)),
            prisma.$queryRawUnsafe(topicsQuery, BigInt(articleId))
        ]);

        const institutionMap = new Map();
        for (const author of authorsResult) {
            for (const institution of author.institutions || []) {
                if (institution?.institution_id && !institutionMap.has(institution.institution_id)) {
                    institutionMap.set(institution.institution_id, institution);
                }
            }
        }

        return {
            ...article,
            authors: authorsResult,
            institutions: Array.from(institutionMap.values()),
            keywords: keywordsResult,
            topics: topicsResult,
        };
    } catch (error) {
        logger.error('Lỗi khi lấy thông tin b� i báo theo ID:', error);
        throw error;
    }
};

const normalizeLimitOffset = (limit, offset, defaultLimit = 20) => {
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);
    return {
        limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : defaultLimit,
        offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
    };
};

export const countArticleCitingWorks = async (articleId) => {
    const result = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*)::integer AS "total" FROM "Article_Citing_Work" WHERE "article_id" = $1::bigint', BigInt(articleId)
    );
    return result[0]?.total || 0;
};

export const getArticleCitingWorksAnalytics = async (articleId) => {
    const query = `
        SELECT
            "publication_year" AS "year",
            COUNT(*)::integer AS "count"
        FROM "Article_Citing_Work"
        WHERE "article_id" = $1::bigint
        GROUP BY "publication_year"
        ORDER BY "publication_year" ASC NULLS LAST;
    `;

    const [totalResult, distributionResult] = await Promise.all([
        prisma.$queryRawUnsafe(
            'SELECT COUNT(*)::integer AS "total" FROM "Article_Citing_Work" WHERE "article_id" = $1::bigint', BigInt(articleId)
        ),
        prisma.$queryRawUnsafe(query, BigInt(articleId)),
    ]);

    return {
        total: totalResult[0]?.total || 0,
        year_distribution: distributionResult,
    };
};

export const getArticleCitingWorks = async (articleId, { limit = 20, offset = 0 } = {}) => {
    const paging = normalizeLimitOffset(limit, offset, 20);
    const query = `
        SELECT
            "article_id"::text,
            "openalex_work_id",
            "doi",
            "title",
            "publication_year",
            "source_name",
            "source_url",
            "landing_url",
            "pdf_url",
            "cited_by_count",
            "type",
            COALESCE("authors", '[]'::jsonb) AS "authors"
        FROM "Article_Citing_Work"
        WHERE "article_id" = $1::bigint
        ORDER BY "publication_year" DESC NULLS LAST, "cited_by_count" DESC NULLS LAST, "title" ASC
        LIMIT $2 OFFSET $3;
    `;
    const result = await prisma.$queryRawUnsafe(query, BigInt(articleId), paging.limit, paging.offset);
    return result;
};

export const countArticleReferences = async (articleId) => {
    const result = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*)::integer AS "total" FROM "Article_Reference" WHERE "article_id" = $1::bigint', BigInt(articleId)
    );
    return result[0]?.total || 0;
};

export const getArticleReferences = async (articleId, { limit = 50, offset = 0 } = {}) => {
    const paging = normalizeLimitOffset(limit, offset, 50);
    const query = `
        SELECT
            "article_id"::text,
            "reference_key",
            "openalex_work_id",
            "semantic_scholar_id",
            "doi",
            "title",
            "publication_year",
            "source_name",
            "source_url",
            "landing_url",
            "pdf_url",
            "cited_by_count",
            "type",
            COALESCE("authors", '[]'::jsonb) AS "authors"
        FROM "Article_Reference"
        WHERE "article_id" = $1::bigint
        ORDER BY "publication_year" DESC NULLS LAST, "title" ASC, "reference_key" ASC
        LIMIT $2 OFFSET $3;
    `;
    const result = await prisma.$queryRawUnsafe(query, BigInt(articleId), paging.limit, paging.offset);
    return result;
};

/**
 * Tạo mới một bản ghi b� i báo (dữ liệu thô) v�  trả về record vừa tạo.
 *
 * @param {Object} articleData - Dữ liệu b� i báo
 * @param {string} articleData.title - Tiêu đề (bắt buộc)
 * @param {number} articleData.publication_year - Năm xuất bản (bắt buộc)
 * @param {number} [articleData.issue_id]
 * @param {string} [articleData.abstract]
 * @param {string} [articleData.doi]
 * @param {number|null} [articleData.primary_topic]
 * @returns {Promise<Object>} Bản ghi b� i báo vừa tạo
 */
export const createArticle = async (articleData) => {
    try {
        const {
            version = null,
            issue_id = null,
            title,            
            abstract = null,
            publication_year, 
            doi = null,
            primary_topic = null
        } = articleData;

        if (!title || publication_year === undefined) {
            throw new Error('Title and publication_year are required fields.');
        }

        const query = `
            INSERT INTO "Article" (
                version, 
                issue_id, 
                title, 
                abstract, 
                publication_year, 
                doi, 
                primary_topic
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;

        const values = [
            version,
            issue_id,
            title,
            abstract,
            publication_year,
            doi,
            primary_topic
        ];

        const result = await prisma.$queryRawUnsafe(query, ...values);
        return result[0];

    } catch (error) {
        logger.error('Error creating article:', error);
        throw error;
    }
};

/**
 * Cập nhật thông tin cốt lõi của b� i báo (Tầng Service)
 * @param {Object} params 
 * @param {number|string} params.article_id - ID b� i báo cần update (Bắt buộc)
 * @param {Object} params.updateData - Object chứa các trường muốn thay đổi từ req.body
 * @returns {Promise<Object|null>} Bản ghi sau khi update th� nh công
 */
export const updateArticle = async ({ article_id, ...updateData }) => {
    try {
        if (!article_id) {
            throw new Error('Thiếu article_id khi gọi h� m updateArticle Service.');
        }

        const currentQuery = `SELECT * FROM "Article" WHERE "article_id" = $1::bigint;`;
        const currentResult = await prisma.$queryRawUnsafe(currentQuery, article_id);
        const currentArticle = currentResult[0];

        if (!currentArticle) {
            return null;
        }

        const { title, publication_year, version, issue_id, abstract, doi, primary_topic } = updateData;

        const fieldsToSet = [];
        const values = [article_id];

        if (title !== undefined) {
            const trimmedTitle = String(title).trim();
            if (trimmedTitle === '') {
                throw new Error('VALIDATION_ERROR: Tiêu đề không được để trống.');
            }
            if (trimmedTitle !== currentArticle.title) {
                fieldsToSet.push('title');
                values.push(trimmedTitle);
            }
        }

        if (publication_year !== undefined) {
            const yearNum = Number(publication_year);
            if (isNaN(yearNum) || yearNum <= 0) {
                throw new Error('VALIDATION_ERROR: Năm xuất bản phải l�  số dương hợp lệ.');
            }
            if (yearNum !== currentArticle.publication_year) {
                fieldsToSet.push('publication_year');
                values.push(yearNum);
            }
        }

        if (version !== undefined && version !== currentArticle.version) {
            fieldsToSet.push('version');
            values.push(version);
        }

        if (abstract !== undefined && abstract !== currentArticle.abstract) {
            fieldsToSet.push('abstract');
            values.push(abstract);
        }

        if (doi !== undefined && doi !== currentArticle.doi) {
            fieldsToSet.push('doi');
            values.push(doi);
        }

        if (issue_id !== undefined) {
            if (String(currentArticle.issue_id) === String(issue_id)) {
                throw new Error('VALIDATION_ERROR: Không thể cập nhật cùng một mã issue.');
            }
            
            const issueExistsRes = await prisma.$queryRawUnsafe('SELECT 1 FROM "Issue" WHERE issue_id = $1 LIMIT 1', issue_id);
            if (issueExistsRes.length === 0) {
                throw new Error('VALIDATION_ERROR: Mã Issue ID không tồn tại trên hệ thống.');
            }

            fieldsToSet.push('issue_id');
            values.push(issue_id);
        }

        if (primary_topic !== undefined) {
            if (Number(primary_topic) === 0) {
                if (currentArticle.primary_topic !== null) {
                    fieldsToSet.push('primary_topic');
                    values.push(null);
                }
            } else {
                if (String(currentArticle.primary_topic) === String(primary_topic)) {
                    throw new Error('VALIDATION_ERROR: Không thể cập nhật cùng giá trị Primary Topic.');
                }

                const topicExistsRes = await prisma.$queryRawUnsafe('SELECT 1 FROM "Topic" WHERE topic_id = $1 LIMIT 1', primary_topic);
                if (topicExistsRes.length === 0) {
                    throw new Error('VALIDATION_ERROR: Primary topic không tồn tại trên hệ thống.');
                }

                fieldsToSet.push('primary_topic');
                values.push(primary_topic);
            }
        }

        if (fieldsToSet.length === 0) {
            return currentArticle;
        }

        const setClause = fieldsToSet
            .map((field, index) => `"${field}" = $${index + 2}`)
            .join(', ');

        // 6. Thực thi câu lệnh UPDATE xuống Postgres
        const query = `
            UPDATE "Article"
            SET ${setClause}
            WHERE "article_id" = $1::bigint
            RETURNING 
                article_id,
                version,
                issue_id,
                title,
                abstract,
                publication_year,
                doi,
                primary_topic,
                created_at;
        `;

        const result = await prisma.$queryRawUnsafe(query, ...values);
        return result[0] || null;

    } catch (error) {
        throw error; // Quăng lỗi lên để Controller bắt lấy v�  trả về res.status
    }
};

/**
 * Xóa mềm một bản ghi b� i báo dựa trên ID (Chuyển is_deleted th� nh TRUE).
 *
 * @param {number|string} articleId - ID của b� i báo cần xóa mềm
 * @returns {Promise<Object|null>} Bản ghi b� i báo sau khi được cập nhật xóa mềm, hoặc null nếu không tìm thấy
 */
export const deleteArticle = async (articleId) => {
    try {
        // Kiểm tra đầu v� o bắt buộc
        if (!articleId) {
            throw new Error('Article ID is required for deletion.');
        }

        const query = `
            UPDATE "Article"
            SET "is_deleted" = TRUE
            WHERE "article_id" = $1::bigint AND "is_deleted" = FALSE
            RETURNING *;
        `;

        const values = [articleId];

        const result = await prisma.$queryRawUnsafe(query, ...values);

        // Nếu cập nhật th� nh công, result[0] sẽ chứa thông tin b� i báo kèm theo is_deleted = true
        // Nếu b� i báo đã bị xóa mềm từ trước hoặc không tồn tại, result[0] sẽ l�  undefined
        return result[0] || null;

    } catch (error) {
        logger.error(`Error soft-deleting article with ID ${articleId}:`, error);
        throw error;
    }
};

/**
 * Khôi phục một b� i báo đã bị xóa mềm (Chuyển is_deleted th� nh FALSE).
 *
 * @param {number|string} articleId - ID của b� i báo cần khôi phục
 * @returns {Promise<Object|null>} Bản ghi b� i báo sau khi khôi phục, hoặc null nếu không tìm thấy
 */
export const restoreArticle = async (articleId) => {
    try {
        // Kiểm tra đầu v� o bắt buộc
        if (!articleId) {
            throw new Error('Article ID is required for restoration.');
        }

        const query = `
            UPDATE "Article"
            SET "is_deleted" = FALSE
            WHERE "article_id" = $1::bigint AND "is_deleted" = TRUE
            RETURNING *;
        `;

        const values = [articleId];

        const result = await prisma.$queryRawUnsafe(query, ...values);

        // Nếu cập nhật th� nh công, result[0] sẽ chứa thông tin b� i báo kèm theo is_deleted = false
        // Nếu b� i báo không bị xóa hoặc không tồn tại, result[0] sẽ l�  undefined
        return result[0] || null;

    } catch (error) {
        logger.error(`Error restoring article with ID ${articleId}:`, error);
        throw error;
    }
};

/**
 * Kiểm tra sự tồn tại của một b� i báo dựa trên `article_id`.
 * H� m n� y sẽ trả về `true` nếu b� i báo tồn tại (bất kể đã bị xóa mềm hay chưa), v�  `false` nếu không tìm thấy.
 *
 * @param {number|string} articleId - ID của b� i báo cần kiểm tra
 * @returns {Promise<boolean>} `true` nếu b� i báo tồn tại, `false` nếu không tìm thấy
 */
export const articleExists = async (articleId) => {
    try {
        const query = `SELECT EXISTS (SELECT 1 FROM "Article" WHERE "article_id" = $1::bigint);`;
        const result = await prisma.$queryRawUnsafe(query, BigInt(articleId));
        return result[0].exists;
    } catch (error) {
        logger.error(`Error checking if article with ID ${articleId} exists:`, error);
        throw error;
    }

}




