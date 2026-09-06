import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

export const getInstitutionById = async (institutionId) => {
  try {
    const query = `
      SELECT
        institution_id::text,
        openalex_id,
        display_name,
        country_code,
        type,
        created_at
      FROM "Institution"
      WHERE institution_id = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1;
    `;
    const result = await prisma.$queryRawUnsafe(query, institutionId);
    return result[0] || null;
  } catch (error) {
    logger.error("[Service Error] Lá»—i khi láº¥y chi tiáº¿t institution:", error);
    throw error;
  }
};

/**
 * Láº¥y danh sÃ¡ch cÆ¡ sá»Ÿ giÃ¡o dá»¥c Viá»‡t Nam (Institution), há»— trá»£ tÃ¬m kiáº¿m vÃ�  phÃ¢n trang.
 * Scope cá»‘ Ä‘á»‹nh: country_code='VN' vÃ�  type='education', khá»›p Ä‘Ãºng quy táº¯c
 * scope=vn_universities Ä‘Ã£ dÃ¹ng cho Article (docs/researches/paper-vn-affiliation-scope.md).
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
      prisma.$queryRawUnsafe(query, searchParam, Number(limit), Number(offset)),
      prisma.$queryRawUnsafe(countQuery, searchParam),
    ]);

    const total = parseInt(countResult[0].total, 10);

    return {
      data: dataResult,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("[Service Error] Lá»—i khi láº¥y danh sÃ¡ch institution:", error);
    throw error;
  }
};



