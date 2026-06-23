import pool from "../config/database.js";
import logger from "../utils/logger.js";

/**
 * Lấy thông tin tác giả theo ID
 * @param {number} authorId
 * @returns {Promise<Object>} Thông tin tác giả
 */
export const getAuthorById = async (authorId) => {
  try {
    const queryText = `SELECT * FROM "Author" WHERE "author_id" = $1`;
    const res = await pool.query(queryText, [authorId]);
    return res.rows[0];
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin tác giả theo ID:", error);
    throw error;
  }
};

/**
 * Phân tích danh mục chuyên ngành (Subject Category) nghiên cứu của một tác giả
 * @async
 * @param {number|string} authorId - ID của tác giả cần thống kê
 * @returns {Promise<Array>} Mảng danh sách chuyên ngành, sản lượng bài báo và tỷ lệ %
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

    const res = await pool.query(queryText, [authorId]);

    return res.rows;
  } catch (error) {
    logger.error(
      "Xuất hiện lỗi khi phân tích lĩnh vực nghiên cứu của tác giả:",
      error,
    );
    throw error;
  }
};

/**
 * Lấy danh sách bài viết của một tác giả với phân trang an toàn.
 *
 * - Chuyển `limit` và `page` sang các giá trị an toàn (`safeLimit`, `safePage`).
 * - Tính `OFFSET` từ `page` và `limit` rồi truy vấn cơ sở dữ liệu.
 *
 * @async
 * @param {number} authorId - ID tác giả cần lấy bài viết.
 * @param {number|string} [limit=10] - Số bài viết trên mỗi trang (hoặc chuỗi có thể parse được).
 * @param {number|string} [page=1] - Số trang (1-based) (hoặc chuỗi có thể parse được).
 * @returns {Promise<Array<Object>>} Mảng các bài viết, mỗi phần tử chứa các trường:
 * `{ article_id, title, abstract, publication_year, doi, primary_topic, created_at }`.
 * @throws {Error} Ném lỗi khi truy vấn DB gặp vấn đề; caller nên xử lý và log lỗi.
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
        a.created_at
      FROM "Article" a
      JOIN "Author_Article" aa ON a.article_id = aa.article_id
      WHERE aa.author_id = $1
      ORDER BY a.publication_year DESC, a.article_id DESC
      LIMIT $2 OFFSET $3
    `;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, [authorId]),
      pool.query(dataQuery, [authorId, safeLimit, safeOffset]),
    ]);

    const total = countResult.rows[0]?.total || 0;

    return {
      items: dataResult.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    logger.error("Lỗi khi lấy bài viết của tác giả:", error);
    throw error;
  }
};

/**
 * Lấy bảng xếp hạng tác giả với phân trang.
 *
 * @param {number|string} [limit=10] - Số lượng bản ghi trên mỗi trang.
 * @param {number|string} [page=1] - Số trang bắt đầu từ 1.
 * @returns {Promise<Array<Object>>} Danh sách tác giả và chỉ số xếp hạng.
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
      pool.query(countQuery),
      pool.query(dataQuery, [safeLimit, safeOffset]),
    ]);

    const total = countResult.rows[0]?.total || 0;

    return {
      items: dataResult.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    logger.error("Lỗi khi lấy bảng xếp hạng tác giả:", error);
    throw error;
  }
};

/**
 * Kiểm tra xem một tác giả có tồn tại hay không.
 *
 * @param {number|string} authorId - ID của tác giả cần kiểm tra
 * @returns {Promise<boolean>} `true` nếu tồn tại, ngược lại `false`
 */
export const isAuthorExists = async (authorId) => {
  try {
    const queryText = `SELECT 1 FROM "Author" WHERE "author_id" = $1`;
    const res = await pool.query(queryText, [authorId]);
    return res.rowCount > 0;
  } catch (error) {
    logger.error("Lỗi khi kiểm tra tồn tại của tác giả:", error);
    throw error;
  }
};

/**
 * Kiểm tra tồn tại một loạt tác giả và trả về những `author_id` không tồn tại.
 *
 * @param {Array<number|string>} authorIds - Mảng ID tác giả cần kiểm tra
 * @returns {Promise<number[]>} Mảng các `author_id` không tồn tại trên hệ thống
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

    const result = await pool.query(queryText, [authorIds]);

    const existingAuthorIds = result.rows.map((row) => Number(row.author_id));

    const normalizedAuthorIds = authorIds.map((id) => Number(id));

    const nonExistingAuthorIds = normalizedAuthorIds.filter(
      (id) => !existingAuthorIds.includes(id),
    );

    return nonExistingAuthorIds;
  } catch (error) {
    logger.error("Lỗi khi kiểm tra tồn tại của các tác giả:", error);
    throw error;
  }
};

/**
 * Tạo các quan hệ `Author_Article` cho một bài báo.
 * - Bỏ qua nếu `authorIds` rỗng.
 * - Loại bỏ trùng lặp trước khi chèn.
 *
 * @param {number|string} articleId - ID bài báo
 * @param {Array<number|string>} authorIds - Mảng ID tác giả để gán cho bài báo
 * @returns {Promise<void>} Không trả về dữ liệu, ném lỗi nếu có sự cố
 */
