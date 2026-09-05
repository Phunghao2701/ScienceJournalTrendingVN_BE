import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import {
  buildArticleFilter,
  normalizeArticleSort,
} from "../../article/services/articleFilter.service.js";

/**
 * Láº¥y danh sÃ¡ch tá»« khÃ³a thá»‹nh hÃ nh trong má»™t project.
 *
 * LÆ°u Ã½: `sort_by=score` sáº¯p xáº¿p theo `avg_score` (Ä‘iá»ƒm relevance trung bÃ¬nh cá»§a
 * `Keyword_Article.score`, tÄ©nh theo thá»i gian) â€” Ä‘Ã¢y KHÃ”NG pháº£i trending_score
 * (khÃ´ng cÃ³ current/previous window, khÃ´ng cÃ³ smoothing/z-score nhÆ°
 * `entityQuery` trong `articleAnalysis.service.js`). TrÆ°á»ng `avg_score` chá»‰ nÃªn
 * hiá»ƒu lÃ  "Ä‘á»™ liÃªn quan", khÃ´ng pháº£i "Ä‘ang tÄƒng trÆ°á»Ÿng".
 *
 * @param {number|string} projectId - ID cá»§a project cáº§n truy váº¥n
 * @param {Object} queryParams - Tham sá»‘ lá»c/phan trang
 * @param {number|string} [queryParams.limit=20] - Sá»‘ káº¿t quáº£ tá»‘i Ä‘a
 * @param {string} [queryParams.sort_by='count'] - `count` hoáº·c `score` (`score` = relevance, khÃ´ng pháº£i trending)
 * @returns {Promise<Object>} Káº¿t quáº£ gá»“m tá»•ng `total`, `sort_by` vÃ  máº£ng `keywords`
 */
export const getTrendingKeywords = async (projectId, queryParams) => {
  const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
  const sortBy = ["count", "score"].includes(queryParams.sort_by)
    ? queryParams.sort_by
    : "count";
  const orderClause =
    sortBy === "score"
      ? "avg_score DESC, count DESC"
      : "count DESC, avg_score DESC";

  const query = `
    SELECT 
      k.keyword_id,
      k.display_name                      AS keyword,
      COUNT(ka.article_id)                AS count,
      ROUND(AVG(ka.score)::numeric, 2)    AS avg_score,
      ROUND(SUM(ka.score)::numeric, 2)    AS total_score
    FROM "Project_Keyword" pk
    JOIN "Project" p          ON p.project_id  = pk.project_id
    JOIN "Keyword" k          ON k.keyword_id  = pk.keyword_id
    JOIN "Keyword_Article" ka ON ka.keyword_id = k.keyword_id
    JOIN "Article" a          ON a.article_id  = ka.article_id
    WHERE pk.project_id = $1
    GROUP BY k.keyword_id, k.display_name
    ORDER BY ${orderClause}
    LIMIT $2;
  `;

  const rows = await prisma.$queryRawUnsafe(query, projectId, limit);

  if (!rows.length) return { total: 0, keywords: [] };

  return {
    total: rows.length,
    sort_by: sortBy,
    keywords: rows.map((k) => ({
      id: k.keyword_id,
      keyword: k.keyword,
      count: parseInt(k.count),
      avg_score: parseFloat(k.avg_score),
      total_score: parseFloat(k.total_score),
    })),
  };
};

/**
 * Láº¥y danh sÃ¡ch bÃ i bÃ¡o liÃªn quan Ä‘áº¿n cÃ¡c tá»« khÃ³a Ä‘Æ°á»£c theo dÃµi trong project.
 *
 * @param {number|string} projectId - ID project
 * @param {number|string} userId - ID ngÆ°á»i dÃ¹ng thá»±c hiá»‡n truy váº¥n (dÃ¹ng Ä‘á»ƒ kiá»ƒm tra sá»Ÿ há»¯u)
 * @param {Object} queryParams
 * @param {number|string} [queryParams.page=1] - Trang káº¿t quáº£
 * @param {number|string} [queryParams.limit=10] - Sá»‘ pháº§n tá»­ trÃªn má»—i trang
 * @returns {Promise<Object>} Object phÃ¢n trang: { page, limit, total, total_pages, data }
 *  - `data` lÃ  máº£ng article objects `{ article_id, title, publication_year, doi, matched_keywords }`
 */
