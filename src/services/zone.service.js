import pool from '../config/database.js';

/**
 * Lấy danh sách thống kê sản lượng bài viết theo từng quốc gia (phân trang).
 *
 * @async
 * @param {Object} params - Các tham số phân trang.
 * @param {number} params.page - Trang hiện tại.
 * @param {number} params.limit - Số lượng bản ghi trên mỗi trang.
 * @returns {Promise<{ countries: Array<Object>, total: number }>} Danh sách các quốc gia cùng tổng số lượng bản ghi.
 */
export const getCountryStats = async ({ page = 1, limit = 10, year }) => {
  const parsedPage = parseInt(page, 10) || 1;
  const parsedLimit = parseInt(limit, 10) || 10;
  const offset = (parsedPage - 1) * parsedLimit;

  // 1. Đếm tổng số quốc gia có trong hệ thống
  const countQuery = 'SELECT COUNT(*)::integer AS total FROM "Zone" WHERE type = \'COUNTRY\'';
  const countResult = await pool.query(countQuery);
  const total = countResult.rows[0]?.total || 0;

  // 2. Lấy thống kê chi tiết sản lượng bài báo theo quốc gia
  // Tạo danh sách giá trị truyền vào query để bảo mật SQL injection
  const values = [parsedLimit, offset];
  let yearClause = '';
  
  // Nếu tham số lọc 'year' (năm xuất bản) được gửi lên, ta sẽ thêm điều kiện lọc theo năm
  if (year) {
    values.push(Number(year));
    yearClause = `AND a.publication_year = $${values.length}`; // Thêm tham số động vào ON clause để lọc bài báo theo năm
  }

  // Thực hiện LEFT JOIN các bảng: Zone -> Journal -> Volume -> Issue -> Article
  // Thêm điều kiện 'is_deleted = false' để loại bỏ các bản ghi đã bị xóa mềm.
  // Điều kiện lọc yearClause được đặt trong ON clause để tránh biến LEFT JOIN thành INNER JOIN (nhằm giữ lại các quốc gia có 0 sản lượng).
  const statsQuery = `
    SELECT 
      z.zone_id,
      z.code,
      z.name,
      z.iso_code,
      z.source,
      z.created_at,
      COUNT(a.article_id)::integer AS article_count
    FROM "Zone" z
    LEFT JOIN "Journal" j ON j.country = z.zone_id AND COALESCE(j.is_deleted, false) = false
    LEFT JOIN "Volume" v ON v.journal_id = j.journal_id AND COALESCE(v.is_deleted, false) = false
    LEFT JOIN "Issue" i ON i.volume_id = v.volume_id AND COALESCE(i.is_deleted, false) = false
    LEFT JOIN "Article" a ON a.issue_id = i.issue_id AND COALESCE(a.is_deleted, false) = false ${yearClause}
    WHERE z.type = 'COUNTRY'
    GROUP BY z.zone_id, z.code, z.name, z.iso_code, z.source, z.created_at
    ORDER BY article_count DESC, z.name ASC
    LIMIT $1 OFFSET $2;
  `;
  const statsResult = await pool.query(statsQuery, values);

  return {
    countries: statsResult.rows,
    total
  };
};

/**
 * Lấy thống kê sản lượng bài viết theo phân vùng (Region), có thể lọc theo mã quốc gia cụ thể.
 *
 * @async
 * @param {Object} [params] - Tham số lọc.
 * @param {string} [params.countryCode] - Mã quốc gia (ví dụ: 'US', 'VN') dùng để lọc.
 * @returns {Promise<Array<Object>>} Danh sách phân vùng và sản lượng bài báo.
 * @throws {Error} Ném ra lỗi 404 nếu truyền mã quốc gia nhưng quốc gia đó không tồn tại.
 */
