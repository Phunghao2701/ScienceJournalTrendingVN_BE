import pool from "../config/database.js";
import logger from "../utils/logger.js";

/**
 * Lấy danh sách từ khóa thịnh hành trong một project.
 *
 * @param {number|string} projectId - ID của project cần truy vấn
 * @param {Object} queryParams - Tham số lọc/phan trang
 * @param {number|string} [queryParams.limit=20] - Số kết quả tối đa
 * @param {string} [queryParams.sort_by='count'] - `count` hoặc `score`
 * @returns {Promise<Object>} Kết quả gồm tổng `total`, `sort_by` và mảng `keywords`
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

  const { rows } = await pool.query(query, [projectId, limit]);

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
 * Lấy danh sách bài báo liên quan đến các từ khóa được theo dõi trong project.
 *
 * @param {number|string} projectId - ID project
 * @param {number|string} userId - ID người dùng thực hiện truy vấn (dùng để kiểm tra sở hữu)
 * @param {Object} queryParams
 * @param {number|string} [queryParams.page=1] - Trang kết quả
 * @param {number|string} [queryParams.limit=10] - Số phần tử trên mỗi trang
 * @returns {Promise<Object>} Object phân trang: { page, limit, total, total_pages, data }
 *  - `data` là mảng article objects `{ article_id, title, publication_year, doi, matched_keywords }`
 */