export const getWatchedKeywordArticles = async (
  projectId,
  userId,
  queryParams,
) => {
  const page = Math.max(parseInt(queryParams.page) || 1, 1);
  const limit = Math.min(parseInt(queryParams.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const projectCheck = await prisma.$queryRawUnsafe(
    `SELECT project_id FROM "Project" WHERE project_id = $1 AND user_id = $2`,
    projectId, userId
  );

  if (!projectCheck.length) {
    const error = new Error(
      "Project khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng thuá»™c quyá»n sá»Ÿ há»¯u",
    );
    error.statusCode = 404;
    throw error;
  }
  const countQuery = `
    SELECT COUNT(DISTINCT a.article_id) AS total
    FROM "Project_Keyword" pk
    JOIN "Project" p          ON p.project_id  = pk.project_id
    JOIN "Keyword" k          ON k.keyword_id  = pk.keyword_id
    JOIN "Keyword_Article" ka ON ka.keyword_id = k.keyword_id
    JOIN "Article" a          ON a.article_id  = ka.article_id
    WHERE pk.project_id = $1
      AND p.user_id     = $2
  `;

  const dataQuery = `
    SELECT 
      a.article_id,
      a.title,
      a.abstract,
      a.publication_year,
      a.doi,
      COALESCE(
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'author_id', au.author_id,
              'name', au.display_name
            )
            ORDER BY au.display_name
          )
          FROM "Author_Article" aa
          JOIN "Author" au ON au.author_id = aa.author_id
          WHERE aa.article_id = a.article_id
            AND COALESCE(au.is_deleted, false) = false
        ),
        '[]'::json
      ) AS authors,
      ARRAY_AGG(DISTINCT k.display_name) AS matched_keywords
    FROM "Project_Keyword" pk
    JOIN "Project" p          ON p.project_id  = pk.project_id
    JOIN "Keyword" k          ON k.keyword_id  = pk.keyword_id
    JOIN "Keyword_Article" ka ON ka.keyword_id = k.keyword_id
    JOIN "Article" a          ON a.article_id  = ka.article_id
    WHERE pk.project_id = $1
      AND p.user_id     = $2
    GROUP BY a.article_id, a.title, a.abstract, a.publication_year, a.doi, a.created_at
    ORDER BY a.publication_year DESC, a.created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const [countResult, dataResult] = await Promise.all([
    prisma.$queryRawUnsafe(countQuery, projectId, userId),
    prisma.$queryRawUnsafe(dataQuery, projectId, userId, limit, offset),
  ]);

  const total = parseInt(countResult[0]?.total) || 0;

  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    data: dataResult.map((a) => ({
      article_id: a.article_id,
      title: a.title || null,
      abstract: a.abstract || null,
      publication_year: a.publication_year || null,
      doi: a.doi || null,
      authors: Array.isArray(a.authors) ? a.authors : [],
      matched_keywords: a.matched_keywords || [],
    })),
  };
};

/**
 * XÃ¡c thá»±c xem má»™t danh sÃ¡ch `keyword_id` cÃ³ tá»“n táº¡i trong báº£ng `Keyword` hay khÃ´ng.
 * Tráº£ vá» `true` khi táº¥t cáº£ id há»£p lá»‡, ngÆ°á»£c láº¡i `false`.
 *
 * @param {Array<number|string>} keywordIds - Máº£ng id cáº§n kiá»ƒm tra
 * @returns {Promise<boolean>} `true` náº¿u táº¥t cáº£ id tá»“n táº¡i
 */
export const validateKeywordIds = async (keywordIds) => {
  if (!keywordIds || keywordIds.length === 0) return true;

  const uniqueIds = [...new Set(keywordIds)];

  const query = `
    SELECT keyword_id
    FROM "Keyword"
    WHERE keyword_id = ANY($1::bigint[])
  `;
  const result = await prisma.$queryRawUnsafe(query, uniqueIds);
  return result.length === uniqueIds.length;
};

/**
 * Äá»“ng bá»™ danh sÃ¡ch tá»« khÃ³a Ä‘Æ°á»£c theo dÃµi (Project_Keyword) cho má»™t project.
 * - Bá» qua náº¿u `keywordIds` rá»—ng.
 * - Chá»‰ insert nhá»¯ng keyword má»›i vÃ  tá»“n táº¡i.
 *
 * @param {number|string} projectId - ID project
 * @param {Array<number|string>} keywordIds - Máº£ng keyword_id cáº§n Ä‘á»“ng bá»™
 * @returns {Promise<boolean>} `true` náº¿u Ä‘á»“ng bá»™ thÃ nh cÃ´ng
 * @throws {Error} NÃ©m lá»—i khi DB transaction gáº·p sá»± cá»‘
 */
export const syncWatchedKeywords = async (projectId, keywordIds) => {
  if (!keywordIds || keywordIds.length === 0) return true;

  return await prisma.$transaction(async (tx) => {
    // 1. Loáº¡i bá» duplicate tá»« input
    const uniqueIds = [...new Set(keywordIds)];

    // 2. Láº¥y danh sÃ¡ch keywords Ä‘Ã£ tá»“n táº¡i cho project nÃ y
    const existingResult = await tx.$queryRawUnsafe(
      `SELECT keyword_id FROM "Project_Keyword" WHERE project_id = $1`,
      projectId
    );
    const existingIds = new Set(
      existingResult.map((row) => Number(row.keyword_id)),
    );

    // 3. Lá»c ra keywords má»›i (chÆ°a tá»“n táº¡i)
    const newKeywordIds = uniqueIds.filter((id) => !existingIds.has(id));

    if (newKeywordIds.length === 0) {
      return true; // KhÃ´ng cÃ³ keywords má»›i Ä‘á»ƒ thÃªm
    }

    // 4. Validate keywords tá»“n táº¡i trong báº£ng Keyword
    const validationResult = await tx.$queryRawUnsafe(
      `SELECT keyword_id FROM "Keyword" WHERE keyword_id = ANY($1::bigint[])`,
      newKeywordIds
    );
    const validIds = new Set(
      validationResult.map((row) => Number(row.keyword_id)),
    );

    // 5. Chá»‰ INSERT nhá»¯ng keywords há»£p lá»‡
    const idsToInsert = newKeywordIds.filter((id) => validIds.has(id));

    if (idsToInsert.length > 0) {
      for (const kwId of idsToInsert) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Project_Keyword" (project_id, keyword_id) VALUES ($1, $2)`,
          projectId, kwId
        );
      }
    }

    return true;
  });
};

