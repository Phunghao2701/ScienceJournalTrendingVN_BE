import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Láº¥y thÃ´ng tin tÃ¡c giáº£ theo ID
 * @param {number} authorId
 * @returns {Promise<Object>} ThÃ´ng tin tÃ¡c giáº£
 */
export const getAuthorById = async (authorId) => {
  try {
    const queryText = `
      SELECT
        author_id::text AS author_id,
        orcid,
        display_name,
        url_image,
        openalex_id,
        works_count,
        cited_by_count,
        h_index,
        i10_index,
        last_known_institution,
        last_known_institution_id::text AS last_known_institution_id,
        created_at
      FROM "Author"
      WHERE "author_id" = $1
        AND COALESCE(is_deleted, false) = false
    `;
    const res = await prisma.$queryRawUnsafe(queryText, authorId);
    return res[0];
  } catch (error) {
    logger.error("Lá»—i khi láº¥y thÃ´ng tin tÃ¡c giáº£ theo ID:", error);
    throw error;
  }
};

/**
 * PhÃ¢n tÃ­ch danh má»¥c chuyÃªn ngÃ nh (Subject Category) nghiÃªn cá»©u cá»§a má»™t tÃ¡c giáº£
 * @async
 * @param {number|string} authorId - ID cá»§a tÃ¡c giáº£ cáº§n thá»‘ng kÃª
 * @returns {Promise<Array>} Máº£ng danh sÃ¡ch chuyÃªn ngÃ nh, sáº£n lÆ°á»£ng bÃ i bÃ¡o vÃ  tá»· lá»‡ %
 */
export const getAuthorAreasBreakdownService = async (authorId) => {
  try {
    const queryText = `
            WITH author_category_stats AS (
                SELECT 
                    sc.subject_category_id,
                    sc.display_name AS raw_category_name,
                    COUNT(DISTINCT a.article_id) AS total_articles
                FROM "Author_Article" aa
                JOIN "Article" a ON aa.article_id = a.article_id
                JOIN "Issue" i ON a.issue_id = i.issue_id
                JOIN "Volume" v ON i.volume_id = v.volume_id
                JOIN "Journal" j ON v.journal_id = j.journal_id
                JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
                JOIN "Subject_Category" sc ON jsc.subject_category_id = sc.subject_category_id
                WHERE aa.author_id = $1
                GROUP BY sc.subject_category_id, sc.display_name
            )
            SELECT 
                subject_category_id,
                raw_category_name AS category_name,
                total_articles AS article_count,
                ROUND(
                    (total_articles::numeric / NULLIF(SUM(total_articles) OVER (), 0)) * 100, 
                    2
                )::float AS percentage
            FROM author_category_stats
            ORDER BY total_articles DESC;
        `;

    const res = await prisma.$queryRawUnsafe(queryText, authorId);

    return res;
  } catch (error) {
    logger.error(
      "Xuáº¥t hiá»‡n lá»—i khi phÃ¢n tÃ­ch lÄ©nh vá»±c nghiÃªn cá»©u cá»§a tÃ¡c giáº£:",
      error,
    );
    throw error;
  }
};

/**
 * Láº¥y danh sÃ¡ch bÃ i viáº¿t cá»§a má»™t tÃ¡c giáº£ vá»›i phÃ¢n trang an toÃ n.
 *
 * - Chuyá»ƒn `limit` vÃ  `page` sang cÃ¡c giÃ¡ trá»‹ an toÃ n (`safeLimit`, `safePage`).
 * - TÃ­nh `OFFSET` tá»« `page` vÃ  `limit` rá»“i truy váº¥n cÆ¡ sá»Ÿ dá»¯ liá»‡u.
 *
 * @async
 * @param {number} authorId - ID tÃ¡c giáº£ cáº§n láº¥y bÃ i viáº¿t.
 * @param {number|string} [limit=10] - Sá»‘ bÃ i viáº¿t trÃªn má»—i trang (hoáº·c chuá»—i cÃ³ thá»ƒ parse Ä‘Æ°á»£c).
 * @param {number|string} [page=1] - Sá»‘ trang (1-based) (hoáº·c chuá»—i cÃ³ thá»ƒ parse Ä‘Æ°á»£c).
 * @returns {Promise<Array<Object>>} Máº£ng cÃ¡c bÃ i viáº¿t, má»—i pháº§n tá»­ chá»©a cÃ¡c trÆ°á»ng:
 * `{ article_id, title, abstract, publication_year, doi, primary_topic, created_at }`.
 * @throws {Error} NÃ©m lá»—i khi truy váº¥n DB gáº·p váº¥n Ä‘á»; caller nÃªn xá»­ lÃ½ vÃ  log lá»—i.
 */
