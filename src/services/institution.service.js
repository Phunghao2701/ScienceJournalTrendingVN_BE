import pool from "../config/database.js";
import logger from "../utils/logger.js";

/**
 * Lấy danh sách cơ sở giáo dục Việt Nam (Institution), hỗ trợ tìm kiếm và phân trang.
 * Scope cố định: country_code='VN' và type='education', khớp đúng quy tắc
 * scope=vn_universities đã dùng cho Article (docs/researches/paper-vn-affiliation-scope.md).
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export const getInstitutions = async ({ page = 1, limit = 50, search = "" } = {}) => {
  try {
    const offset = (page - 1) * limit;
    const searchParam = `%${search}%`;

    const query = `
      SELECT institution_id::text, display_name, country_code, type, created_at
      FROM "Institution"
      WHERE COALESCE(is_deleted, false) = false
        AND UPPER(TRIM(country_code)) = 'VN'
        AND LOWER(TRIM(type)) = 'education'
        AND display_name ILIKE $1
      ORDER BY display_name ASC
      LIMIT $2 OFFSET $3;
    `;
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM "Institution"
      WHERE COALESCE(is_deleted, false) = false
        AND UPPER(TRIM(country_code)) = 'VN'
        AND LOWER(TRIM(type)) = 'education'
        AND display_name ILIKE $1;
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, [searchParam, limit, offset]),
      pool.query(countQuery, [searchParam]),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("[Service Error] Lỗi khi lấy danh sách institution:", error);
    throw error;
  }
};