/**
 * Ghi Ä‘Ã¨ (thay tháº¿ toÃ n bá»™) danh sÃ¡ch tá»« khÃ³a Ä‘Æ°á»£c theo dÃµi cho má»™t project.
 * - XÃ³a táº¥t cáº£ tá»« khÃ³a Ä‘ang theo dÃµi hiá»‡n táº¡i cá»§a project.
 * - ThÃªm má»›i danh sÃ¡ch `keywordIds` truyá»n vÃ o.
 *
 * @param {number|string} projectId - ID project
 * @param {Array<number|string>} keywordIds - Máº£ng keyword_id cáº§n cáº­p nháº­t
 * @returns {Promise<boolean>} `true` náº¿u cáº­p nháº­t thÃ nh cÃ´ng
 * @throws {Error} NÃ©m lá»—i khi DB transaction gáº·p sá»± cá»‘
 */
export const replaceWatchedKeywords = async (projectId, keywordIds) => {
  return await prisma.$transaction(async (tx) => {
    // 1. XÃ³a táº¥t cáº£ cÃ¡c liÃªn káº¿t tá»« khÃ³a cÅ© cá»§a project
    await tx.$executeRawUnsafe(
      `DELETE FROM "Project_Keyword" WHERE project_id = $1`,
      projectId
    );

    // Náº¿u khÃ´ng cÃ³ keyword nÃ o truyá»n lÃªn, tá»©c lÃ  chá»‰ muá»‘n xÃ³a sáº¡ch -> Commit luÃ´n
    if (!keywordIds || keywordIds.length === 0) {
      return true;
    }

    // 2. Loáº¡i bá» duplicate tá»« input
    const uniqueIds = [...new Set(keywordIds)];

    // 3. Validate keywords tá»“n táº¡i trong báº£ng Keyword
    const validationResult = await tx.$queryRawUnsafe(
      `SELECT keyword_id FROM "Keyword" WHERE keyword_id = ANY($1::bigint[])`,
      uniqueIds
    );
    const validIds = new Set(validationResult.map(row => Number(row.keyword_id)));

    // 4. Lá»c ra nhá»¯ng keywords há»£p lá»‡
    const idsToInsert = uniqueIds.filter(id => validIds.has(id));
    
    // 5. Insert danh sÃ¡ch keywords há»£p lá»‡ má»›i
    if (idsToInsert.length > 0) {
      for (const kwId of idsToInsert) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Project_Keyword" (project_id, keyword_id) VALUES ($1, $2)`,
          projectId, kwId
        );
      }
    }

    return true;
  });
};

