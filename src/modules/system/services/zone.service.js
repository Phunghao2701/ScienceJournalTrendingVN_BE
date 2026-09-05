import prisma from '../../../config/prisma.js';

/**
 * Láº¥y danh sÃ¡ch thá»‘ng kÃª sáº£n lÆ°á»£ng bÃ i viáº¿t theo tá»«ng quá»‘c gia (phÃ¢n trang).
 *
 * @async
 * @param {Object} params - CÃ¡c tham sá»‘ phÃ¢n trang.
 * @param {number} params.page - Trang hiá»‡n táº¡i.
 * @param {number} params.limit - Sá»‘ lÆ°á»£ng báº£n ghi trÃªn má»—i trang.
 * @returns {Promise<{ countries: Array<Object>, total: number }>} Danh sÃ¡ch cÃ¡c quá»‘c gia cÃ¹ng tá»•ng sá»‘ lÆ°á»£ng báº£n ghi.
 */
export const getCountryStats = async ({ page = 1, limit = 10, year }) => {
  const parsedPage = parseInt(page, 10) || 1;
  const parsedLimit = parseInt(limit, 10) || 10;
  const offset = (parsedPage - 1) * parsedLimit;

  // 1. Äáº¿m tá»•ng sá»‘ quá»‘c gia cÃ³ trong há»‡ thá»‘ng
  const countQuery = 'SELECT COUNT(*)::integer AS total FROM "Zone" WHERE type = \'COUNTRY\'';
  const countResult = await prisma.$queryRawUnsafe(countQuery);
  const total = countResult[0]?.total || 0;

  // 2. Láº¥y thá»‘ng kÃª chi tiáº¿t sáº£n lÆ°á»£ng bÃ i bÃ¡o theo quá»‘c gia
  // Táº¡o danh sÃ¡ch giÃ¡ trá»‹ truyá»n vÃ o query Ä‘á»ƒ báº£o máº­t SQL injection
  const values = [parsedLimit, offset];
  let yearClause = '';
  
  // Náº¿u tham sá»‘ lá»c 'year' (nÄƒm xuáº¥t báº£n) Ä‘Æ°á»£c gá»­i lÃªn, ta sáº½ thÃªm Ä‘iá»u kiá»‡n lá»c theo nÄƒm
  if (year) {
    values.push(Number(year));
    yearClause = `AND a.publication_year = $${values.length}`; // ThÃªm tham sá»‘ Ä‘á»™ng vÃ o ON clause Ä‘á»ƒ lá»c bÃ i bÃ¡o theo nÄƒm
  }

  // Thá»±c hiá»‡n LEFT JOIN cÃ¡c báº£ng: Zone -> Journal -> Volume -> Issue -> Article
  // ThÃªm Ä‘iá»u kiá»‡n 'is_deleted = false' Ä‘á»ƒ loáº¡i bá» cÃ¡c báº£n ghi Ä‘Ã£ bá»‹ xÃ³a má»m.
  // Äiá»u kiá»‡n lá»c yearClause Ä‘Æ°á»£c Ä‘áº·t trong ON clause Ä‘á»ƒ trÃ¡nh biáº¿n LEFT JOIN thÃ nh INNER JOIN (nháº±m giá»¯ láº¡i cÃ¡c quá»‘c gia cÃ³ 0 sáº£n lÆ°á»£ng).
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
  const statsResult = await prisma.$queryRawUnsafe(statsQuery, ...values);

  return {
    countries: statsResult,
    total
  };
};

/**
 * Láº¥y thá»‘ng kÃª sáº£n lÆ°á»£ng bÃ i viáº¿t theo phÃ¢n vÃ¹ng (Region), cÃ³ thá»ƒ lá»c theo mÃ£ quá»‘c gia cá»¥ thá»ƒ.
 *
 * @async
 * @param {Object} [params] - Tham sá»‘ lá»c.
 * @param {string} [params.countryCode] - MÃ£ quá»‘c gia (vÃ­ dá»¥: 'US', 'VN') dÃ¹ng Ä‘á»ƒ lá»c.
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch phÃ¢n vÃ¹ng vÃ  sáº£n lÆ°á»£ng bÃ i bÃ¡o.
 * @throws {Error} NÃ©m ra lá»—i 404 náº¿u truyá»n mÃ£ quá»‘c gia nhÆ°ng quá»‘c gia Ä‘Ã³ khÃ´ng tá»“n táº¡i.
 */
