import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a má»™t Subject Area trong database dá»±a trÃªn ID.
 * KhÃ´ng phÃ¢n biá»‡t Ä‘Ã£ bá»‹ xÃ³a má»m hay chÆ°a.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Area.
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u tá»“n táº¡i, ngÆ°á»£c láº¡i false.
 */
export const subjectAreaExist = async (id) => {
  try {
    const query = `SELECT 1 FROM "Subject_Area" WHERE subject_area_id = $1`;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a Subject Area vá»›i ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiá»ƒm tra xem Subject Area cÃ³ Ä‘ang bá»‹ xÃ³a má»m (is_deleted = true) hay khÃ´ng.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Area.
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u Ä‘Ã£ bá»‹ xÃ³a má»m, ngÆ°á»£c láº¡i false.
 */
export const subjectAreaIsDeleted = async (id) => {
  try {
    const query = `SELECT 1 FROM "Subject_Area" WHERE subject_area_id = $1 AND is_deleted = true`;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi kiá»ƒm tra tráº¡ng thÃ¡i xÃ³a má»m cá»§a Subject Area vá»›i ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiá»ƒm tra xem cÃ³ Subject Area nÃ o khÃ¡c Ä‘ang hoáº¡t Ä‘á»™ng trÃ¹ng láº·p display_name khÃ´ng.
 * 
 * @async
 * @param {string} displayName - TÃªn cáº§n kiá»ƒm tra.
 * @param {number|string} [excludeId=null] - ID cáº§n loáº¡i trá»« (trong trÆ°á»ng há»£p update).
 * @returns {Promise<{ duplicateName: boolean }>} Äá»‘i tÆ°á»£ng chá»©a káº¿t quáº£ trÃ¹ng láº·p.
 */
export const checkDuplicateSubjectArea = async (displayName, excludeId = null) => {
  try {
    let queryName = `SELECT 1 FROM "Subject_Area" WHERE display_name = $1 AND is_deleted = false`;
    const paramsName = [displayName.trim()];
    if (excludeId !== null) {
      queryName += ` AND subject_area_id != $2`;
      paramsName.push(BigInt(excludeId));
    }
    const resName = await prisma.$queryRawUnsafe(queryName, ...paramsName);

    return {
      duplicateName: resName.length > 0
    };
  } catch (error) {
    logger.error("Lá»—i khi kiá»ƒm tra trÃ¹ng láº·p Subject Area:", error.message);
    throw error;
  }
};

/**
 * Táº¡o má»›i má»™t Subject Area.
 * 
 * @async
 * @param {Object} data - Dá»¯ liá»‡u táº¡o.
 * @param {string} data.display_name - TÃªn hiá»ƒn thá»‹.
 * @param {string} [data.description] - MÃ´ táº£.
 * @returns {Promise<Object>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng vá»«a táº¡o.
 */
export const createSubjectArea = async (data) => {
  try {
    const { display_name, description } = data;
    const trimmedName = display_name.trim();
    const cleanDesc = description ? description.trim() : null;

    const query = `
      INSERT INTO "Subject_Area" (display_name, description, is_deleted)
      VALUES ($1, $2, false)
      RETURNING 
        subject_area_id::text AS subject_area_id, 
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await prisma.$queryRawUnsafe(query, trimmedName, cleanDesc);
    return result[0];
  } catch (error) {
    logger.error("Lá»—i khi táº¡o má»›i Subject Area:", error.message);
    throw error;
  }
};

/**
 * Láº¥y danh sÃ¡ch Subject Area há»— trá»£ tÃ¬m kiáº¿m, phÃ¢n trang vÃ  sáº¯p xáº¿p.
 * Chá»‰ láº¥y báº£n ghi chÆ°a bá»‹ xÃ³a má»m (is_deleted = false).
 * 
 * @async
 * @param {Object} params - Tham sá»‘ Ä‘áº§u vÃ o.
 * @returns {Promise<{ items: Array<Object>, total: number }>}
 */
export const getSubjectAreas = async ({
  page = 1,
  limit = 10,
  search,
  sort_by = "display_name",
  sort_order = "asc"
} = {}) => {
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      FROM "Subject_Area"
      WHERE is_deleted = false
    `;
    const queryParams = [];

    // TÃ¬m kiáº¿m theo display_name (khÃ´ng phÃ¢n biá»‡t hoa thÆ°á»ng)
    if (search !== undefined && search !== null && search.toString().trim() !== "") {
      queryParams.push(`%${search.toString().trim()}%`);
      baseQuery += ` AND display_name ILIKE $1`;
    }

    // Äáº¿m tá»•ng sá»‘ báº£n ghi
    const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;
    const countRes = await prisma.$queryRawUnsafe(countQuery, ...queryParams);
    const total = countRes[0]?.total || 0;

    // Sáº¯p xáº¿p
    const allowedSortFields = ["subject_area_id", "display_name"];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : "display_name";
    const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

    // PhÃ¢n trang
    queryParams.push(limitNum, offset);
    const dataQuery = `
      SELECT 
        subject_area_id::text AS subject_area_id, 
        display_name, 
        description, 
        is_deleted
      ${baseQuery}
      ORDER BY "${sortField}" ${sortDir}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    const dataRes = await prisma.$queryRawUnsafe(dataQuery, ...queryParams);
    return {
      items: dataRes,
      total
    };
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch Subject Area:", error.message);
    throw error;
  }
};

/**
 * Láº¥y thÃ´ng tin chi tiáº¿t má»™t Subject Area (chÆ°a bá»‹ xÃ³a má»m).
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Area.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng hoáº·c null náº¿u khÃ´ng tá»“n táº¡i.
 */
export const getSubjectAreaById = async (id) => {
  try {
    const query = `
      SELECT 
        subject_area_id::text AS subject_area_id, 
        display_name, 
        description, 
        is_deleted
      FROM "Subject_Area"
      WHERE subject_area_id = $1 AND is_deleted = false
    `;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y chi tiáº¿t Subject Area ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Cáº­p nháº­t thÃ´ng tin Subject Area.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Area.
 * @param {Object} data - Dá»¯ liá»‡u cáº­p nháº­t.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng sau cáº­p nháº­t hoáº·c null.
 */
export const updateSubjectArea = async (id, data) => {
  try {
    const allowedFields = ["display_name", "description"];
    const updateParts = [];
    const values = [];
    let placeholderIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateParts.push(`"${field}" = $${placeholderIndex}`);
        let val = data[field];
        if (typeof val === "string") {
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
      UPDATE "Subject_Area"
      SET ${updateParts.join(", ")}
      WHERE subject_area_id = $${placeholderIndex} AND is_deleted = false
      RETURNING 
        subject_area_id::text AS subject_area_id, 
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Subject Area ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * XÃ³a má»m má»™t Subject Area.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Area.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng Ä‘Ã£ xÃ³a hoáº·c null.
 */
export const deleteSubjectArea = async (id) => {
  try {
    const query = `
      UPDATE "Subject_Area"
      SET is_deleted = true
      WHERE subject_area_id = $1 AND is_deleted = false
      RETURNING 
        subject_area_id::text AS subject_area_id, 
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a má»m Subject Area ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * KhÃ´i phá»¥c má»™t Subject Area Ä‘Ã£ bá»‹ xÃ³a má»m.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Area.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng Ä‘Ã£ khÃ´i phá»¥c hoáº·c null.
 */
export const restoreSubjectArea = async (id) => {
  try {
    const query = `
      UPDATE "Subject_Area"
      SET is_deleted = false
      WHERE subject_area_id = $1 AND is_deleted = true
      RETURNING 
        subject_area_id::text AS subject_area_id, 
        display_name, 
        description, 
        is_deleted;
    `;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c Subject Area ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * TÃ­nh toÃ¡n thá»‘ng kÃª dá»¯ liá»‡u liÃªn quan tá»›i Subject Area: total_journals, total_articles, total_authors.
 * Sá»­ dá»¥ng Promise.all Ä‘á»ƒ tá»‘i Æ°u hÃ³a hiá»‡u nÄƒng.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Area.
 * @returns {Promise<Object>} Äá»‘i tÆ°á»£ng thá»‘ng kÃª.
 */
export const getSubjectAreaStatistics = async (id) => {
  try {
    const parsedId = BigInt(id);

    // 1. Láº¥y thÃ´ng tin Subject Area trÆ°á»›c Ä‘á»ƒ tráº£ vá» Ä‘Ãºng tÃªn
    const saRes = await prisma.$queryRawUnsafe(
      `SELECT display_name FROM "Subject_Area" WHERE subject_area_id = $1 AND is_deleted = false`,
      parsedId
    );

    if (saRes.length === 0) {
      return null;
    }

    const { display_name } = saRes[0];

    // 2. Äá»‹nh nghÄ©a cÃ¡c cÃ¢u truy váº¥n Ä‘áº¿m song song
    // Äáº¿m tá»•ng sá»‘ Journal Ä‘ang hoáº¡t Ä‘á»™ng thuá»™c Subject Area
    const journalsQuery = `
      SELECT COUNT(DISTINCT j.journal_id)::integer AS count
      FROM "Journal" j
      JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
      JOIN "Subject_Category" sc ON jsc.subject_category_id = sc.subject_category_id
      WHERE sc.subject_area_id = $1 AND COALESCE(j.is_deleted, false) = false
    `;

    // Äáº¿m tá»•ng sá»‘ Article Ä‘ang hoáº¡t Ä‘á»™ng (Article -> Issue -> Volume -> Journal)
    const articlesQuery = `
      SELECT COUNT(DISTINCT a.article_id)::integer AS count
      FROM "Article" a
      JOIN "Issue" i ON a.issue_id = i.issue_id
      JOIN "Volume" v ON i.volume_id = v.volume_id
      JOIN "Journal" j ON v.journal_id = j.journal_id
      JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
      JOIN "Subject_Category" sc ON jsc.subject_category_id = sc.subject_category_id
      WHERE sc.subject_area_id = $1
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(v.is_deleted, false) = false
        AND COALESCE(j.is_deleted, false) = false
    `;

    // Äáº¿m tá»•ng sá»‘ Author duy nháº¥t cá»§a cÃ¡c Article trÃªn
    const authorsQuery = `
      SELECT COUNT(DISTINCT aa.author_id)::integer AS count
      FROM "Author_Article" aa
      JOIN "Article" a ON aa.article_id = a.article_id
      JOIN "Issue" i ON a.issue_id = i.issue_id
      JOIN "Volume" v ON i.volume_id = v.volume_id
      JOIN "Journal" j ON v.journal_id = j.journal_id
      JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
      JOIN "Subject_Category" sc ON jsc.subject_category_id = sc.subject_category_id
      WHERE sc.subject_area_id = $1
        AND COALESCE(a.is_deleted, false) = false
        AND COALESCE(v.is_deleted, false) = false
        AND COALESCE(j.is_deleted, false) = false
    `;

    // 3. Thá»±c hiá»‡n song song truy váº¥n báº±ng Promise.all
    const [journalsRes, articlesRes, authorsRes] = await Promise.all([
      prisma.$queryRawUnsafe(journalsQuery, parsedId),
      prisma.$queryRawUnsafe(articlesQuery, parsedId),
      prisma.$queryRawUnsafe(authorsQuery, parsedId)
    ]);

    return {
      subject_area_id: id.toString(),
      display_name,
      total_journals: journalsRes[0]?.count || 0,
      total_articles: articlesRes[0]?.count || 0,
      total_authors: authorsRes[0]?.count || 0
    };
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y thá»‘ng kÃª Subject Area ID ${id}:`, error.message);
    throw error;
  }
};