/**
 * ThÃªm danh sÃ¡ch tá»« khÃ³a vÃ o danh sÃ¡ch theo dÃµi cá»§a dá»± Ã¡n.
 * Náº¿u cÃ³ Báº¤T Ká»² tá»« khÃ³a nÃ o trong danh sÃ¡ch Ä‘Ã£ Ä‘Æ°á»£c theo dÃµi, sáº½ khÃ´ng thÃªm tá»« khÃ³a nÃ o vÃ  bÃ¡o lá»—i.
 *
 * @param {number|string} projectId - ID dá»± Ã¡n
 * @param {Array<number|string>} keywordIds - Máº£ng cÃ¡c ID tá»« khÃ³a
 * @returns {Promise<Object>} Object chá»©a tráº¡ng thÃ¡i success, sá»‘ lÆ°á»£ng thÃªm thÃ nh cÃ´ng, hoáº·c danh sÃ¡ch ID bá»‹ trÃ¹ng
 */
export const addWatchedKeywords = async (projectId, keywordIds) => {
  if (!keywordIds || keywordIds.length === 0) return { success: true, insertedCount: 0 };
  
  // 1. Kiá»ƒm tra xem cÃ³ keyword nÃ o Ä‘Ã£ tá»“n táº¡i trong project nÃ y chÆ°a
  const existingCheck = await prisma.$queryRawUnsafe(
    `SELECT keyword_id FROM "Project_Keyword" WHERE project_id = $1 AND keyword_id = ANY($2::int[])`,
    projectId, keywordIds
  );

  if (existingCheck.length > 0) {
    const existingIds = existingCheck.map(row => row.keyword_id);
    return { success: false, existingIds };
  }

  // 2. Náº¿u khÃ´ng trÃ¹ng cÃ¡i nÃ o, tiáº¿n hÃ nh thÃªm táº¥t cáº£
  // DÃ¹ng transaction Ä‘á»ƒ Ä‘áº£m báº£o an toÃ n náº¿u thÃªm nhiá»u
  return await prisma.$transaction(async (tx) => {
    let insertedCount = 0;
    for (const kwId of keywordIds) {
      const result = await tx.$executeRawUnsafe(
        `INSERT INTO "Project_Keyword" (project_id, keyword_id) VALUES ($1, $2)`,
        projectId, kwId
      );
      insertedCount += result;
    }
    return { success: true, insertedCount };
  });
};

