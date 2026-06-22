import pool from "../config/database.js";
import logger from "../utils/logger.js";

/**
 * Kiểm tra sự tồn tại của một Subject Category trong database dựa trên ID.
 * Không phân biệt đã bị xóa mềm hay chưa.
 * 
 * @async
 * @param {number|string} id - ID của Subject Category.
 * @returns {Promise<boolean>} Trả về true nếu tồn tại, ngược lại false.
 */
export const subjectCategoryExist = async (id) => {
  try {
    const query = `SELECT 1 FROM "Subject_Category" WHERE subject_category_id = $1`;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Lỗi khi kiểm tra tồn tại của Subject Category với ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiểm tra xem Subject Category có đang bị xóa mềm (is_deleted = true) hay không.
 * 
 * @async
 * @param {number|string} id - ID của Subject Category.
 * @returns {Promise<boolean>} Trả về true nếu đã bị xóa mềm, ngược lại false.
 */
export const subjectCategoryIsDeleted = async (id) => {
  try {
    const query = `SELECT 1 FROM "Subject_Category" WHERE subject_category_id = $1 AND is_deleted = true`;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Lỗi khi kiểm tra trạng thái xóa mềm của Subject Category với ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiểm tra xem có Subject Category nào khác đang hoạt động trùng lặp display_name trong cùng Subject Area không.
 * 
 * @async
 * @param {number|string} subjectAreaId - ID của Subject Area cha.
 * @param {string} displayName - Tên cần kiểm tra.
 * @param {number|string} [excludeId=null] - ID cần loại trừ (trong trường hợp update).
 * @returns {Promise<{ duplicateName: boolean }>} Đối tượng chứa kết quả trùng lặp.
 */
export const checkDuplicateSubjectCategory = async (subjectAreaId, displayName, excludeId = null) => {
  try {
    let queryName = `
      SELECT 1 FROM "Subject_Category" 
      WHERE subject_area_id = $1 AND display_name = $2 AND is_deleted = false
    `;
    const paramsName = [BigInt(subjectAreaId), displayName.trim()];
    if (excludeId !== null) {
      queryName += ` AND subject_category_id != $3`;
      paramsName.push(BigInt(excludeId));
    }
    const resName = await pool.query(queryName, paramsName);

    return {
      duplicateName: resName.rows.length > 0
    };
  } catch (error) {
    logger.error("Lỗi khi kiểm tra trùng lặp Subject Category:", error.message);
    throw error;
  }
};

/**
 * Tạo mới một Subject Category.
 * 
 * @async
 * @param {Object} data - Dữ liệu tạo.
 * @param {number|string} data.subject_area_id - ID của Subject Area cha.
 * @param {string} data.display_name - Tên hiển thị.
 * @param {string} [data.description] - Mô tả.
 * @returns {Promise<Object>} Trả về đối tượng vừa tạo.
 */
export const createSubjectCategory = async (data) => {
  try {
    const { subject_area_id, display_name, description } = data;
    const trimmedName = display_name.trim();
    const cleanDesc = description ? description.trim() : null;

    const query = `
      INSERT INTO "Subject_Category" (subject_area_id, display_name, description, is_deleted)
      VALUES ($1, $2, $3, false)
      RETURNING 
        subject_category_id::text AS subject_category_id, 
        subject_area_id::text AS subject_area_id,
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await pool.query(query, [BigInt(subject_area_id), trimmedName, cleanDesc]);
    return result.rows[0];
  } catch (error) {
    logger.error("Lỗi khi tạo mới Subject Category:", error.message);
    throw error;
  }
};

/**
 * Lấy danh sách Subject Category hỗ trợ tìm kiếm, phân trang, lọc theo Subject Area và sắp xếp.
 * Chỉ lấy bản ghi chưa bị xóa mềm (is_deleted = false).
 * 
 * @async
 * @param {Object} params - Tham số đầu vào.
 * @returns {Promise<{ items: Array<Object>, total: number }>}
 */
export const getSubjectCategories = async ({
  page = 1,
  limit = 10,
  search,
  subject_area_id,
  sort_by = "display_name",
  sort_order = "asc"
} = {}) => {
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      FROM "Subject_Category"
      WHERE is_deleted = false
    `;
    const queryParams = [];

    // Lọc theo subject_area_id
    if (subject_area_id !== undefined && subject_area_id !== null && subject_area_id.toString().trim() !== "") {
      queryParams.push(BigInt(subject_area_id));
      baseQuery += ` AND subject_area_id = $${queryParams.length}`;
    }

    // Tìm kiếm theo display_name (không phân biệt hoa thường)
    if (search !== undefined && search !== null && search.toString().trim() !== "") {
      queryParams.push(`%${search.toString().trim()}%`);
      baseQuery += ` AND display_name ILIKE $${queryParams.length}`;
    }

    // Đếm tổng số bản ghi
    const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;
    const countRes = await pool.query(countQuery, queryParams);
    const total = countRes.rows[0]?.total || 0;

    // Sắp xếp
    const allowedSortFields = ["subject_category_id", "display_name", "subject_area_id"];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : "display_name";
    const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

    // Phân trang
    queryParams.push(limitNum, offset);
    const dataQuery = `
      SELECT 
        subject_category_id::text AS subject_category_id, 
        subject_area_id::text AS subject_area_id,
        display_name, 
        description, 
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
    logger.error("Lỗi khi lấy danh sách Subject Category:", error.message);
    throw error;
  }
};

/**
 * Lấy thông tin chi tiết một Subject Category và JOIN với Subject Area.
 * 
 * @async
 * @param {number|string} id - ID của Subject Category.
 * @returns {Promise<Object|null>} Trả về đối tượng chi tiết hoặc null.
 */
export const getSubjectCategoryById = async (id) => {
  try {
    const query = `
      SELECT 
        sc.subject_category_id::text AS subject_category_id, 
        sc.subject_area_id::text AS subject_area_id,
        sc.display_name, 
        sc.description, 
        sc.is_deleted,
        sa.display_name AS subject_area_name
      FROM "Subject_Category" sc
      LEFT JOIN "Subject_Area" sa ON sc.subject_area_id = sa.subject_area_id
      WHERE sc.subject_category_id = $1 AND sc.is_deleted = false
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Cập nhật thông tin Subject Category.
 * 
 * @async
 * @param {number|string} id - ID của Subject Category.
 * @param {Object} data - Dữ liệu cập nhật.
 * @returns {Promise<Object|null>} Trả về đối tượng sau cập nhật hoặc null.
 */
export const updateSubjectCategory = async (id, data) => {
  try {
    const allowedFields = ["subject_area_id", "display_name", "description"];
    const updateParts = [];
    const values = [];
    let placeholderIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateParts.push(`"${field}" = $${placeholderIndex}`);
        let val = data[field];
        if (field === "subject_area_id") {
          val = BigInt(val);
        } else if (typeof val === "string") {
          val = val.trim();
        }
        values.push(val);
        placeholderIndex++;
      }
    }

    if (updateParts.length === 0) {
      return null;
    }

    values.push(BigInt(id));
    const query = `
      UPDATE "Subject_Category"
      SET ${updateParts.join(", ")}
      WHERE subject_category_id = $${placeholderIndex} AND is_deleted = false
      RETURNING 
        subject_category_id::text AS subject_category_id, 
        subject_area_id::text AS subject_area_id,
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await pool.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Xóa mềm một Subject Category.
 * 
 * @async
 * @param {number|string} id - ID của Subject Category.
 * @returns {Promise<Object|null>} Trả về đối tượng đã xóa hoặc null.
 */
export const deleteSubjectCategory = async (id) => {
  try {
    const query = `
      UPDATE "Subject_Category"
      SET is_deleted = true
      WHERE subject_category_id = $1 AND is_deleted = false
      RETURNING 
        subject_category_id::text AS subject_category_id, 
        subject_area_id::text AS subject_area_id,
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Khôi phục một Subject Category đã bị xóa mềm.
 * 
 * @async
 * @param {number|string} id - ID của Subject Category.
 * @returns {Promise<Object|null>} Trả về đối tượng đã khôi phục hoặc null.
 */
export const restoreSubjectCategory = async (id) => {
  try {
    const query = `
      UPDATE "Subject_Category"
      SET is_deleted = false
      WHERE subject_category_id = $1 AND is_deleted = true
      RETURNING 
        subject_category_id::text AS subject_category_id, 
        subject_area_id::text AS subject_area_id,
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await pool.query(query, [BigInt(id)]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Tính toán thống kê dữ liệu liên quan tới Subject Category: total_journals, total_articles, total_authors.
 * Sử dụng Promise.all để tối ưu hóa hiệu năng.
 * 
 * @async
 * @param {number|string} id - ID của Subject Category.
 * @returns {Promise<Object>} Đối tượng thống kê.
 */
export const getSubjectCategoryStatistics = async (id) => {
  try {
    const parsedId = BigInt(id);

    // 1. Lấy thông tin Subject Category trước
    const scRes = await pool.query(
      `SELECT display_name FROM "Subject_Category" WHERE subject_category_id = $1 AND is_deleted = false`,
      [parsedId]
    );

    if (scRes.rows.length === 0) {
      return null;
    }

    const { display_name } = scRes.rows[0];

    // 2. Định nghĩa các câu truy vấn đếm song song
    // Đếm tổng số Journal đang hoạt động thuộc Subject Category
    const journalsQuery = `
      SELECT COUNT(DISTINCT j.journal_id)::integer AS count
      FROM "Journal" j
      JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
      WHERE jsc.subject_category_id = $1 AND COALESCE(j.is_deleted, false) = false
    `;

    // Đếm tổng số Article đang hoạt động (Article -> Issue -> Volume -> Journal) thuộc Category này
    const articlesQuery = `
      SELECT COUNT(DISTINCT a.article_id)::integer AS count
      FROM "Article" a
      JOIN "Issue" i ON a.issue_id = i.issue_id
      JOIN "Volume" v ON i.volume_id = v.volume_id
      JOIN "Journal" j ON v.journal_id = j.journal_id
      JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
      WHERE jsc.subject_category_id = $1
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(v.is_deleted, false) = false
        AND COALESCE(j.is_deleted, false) = false
    `;

    // Đếm tổng số Author duy nhất của các Article này
    const authorsQuery = `
      SELECT COUNT(DISTINCT aa.author_id)::integer AS count
      FROM "Author_Article" aa
      JOIN "Article" a ON aa.article_id = a.article_id
      JOIN "Issue" i ON a.issue_id = i.issue_id
      JOIN "Volume" v ON i.volume_id = v.volume_id
      JOIN "Journal" j ON v.journal_id = j.journal_id
      JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
      WHERE jsc.subject_category_id = $1
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(v.is_deleted, false) = false
        AND COALESCE(j.is_deleted, false) = false
    `;

    // 3. Thực hiện song song truy vấn bằng Promise.all
    const [journalsRes, articlesRes, authorsRes] = await Promise.all([
      pool.query(journalsQuery, [parsedId]),
      pool.query(articlesQuery, [parsedId]),
      pool.query(authorsQuery, [parsedId])
    ]);

    return {
      subject_category_id: id.toString(),
      display_name,
      total_journals: journalsRes.rows[0]?.count || 0,
      total_articles: articlesRes.rows[0]?.count || 0,
      total_authors: authorsRes.rows[0]?.count || 0
    };
  } catch (error) {
    logger.error(`Lỗi khi lấy thống kê Subject Category ID ${id}:`, error.message);
    throw error;
  }
};