export const getWatchedKeywordArticles = async (
  projectId,
  userId,
  queryParams,
) => {
  const page = Math.max(parseInt(queryParams.page) || 1, 1);
  const limit = Math.min(parseInt(queryParams.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const projectCheck = await pool.query(
    `SELECT project_id FROM "Project" WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId],
  );

  if (!projectCheck.rows.length) {
    const error = new Error(
      "Project không tồn tại hoặc không thuộc quyền sở hữu",
    );
    error.statusCode = 400;
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
      a.publication_year,
      a.doi,
      ARRAY_AGG(DISTINCT k.display_name) AS matched_keywords
    FROM "Project_Keyword" pk
    JOIN "Project" p          ON p.project_id  = pk.project_id
    JOIN "Keyword" k          ON k.keyword_id  = pk.keyword_id
    JOIN "Keyword_Article" ka ON ka.keyword_id = k.keyword_id
    JOIN "Article" a          ON a.article_id  = ka.article_id
    WHERE pk.project_id = $1
      AND p.user_id     = $2
    GROUP BY a.article_id, a.title, a.publication_year, a.doi, a.created_at
    ORDER BY a.publication_year DESC, a.created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countQuery, [projectId, userId]),
    pool.query(dataQuery, [projectId, userId, limit, offset]),
  ]);

  const total = parseInt(countResult.rows[0]?.total) || 0;

  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    data: dataResult.rows.map((a) => ({
      article_id: a.article_id,
      title: a.title || null,
      publication_year: a.publication_year || null,
      doi: a.doi || null,
      matched_keywords: a.matched_keywords || [],
    })),
  };
};

/**
 * Xác thực xem một danh sách `keyword_id` có tồn tại trong bảng `Keyword` hay không.
 * Trả về `true` khi tất cả id hợp lệ, ngược lại `false`.
 *
 * @param {Array<number|string>} keywordIds - Mảng id cần kiểm tra
 * @returns {Promise<boolean>} `true` nếu tất cả id tồn tại
 */
export const validateKeywordIds = async (keywordIds) => {
  if (!keywordIds || keywordIds.length === 0) return true;

  const uniqueIds = [...new Set(keywordIds)];

  const query = `
    SELECT keyword_id
    FROM "Keyword"
    WHERE keyword_id = ANY($1::bigint[])
  `;
  const result = await pool.query(query, [uniqueIds]);
  return result.rows.length === uniqueIds.length;
};

/**
 * Đồng bộ danh sách từ khóa được theo dõi (Project_Keyword) cho một project.
 * - Bỏ qua nếu `keywordIds` rỗng.
 * - Chỉ insert những keyword mới và tồn tại.
 *
 * @param {number|string} projectId - ID project
 * @param {Array<number|string>} keywordIds - Mảng keyword_id cần đồng bộ
 * @returns {Promise<boolean>} `true` nếu đồng bộ thành công
 * @throws {Error} Ném lỗi khi DB transaction gặp sự cố
 */
export const syncWatchedKeywords = async (projectId, keywordIds) => {
  if (!keywordIds || keywordIds.length === 0) return true;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Loại bỏ duplicate từ input
    const uniqueIds = [...new Set(keywordIds)];

    // 2. Lấy danh sách keywords đã tồn tại cho project này
    const existingResult = await client.query(
      `SELECT keyword_id FROM "Project_Keyword" WHERE project_id = $1`,
      [projectId],
    );
    const existingIds = new Set(
      existingResult.rows.map((row) => Number(row.keyword_id)),
    );

    // 3. Lọc ra keywords mới (chưa tồn tại)
    const newKeywordIds = uniqueIds.filter((id) => !existingIds.has(id));

    if (newKeywordIds.length === 0) {
      await client.query("COMMIT");
      return true; // Không có keywords mới để thêm
    }

    // 4. Validate keywords tồn tại trong bảng Keyword
    const validationResult = await client.query(
      `SELECT keyword_id FROM "Keyword" WHERE keyword_id = ANY($1::bigint[])`,
      [newKeywordIds],
    );
    const validIds = new Set(
      validationResult.rows.map((row) => Number(row.keyword_id)),
    );

    // 5. Chỉ INSERT những keywords hợp lệ
    const idsToInsert = newKeywordIds.filter((id) => validIds.has(id));

    if (idsToInsert.length > 0) {
      for (const kwId of idsToInsert) {
        await client.query(
          `INSERT INTO "Project_Keyword" (project_id, keyword_id) VALUES ($1, $2)`,
          [projectId, kwId],
        );
      }
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Ghi đè (thay thế toàn bộ) danh sách từ khóa được theo dõi cho một project.
 * - Xóa tất cả từ khóa đang theo dõi hiện tại của project.
 * - Thêm mới danh sách `keywordIds` truyền vào.
 *
 * @param {number|string} projectId - ID project
 * @param {Array<number|string>} keywordIds - Mảng keyword_id cần cập nhật
 * @returns {Promise<boolean>} `true` nếu cập nhật thành công
 * @throws {Error} Ném lỗi khi DB transaction gặp sự cố
 */
export const replaceWatchedKeywords = async (projectId, keywordIds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Xóa tất cả các liên kết từ khóa cũ của project
    await client.query(
      `DELETE FROM "Project_Keyword" WHERE project_id = $1`,
      [projectId]
    );

    // Nếu không có keyword nào truyền lên, tức là chỉ muốn xóa sạch -> Commit luôn
    if (!keywordIds || keywordIds.length === 0) {
      await client.query('COMMIT');
      return true;
    }

    // 2. Loại bỏ duplicate từ input
    const uniqueIds = [...new Set(keywordIds)];

    // 3. Validate keywords tồn tại trong bảng Keyword
    const validationResult = await client.query(
      `SELECT keyword_id FROM "Keyword" WHERE keyword_id = ANY($1::bigint[])`,
      [uniqueIds]
    );
    const validIds = new Set(validationResult.rows.map(row => Number(row.keyword_id)));

    // 4. Lọc ra những keywords hợp lệ
    const idsToInsert = uniqueIds.filter(id => validIds.has(id));
    
    // 5. Insert danh sách keywords hợp lệ mới
    if (idsToInsert.length > 0) {
      for (const kwId of idsToInsert) {
        await client.query(
          `INSERT INTO "Project_Keyword" (project_id, keyword_id) VALUES ($1, $2)`,
          [projectId, kwId]
        );
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Thêm danh sách từ khóa vào danh sách theo dõi của dự án.
 * Nếu có BẤT KỲ từ khóa nào trong danh sách đã được theo dõi, sẽ không thêm từ khóa nào và báo lỗi.
 *
 * @param {number|string} projectId - ID dự án
 * @param {Array<number|string>} keywordIds - Mảng các ID từ khóa
 * @returns {Promise<Object>} Object chứa trạng thái success, số lượng thêm thành công, hoặc danh sách ID bị trùng
 */
export const addWatchedKeywords = async (projectId, keywordIds) => {
  if (!keywordIds || keywordIds.length === 0) return { success: true, insertedCount: 0 };
  
  // 1. Kiểm tra xem có keyword nào đã tồn tại trong project này chưa
  const existingCheck = await pool.query(
    `SELECT keyword_id FROM "Project_Keyword" WHERE project_id = $1 AND keyword_id = ANY($2::int[])`,
    [projectId, keywordIds]
  );

  if (existingCheck.rows.length > 0) {
    const existingIds = existingCheck.rows.map(row => row.keyword_id);
    return { success: false, existingIds };
  }

  // 2. Nếu không trùng cái nào, tiến hành thêm tất cả
  // Dùng transaction để đảm bảo an toàn nếu thêm nhiều
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let insertedCount = 0;
    for (const kwId of keywordIds) {
      const result = await client.query(
        `INSERT INTO "Project_Keyword" (project_id, keyword_id) VALUES ($1, $2)`,
        [projectId, kwId]
      );
      insertedCount += result.rowCount;
    }
    await client.query('COMMIT');
    return { success: true, insertedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Kiểm tra quyền sở hữu project của user.
 *
 * @param {number|string} projectId - ID project
 * @param {number|string} userId - ID user
 * @returns {Promise<boolean>} `true` nếu user là chủ project
 */
export const checkProjectOwnership = async (projectId, userId) => {
  const result = await pool.query(
    `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId],
  );
  return result.rows.length > 0;
};

/**
 * Xóa một từ khóa khỏi danh sách theo dõi của dự án (xóa trong Project_Keyword).
 *
 * @param {number|string} projectId - ID dự án
 * @param {number|string} keywordId - ID từ khóa cần xóa
 * @returns {Promise<boolean>} `true` nếu xóa thành công, `false` nếu từ khóa không tồn tại trong danh sách
 */
export const removeWatchedKeyword = async (projectId, keywordId) => {
  const result = await pool.query(
    `DELETE FROM "Project_Keyword" WHERE project_id = $1 AND keyword_id = $2 RETURNING *`,
    [projectId, keywordId]
  );
  
  return result.rowCount > 0;
};

/**
 * Thêm (và upsert) các từ khóa rồi gán vào một bài báo cùng với `score`.
 * Hỗ trợ hai dạng `keywordsInput`:
 * - Array of strings: `["kw1", "kw2"]` (điểm dùng `options.score` hoặc 0)
 * - Object mapping: `{ "Colorectal cancer": 0.25, "demo 2": 0.25 }`
 *
 * Trả về mảng các bản ghi `Keyword` đã được upsert.
 *
 * @param {number|string} articleId - ID bài báo
 * @param {Array<string>|Object<string, number>} keywordsInput - Dữ liệu từ khóa
 * @param {Object} [options] - Tuỳ chọn, ví dụ `{ score: number }` cho dạng array
 * @returns {Promise<Array>} Mảng các bản ghi `Keyword` (rows returned from INSERT ... RETURNING)
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const upsertKeywordsQuery = `
            INSERT INTO "Keyword" (display_name)
            SELECT unnest($1::text[])
            ON CONFLICT (display_name)
            DO UPDATE SET display_name = EXCLUDED.display_name
            RETURNING keyword_id, display_name;
        `;

    const keywordResult = await client.query(upsertKeywordsQuery, [
      uniqueKeywordNames,
    ]);
    const allKeywords = keywordResult.rows;

    if (allKeywords.length === 0) {
      await client.query("COMMIT");
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
      await client.query("COMMIT");
      return [];
    }

    const insertRelationsQuery = `
            INSERT INTO "Keyword_Article" (article_id, keyword_id, score)
            SELECT $1, unnest($2::bigint[]), unnest($3::numeric[])
            ON CONFLICT DO NOTHING;
        `;

    await client.query(insertRelationsQuery, [
      articleId,
      keywordIds,
      keywordScores,
    ]);

    await client.query("COMMIT");
    return allKeywords;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Error adding keywords to article:", error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cập nhật toàn bộ danh sách từ khóa của một bài báo (thay thế hoàn toàn).
 * - Xóa mối quan hệ cũ trong `Keyword_Article`
 * - Gọi `addKeywordsToArticle` để upsert và chèn quan hệ mới
 *
 * @param {number|string} articleId - ID bài báo
 * @param {Array<string>|Object<string, number>} keywordsInput - Dữ liệu từ khóa (giống `addKeywordsToArticle`)
 * @returns {Promise<Array>} Mảng các bản ghi `Keyword` đã được gán
 */
export const updateKeywordsToArticle = async (articleId, keywordsInput) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deleteRelationsQuery = `
            DELETE FROM "Keyword_Article"
            WHERE "article_id" = $1;
        `;
    await client.query(deleteRelationsQuery, [articleId]);

    await client.query("COMMIT");

    const updatedKeywords = await addKeywordsToArticle(
      articleId,
      keywordsInput,
    );

    logger.info(
      `Đã làm mới toàn bộ danh sách từ khóa cho bài báo ID: ${articleId}`,
    );
    return updatedKeywords;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(
      `Lỗi khi cập nhật danh sách từ khóa cho bài báo ID ${articleId}:`,
      error,
    );
    throw error;
  } finally {
    client.release();
  }
};