/**
 * Kiá»ƒm tra quyá»n sá»Ÿ há»¯u project cá»§a user.
 *
 * @param {number|string} projectId - ID project
 * @param {number|string} userId - ID user
 * @returns {Promise<boolean>} `true` náº¿u user lÃ  chá»§ project
 */
export const checkProjectOwnership = async (projectId, userId) => {
  const result = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
    projectId, userId
  );
  return result.length > 0;
};

/**
 * XÃ³a má»™t tá»« khÃ³a khá»i danh sÃ¡ch theo dÃµi cá»§a dá»± Ã¡n (xÃ³a trong Project_Keyword).
 *
 * @param {number|string} projectId - ID dá»± Ã¡n
 * @param {number|string} keywordId - ID tá»« khÃ³a cáº§n xÃ³a
 * @returns {Promise<boolean>} `true` náº¿u xÃ³a thÃ nh cÃ´ng, `false` náº¿u tá»« khÃ³a khÃ´ng tá»“n táº¡i trong danh sÃ¡ch
 */
export const removeWatchedKeyword = async (projectId, keywordId) => {
  const result = await prisma.$queryRawUnsafe(
    `DELETE FROM "Project_Keyword" WHERE project_id = $1 AND keyword_id = $2 RETURNING *`,
    projectId, keywordId
  );
  
  return result.length > 0;
};

/**
 * ThÃªm (vÃ  upsert) cÃ¡c tá»« khÃ³a rá»“i gÃ¡n vÃ o má»™t bÃ i bÃ¡o cÃ¹ng vá»›i `score`.
 * Há»— trá»£ hai dáº¡ng `keywordsInput`:
 * - Array of strings: `["kw1", "kw2"]` (Ä‘iá»ƒm dÃ¹ng `options.score` hoáº·c 0)
 * - Object mapping: `{ "Colorectal cancer": 0.25, "demo 2": 0.25 }`
 *
 * Tráº£ vá» máº£ng cÃ¡c báº£n ghi `Keyword` Ä‘Ã£ Ä‘Æ°á»£c upsert.
 *
 * @param {number|string} articleId - ID bÃ i bÃ¡o
 * @param {Array<string>|Object<string, number>} keywordsInput - Dá»¯ liá»‡u tá»« khÃ³a
 * @param {Object} [options] - Tuá»³ chá»n, vÃ­ dá»¥ `{ score: number }` cho dáº¡ng array
 * @returns {Promise<Array>} Máº£ng cÃ¡c báº£n ghi `Keyword` (rows returned from INSERT ... RETURNING)
 */
