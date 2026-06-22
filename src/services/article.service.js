import pool from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Tìm các bài báo có chứa các keyword người dùng nhập vào trên toàn hệ thống
 * Luồng JOIN trong DB: Article → Keyword_Article → Keyword
 * @param {string[]} keywords - Mảng tên keyword (ví dụ: ["Machine Learning", "Deep Learning"])
 * @param {number} limit - Số bài tối đa trả về
 * @param {number} offset - Vị trí bắt đầu (dùng cho phân trang)
 * @returns {Array} Danh sách bài báo kèm keyword matched
 */
export const getArticlesByKeywords = async (keywords, limit = 20, offset = 0) => {
    const keywordPlaceholders = keywords
        .map((_, index) => `$${index + 3}`)
        .join(', ');

    const values = [limit, offset, ...keywords];

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
        WHERE LOWER(k."display_name") IN (${keywordPlaceholders})
          AND a."is_deleted" = false
        ORDER BY a."publication_year" DESC NULLS LAST, a."created_at" DESC
        LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, values);
    return result.rows;
};

/**
 * Đếm số bài báo khớp với danh sách từ khóa (case-insensitive).
 *
 * @param {string[]} keywords - Mảng tên keyword (sẽ được so sánh bằng LOWER)
 * @returns {Promise<number>} Tổng số bài báo khớp
 */
export const countArticlesByKeywords = async (keywords) => {
    const keywordPlaceholders = keywords
        .map((_, index) => `$${index + 1}`)
        .join(', ');

    const values = [...keywords];

    const query = `
        SELECT COUNT(DISTINCT a."article_id") AS "total"
        FROM "Article" a
        JOIN "Keyword_Article" ka ON ka."article_id" = a."article_id"
        JOIN "Keyword" k         ON k."keyword_id"   = ka."keyword_id"
        WHERE LOWER(k."display_name") IN (${keywordPlaceholders})
          AND a."is_deleted" = false
    `;

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].total);
};

const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Đếm tổng số bài báo công khai theo cùng bộ lọc với trang Article List.
 * @param {Object} params
 */
export const countAllArticles = async ({
    search = '',
    publicationYear,
    journalId,
    topicId,
    volumeId,
    issueId,
    isOpenAccess,
} = {}) => {
    const values = [];
    const where = ['a."is_deleted" = false'];

    let query = `
        SELECT COUNT(*) AS "total"
        FROM "Article" a
        LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
        LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
        LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
        LEFT JOIN "Topic" t   ON t."topic_id"   = a."primary_topic"
    `;

    if (search) {
        values.push(`%${search}%`);
        where.push(`(a."title" ILIKE $${values.length} OR a."doi" ILIKE $${values.length} OR a."abstract" ILIKE $${values.length})`);
    }

    const publicationYearNum = toOptionalNumber(publicationYear);
    if (publicationYearNum !== undefined) {
        values.push(publicationYearNum);
        where.push(`a."publication_year" = $${values.length}`);
    }

    const journalIdNum = toOptionalNumber(journalId);
    if (journalIdNum !== undefined) {
        values.push(journalIdNum);
        where.push(`j."journal_id" = $${values.length}`);
    }

    const topicIdNum = toOptionalNumber(topicId);
    if (topicIdNum !== undefined) {
        values.push(topicIdNum);
        where.push(`a."primary_topic" = $${values.length}`);
    }

    const volumeIdNum = toOptionalNumber(volumeId);
    if (volumeIdNum !== undefined) {
        values.push(volumeIdNum);
        where.push(`v."volume_id" = $${values.length}`);
    }

    const issueIdNum = toOptionalNumber(issueId);
    if (issueIdNum !== undefined) {
        values.push(issueIdNum);
        where.push(`a."issue_id" = $${values.length}`);
    }

    if (isOpenAccess !== undefined) {
        values.push(isOpenAccess === true || isOpenAccess === 'true');
        where.push(`COALESCE(j."is_open_access", false) = $${values.length}`);
    }

    query += ` WHERE ${where.join(' AND ')}`;

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].total, 10);
};

