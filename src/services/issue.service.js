import pool from "../config/database.js";
import logger from "../utils/logger.js";

/**
 * Kiểm tra xem một số báo (Issue) có tồn tại trong hệ thống hay không.
 *
 * @param {number|string} issueId - ID của số báo cần kiểm tra
 * @returns {Promise<boolean>} `true` nếu số báo tồn tại, ngược lại `false`
 * @throws {Error} Ném lỗi khi truy vấn CSDL gặp sự cố
 */
export const issueExists = async (issueId) => {
  try {
    const queryText = `SELECT 1 FROM "Issue" WHERE "issue_id" = $1`;
    const res = await pool.query(queryText, [BigInt(issueId)]);
    return res.rowCount > 0;
  } catch (error) {
    logger.error("Lỗi khi kiểm tra tồn tại của số báo:", error);
    throw error;
  }
};

/**
 * Kiểm tra xem Issue có đang bị xóa mềm (is_deleted = true) hay không.
 *
 * @async
 * @param {number|string} id - ID của Issue cần kiểm tra.
 * @returns {Promise<boolean>} Trả về true nếu Issue đã bị xóa mềm, ngược lại false.
 */
export const issueIsDeleted = async (id) => {
  try {
    const query = `SELECT 1 FROM "Issue" WHERE issue_id = $1 AND is_deleted = true`;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Lỗi khi kiểm tra trạng thái xóa mềm của Issue với ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiểm tra xem có Issue nào khác đang hoạt động trùng lặp số issue trong cùng một volume không.
 *
 * @async
 * @param {number|string} volumeId - ID của Volume.
 * @param {number} issueNumber - Số issue cần kiểm tra.
 * @param {number|string} [excludeId=null] - ID của Issue cần loại trừ (trong trường hợp update).
 * @returns {Promise<boolean>} Trả về true nếu bị trùng lặp, ngược lại false.
 */
export const checkDuplicateIssue = async (volumeId, issueNumber, excludeId = null) => {
  try {
    let query = `
      SELECT 1 FROM "Issue"
      WHERE volume_id = $1 AND issue_number = $2 AND is_deleted = false
    `;
    const params = [BigInt(volumeId), parseInt(issueNumber, 10)];

    if (excludeId !== null) {
      query += ` AND issue_id != $3`;
      params.push(BigInt(excludeId));
    }

    const result = await pool.query(query, params);
    return result.rows.length > 0;
  } catch (error) {
    logger.error("Lỗi khi kiểm tra trùng lặp issue:", error.message);
    throw error;
  }
};

/**
 * Tạo mới một Issue.
 *
 * @async
 * @param {Object} data - Dữ liệu Issue cần tạo.
 * @param {number|string} data.volume_id - ID của Volume liên kết.
 * @param {number} data.issue_number - Số issue.
 * @param {number} data.publication_year - Năm xuất bản.
 * @returns {Promise<Object>} Trả về đối tượng Issue vừa được tạo.
 */
export const createIssue = async (data) => {
  try {
    const { volume_id, issue_number, publication_year } = data;
    const query = `
      INSERT INTO "Issue" (volume_id, issue_number, publication_year, is_deleted)
      VALUES ($1, $2, $3, false)
      RETURNING
        issue_id::text AS issue_id,
        volume_id::text AS volume_id,
        issue_number,
        publication_year,
        is_deleted;
    `;
    const values = [BigInt(volume_id), parseInt(issue_number, 10), parseInt(publication_year, 10)];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    logger.error("Lỗi khi tạo mới Issue:", error.message);
    throw error;
  }
};

/**
 * Lấy danh sách Issues có hỗ trợ tìm kiếm, lọc, sắp xếp và phân trang.
 * Chỉ lấy các Issue chưa bị xóa mềm (is_deleted = false).
 *
 * @async
 * @param {Object} params - Các tham số lọc và phân trang.
 * @returns {Promise<{ items: Array<Object>, total: number }>}
 */
export const getIssues = async ({
  page = 1,
  limit = 10,
  search,
  volume_id,
  sort_by = "issue_number",
  sort_order = "asc"
} = {}) => {
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      FROM "Issue"
      WHERE is_deleted = false
    `;
    const queryParams = [];

    // Lọc theo volume_id
    if (volume_id !== undefined && volume_id !== null && volume_id !== "") {
      queryParams.push(BigInt(volume_id));
      baseQuery += ` AND volume_id = $${queryParams.length}`;
    }

    // Tìm kiếm theo issue_number
    if (search !== undefined && search !== null && search.toString().trim() !== "") {
      queryParams.push(`%${search.toString().trim()}%`);
      baseQuery += ` AND issue_number::text ILIKE $${queryParams.length}`;
    }

    // Sắp xếp
    const allowedSortFields = ["issue_id", "issue_number", "publication_year"];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : "issue_number";
    const sortDir = sort_order && sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

    // Dùng Promise.all để tối ưu hiệu suất (chạy song song count + data)
    const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;

    queryParams.push(limitNum, offset);
    const dataQuery = `
      SELECT
        issue_id::text AS issue_id,
        volume_id::text AS volume_id,
        issue_number,
        publication_year,
        is_deleted
      ${baseQuery}
      ORDER BY "${sortField}" ${sortDir}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    // Chạy đồng thời 2 query
    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, queryParams.slice(0, queryParams.length - 2)),
      pool.query(dataQuery, queryParams)
    ]);

    return {
      items: dataRes.rows,
      total: countRes.rows[0]?.total || 0
    };
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách Issue:", error.message);
    throw error;
  }
};