export const getRegionStats = async ({ countryCode } = {}) => {
  if (countryCode) {
    // 1. Kiểm tra sự tồn tại của quốc gia với mã đã cho
    const countryCheckQuery = `
      SELECT zone_id, name 
      FROM "Zone" 
      WHERE type = 'COUNTRY' AND (UPPER(code) = UPPER($1) OR UPPER(iso_code) = UPPER($1))
    `;
    const countryCheckResult = await pool.query(countryCheckQuery, [countryCode]);
    
    if (countryCheckResult.rows.length === 0) {
      const error = new Error(`Quốc gia có mã '${countryCode}' không tồn tại`);
      error.statusCode = 404;
      throw error;
    }

    const countryZoneId = countryCheckResult.rows[0].zone_id;

    // 2. Lấy thống kê theo vùng của quốc gia cụ thể
    const regionStatsQuery = `
      SELECT 
        zr.zone_id,
        zr.code,
        zr.name,
        zr.iso_code,
        zr.source,
        zr.created_at,
        COUNT(a.article_id)::integer AS article_count
      FROM "Zone" zr
      INNER JOIN "Journal" j ON j.region = zr.zone_id
      INNER JOIN "Volume" v ON v.journal_id = j.journal_id
      INNER JOIN "Issue" i ON i.volume_id = v.volume_id
      LEFT JOIN "Article" a ON a.issue_id = i.issue_id
      WHERE zr.type = 'REGION' AND j.country = $1
      GROUP BY zr.zone_id, zr.code, zr.name, zr.iso_code, zr.source, zr.created_at
      ORDER BY article_count DESC, zr.name ASC
    `;
    const statsResult = await pool.query(regionStatsQuery, [countryZoneId]);
    return statsResult.rows;
  }

  // Lấy toàn bộ phân vùng (Region) toàn cầu
  const globalRegionStatsQuery = `
    SELECT 
      zr.zone_id,
      zr.code,
      zr.name,
      zr.iso_code,
      zr.source,
      zr.created_at,
      COUNT(a.article_id)::integer AS article_count
    FROM "Zone" zr
    LEFT JOIN "Journal" j ON j.region = zr.zone_id
    LEFT JOIN "Volume" v ON v.journal_id = j.journal_id
    LEFT JOIN "Issue" i ON i.volume_id = v.volume_id
    LEFT JOIN "Article" a ON a.issue_id = i.issue_id
    WHERE zr.type = 'REGION'
    GROUP BY zr.zone_id, zr.code, zr.name, zr.iso_code, zr.source, zr.created_at
    ORDER BY article_count DESC, zr.name ASC
  `;
  const statsResult = await pool.query(globalRegionStatsQuery);
  return statsResult.rows;
};

/**
 * Lấy danh sách phân vùng nội bộ (Region) của một quốc gia cụ thể kèm theo thông tin chi tiết của quốc gia đó.
 *
 * @async
 * @param {string} countryCode - Mã quốc gia (ví dụ: 'US', 'VN') dùng để truy vấn.
 * @returns {Promise<{ country: Object, regions: Array<Object> }>} Thông tin quốc gia và danh sách phân vùng kèm sản lượng.
 * @throws {Error} Ném ra lỗi 404 nếu quốc gia không tồn tại.
 */
export const getCountryRegionsStats = async (countryCode) => {
  // 1. Kiểm tra sự tồn tại và lấy thông tin chi tiết của quốc gia
  const countryCheckQuery = `
    SELECT zone_id, code, name, iso_code, source, created_at
    FROM "Zone" 
    WHERE type = 'COUNTRY' AND (UPPER(code) = UPPER($1) OR UPPER(iso_code) = UPPER($1))
  `;
  const countryCheckResult = await pool.query(countryCheckQuery, [countryCode]);
  
  if (countryCheckResult.rows.length === 0) {
    const error = new Error(`Quốc gia có mã '${countryCode}' không tồn tại`);
    error.statusCode = 404;
    throw error;
  }

  const country = countryCheckResult.rows[0];

  // 2. Lấy thống kê theo phân vùng của quốc gia đó
  const regionStatsQuery = `
    SELECT 
      zr.zone_id,
      zr.code,
      zr.name,
      zr.iso_code,
      zr.source,
      zr.created_at,
      COUNT(a.article_id)::integer AS article_count
    FROM "Zone" zr
    INNER JOIN "Journal" j ON j.region = zr.zone_id
    INNER JOIN "Volume" v ON v.journal_id = j.journal_id
    INNER JOIN "Issue" i ON i.volume_id = v.volume_id
    LEFT JOIN "Article" a ON a.issue_id = i.issue_id
    WHERE zr.type = 'REGION' AND j.country = $1
    GROUP BY zr.zone_id, zr.code, zr.name, zr.iso_code, zr.source, zr.created_at
    ORDER BY article_count DESC, zr.name ASC
  `;
  const statsResult = await pool.query(regionStatsQuery, [country.zone_id]);

  return {
    country,
    regions: statsResult.rows
  };
};


/**
 * Kiểm tra Vùng (Zone) có tồn tại trong hệ thống hay không
 * @param {string|number} id - ID của Zone cần kiểm tra
 * @returns {Promise<boolean>} true nếu tồn tại, false nếu không
 */
export const zoneExist = async (id) => {
    try {
        const query = `
            SELECT EXISTS (
                SELECT 1 FROM "Zone" WHERE zone_id = $1
            ) AS "exists";
        `;

        const result = await pool.query(query, [id]);
        
        return result.rows[0]?.exists || false;

    } catch (error) {
        console.error(`[Service Error] Lỗi khi kiểm tra zoneExist với ID ${id}:`, error);
        throw error;
    }
};