//*********Những API liên quan tương tác trực tiếp tới Table Keyword */
/**
 * Lấy keyword theo ID
 * @param {number} id - keyword_id
 * @returns {Promise<Object>} keyword object
 */
export const getKeywordById = async (id) => {
  const { rows } = await pool.query(
    `SELECT keyword_id, display_name FROM "Keyword"
     WHERE keyword_id = $1`,
    [id],
  );
  if (!rows.length) {
    const error = new Error("Keyword không tồn tại");
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
    pool.query(countQuery, [normalizedSearch, searchPattern]),
    pool.query(dataQuery, [normalizedSearch, searchPattern, limit, offset]),
  ]);

  const total = parseInt(countResult.rows[0].total);
  return {
    data: dataResult.rows,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

/**
 * Lấy danh sách bài báo liên quan đến một keyword theo ID.
 * Public — không cần auth.
 *
 * @param {number} keywordId - ID của keyword
 * @param {Object} params - { page, limit, sortBy, sortOrder }
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export const getArticlesByKeyword = async (keywordId, { page = 1, limit = 10, sortBy = 'publication_year', sortOrder = 'desc' } = {}) => {
  const offset = (page - 1) * limit;

  // Chỉ cho phép sort hợp lệ để tránh SQL injection
  const allowedSortFields = ['publication_year', 'title', 'created_at'];
  const safeSort = allowedSortFields.includes(sortBy) ? sortBy : 'publication_year';
  const safeOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countQuery = `
    SELECT COUNT(DISTINCT a.article_id) AS total
    FROM "Article" a
    JOIN "Keyword_Article" ka ON ka.article_id = a.article_id
    WHERE ka.keyword_id = $1
  `;

  const dataQuery = `
    SELECT
      a.article_id,
      a.title,
      a.abstract,
      a.publication_year,
      a.doi,
      j.display_name AS journal_name,
      0 AS citations_count
    FROM "Article" a
    JOIN "Keyword_Article" ka ON ka.article_id = a.article_id
    LEFT JOIN "Issue" i   ON i.issue_id   = a.issue_id
    LEFT JOIN "Volume" v  ON v.volume_id  = i.volume_id
    LEFT JOIN "Journal" j ON j.journal_id = v.journal_id
    WHERE ka.keyword_id = $1
    ORDER BY a.${safeSort} ${safeOrder} NULLS LAST
    LIMIT $2 OFFSET $3
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countQuery, [keywordId]),
    pool.query(dataQuery, [keywordId, limit, offset]),
  ]);

  const total = parseInt(countResult.rows[0].total);
  return {
    data: dataResult.rows,
    pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
};


/**
 * Tạo mới một keyword
 * @param {string} display_name - Tên keyword
 * @returns {Promise<Object>} keyword vừa tạo
 */
export const createKeyword = async (display_name) => {
  const duplicateCheck = await pool.query(
    `SELECT keyword_id, is_deleted FROM "Keyword"
     WHERE LOWER(display_name) = LOWER($1)`,
    [display_name],
  );

  if (duplicateCheck.rows.length > 0) {
    if (duplicateCheck.rows[0].is_deleted) {
      const error = new Error(
        "Keyword này đã bị xóa trước đó, vui lòng sử dụng API Restore để khôi phục",
      );
      error.statusCode = 409;
      error.code = "KEYWORD_ALREADY_DELETED";
      throw error;
    }
    const error = new Error("Keyword đã tồn tại");
    error.statusCode = 409;
    error.code = "KEYWORD_DUPLICATE";
    throw error;
  }

  const { rows } = await pool.query(
    `INSERT INTO "Keyword" (display_name)
     VALUES ($1) RETURNING keyword_id, display_name`,
    [display_name],
  );
  return rows[0];
};

/**
 * Cập nhật keyword theo ID
 * @param {number} id - keyword_id
 * @param {string} display_name - Tên keyword mới
 * @returns {Promise<Object>} keyword sau khi cập nhật
 */
export const updateKeyword = async (id, display_name) => {
  const existing = await pool.query(
    `SELECT keyword_id FROM "Keyword"
     WHERE keyword_id = $1 AND is_deleted = false`,
    [id],
  );
  if (!existing.rows.length) {
    const error = new Error("Keyword không tồn tại");
    error.statusCode = 404;
    error.code = "KEYWORD_NOT_FOUND";
    throw error;
  }

  const duplicateCheck = await pool.query(
    `SELECT keyword_id FROM "Keyword"
     WHERE LOWER(display_name) = LOWER($1)
     AND keyword_id != $2 AND is_deleted = false`,
    [display_name, id],
  );
  if (duplicateCheck.rows.length > 0) {
    const error = new Error("Keyword đã tồn tại");
    error.statusCode = 409;
    error.code = "KEYWORD_DUPLICATE";
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE "Keyword" SET display_name = $1
     WHERE keyword_id = $2
     RETURNING keyword_id, display_name`,
    [display_name, id],
  );
  return rows[0];
};

/**
 * Soft delete keyword theo ID
 * @param {number} id - keyword_id
 * @returns {Promise<Object>} keyword sau khi xóa
 */
export const deleteKeyword = async (id) => {
  const existing = await pool.query(
    `SELECT keyword_id, is_deleted FROM "Keyword"
     WHERE keyword_id = $1`,
    [id],
  );
  if (!existing.rows.length) {
    const error = new Error("Keyword không tồn tại");
    error.statusCode = 404;
    error.code = "KEYWORD_NOT_FOUND";
    throw error;
  }
  if (existing.rows[0].is_deleted) {
    const error = new Error("Keyword đã bị xóa trước đó");
    error.statusCode = 400;
    error.code = "KEYWORD_ALREADY_DELETED";
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE "Keyword" SET is_deleted = true
     WHERE keyword_id = $1
     RETURNING keyword_id, display_name, is_deleted`,
    [id],
  );
  return rows[0];
};

/**
 * Restore keyword đã bị soft delete
 * @param {number} id - keyword_id
 * @returns {Promise<Object>} keyword sau khi restore
 */
export const restoreKeyword = async (id) => {
  const existing = await pool.query(
    `SELECT keyword_id, is_deleted FROM "Keyword"
     WHERE keyword_id = $1`,
    [id],
  );
  if (!existing.rows.length) {
    const error = new Error("Keyword không tồn tại");
    error.statusCode = 404;
    error.code = "KEYWORD_NOT_FOUND";
    throw error;
  }
  if (!existing.rows[0].is_deleted) {
    const error = new Error("Keyword này đang active, không cần restore");
    error.statusCode = 400;
    error.code = "KEYWORD_ALREADY_ACTIVE";
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE "Keyword" SET is_deleted = false
     WHERE keyword_id = $1
     RETURNING keyword_id, display_name, is_deleted`,
    [id],
  );
  return rows[0];
};