export const createAuthorArticleRelationships = async (
  articleId,
  authorIds,
) => {
  try {
    if (!authorIds || authorIds.length === 0) {
      return;
    }

    // Loại bỏ trùng lặp, chuyển thành Number, và lọc bỏ NaN / ID không hợp lệ
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

    await pool.query(query, [articleId, uniqueAuthorIds]);

    logger.info(`Đã tạo ${uniqueAuthorIds.length} quan hệ tác giả - bài báo`);
  } catch (error) {
    logger.error("Lỗi khi tạo quan hệ tác giả - bài báo:", error);
    throw error;
  }
};

/**
 * Cập nhật toàn bộ mối quan hệ tác giả cho bài báo
 * - Bước 1: Xóa toàn bộ liên kết tác giả cũ của bài báo này
 * - Bước 2: Gọi lại hàm create để chèn danh sách mới sạch sẽ
 * * @param {number|string} articleId - ID của bài báo cần cập nhật
 * @param {number[]} authorIds - Mảng các ID tác giả mới (ví dụ: [1, 2, 3])
 */
export const updateAuthorArticleRelationships = async (
  articleId,
  authorIds,
) => {
  try {
    if (!articleId) {
      throw new Error(
        "Thiếu articleId khi gọi hàm updateAuthorArticleRelationships",
      );
    }

    const deleteQuery = `
            DELETE FROM "Author_Article"
            WHERE "article_id" = $1;
        `;
    await pool.query(deleteQuery, [articleId]);

    await createAuthorArticleRelationships(articleId, authorIds);

    logger.info(
      `Đã cập nhật làm mới toàn bộ quan hệ tác giả cho bài báo ID: ${articleId}`,
    );
  } catch (error) {
    logger.error(
      `Lỗi khi cập nhật quan hệ tác giả cho bài báo ID ${articleId}:`,
      error,
    );
    throw error;
  }
};

//Phần API xử lý CRUD Author - Author Management
/**
 * Lấy danh sách authors với pagination và search
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
    pool.query(countQuery, [searchPattern]),
    pool.query(dataQuery, [searchPattern, limit, offset]),
  ]);

  const total = parseInt(countResult.rows[0].total);

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Tạo mới author
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

  const { rows } = await pool.query(
    `INSERT INTO "Author" (
      display_name, orcid, url_image,
      works_count, cited_by_count, h_index, i10_index,
      last_known_institution, last_known_institution_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [
      display_name,
      orcid,
      url_image,
      works_count,
      cited_by_count,
      h_index,
      i10_index,
      last_known_institution,
      last_known_institution_id,
    ],
  );

  return rows[0];
};
/**
 * Cập nhật author theo ID
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

  const existing = await pool.query(
    `SELECT author_id FROM "Author" WHERE author_id = $1 AND is_deleted = false`,
    [id],
  );

  if (!existing.rows.length) {
    const error = new Error("Tác giả không tồn tại");
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
  const { rows } = await pool.query(
    `UPDATE "Author" SET ${updateParts.join(", ")}
     WHERE author_id = $${idx} AND is_deleted = false
     RETURNING *`,
    values,
  );

  return rows[0];
};

/**
 * Soft delete author
 */
export const deleteAuthor = async (id) => {
  const existing = await pool.query(
    `SELECT author_id, is_deleted FROM "Author" WHERE author_id = $1`,
    [id],
  );

  if (!existing.rows.length) {
    const error = new Error("Tác giả không tồn tại");
    error.statusCode = 404;
    error.code = "AUTHOR_NOT_FOUND";
    throw error;
  }

  if (existing.rows[0].is_deleted) {
    const error = new Error("Tác giả đã bị xóa trước đó");
    error.statusCode = 400;
    error.code = "AUTHOR_ALREADY_DELETED";
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE "Author" SET is_deleted = true
     WHERE author_id = $1
     RETURNING author_id, display_name, is_deleted`,
    [id],
  );

  return rows[0];
};

/**
 * Restore author đã bị soft delete
 */
export const restoreAuthor = async (id) => {
  const existing = await pool.query(
    `SELECT author_id, is_deleted FROM "Author" WHERE author_id = $1`,
    [id],
  );

  if (!existing.rows.length) {
    const error = new Error("Tác giả không tồn tại");
    error.statusCode = 404;
    error.code = "AUTHOR_NOT_FOUND";
    throw error;
  }

  if (!existing.rows[0].is_deleted) {
    const error = new Error("Tác giả đang active, không cần restore");
    error.statusCode = 400;
    error.code = "AUTHOR_ALREADY_ACTIVE";
    throw error;
  }

  const { rows } = await pool.query(
    `UPDATE "Author" SET is_deleted = false
     WHERE author_id = $1
     RETURNING author_id, display_name, is_deleted`,
    [id],
  );

  return rows[0];
};