export const getRegionStats = async ({ countryCode } = {}) => {
  if (countryCode) {
    // 1. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a quá»‘c gia vá»›i mÃ£ Ä‘Ã£ cho
    const countryCheckQuery = `
      SELECT zone_id, name 
      FROM "Zone" 
      WHERE type = 'COUNTRY' AND (UPPER(code) = UPPER($1) OR UPPER(iso_code) = UPPER($1))
    `;
    const countryCheckResult = await prisma.$queryRawUnsafe(countryCheckQuery, countryCode);
    
    if (countryCheckResult.length === 0) {
      const error = new Error(`Quá»‘c gia cÃ³ mÃ£ '${countryCode}' khÃ´ng tá»“n táº¡i`);
      error.statusCode = 404;
      throw error;
    }

    const countryZoneId = countryCheckResult[0].zone_id;

    // 2. Láº¥y thá»‘ng kÃª theo vÃ¹ng cá»§a quá»‘c gia cá»¥ thá»ƒ
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
    const statsResult = await prisma.$queryRawUnsafe(regionStatsQuery, countryZoneId);
    return statsResult;
  }

  // Láº¥y toÃ n bá»™ phÃ¢n vÃ¹ng (Region) toÃ n cáº§u
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
  const statsResult = await prisma.$queryRawUnsafe(globalRegionStatsQuery);
  return statsResult;
};

/**
 * Láº¥y danh sÃ¡ch phÃ¢n vÃ¹ng ná»™i bá»™ (Region) cá»§a má»™t quá»‘c gia cá»¥ thá»ƒ kÃ¨m theo thÃ´ng tin chi tiáº¿t cá»§a quá»‘c gia Ä‘Ã³.
 *
 * @async
 * @param {string} countryCode - MÃ£ quá»‘c gia (vÃ­ dá»¥: 'US', 'VN') dÃ¹ng Ä‘á»ƒ truy váº¥n.
 * @returns {Promise<{ country: Object, regions: Array<Object> }>} ThÃ´ng tin quá»‘c gia vÃ  danh sÃ¡ch phÃ¢n vÃ¹ng kÃ¨m sáº£n lÆ°á»£ng.
 * @throws {Error} NÃ©m ra lá»—i 404 náº¿u quá»‘c gia khÃ´ng tá»“n táº¡i.
 */
export const getCountryRegionsStats = async (countryCode) => {
  // 1. Kiá»ƒm tra sá»± tá»“n táº¡i vÃ  láº¥y thÃ´ng tin chi tiáº¿t cá»§a quá»‘c gia
  const countryCheckQuery = `
    SELECT zone_id, code, name, iso_code, source, created_at
    FROM "Zone" 
    WHERE type = 'COUNTRY' AND (UPPER(code) = UPPER($1) OR UPPER(iso_code) = UPPER($1))
  `;
  const countryCheckResult = await prisma.$queryRawUnsafe(countryCheckQuery, countryCode);
  
  if (countryCheckResult.length === 0) {
    const error = new Error(`Quá»‘c gia cÃ³ mÃ£ '${countryCode}' khÃ´ng tá»“n táº¡i`);
    error.statusCode = 404;
    throw error;
  }

  const country = countryCheckResult[0];

  // 2. Láº¥y thá»‘ng kÃª theo phÃ¢n vÃ¹ng cá»§a quá»‘c gia Ä‘Ã³
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
  const statsResult = await prisma.$queryRawUnsafe(regionStatsQuery, country.zone_id);

  return {
    country,
    regions: statsResult
  };
};


/**
 * Kiá»ƒm tra VÃ¹ng (Zone) cÃ³ tá»“n táº¡i trong há»‡ thá»‘ng hay khÃ´ng
 * @param {string|number} id - ID cá»§a Zone cáº§n kiá»ƒm tra
 * @returns {Promise<boolean>} true náº¿u tá»“n táº¡i, false náº¿u khÃ´ng
 */
export const zoneExist = async (id) => {
    try {
        const query = `
            SELECT EXISTS (
                SELECT 1 FROM "Zone" WHERE zone_id = $1
            ) AS "exists";
        `;

        const result = await prisma.$queryRawUnsafe(query, id);
        
        return result[0]?.exists || false;

    } catch (error) {
        console.error(`[Service Error] Lá»—i khi kiá»ƒm tra zoneExist vá»›i ID ${id}:`, error);
        throw error;
    }
};