/**
 * Đếm tổng số bài báo chưa bị xóa trong hệ thống.
 *
 * @returns {Promise<number>} Tổng số bài báo
 */
export const getTotalArticles = async () => {
    try {
        const query = `SELECT COUNT(*) AS total FROM "Article" WHERE "is_deleted" = false;`;
        const result = await pool.query(query);
        return parseInt(result.rows[0].total, 10);
    } catch (error) {
        logger.error('Lỗi khi đếm tổng số bài báo:', error);
        throw error;
    }
};

export const getArticleListStats = async () => {
    try {
        const query = `
            SELECT
                COUNT(DISTINCT a."article_id")::integer AS "totalArticles",
                COUNT(DISTINCT a."article_id") FILTER (WHERE COALESCE(j."is_open_access", false) = true)::integer AS "openAccessCount",
                COUNT(DISTINCT aa."author_id")::integer AS "authorsCount",
                COUNT(DISTINCT a."primary_topic") FILTER (WHERE a."primary_topic" IS NOT NULL)::integer AS "topicsCount"
            FROM "Article" a
            LEFT JOIN "Issue" i ON i."issue_id" = a."issue_id" AND COALESCE(i."is_deleted", false) = false
            LEFT JOIN "Volume" v ON v."volume_id" = i."volume_id" AND COALESCE(v."is_deleted", false) = false
            LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
            LEFT JOIN "Author_Article" aa ON aa."article_id" = a."article_id"
            WHERE a."is_deleted" = false;
        `;
        const result = await pool.query(query);
        return result.rows[0] || {
            totalArticles: 0,
            openAccessCount: 0,
            authorsCount: 0,
            topicsCount: 0,
        };
    } catch (error) {
        logger.error('Lỗi khi lấy thống kê bài báo:', error);
        throw error;
    }
};