export const addKeywordsToArticle = async (
  articleId,
  keywordsInput,
  options = {},
) => {
  const isEmptyObject =
    typeof keywordsInput === "object" &&
    !Array.isArray(keywordsInput) &&
    Object.keys(keywordsInput || {}).length === 0;
  if (
    !keywordsInput ||
    (Array.isArray(keywordsInput) && keywordsInput.length === 0) ||
    isEmptyObject
  ) {
    return [];
  }

  let keywordEntries = [];
  if (Array.isArray(keywordsInput)) {
    const score = options.score !== undefined ? Number(options.score) : 0.0;
    keywordEntries = keywordsInput
      .filter((name) => typeof name === "string")
      .map((name) => ({ display_name: name.trim(), score }))
      .filter((item) => item.display_name.length > 0);
  } else if (typeof keywordsInput === "object") {
    keywordEntries = Object.entries(keywordsInput)
      .filter(([name]) => typeof name === "string" && name.trim().length > 0)
      .map(([name, score]) => ({
        display_name: name.trim(),
        score: Number(score ?? 0),
      }));
  } else {
    throw new Error("Keywords must be an array or object");
  }

  if (keywordEntries.length === 0) {
    return [];
  }

  const uniqueKeywordNames = [
    ...new Set(keywordEntries.map((entry) => entry.display_name)),
  ];
  const scoreMap = Object.fromEntries(
    keywordEntries.map((entry) => [entry.display_name, entry.score]),
  );

  return await prisma.$transaction(async (tx) => {
    const upsertKeywordsQuery = `
            INSERT INTO "Keyword" (display_name)
            SELECT unnest($1::text[])
            ON CONFLICT (display_name)
            DO UPDATE SET display_name = EXCLUDED.display_name
            RETURNING keyword_id, display_name;
        `;

    const allKeywords = await tx.$queryRawUnsafe(upsertKeywordsQuery, uniqueKeywordNames);

    if (allKeywords.length === 0) {
      return [];
    }

    const keywordIds = [];
    const keywordScores = [];
    for (const displayName of uniqueKeywordNames) {
      const keywordRow = allKeywords.find(
        (k) => k.display_name === displayName,
      );
      if (!keywordRow) continue;
      keywordIds.push(keywordRow.keyword_id);
      keywordScores.push(scoreMap[displayName] ?? 0.0);
    }

    if (keywordIds.length === 0) {
      return [];
    }

    const insertRelationsQuery = `
            INSERT INTO "Keyword_Article" (article_id, keyword_id, score)
            SELECT $1, unnest($2::bigint[]), unnest($3::numeric[])
            ON CONFLICT DO NOTHING;
        `;

    await tx.$executeRawUnsafe(insertRelationsQuery, articleId, keywordIds, keywordScores);

    return allKeywords;
  });
};

/**
 * Cáº­p nháº­t toÃ n bá»™ danh sÃ¡ch tá»« khÃ³a cá»§a má»™t bÃ i bÃ¡o (thay tháº¿ hoÃ n toÃ n).
 * - XÃ³a má»‘i quan há»‡ cÅ© trong `Keyword_Article`
 * - Gá»i `addKeywordsToArticle` Ä‘á»ƒ upsert vÃ  chÃ¨n quan há»‡ má»›i
 *
 * @param {number|string} articleId - ID bÃ i bÃ¡o
 * @param {Array<string>|Object<string, number>} keywordsInput - Dá»¯ liá»‡u tá»« khÃ³a (giá»‘ng `addKeywordsToArticle`)
 * @returns {Promise<Array>} Máº£ng cÃ¡c báº£n ghi `Keyword` Ä‘Ã£ Ä‘Æ°á»£c gÃ¡n
 */
export const updateKeywordsToArticle = async (articleId, keywordsInput) => {
  try {
    const deleteRelationsQuery = `
            DELETE FROM "Keyword_Article"
            WHERE "article_id" = $1;
        `;
    await prisma.$executeRawUnsafe(deleteRelationsQuery, articleId);

    const updatedKeywords = await addKeywordsToArticle(
      articleId,
      keywordsInput,
    );

    logger.info(
      `ÄÃ£ lÃ m má»›i toÃ n bá»™ danh sÃ¡ch tá»« khÃ³a cho bÃ i bÃ¡o ID: ${articleId}`,
    );
    return updatedKeywords;
  } catch (error) {
    logger.error(
      `Lá»—i khi cáº­p nháº­t danh sÃ¡ch tá»« khÃ³a cho bÃ i bÃ¡o ID ${articleId}:`,
      error,
    );
    throw error;
  }
};

//*********Nhá»¯ng API liÃªn quan tÆ°Æ¡ng tÃ¡c trá»±c tiáº¿p tá»›i Table Keyword */
/**
 * Láº¥y keyword theo ID
 * @param {number} id - keyword_id
 * @returns {Promise<Object>} keyword object
 */
