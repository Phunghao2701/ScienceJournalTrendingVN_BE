import pool from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Lấy danh sách các project của một user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getUserProjects = async (userId) => {
  const result = await pool.query(
    `SELECT project_id, title, subject_area, created_at 
     FROM "Project" 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

/**
 * Lấy chi tiết một project bao gồm cấu hình Subject Area, Subject Categories và Journals
 * @param {string|number} projectId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export const getProjectById = async (projectId, userId) => {
  // 1. Lấy thông tin chung của project và Subject Area tương ứng
  const projectResult = await pool.query(
    `SELECT p.project_id, p.title, p.user_id, p.subject_area, p.created_at,
            sa.display_name as subject_area_name, sa.description as subject_area_description
     FROM "Project" p
     LEFT JOIN "Subject_Area" sa ON p.subject_area = sa.subject_area_id
     WHERE p.project_id = $1 AND p.user_id = $2`,
    [projectId, userId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  const project = projectResult.rows[0];

  // 2. Lấy danh sách Subject Category đã cấu hình
  const categoriesResult = await pool.query(
    `SELECT sc.subject_category_id, sc.display_name, sc.description, sc.subject_area_id
     FROM "Subject_Category_Project" psc
     JOIN "Subject_Category" sc ON psc.subject_category_id = sc.subject_category_id
     WHERE psc.project_id = $1`,
    [projectId]
  );

  // 3. Lấy danh sách Journal đã cấu hình
  const journalsResult = await pool.query(
    `SELECT j.journal_id, j.display_name, j.issn, j.type, j.is_open_access
     FROM "Project_Journal" pj
     JOIN "Journal" j ON pj.journal_id = j.journal_id
     WHERE pj.project_id = $1`,
    [projectId]
  );

  return {
    project_id: project.project_id,
    title: project.title,
    user_id: project.user_id,
    created_at: project.created_at,
    subject_area: project.subject_area ? {
      subject_area_id: project.subject_area,
      display_name: project.subject_area_name,
      description: project.subject_area_description
    } : null,
    subject_categories: categoriesResult.rows,
    journals: journalsResult.rows
  };
};

/**
 * Helper để kiểm tra danh sách ID có tồn tại trong bảng tương ứng hay không
 * @param {Array<number|string>} ids - Danh sách ID cần kiểm tra
 * @param {string} tableName - Tên bảng trong cơ sở dữ liệu
 * @param {string} idColumnName - Tên cột ID của bảng cần kiểm tra
 * @returns {Promise<boolean>} Trả về true nếu tất cả các ID đều tồn tại, ngược lại trả về false
 */
const validateIdsExist = async (ids, tableName, idColumnName) => {
  if (!ids || ids.length === 0) return true;
  // Loại bỏ các ID trùng lặp
  const uniqueIds = [...new Set(ids)];
  
  // Thực hiện truy vấn để kiểm tra xem các ID có tồn tại không
  const query = `
    SELECT ${idColumnName} 
    FROM "${tableName}" 
    WHERE ${idColumnName} = ANY($1::bigint[])
  `;
  const result = await pool.query(query, [uniqueIds]);
  return result.rows.length === uniqueIds.length;
};

/**
 * Tạo một dự án mới và thiết lập các liên kết chuyên ngành / tạp chí tương ứng
 * @param {Object} projectData - Thông tin dự án cần tạo
 * @param {string} projectData.userId - ID của người dùng sở hữu dự án
 * @param {string} projectData.title - Tiêu đề của dự án
 * @param {number|string} [projectData.subject_area] - ID của lĩnh vực nghiên cứu chính
 * @param {Array<number|string>} [projectData.subject_category_ids] - Danh sách ID danh mục chuyên ngành liên kết
 * @param {Array<number|string>} [projectData.journal_ids] - Danh sách ID tạp chí liên kết
 * @returns {Promise<Object>} Trả về thông tin cơ bản của project vừa được tạo
 * @throws {Error} Ném lỗi nếu Subject Area, Subject Category hoặc Journal không tồn tại
 */
export const createProject = async ({ userId, title, subject_area, subject_category_ids = [], journal_ids = [] }) => {
  // 1. Kiểm tra sự tồn tại của subject_area
  if (subject_area) {
    const areaCheck = await pool.query(
      `SELECT 1 FROM "Subject_Area" WHERE subject_area_id = $1`,
      [subject_area]
    );
    if (areaCheck.rows.length === 0) {
      throw new Error(`Subject Area ID '${subject_area}' không tồn tại`);
    }
  }

  // 2. Kiểm tra sự tồn tại của tất cả subject_category_ids
  if (subject_category_ids.length > 0) {
    const categoriesValid = await validateIdsExist(subject_category_ids, 'Subject_Category', 'subject_category_id');
    if (!categoriesValid) {
      throw new Error('Một hoặc nhiều Subject Category ID không tồn tại trong hệ thống');
    }
  }

  // 3. Kiểm tra sự tồn tại của tất cả journal_ids
  if (journal_ids.length > 0) {
    const journalsValid = await validateIdsExist(journal_ids, 'Journal', 'journal_id');
    if (!journalsValid) {
      throw new Error('Một hoặc nhiều Journal ID không tồn tại trong hệ thống');
    }
  }

  // 4. Bắt đầu transaction để lưu dữ liệu
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Thêm bản ghi vào bảng Project
    const projectInsertResult = await client.query(
      `INSERT INTO "Project" (user_id, title, subject_area) 
       VALUES ($1, $2, $3) 
       RETURNING project_id, user_id, title, subject_area, created_at`,
      [userId, title, subject_area || null]
    );
    const newProject = projectInsertResult.rows[0];
    const projectId = newProject.project_id;

    // Thêm các liên kết vào bảng trung gian Subject_Category_Project
    if (subject_category_ids.length > 0) {
      const uniqueCategoryIds = [...new Set(subject_category_ids)];
      for (const catId of uniqueCategoryIds) {
        await client.query(
          `INSERT INTO "Subject_Category_Project" (project_id, subject_category_id) VALUES ($1, $2)`,
          [projectId, catId]
        );
      }
    }

    // Thêm các liên kết vào bảng trung gian Project_Journal
    if (journal_ids.length > 0) {
      const uniqueJournalIds = [...new Set(journal_ids)];
      for (const journalId of uniqueJournalIds) {
        await client.query(
          `INSERT INTO "Project_Journal" (project_id, journal_id) VALUES ($1, $2)`,
          [projectId, journalId]
        );
      }
    }

    await client.query('COMMIT');
    return newProject;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cập nhật thông tin của dự án, bao gồm cập nhật liên kết chuyên ngành và tạp chí
 * @param {string|number} projectId - ID của dự án cần cập nhật
 * @param {string} userId - ID của người dùng sở hữu dự án (để xác thực quyền)
 * @param {Object} updateData - Dữ liệu cập nhật
 * @param {string} [updateData.title] - Tiêu đề mới của dự án
 * @param {number|string} [updateData.subject_area] - ID mới của lĩnh vực nghiên cứu chính
 * @param {Array<number|string>} [updateData.subject_category_ids] - Danh sách ID danh mục chuyên ngành mới
 * @param {Array<number|string>} [updateData.journal_ids] - Danh sách ID tạp chí mới
 * @returns {Promise<boolean|null>} Trả về true nếu cập nhật thành công, null nếu dự án không tồn tại hoặc không thuộc sở hữu của user
 * @throws {Error} Ném lỗi nếu Subject Area, Subject Category hoặc Journal mới không tồn tại
 */
export const updateProject = async (projectId, userId, { title, subject_area, subject_category_ids, journal_ids }) => {
  // 1. Kiểm tra xem project có tồn tại và thuộc sở hữu của user không
  const projectCheck = await pool.query(
    `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  if (projectCheck.rows.length === 0) {
    return null;
  }

  // 2. Kiểm tra sự tồn tại của subject_area nếu được truyền vào
  if (subject_area) {
    const areaCheck = await pool.query(
      `SELECT 1 FROM "Subject_Area" WHERE subject_area_id = $1`,
      [subject_area]
    );
    if (areaCheck.rows.length === 0) {
      throw new Error(`Subject Area ID '${subject_area}' không tồn tại`);
    }
  }

  // 3. Kiểm tra sự tồn tại của tất cả subject_category_ids nếu được truyền vào
  if (subject_category_ids && subject_category_ids.length > 0) {
    const categoriesValid = await validateIdsExist(subject_category_ids, 'Subject_Category', 'subject_category_id');
    if (!categoriesValid) {
      throw new Error('Một hoặc nhiều Subject Category ID không tồn tại trong hệ thống');
    }
  }

  // 4. Kiểm tra sự tồn tại của tất cả journal_ids nếu được truyền vào
  if (journal_ids && journal_ids.length > 0) {
    const journalsValid = await validateIdsExist(journal_ids, 'Journal', 'journal_id');
    if (!journalsValid) {
      throw new Error('Một hoặc nhiều Journal ID không tồn tại trong hệ thống');
    }
  }

  // 5. Bắt đầu transaction để cập nhật dữ liệu
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cập nhật thông tin cơ bản của project
    await client.query(
      `UPDATE "Project" 
       SET title = COALESCE($1, title), 
           subject_area = $2
       WHERE project_id = $3 AND user_id = $4`,
      [title, subject_area || null, projectId, userId]
    );

    // Cập nhật quan hệ Subject Category nếu mảng được truyền vào
    if (subject_category_ids) {
      // Xóa các quan hệ cũ
      await client.query(`DELETE FROM "Subject_Category_Project" WHERE project_id = $1`, [projectId]);
      
      // Thêm các quan hệ mới
      if (subject_category_ids.length > 0) {
        const uniqueCategoryIds = [...new Set(subject_category_ids)];
        for (const catId of uniqueCategoryIds) {
          await client.query(
            `INSERT INTO "Subject_Category_Project" (project_id, subject_category_id) VALUES ($1, $2)`,
            [projectId, catId]
          );
        }
      }
    }

    // Cập nhật quan hệ Journal nếu mảng được truyền vào
    if (journal_ids) {
      // Xóa các quan hệ cũ
      await client.query(`DELETE FROM "Project_Journal" WHERE project_id = $1`, [projectId]);
      
      // Thêm các quan hệ mới
      if (journal_ids.length > 0) {
        const uniqueJournalIds = [...new Set(journal_ids)];
        for (const journalId of uniqueJournalIds) {
          await client.query(
            `INSERT INTO "Project_Journal" (project_id, journal_id) VALUES ($1, $2)`,
            [projectId, journalId]
          );
        }
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
 * Xóa một project
 * @param {string|number} projectId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export const deleteProject = async (projectId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Kiểm tra xem project có tồn tại và thuộc sở hữu của user hay không
    const checkResult = await client.query(
      `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    // 2. Xóa các bản ghi liên quan trong Subject_Category_Project
    await client.query(
      `DELETE FROM "Subject_Category_Project" WHERE project_id = $1`,
      [projectId]
    );

    // 3. Xóa các bản ghi liên quan trong Project_Journal
    await client.query(
      `DELETE FROM "Project_Journal" WHERE project_id = $1`,
      [projectId]
    );

    // 4. Xóa project chính
    await client.query(
      `DELETE FROM "Project" WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );

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
 * Lấy danh sách journal_id thuộc về một dự án.
 *
 * @async
 * @param {(number|string)} projectId - ID của dự án cần truy vấn.
 * @returns {Promise<number[]>} Mảng các journal_id.
 */
export const getJournalIdsByProjectId = async (projectId) => {
    try {
        const queryText = `
            SELECT pj.journal_id
            FROM "Project_Journal" pj
            WHERE pj.project_id = $1;
        `;

        const res = await pool.query(queryText, [Number(projectId)]);

        // Chỉ trả về mảng số
        return res.rows.map(row => Number(row.journal_id));
    } catch (error) {
        logger.error('Lỗi khi lấy journal_id của dự án:', error);
        throw error;
    }
};

/**
 * Lấy danh sách subject_category_id thuộc về các journal trong dự án.
 *
 * @async
 * @param {(number|string)} projectId - ID của dự án.
 * @returns {Promise<number[]>} Mảng các subject_category_id (không trùng).
 */
export const getCategoryIdsByProjectId = async (projectId) => {
    try {
        const queryText = `
            SELECT DISTINCT jsc.subject_category_id
            FROM "Project_Journal" pj
            JOIN "Journal_Subject_Category" jsc 
                ON pj.journal_id = jsc.journal_id
            WHERE pj.project_id = $1;
        `;

        const res = await pool.query(queryText, [Number(projectId)]);

        return res.rows.map(row => Number(row.subject_category_id));
    } catch (error) {
        logger.error('Lỗi khi lấy subject_category_id của dự án:', error);
        throw error;
    }
};

/**
 * Lấy danh sách các bài viết liên quan dựa trên mảng ID tạp chí HOẶC mảng ID danh mục thuộc dự án.
 * Ưu tiên các bài viết thỏa mãn cả hai điều kiện, sắp xếp theo năm xuất bản mới nhất.
 *
 * @async
 * @param {Array<number|string>} journalIds - Mảng chứa các ID của tạp chí thuộc dự án.
 * @param {Array<number|string>} categoryIds - Mảng chứa các ID của danh mục thuộc dự án.
 * @param {Object} options - Cấu hình tùy chọn cho dữ liệu.
 * @param {number} [options.limit=5] - Số lượng bài viết giới hạn lấy ra.
 * @returns {Promise<Array<{article_id: (number|string), title: string, abstract: string, publication_year: number, doi: string, journal_name: string}>>} Danh sách bài viết gợi ý.
 */
export const getRelatedArticles = async (journalIds, categoryIds, { limit = 5 }) => {
    try {
        // Phòng hờ trường hợp mảng truyền vào bị rỗng để tránh lỗi SQL ANY()
        const finalJournalIds = journalIds.length > 0 ? journalIds : [-1];
        const finalCategoryIds = categoryIds.length > 0 ? categoryIds : [-1];

        const queryText = `
            SELECT DISTINCT
                a.article_id,
                a.title,
                a.abstract,
                a.publication_year,
                a.doi,
                j.display_name AS journal_name -- Lấy ra tên tạp chí tương ứng như yêu cầu bài toán
            FROM "Article" a
            -- Luồng đi ngược cây thư mục theo sơ đồ DB của bạn: Article -> Issue -> Volume -> Journal
            JOIN "Issue" i ON a.issue_id = i.issue_id
            JOIN "Volume" v ON i.volume_id = v.volume_id
            JOIN "Journal" j ON v.journal_id = j.journal_id
            -- Kết nối sang bảng danh mục để kiểm tra chuyên ngành hẹp
            LEFT JOIN "Journal_Subject_Category" jc ON j.journal_id = jc.journal_id
            -- Điều kiện lọc động "Hoặc/Và": Thỏa mãn tạp chí HOẶC thỏa mãn chuyên ngành đều lấy
            WHERE v.journal_id = ANY($1) 
               OR jc.subject_category_id = ANY($2) 
            -- Sắp xếp: Ưu tiên bài viết mới xuất bản nhất, tiếp theo là bài tạo mới nhất trong DB
            ORDER BY a.publication_year DESC, a.article_id DESC
            LIMIT $3;
        `;

        const values = [finalJournalIds, finalCategoryIds, limit];
        const res = await pool.query(queryText, values);
        return res.rows; 
        
    } catch (error) {
        logger.error('Lỗi khi lấy bài viết liên quan tại Service:', error);
        throw error;
    }
};

/**
 * Lấy dữ liệu phân tích/thống kê của một dự án (Trending Charts)
 * 
 * @async
 * @param {number|string} projectId - ID dự án.
 * @param {string} userId - ID người dùng sở hữu dự án.
 * @returns {Promise<Object|null>} Dữ liệu phân tích hoặc null nếu dự án không tồn tại/không thuộc quyền sở hữu.
 */
export const getProjectAnalytics = async (projectId, userId) => {
    try {
        // 1. Xác thực sự tồn tại và quyền sở hữu dự án
        const projectCheck = await pool.query(
            `SELECT 1 FROM "Project" WHERE project_id = $1 AND user_id = $2`,
            [Number(projectId), userId]
        );
        if (projectCheck.rows.length === 0) {
            return null;
        }

        // 2. Chart 1 (Article Volume Trend)
        const articleTrendQuery = `
            SELECT 
                a.publication_year::integer AS year,
                COUNT(a.article_id)::integer AS article_count
            FROM "Article" a
            JOIN "Issue" i ON a.issue_id = i.issue_id
            JOIN "Volume" v ON i.volume_id = v.volume_id
            JOIN "Project_Journal" pj ON v.journal_id = pj.journal_id
            WHERE pj.project_id = $1 AND a.is_deleted = false
            GROUP BY a.publication_year
            ORDER BY a.publication_year ASC
        `;
        const articleTrendRes = await pool.query(articleTrendQuery, [Number(projectId)]);

        // 3. Chart 2 (Journal Metrics Comparison)
        const metricsCompareQuery = `
            WITH latest_years AS (
                SELECT jr.journal_id, MAX(jr.year) AS max_year
                FROM "Journal_Ranking" jr
                JOIN "Project_Journal" pj ON jr.journal_id = pj.journal_id
                WHERE pj.project_id = $1
                GROUP BY jr.journal_id
            ),
            deduped_rankings AS (
                SELECT DISTINCT ON (jr.journal_id, rm.code, jr.subject_category_id)
                    j.display_name AS journal_name,
                    j.journal_id::text AS journal_id,
                    rm.code AS metric_code,
                    rm.display_name AS metric_name,
                    rm.metric_type,
                    jr.year,
                    jr.value_txt,
                    jr.value_float,
                    jr.value_int
                FROM "Journal_Ranking" jr
                JOIN latest_years ly ON jr.journal_id = ly.journal_id AND jr.year = ly.max_year
                JOIN "Ranking_Metric" rm ON jr.metric_id = rm.metric_id
                JOIN "Journal" j ON jr.journal_id = j.journal_id
                ORDER BY jr.journal_id, rm.code, jr.subject_category_id, jr.journal_ranking_id DESC
            )
            SELECT * FROM deduped_rankings
            ORDER BY journal_name ASC, metric_code ASC
        `;
        const metricsCompareRes = await pool.query(metricsCompareQuery, [Number(projectId)]);
        
        const journalMetrics = metricsCompareRes.rows.map(row => {
            let value = null;
            if (row.metric_type === 'QUARTILE') {
                value = row.value_txt;
            } else if (row.metric_type === 'SCORE') {
                value = row.value_float !== null ? Number(row.value_float) : null;
            } else if (row.metric_type === 'INTEGER') {
                value = row.value_int !== null ? Number(row.value_int) : null;
            } else {
                value = row.value_txt !== null ? row.value_txt :
                        row.value_float !== null ? Number(row.value_float) :
                        row.value_int !== null ? Number(row.value_int) : null;
            }
            return {
                journal_name: row.journal_name,
                journal_id: row.journal_id,
                metric_code: row.metric_code,
                metric_name: row.metric_name,
                metric_type: row.metric_type,
                value,
                year: row.year
            };
        });

        return {
            article_volume_trend: articleTrendRes.rows,
            journal_metrics_comparison: journalMetrics
        };
    } catch (error) {
        logger.error('Lỗi khi lấy dữ liệu phân tích của dự án:', error);
        throw error;
    }
};