/**
 * Lấy danh sách bài báo công khai cho Article List Page.
 * Hỗ trợ search, filter, sort và JOIN metadata từ Issue → Volume → Journal → Topic.
 *
 * @param {Object|number} [firstParam={}] - Object params hoặc legacy numeric limit
 * @param {number} [offsetParam=0]
 * @param {string} [sortByParam='created_at']
 * @param {string} [sortOrderParam='DESC']
 * @returns {Promise<Array>} Mảng bài báo đã enrich metadata
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
        } = params;

        const allowedColumns = {
            article_id: 'a."article_id"',
            title: 'a."title"',
            publication_year: 'a."publication_year"',
            created_at: 'a."created_at"',
            doi: 'a."doi"',
        };
        const column = allowedColumns[sortBy] || allowedColumns.created_at;
        const order = ['ASC', 'DESC'].includes(String(sortOrder).toUpperCase())
            ? String(sortOrder).toUpperCase()
            : 'DESC';

        const values = [];
        const where = ['a."is_deleted" = false'];

        if (search && search.trim()) {
            values.push(`%${search.trim()}%`);
            where.push(`(a."title" ILIKE $${values.length} OR a."doi" ILIKE $${values.length} OR a."abstract" ILIKE $${values.length})`);
        }

        const publicationYearNum = toOptionalNumber(publicationYear);
        if (publicationYearNum !== undefined) {
            values.push(publicationYearNum);
            where.push(`a."publication_year" = $${values.length}`);
        }

        const journalIdNum = toOptionalNumber(journalId);
        if (journalIdNum !== undefined) {
            values.push(journalIdNum);
            where.push(`j."journal_id" = $${values.length}`);
        }

        const topicIdNum = toOptionalNumber(topicId);
        if (topicIdNum !== undefined) {
            values.push(topicIdNum);
            where.push(`a."primary_topic" = $${values.length}`);
        }

        const volumeIdNum = toOptionalNumber(volumeId);
        if (volumeIdNum !== undefined) {
            values.push(volumeIdNum);
            where.push(`v."volume_id" = $${values.length}`);
        }

        const issueIdNum = toOptionalNumber(issueId);
        if (issueIdNum !== undefined) {
            values.push(issueIdNum);
            where.push(`a."issue_id" = $${values.length}`);
        }

        if (isOpenAccess !== undefined) {
            values.push(isOpenAccess === true || isOpenAccess === 'true');
            where.push(`COALESCE(j."is_open_access", false) = $${values.length}`);
        }

        values.push(toOptionalNumber(limit) ?? 10);
        const limitIndex = values.length;
        values.push(toOptionalNumber(offset) ?? 0);
        const offsetIndex = values.length;

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
                COALESCE(j."is_open_access", false) AS "is_open_access"
            FROM "Article" a
            LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
            LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
            LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
            LEFT JOIN "Topic" t   ON t."topic_id"   = a."primary_topic"
            WHERE ${where.join(' AND ')}
            ORDER BY ${column} ${order} NULLS LAST, a."article_id" DESC
            LIMIT $${limitIndex} OFFSET $${offsetIndex};
        `;

        const result = await pool.query(query, values);
        return result.rows;

    } catch (error) {
        logger.error('Lỗi khi lấy tất cả bài báo (getAllArticles Service):', error);
        throw error;
    }
};

/**
 * Lấy thông tin chi tiết một bài báo theo `article_id`.
 * Lưu ý: Trả về cả bài báo đã bị xóa mềm (is_deleted = true).
 *
 * @param {number|string} articleId - ID bài báo
 * @returns {Promise<Object|null>} Bản ghi bài báo hoặc `null` nếu không tồn tại
 */
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
                a."primary_topic"::text AS "primary_topic",
                pt."display_name" AS "topic_name",
                a."is_deleted",
                a."created_at",
                i."issue_number" AS "issue_number",
                v."volume_id"::text AS "volume_id",
                v."volume_number" AS "volume_number",
                j."journal_id"::text AS "journal_id",
                j."display_name" AS "journal_name",
                j."issn" AS "journal_issn",
                p."publisher_id"::text AS "publisher_id",
                p."display_name" AS "publisher_name",
                a."cited_by_count",
                a."references",
                a."reference_count",
                COALESCE(j."is_open_access", false) AS "is_open_access",
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
            WHERE a."article_id" = $1;
        `;

        const detailResult = await pool.query(detailQuery, [articleId]);
        const article = detailResult.rows[0] || null;

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
                au."works_count"
            FROM "Author_Article" aa
            JOIN "Author" au ON au."author_id" = aa."author_id"
            WHERE aa."article_id" = $1
              AND COALESCE(au."is_deleted", false) = false
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
            WHERE a."article_id" = $1
              AND COALESCE(t."is_deleted", false) = false
            ORDER BY "is_primary" DESC, t."display_name" ASC;
        `;

        const [authorsResult, keywordsResult, topicsResult] = await Promise.all([
            pool.query(authorsQuery, [articleId]),
            pool.query(keywordsQuery, [articleId]),
            pool.query(topicsQuery, [articleId])
        ]);

        return {
            ...article,
            authors: authorsResult.rows,
            keywords: keywordsResult.rows,
            topics: topicsResult.rows,
        };
    } catch (error) {
        logger.error('Lỗi khi lấy thông tin bài báo theo ID:', error);
        throw error;
    }
};

/**
 * Tạo mới một bản ghi bài báo (dữ liệu thô) và trả về record vừa tạo.
 *
 * @param {Object} articleData - Dữ liệu bài báo
 * @param {string} articleData.title - Tiêu đề (bắt buộc)
 * @param {number} articleData.publication_year - Năm xuất bản (bắt buộc)
 * @param {number} [articleData.issue_id]
 * @param {string} [articleData.abstract]
 * @param {string} [articleData.doi]
 * @param {number|null} [articleData.primary_topic]
 * @returns {Promise<Object>} Bản ghi bài báo vừa tạo
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

        const result = await pool.query(query, values);
        return result.rows[0];

    } catch (error) {
        logger.error('Error creating article:', error);
        throw error;
    }
};

/**
 * Cập nhật thông tin cốt lõi của bài báo (Tầng Service)
 * @param {Object} params 
 * @param {number|string} params.article_id - ID bài báo cần update (Bắt buộc)
 * @param {Object} params.updateData - Object chứa các trường muốn thay đổi từ req.body
 * @returns {Promise<Object|null>} Bản ghi sau khi update thành công
 */