export const getKeywordById = async (id) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT keyword_id::text AS keyword_id, display_name FROM "Keyword"
     WHERE keyword_id = $1`,
    id
  );
  if (!rows.length) {
    const error = new Error("Keyword khÃ´ng tá»“n táº¡i");
    error.statusCode = 404;
    error.code = "KEYWORD_NOT_FOUND";
    throw error;
  }
  return rows[0];
};

export const getAllKeywords = async ({ page = 1, limit = 10, search = "" }) => {
  const offset = (page - 1) * limit;
  const normalizedSearch = search.trim();
  const searchPattern = `%${normalizedSearch}%`;

  const countQuery = `
    SELECT COUNT(*) AS total FROM "Keyword"
    WHERE ($1 = '' OR LOWER(display_name) LIKE LOWER($2))
  `;
  const dataQuery = `
    SELECT keyword_id, display_name FROM "Keyword"
    WHERE ($1 = '' OR LOWER(display_name) LIKE LOWER($2))
    ORDER BY display_name ASC
    LIMIT $3 OFFSET $4
  `;

  const [countResult, dataResult] = await Promise.all([
    prisma.$queryRawUnsafe(countQuery, normalizedSearch, searchPattern),
    prisma.$queryRawUnsafe(dataQuery, normalizedSearch, searchPattern, limit, offset),
  ]);

  const total = parseInt(countResult[0].total);
  return {
    data: dataResult,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

/**
 * Láº¥y danh sÃ¡ch bÃ i bÃ¡o liÃªn quan Ä‘áº¿n má»™t keyword theo ID.
 * Public â€” khÃ´ng cáº§n auth.
 *
 * @param {number} keywordId - ID cá»§a keyword
 * @param {Object} params - { page, limit, sortBy, sortOrder }
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export const getArticlesByKeyword = async (keywordId, { page = 1, limit = 10, sortBy = 'publication_year', sortOrder = 'desc', scope = 'all' } = {}) => {
  const offset = (page - 1) * limit;

  // Chá»‰ cho phÃ©p sort há»£p lá»‡ Ä‘á»ƒ trÃ¡nh SQL injection
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
  const values = [...articleFilter.values, keywordId];
  const keywordIndex = values.length;

  const countQuery = `
    SELECT COUNT(DISTINCT a.article_id) AS total
    FROM "Article" a
    JOIN "Keyword_Article" ka ON ka.article_id = a.article_id
    LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
    LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
    LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
    WHERE ${articleFilter.whereSql}
      AND ka.keyword_id = $${keywordIndex}
  `;

  const dataValues = [...values, limit, offset];
  const limitIndex = dataValues.length - 1;
  const offsetIndex = dataValues.length;
  const dataQuery = `
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
    JOIN "Keyword_Article" ka ON ka.article_id = a.article_id
    LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
    LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
    LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
    LEFT JOIN "Publisher" p ON p."publisher_id" = j."publisher_id"
    LEFT JOIN "Topic" t   ON t."topic_id"   = a."primary_topic"
    WHERE ${articleFilter.whereSql}
      AND ka.keyword_id = $${keywordIndex}
    ORDER BY ${column} ${safeOrder} NULLS LAST
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `;

  const [countResult, dataResult] = await Promise.all([
    prisma.$queryRawUnsafe(countQuery, ...values),
    prisma.$queryRawUnsafe(dataQuery, ...dataValues),
  ]);

  const total = parseInt(countResult[0].total);
  return {
    data: dataResult,
    scope: articleFilter.scope,
    pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
};


/**
 * Táº¡o má»›i má»™t keyword
 * @param {string} display_name - TÃªn keyword
 * @returns {Promise<Object>} keyword vá»«a táº¡o
 */
export const createKeyword = async (display_name) => {
  const duplicateCheck = await prisma.$queryRawUnsafe(
    `SELECT keyword_id, is_deleted FROM "Keyword"
     WHERE LOWER(display_name) = LOWER($1)`,
    display_name
  );

  if (duplicateCheck.length > 0) {
    if (duplicateCheck[0].is_deleted) {
      const error = new Error(
        "Keyword nÃ y Ä‘Ã£ bá»‹ xÃ³a trÆ°á»›c Ä‘Ã³, vui lÃ²ng sá»­ dá»¥ng API Restore Ä‘á»ƒ khÃ´i phá»¥c",
      );
      error.statusCode = 409;
      error.code = "KEYWORD_ALREADY_DELETED";
      throw error;
    }
    const error = new Error("Keyword Ä‘Ã£ tá»“n táº¡i");
    error.statusCode = 409;
    error.code = "KEYWORD_DUPLICATE";
    throw error;
  }

  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO "Keyword" (display_name)
     VALUES ($1) RETURNING keyword_id, display_name`,
    display_name
  );
  return rows[0];
};