export const getAuthorArticlesService = async (authorId, limit, page) => {
  try {
    const safeLimit = Math.max(1, parseInt(limit) || 10);
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeOffset = (safePage - 1) * safeLimit;

    const countQuery = `
      SELECT COUNT(DISTINCT a.article_id)::integer AS total
      FROM "Article" a
      JOIN "Author_Article" aa ON a.article_id = aa.article_id
      WHERE aa.author_id = $1
        AND COALESCE(a.is_deleted, false) = false
    `;

    const dataQuery = `
      SELECT 
        a.article_id,
        a.title,
        a.abstract,
        a.publication_year,
        a.doi,
        COALESCE(a."citation_count", 0) AS cited_by_count,
        COALESCE(a."citation_count", 0) AS citation_count,
        a.primary_topic,
        a.created_at,
        j.journal_id::text AS journal_id,
        j.display_name AS journal_name,
        j.issn AS journal_issn
      FROM "Article" a
      JOIN "Author_Article" aa ON a.article_id = aa.article_id
      LEFT JOIN "Issue" i
        ON i.issue_id = a.issue_id
       AND COALESCE(i.is_deleted, false) = false
      LEFT JOIN "Volume" v
        ON v.volume_id = i.volume_id
       AND COALESCE(v.is_deleted, false) = false
      LEFT JOIN "Journal" j
        ON j.journal_id = v.journal_id
       AND COALESCE(j.is_deleted, false) = false
      WHERE aa.author_id = $1
        AND COALESCE(a.is_deleted, false) = false
      ORDER BY a.publication_year DESC, a.article_id DESC
      LIMIT $2 OFFSET $3
    `;

    const [countResult, dataResult] = await Promise.all([
      prisma.$queryRawUnsafe(countQuery, authorId),
      prisma.$queryRawUnsafe(dataQuery, authorId, safeLimit, safeOffset),
    ]);

    const total = countResult[0]?.total || 0;

    return {
      items: dataResult,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    logger.error("Lá»—i khi láº¥y bÃ i viáº¿t cá»§a tÃ¡c giáº£:", error);
    throw error;
  }
};

/**
 * Láº¥y báº£ng xáº¿p háº¡ng tÃ¡c giáº£ vá»›i phÃ¢n trang.
 *
 * @param {number|string} [limit=10] - Sá»‘ lÆ°á»£ng báº£n ghi trÃªn má»—i trang.
 * @param {number|string} [page=1] - Sá»‘ trang báº¯t Ä‘áº§u tá»« 1.
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch tÃ¡c giáº£ vÃ  chá»‰ sá»‘ xáº¿p háº¡ng.
 */
export const getAuthorLeaderboardService = async (limit, page) => {
  try {
    const safeLimit = Math.max(1, parseInt(limit) || 10);
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeOffset = (safePage - 1) * safeLimit;

    const countQuery = `
      SELECT COUNT(*)::integer AS total
      FROM "Author"
      WHERE COALESCE(is_deleted, false) = false
    `;

    const dataQuery = `
      SELECT 
        author_id,
        orcid,
        display_name,
        url_image,
        COALESCE(works_count, 0) AS works_count,
        COALESCE(cited_by_count, 0) AS cited_by_count,
        COALESCE(h_index, 0) AS h_index,
        COALESCE(i10_index, 0) AS i10_index,
        ROW_NUMBER() OVER (
          ORDER BY 
            h_index DESC NULLS LAST, 
            cited_by_count DESC NULLS LAST, 
            i10_index DESC NULLS LAST, 
            works_count DESC NULLS LAST
        ) AS final_rank
      FROM "Author"
      WHERE COALESCE(is_deleted, false) = false
      ORDER BY final_rank ASC
      LIMIT $1 OFFSET $2;
    `;

    const [countResult, dataResult] = await Promise.all([
      prisma.$queryRawUnsafe(countQuery),
      prisma.$queryRawUnsafe(dataQuery, safeLimit, safeOffset),
    ]);

    const total = countResult[0]?.total || 0;

    return {
      items: dataResult,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    logger.error("Lá»—i khi láº¥y báº£ng xáº¿p háº¡ng tÃ¡c giáº£:", error);
    throw error;
  }
};

/**
 * Kiá»ƒm tra xem má»™t tÃ¡c giáº£ cÃ³ tá»“n táº¡i hay khÃ´ng.
 *
 * @param {number|string} authorId - ID cá»§a tÃ¡c giáº£ cáº§n kiá»ƒm tra
 * @returns {Promise<boolean>} `true` náº¿u tá»“n táº¡i, ngÆ°á»£c láº¡i `false`
 */
export const isAuthorExists = async (authorId) => {
  try {
    const queryText = `SELECT 1 FROM "Author" WHERE "author_id" = $1`;
    const res = await prisma.$queryRawUnsafe(queryText, authorId);
    return res.length > 0;
  } catch (error) {
    logger.error("Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a tÃ¡c giáº£:", error);
    throw error;
  }
};

/**
 * Kiá»ƒm tra tá»“n táº¡i má»™t loáº¡t tÃ¡c giáº£ vÃ  tráº£ vá» nhá»¯ng `author_id` khÃ´ng tá»“n táº¡i.
 *
 * @param {Array<number|string>} authorIds - Máº£ng ID tÃ¡c giáº£ cáº§n kiá»ƒm tra
 * @returns {Promise<number[]>} Máº£ng cÃ¡c `author_id` khÃ´ng tá»“n táº¡i trÃªn há»‡ thá»‘ng
 */
export const checkAuthorsExistence = async (authorIds) => {
  try {
    if (!authorIds || authorIds.length === 0) {
      return [];
    }

    const queryText = `
            SELECT author_id
            FROM "Author"
            WHERE author_id = ANY($1)
        `;

    const result = await prisma.$queryRawUnsafe(queryText, authorIds);

    const existingAuthorIds = result.map((row) => Number(row.author_id));

    const normalizedAuthorIds = authorIds.map((id) => Number(id));

    const nonExistingAuthorIds = normalizedAuthorIds.filter(
      (id) => !existingAuthorIds.includes(id),
    );

    return nonExistingAuthorIds;
  } catch (error) {
    logger.error("Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a cÃ¡c tÃ¡c giáº£:", error);
    throw error;
  }
};

/**
 * Táº¡o cÃ¡c quan há»‡ `Author_Article` cho má»™t bÃ i bÃ¡o.
 * - Bá» qua náº¿u `authorIds` rá»—ng.
 * - Loáº¡i bá» trÃ¹ng láº·p trÆ°á»›c khi chÃ¨n.
 *
 * @param {number|string} articleId - ID bÃ i bÃ¡o
 * @param {Array<number|string>} authorIds - Máº£ng ID tÃ¡c giáº£ Ä‘á»ƒ gÃ¡n cho bÃ i bÃ¡o
 * @returns {Promise<void>} KhÃ´ng tráº£ vá» dá»¯ liá»‡u, nÃ©m lá»—i náº¿u cÃ³ sá»± cá»‘
 */
export const createAuthorArticleRelationships = async (
  articleId,
  authorIds,
) => {
  try {
    if (!authorIds || authorIds.length === 0) {
      return;
    }

    // Loáº¡i bá» trÃ¹ng láº·p, chuyá»ƒn thÃ nh Number, vÃ  lá»c bá» NaN / ID khÃ´ng há»£p lá»‡
    const uniqueAuthorIds = [...new Set(
      authorIds
        .map((id) => Number(id))
        .filter((id) => !isNaN(id) && id > 0)
    )];

    if (uniqueAuthorIds.length === 0) {
      return;
    }

    const query = `
            INSERT INTO "Author_Article" (article_id, author_id)
            SELECT $1, unnest($2::bigint[])
            ON CONFLICT DO NOTHING
        `;

    await prisma.$executeRawUnsafe(query, articleId, uniqueAuthorIds);

    logger.info(`ÄÃ£ táº¡o ${uniqueAuthorIds.length} quan há»‡ tÃ¡c giáº£ - bÃ i bÃ¡o`);
  } catch (error) {
    logger.error("Lá»—i khi táº¡o quan há»‡ tÃ¡c giáº£ - bÃ i bÃ¡o:", error);
    throw error;
  }
};

/**
 * Cáº­p nháº­t toÃ n bá»™ má»‘i quan há»‡ tÃ¡c giáº£ cho bÃ i bÃ¡o
 * - BÆ°á»›c 1: XÃ³a toÃ n bá»™ liÃªn káº¿t tÃ¡c giáº£ cÅ© cá»§a bÃ i bÃ¡o nÃ y
 * - BÆ°á»›c 2: Gá»i láº¡i hÃ m create Ä‘á»ƒ chÃ¨n danh sÃ¡ch má»›i sáº¡ch sáº½
 * * @param {number|string} articleId - ID cá»§a bÃ i bÃ¡o cáº§n cáº­p nháº­t
 * @param {number[]} authorIds - Máº£ng cÃ¡c ID tÃ¡c giáº£ má»›i (vÃ­ dá»¥: [1, 2, 3])
 */
export const updateAuthorArticleRelationships = async (
  articleId,
  authorIds,
) => {
  try {
    if (!articleId) {
      throw new Error(
        "Thiáº¿u articleId khi gá»i hÃ m updateAuthorArticleRelationships",
      );
    }

    const deleteQuery = `
            DELETE FROM "Author_Article"
            WHERE "article_id" = $1;
        `;
    await prisma.$executeRawUnsafe(deleteQuery, articleId);

    await createAuthorArticleRelationships(articleId, authorIds);

    logger.info(
      `ÄÃ£ cáº­p nháº­t lÃ m má»›i toÃ n bá»™ quan há»‡ tÃ¡c giáº£ cho bÃ i bÃ¡o ID: ${articleId}`,
    );
  } catch (error) {
    logger.error(
      `Lá»—i khi cáº­p nháº­t quan há»‡ tÃ¡c giáº£ cho bÃ i bÃ¡o ID ${articleId}:`,
      error,
    );
    throw error;
  }
};

//Pháº§n API xá»­ lÃ½ CRUD Author - Author Management
/**
 * Láº¥y danh sÃ¡ch authors vá»›i pagination vÃ  search
 */
export const getAllAuthors = async ({ page = 1, limit = 10, search = "", sort = "impact" }) => {
  const offset = (page - 1) * limit;
  const searchPattern = `%${search.trim()}%`;

  const sortKey = String(sort || "impact").toLowerCase();
  const orderByMap = {
    impact: `COALESCE(h_index, 0) DESC, COALESCE(cited_by_count, 0) DESC, COALESCE(works_count, 0) DESC, display_name ASC`,
    h_index: `COALESCE(h_index, 0) DESC, COALESCE(cited_by_count, 0) DESC, COALESCE(works_count, 0) DESC, display_name ASC`,
    citations: `COALESCE(cited_by_count, 0) DESC, COALESCE(h_index, 0) DESC, COALESCE(works_count, 0) DESC, display_name ASC`,
    articles: `COALESCE(works_count, 0) DESC, COALESCE(h_index, 0) DESC, COALESCE(cited_by_count, 0) DESC, display_name ASC`,
    name: `display_name ASC`,
  };
  const orderByClause = orderByMap[sortKey] || orderByMap.impact;

  const countQuery = `
    SELECT COUNT(*) AS total FROM "Author"
    WHERE is_deleted = false
      AND ($1 = '%%' OR (
        LOWER(display_name) LIKE LOWER($1) OR
        LOWER(COALESCE(last_known_institution, '')) LIKE LOWER($1)
      ))
  `;

  const dataQuery = `
    SELECT 
      author_id, orcid, display_name, url_image, openalex_id,
      works_count, cited_by_count, h_index, i10_index,
      last_known_institution, last_known_institution_id,
      created_at
    FROM "Author"
    WHERE is_deleted = false
      AND ($1 = '%%' OR (
        LOWER(display_name) LIKE LOWER($1) OR
        LOWER(COALESCE(last_known_institution, '')) LIKE LOWER($1)
      ))
    ORDER BY ${orderByClause}
    LIMIT $2 OFFSET $3
  `;

  const [countResult, dataResult] = await Promise.all([
    prisma.$queryRawUnsafe(countQuery, searchPattern),
    prisma.$queryRawUnsafe(dataQuery, searchPattern, limit, offset),
  ]);

  const total = parseInt(countResult[0].total);

  return {
    data: dataResult,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Táº¡o má»›i author
 */
export const createAuthor = async (data) => {
  const {
    display_name,
    orcid = null,
    url_image = null,
    works_count = null,
    cited_by_count = null,
    h_index = null,
    i10_index = null,
    last_known_institution = null,
    last_known_institution_id = null,
  } = data;

  const result = await prisma.$queryRawUnsafe(
    `INSERT INTO "Author" (
      display_name, orcid, url_image,
      works_count, cited_by_count, h_index, i10_index,
      last_known_institution, last_known_institution_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
      display_name,
      orcid,
      url_image,
      works_count,
      cited_by_count,
      h_index,
      i10_index,
      last_known_institution,
      last_known_institution_id
  );

  return result[0];
};
/**
 * Cáº­p nháº­t author theo ID
 */
export const updateAuthor = async (id, data) => {
  const allowedFields = [
    "display_name",
    "orcid",
    "url_image",
    "works_count",
    "cited_by_count",
    "h_index",
    "i10_index",
    "last_known_institution",
    "last_known_institution_id",
  ];

  const existing = await prisma.$queryRawUnsafe(
    `SELECT author_id FROM "Author" WHERE author_id = $1 AND is_deleted = false`,
    id,
  );

  if (!existing.length) {
    const error = new Error("TÃ¡c giáº£ khÃ´ng tá»“n táº¡i");
    error.statusCode = 404;
    error.code = "AUTHOR_NOT_FOUND";
    throw error;
  }

  const updateParts = [];
  const values = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateParts.push(`"${field}" = $${idx}`);
      values.push(data[field]);
      idx++;
    }
  }

  values.push(id);
  const result = await prisma.$queryRawUnsafe(
    `UPDATE "Author" SET ${updateParts.join(", ")}
     WHERE author_id = $${idx} AND is_deleted = false
     RETURNING *`,
    ...values,
  );

  return result[0];
};

/**
 * Soft delete author
 */
export const deleteAuthor = async (id) => {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT author_id, is_deleted FROM "Author" WHERE author_id = $1`,
    id,
  );

  if (!existing.length) {
    const error = new Error("TÃ¡c giáº£ khÃ´ng tá»“n táº¡i");
    error.statusCode = 404;
    error.code = "AUTHOR_NOT_FOUND";
    throw error;
  }

  if (existing[0].is_deleted) {
    const error = new Error("TÃ¡c giáº£ Ä‘Ã£ bá»‹ xÃ³a trÆ°á»›c Ä‘Ã³");
    error.statusCode = 400;
    error.code = "AUTHOR_ALREADY_DELETED";
    throw error;
  }

  const result = await prisma.$queryRawUnsafe(
    `UPDATE "Author" SET is_deleted = true
     WHERE author_id = $1
     RETURNING author_id, display_name, is_deleted`,
    id,
  );

  return result[0];
};

/**
 * Restore author Ä‘Ã£ bá»‹ soft delete
 */
export const restoreAuthor = async (id) => {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT author_id, is_deleted FROM "Author" WHERE author_id = $1`,
    id,
  );

  if (!existing.length) {
    const error = new Error("TÃ¡c giáº£ khÃ´ng tá»“n táº¡i");
    error.statusCode = 404;
    error.code = "AUTHOR_NOT_FOUND";
    throw error;
  }

  if (!existing[0].is_deleted) {
    const error = new Error("TÃ¡c giáº£ Ä‘ang active, khÃ´ng cáº§n restore");
    error.statusCode = 400;
    error.code = "AUTHOR_ALREADY_ACTIVE";
    throw error;
  }

  const result = await prisma.$queryRawUnsafe(
    `UPDATE "Author" SET is_deleted = false
     WHERE author_id = $1
     RETURNING author_id, display_name, is_deleted`,
    id,
  );

  return result[0];
};