/**
 * Lấy thông tin chi tiết một Issue theo ID (chưa bị xóa mềm).
 * Join với Volume và Journal để lấy thêm thông tin liên quan.
 *
 * @async
 * @param {number|string} id - ID của Issue cần lấy.
 * @returns {Promise<Object|null>} Trả về thông tin Issue hoặc null nếu không tìm thấy.
 */
export const getIssueById = async (id) => {
  try {
    const query = `
      SELECT
        i.issue_id::text AS issue_id,
        i.volume_id::text AS volume_id,
        i.issue_number,
        i.publication_year,
        i.is_deleted,
        v.volume_number,
        v.journal_id::text AS journal_id,
        j.display_name AS journal_name
      FROM "Issue" i
      LEFT JOIN "Volume" v ON v.volume_id = i.volume_id
      LEFT JOIN "Journal" j ON j.journal_id = v.journal_id
      WHERE i.issue_id = $1 AND i.is_deleted = false
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Issue ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Cập nhật thông tin Issue.
 * Dynamic update — chỉ cập nhật các field được gửi lên.
 *
 * @async
 * @param {number|string} id - ID của Issue cần cập nhật.
 * @param {Object} data - Dữ liệu cần cập nhật.
 * @param {number} [data.issue_number] - Số issue mới.
 * @param {number} [data.publication_year] - Năm xuất bản mới.
 * @returns {Promise<Object|null>} Trả về Issue sau cập nhật, hoặc null nếu không thành công.
 */
export const updateIssue = async (id, data) => {
  try {
    const allowedFields = ["issue_number", "publication_year"];
    const updateParts = [];
    const values = [];
    let placeholderIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined && data[field] !== null) {
        updateParts.push(`"${field}" = $${placeholderIndex}`);
        values.push(parseInt(data[field], 10));
        placeholderIndex++;
      }
    }

    if (updateParts.length === 0) {
      return null;
    }

    values.push(BigInt(id));
    const query = `
      UPDATE "Issue"
      SET ${updateParts.join(", ")}
      WHERE issue_id = $${placeholderIndex} AND is_deleted = false
      RETURNING
        issue_id::text AS issue_id,
        volume_id::text AS volume_id,
        issue_number,
        publication_year,
        is_deleted;
    `;
    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Issue ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Xóa mềm một Issue (đặt is_deleted = true).
 *
 * @async
 * @param {number|string} id - ID của Issue cần xóa mềm.
 * @returns {Promise<Object|null>} Trả về thông tin Issue đã xóa mềm, hoặc null.
 */
export const deleteIssue = async (id) => {
  try {
    const query = `
      UPDATE "Issue"
      SET is_deleted = true
      WHERE issue_id = $1 AND is_deleted = false
      RETURNING
        issue_id::text AS issue_id,
        volume_id::text AS volume_id,
        issue_number,
        publication_year,
        is_deleted;
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Issue ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Khôi phục một Issue đã bị xóa mềm (đặt is_deleted = false).
 *
 * @async
 * @param {number|string} id - ID của Issue cần khôi phục.
 * @returns {Promise<Object|null>} Trả về thông tin Issue đã khôi phục, hoặc null.
 */
export const restoreIssue = async (id) => {
  try {
    const query = `
      UPDATE "Issue"
      SET is_deleted = false
      WHERE issue_id = $1 AND is_deleted = true
      RETURNING
        issue_id::text AS issue_id,
        volume_id::text AS volume_id,
        issue_number,
        publication_year,
        is_deleted;
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Issue ID ${id}:`, error.message);
    throw error;
  }
};