/**
 * Cáº­p nháº­t keyword theo ID
 * @param {number} id - keyword_id
 * @param {string} display_name - TÃªn keyword má»›i
 * @returns {Promise<Object>} keyword sau khi cáº­p nháº­t
 */
export const updateKeyword = async (id, display_name) => {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT keyword_id FROM "Keyword"
     WHERE keyword_id = $1 AND is_deleted = false`,
    id
  );
  if (!existing.length) {
    const error = new Error("Keyword khÃ´ng tá»“n táº¡i");
    error.statusCode = 404;
    error.code = "KEYWORD_NOT_FOUND";
    throw error;
  }

  const duplicateCheck = await prisma.$queryRawUnsafe(
    `SELECT keyword_id FROM "Keyword"
     WHERE LOWER(display_name) = LOWER($1)
     AND keyword_id != $2 AND is_deleted = false`,
    display_name, id
  );
  if (duplicateCheck.length > 0) {
    const error = new Error("Keyword Ä‘Ã£ tá»“n táº¡i");
    error.statusCode = 409;
    error.code = "KEYWORD_DUPLICATE";
    throw error;
  }

  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "Keyword" SET display_name = $1
     WHERE keyword_id = $2
     RETURNING keyword_id, display_name`,
    display_name, id
  );
  return rows[0];
};

/**
 * Soft delete keyword theo ID
 * @param {number} id - keyword_id
 * @returns {Promise<Object>} keyword sau khi xÃ³a
 */
export const deleteKeyword = async (id) => {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT keyword_id, is_deleted FROM "Keyword"
     WHERE keyword_id = $1`,
    id
  );
  if (!existing.length) {
    const error = new Error("Keyword khÃ´ng tá»“n táº¡i");
    error.statusCode = 404;
    error.code = "KEYWORD_NOT_FOUND";
    throw error;
  }
  if (existing[0].is_deleted) {
    const error = new Error("Keyword Ä‘Ã£ bá»‹ xÃ³a trÆ°á»›c Ä‘Ã³");
    error.statusCode = 400;
    error.code = "KEYWORD_ALREADY_DELETED";
    throw error;
  }

  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "Keyword" SET is_deleted = true
     WHERE keyword_id = $1
     RETURNING keyword_id, display_name, is_deleted`,
    id
  );
  return rows[0];
};

/**
 * Restore keyword Ä‘Ã£ bá»‹ soft delete
 * @param {number} id - keyword_id
 * @returns {Promise<Object>} keyword sau khi restore
 */
export const restoreKeyword = async (id) => {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT keyword_id, is_deleted FROM "Keyword"
     WHERE keyword_id = $1`,
    id
  );
  if (!existing.length) {
    const error = new Error("Keyword khÃ´ng tá»“n táº¡i");
    error.statusCode = 404;
    error.code = "KEYWORD_NOT_FOUND";
    throw error;
  }
  if (!existing[0].is_deleted) {
    const error = new Error("Keyword nÃ y Ä‘ang active, khÃ´ng cáº§n restore");
    error.statusCode = 400;
    error.code = "KEYWORD_ALREADY_ACTIVE";
    throw error;
  }

  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "Keyword" SET is_deleted = false
     WHERE keyword_id = $1
     RETURNING keyword_id, display_name, is_deleted`,
    id
  );
  return rows[0];
};