export const updateArticle = async ({ article_id, ...updateData }) => {
    try {
        if (!article_id) {
            throw new Error('Thiếu article_id khi gọi hàm updateArticle Service.');
        }

        const currentQuery = `SELECT * FROM "Article" WHERE "article_id" = $1;`;
        const currentResult = await pool.query(currentQuery, [article_id]);
        const currentArticle = currentResult.rows[0];

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
                throw new Error('VALIDATION_ERROR: Năm xuất bản phải là số dương hợp lệ.');
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
            
            const issueExistsResult = await issueExists(issue_id);
            if (!issueExistsResult) {
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

                const isTopicExists = await topicExists(primary_topic);
                if (!isTopicExists) {
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
            WHERE "article_id" = $1
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

        const result = await pool.query(query, values);
        return result.rows[0] || null;

    } catch (error) {
        throw error; // Quăng lỗi lên để Controller bắt lấy và trả về res.status
    }
};

/**
 * Xóa mềm một bản ghi bài báo dựa trên ID (Chuyển is_deleted thành TRUE).
 *
 * @param {number|string} articleId - ID của bài báo cần xóa mềm
 * @returns {Promise<Object|null>} Bản ghi bài báo sau khi được cập nhật xóa mềm, hoặc null nếu không tìm thấy
 */
export const deleteArticle = async (articleId) => {
    try {
        // Kiểm tra đầu vào bắt buộc
        if (!articleId) {
            throw new Error('Article ID is required for deletion.');
        }

        const query = `
            UPDATE "Article"
            SET "is_deleted" = TRUE
            WHERE "article_id" = $1 AND "is_deleted" = FALSE
            RETURNING *;
        `;

        const values = [articleId];

        const result = await pool.query(query, values);

        // Nếu cập nhật thành công, result.rows[0] sẽ chứa thông tin bài báo kèm theo is_deleted = true
        // Nếu bài báo đã bị xóa mềm từ trước hoặc không tồn tại, result.rows[0] sẽ là undefined
        return result.rows[0] || null;

    } catch (error) {
        logger.error(`Error soft-deleting article with ID ${articleId}:`, error);
        throw error;
    }
};

/**
 * Khôi phục một bài báo đã bị xóa mềm (Chuyển is_deleted thành FALSE).
 *
 * @param {number|string} articleId - ID của bài báo cần khôi phục
 * @returns {Promise<Object|null>} Bản ghi bài báo sau khi khôi phục, hoặc null nếu không tìm thấy
 */
export const restoreArticle = async (articleId) => {
    try {
        // Kiểm tra đầu vào bắt buộc
        if (!articleId) {
            throw new Error('Article ID is required for restoration.');
        }

        const query = `
            UPDATE "Article"
            SET "is_deleted" = FALSE
            WHERE "article_id" = $1 AND "is_deleted" = TRUE
            RETURNING *;
        `;

        const values = [articleId];

        const result = await pool.query(query, values);

        // Nếu cập nhật thành công, result.rows[0] sẽ chứa thông tin bài báo kèm theo is_deleted = false
        // Nếu bài báo không bị xóa hoặc không tồn tại, result.rows[0] sẽ là undefined
        return result.rows[0] || null;

    } catch (error) {
        logger.error(`Error restoring article with ID ${articleId}:`, error);
        throw error;
    }
};

/**
 * Kiểm tra sự tồn tại của một bài báo dựa trên `article_id`.
 * Hàm này sẽ trả về `true` nếu bài báo tồn tại (bất kể đã bị xóa mềm hay chưa), và `false` nếu không tìm thấy.
 *
 * @param {number|string} articleId - ID của bài báo cần kiểm tra
 * @returns {Promise<boolean>} `true` nếu bài báo tồn tại, `false` nếu không tìm thấy
 */
export const articleExists = async (articleId) => {
    try {
        const query = `SELECT EXISTS (SELECT 1 FROM "Article" WHERE "article_id" = $1);`;
        const result = await pool.query(query, [articleId]);
        return result.rows[0].exists;
    } catch (error) {
        logger.error(`Error checking if article with ID ${articleId} exists:`, error);
        throw error;
    }

}