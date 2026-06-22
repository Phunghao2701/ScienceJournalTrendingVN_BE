import pool from "../config/database.js";
import logger from "../utils/logger.js";

/**
 * Kiểm tra sự tồn tại của một Volume trong database dựa trên ID.
 * Không phân biệt đã bị xóa mềm hay chưa.
 * 
 * @async
 * @param {number|string} id - ID của Volume cần kiểm tra.
 * @returns {Promise<boolean>} Trả về true nếu Volume tồn tại, ngược lại false.
 */
export const volumeExist = async (id) => {
  try {
    const query = `SELECT 1 FROM "Volume" WHERE volume_id = $1`;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Lỗi khi kiểm tra tồn tại của Volume với ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiểm tra xem Volume có đang bị xóa mềm (is_deleted = true) hay không.
 * 
 * @async
 * @param {number|string} id - ID của Volume cần kiểm tra.
 * @returns {Promise<boolean>} Trả về true nếu Volume đã bị xóa mềm, ngược lại false.
 */
export const volumeIsDeleted = async (id) => {
  try {
    const query = `SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = true`;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Lỗi khi kiểm tra trạng thái xóa mềm của Volume với ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiểm tra xem có Volume nào khác đang hoạt động trùng lặp số volume trong cùng một tạp chí không.
 * 
 * @async
 * @param {number|string} journalId - ID của Journal.
 * @param {number} volumeNumber - Số volume cần kiểm tra.
 * @param {number|string} [excludeId=null] - ID của Volume cần loại trừ (trong trường hợp update).
 * @returns {Promise<boolean>} Trả về true nếu bị trùng lặp, ngược lại false.
 */
export const checkDuplicateVolume = async (journalId, volumeNumber, excludeId = null) => {
  try {
    let query = `
      SELECT 1 FROM "Volume" 
      WHERE journal_id = $1 AND volume_number = $2 AND is_deleted = false
    `;
    const params = [BigInt(journalId), parseInt(volumeNumber, 10)];

    if (excludeId !== null) {
      query += ` AND volume_id != $3`;
      params.push(BigInt(excludeId));
    }

    const result = await pool.query(query, params);
    return result.rows.length > 0;
  } catch (error) {
    logger.error("Lỗi khi kiểm tra trùng lặp volume:", error.message);
    throw error;
  }
};

/**
 * Tạo mới một Volume.
 * 
 * @async
 * @param {Object} data - Dữ liệu Volume cần tạo.
 * @param {number|string} data.journal_id - ID của Journal liên kết.
 * @param {number} data.volume_number - Số volume.
 * @param {number} data.publication_year - Năm xuất bản.
 * @returns {Promise<Object>} Trả về đối tượng Volume vừa được tạo.
 */
export const createVolume = async (data) => {
  try {
    const { journal_id, volume_number, publication_year } = data;
    const query = `
      INSERT INTO "Volume" (journal_id, volume_number, publication_year, is_deleted)
      VALUES ($1, $2, $3, false)
      RETURNING 
        volume_id::text AS volume_id, 
        journal_id::text AS journal_id, 
        volume_number, 
        publication_year, 
        is_deleted;
    `;
    const values = [BigInt(journal_id), parseInt(volume_number, 10), parseInt(publication_year, 10)];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    logger.error("Lỗi khi tạo mới Volume:", error.message);
    throw error;
  }
};

/**
 * Lấy danh sách Volumes có hỗ trợ tìm kiếm, lọc, sắp xếp và phân trang.
 * Chỉ lấy các Volume chưa bị xóa mềm (is_deleted = false).
 * 
 * @async
 * @param {Object} params - Các tham số lọc và phân trang.
 * @returns {Promise<{ items: Array<Object>, total: number }>}
 */
export const getVolumes = async ({
  page = 1,
  limit = 10,
  search,
  journal_id,
  publication_year,
  sort_by = "volume_number",
  sort_order = "asc"
} = {}) => {
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      FROM "Volume"
      WHERE is_deleted = false
    `;
    const queryParams = [];

    // Lọc theo journal_id
    if (journal_id !== undefined && journal_id !== null && journal_id !== "") {
      queryParams.push(BigInt(journal_id));
      baseQuery += ` AND journal_id = $${queryParams.length}`;
    }

    // Lọc theo publication_year
    if (publication_year !== undefined && publication_year !== null && publication_year !== "") {
      queryParams.push(parseInt(publication_year, 10));
      baseQuery += ` AND publication_year = $${queryParams.length}`;
    }

    // Tìm kiếm theo số volume
    if (search !== undefined && search !== null && search.toString().trim() !== "") {
      queryParams.push(`%${search.toString().trim()}%`);
      baseQuery += ` AND volume_number::text ILIKE $${queryParams.length}`;
    }

    // Đếm tổng số bản ghi
    const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;
    const countRes = await pool.query(countQuery, queryParams);
    const total = countRes.rows[0]?.total || 0;

    // Sắp xếp
    const allowedSortFields = ["volume_id", "volume_number", "publication_year"];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : "volume_number";
    const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

    // Phân trang
    queryParams.push(limitNum, offset);
    const dataQuery = `
      SELECT 
        volume_id::text AS volume_id, 
        journal_id::text AS journal_id, 
        volume_number, 
        publication_year, 
        is_deleted
      ${baseQuery}
      ORDER BY "${sortField}" ${sortDir}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    const dataRes = await pool.query(dataQuery, queryParams);
    return {
      items: dataRes.rows,
      total
    };
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách Volume:", error.message);
    throw error;
  }
};

/**
 * Lấy thông tin chi tiết một Volume theo ID (chưa bị xóa mềm).
 * 
 * @async
 * @param {number|string} id - ID của Volume cần lấy.
 * @returns {Promise<Object|null>} Trả về thông tin Volume hoặc null nếu không tìm thấy.
 */
export const getVolumeById = async (id) => {
  try {
    const query = `
      SELECT 
        volume_id::text AS volume_id, 
        journal_id::text AS journal_id, 
        volume_number, 
        publication_year, 
        is_deleted
      FROM "Volume"
      WHERE volume_id = $1 AND is_deleted = false
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Volume ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Cập nhật thông tin Volume.
 * 
 * @async
 * @param {number|string} id - ID của Volume cần cập nhật.
 * @param {Object} data - Dữ liệu cần cập nhật.
 * @param {number} [data.volume_number] - Số volume mới.
 * @param {number} [data.publication_year] - Năm xuất bản mới.
 * @returns {Promise<Object|null>} Trả về Volume sau cập nhật, hoặc null nếu không thành công.
 */
export const updateVolume = async (id, data) => {
  try {
    const allowedFields = ["volume_number", "publication_year"];
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
      UPDATE "Volume"
      SET ${updateParts.join(", ")}
      WHERE volume_id = $${placeholderIndex} AND is_deleted = false
      RETURNING 
        volume_id::text AS volume_id, 
        journal_id::text AS journal_id, 
        volume_number, 
        publication_year, 
        is_deleted;
    `;
    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Volume ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Xóa mềm một Volume (đặt is_deleted = true).
 * 
 * @async
 * @param {number|string} id - ID của Volume cần xóa mềm.
 * @returns {Promise<Object|null>} Trả về thông tin Volume đã xóa mềm, hoặc null.
 */
export const deleteVolume = async (id) => {
  try {
    const query = `
      UPDATE "Volume"
      SET is_deleted = true
      WHERE volume_id = $1 AND is_deleted = false
      RETURNING 
        volume_id::text AS volume_id, 
        journal_id::text AS journal_id, 
        volume_number, 
        publication_year, 
        is_deleted;
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Volume ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Khôi phục một Volume đã bị xóa mềm (đặt is_deleted = false).
 * 
 * @async
 * @param {number|string} id - ID của Volume cần khôi phục.
 * @returns {Promise<Object|null>} Trả về thông tin Volume đã khôi phục, hoặc null.
 */
export const restoreVolume = async (id) => {
  try {
    const query = `
      UPDATE "Volume"
      SET is_deleted = false
      WHERE volume_id = $1 AND is_deleted = true
      RETURNING 
        volume_id::text AS volume_id, 
        journal_id::text AS journal_id, 
        volume_number, 
        publication_year, 
        is_deleted;
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Volume ID ${id}:`, error.message);
    throw error;
  }
};
