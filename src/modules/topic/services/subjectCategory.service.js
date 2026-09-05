import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a má»™t Subject Category trong database dá»±a trÃªn ID.
 * KhÃ´ng phÃ¢n biá»‡t Ä‘Ã£ bá»‹ xÃ³a má»m hay chÆ°a.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Category.
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u tá»“n táº¡i, ngÆ°á»£c láº¡i false.
 */
export const subjectCategoryExist = async (id) => {
  try {
    const query = `SELECT 1 FROM "Subject_Category" WHERE subject_category_id = $1`;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a Subject Category vá»›i ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiá»ƒm tra xem Subject Category cÃ³ Ä‘ang bá»‹ xÃ³a má»m (is_deleted = true) hay khÃ´ng.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Category.
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u Ä‘Ã£ bá»‹ xÃ³a má»m, ngÆ°á»£c láº¡i false.
 */
export const subjectCategoryIsDeleted = async (id) => {
  try {
    const query = `SELECT 1 FROM "Subject_Category" WHERE subject_category_id = $1 AND is_deleted = true`;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi kiá»ƒm tra tráº¡ng thÃ¡i xÃ³a má»m cá»§a Subject Category vá»›i ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiá»ƒm tra xem cÃ³ Subject Category nÃ o khÃ¡c Ä‘ang hoáº¡t Ä‘á»™ng trÃ¹ng láº·p display_name trong cÃ¹ng Subject Area khÃ´ng.
 * 
 * @async
 * @param {number|string} subjectAreaId - ID cá»§a Subject Area cha.
 * @param {string} displayName - TÃªn cáº§n kiá»ƒm tra.
 * @param {number|string} [excludeId=null] - ID cáº§n loáº¡i trá»« (trong trÆ°á»ng há»£p update).
 * @returns {Promise<{ duplicateName: boolean }>} Äá»‘i tÆ°á»£ng chá»©a káº¿t quáº£ trÃ¹ng láº·p.
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
    const resName = await prisma.$queryRawUnsafe(queryName, ...paramsName);

    return {
      duplicateName: resName.length > 0
    };
  } catch (error) {
    logger.error("Lá»—i khi kiá»ƒm tra trÃ¹ng láº·p Subject Category:", error.message);
    throw error;
  }
};

/**
 * Táº¡o má»›i má»™t Subject Category.
 * 
 * @async
 * @param {Object} data - Dá»¯ liá»‡u táº¡o.
 * @param {number|string} data.subject_area_id - ID cá»§a Subject Area cha.
 * @param {string} data.display_name - TÃªn hiá»ƒn thá»‹.
 * @param {string} [data.description] - MÃ´ táº£.
 * @returns {Promise<Object>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng vá»«a táº¡o.
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
    const result = await prisma.$queryRawUnsafe(query, BigInt(subject_area_id), trimmedName, cleanDesc);
    return result[0];
  } catch (error) {
    logger.error("Lá»—i khi táº¡o má»›i Subject Category:", error.message);
    throw error;
  }
};

/**
 * Láº¥y danh sÃ¡ch Subject Category há»— trá»£ tÃ¬m kiáº¿m, phÃ¢n trang, lá»c theo Subject Area vÃ  sáº¯p xáº¿p.
 * Chá»‰ láº¥y báº£n ghi chÆ°a bá»‹ xÃ³a má»m (is_deleted = false).
 * 
 * @async
 * @param {Object} params - Tham sá»‘ Ä‘áº§u vÃ o.
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

    // Lá»c theo subject_area_id
    if (subject_area_id !== undefined && subject_area_id !== null && subject_area_id.toString().trim() !== "") {
      queryParams.push(BigInt(subject_area_id));
      baseQuery += ` AND subject_area_id = $${queryParams.length}`;
    }

    // TÃ¬m kiáº¿m theo display_name (khÃ´ng phÃ¢n biá»‡t hoa thÆ°á»ng)
    if (search !== undefined && search !== null && search.toString().trim() !== "") {
      queryParams.push(`%${search.toString().trim()}%`);
      baseQuery += ` AND display_name ILIKE $${queryParams.length}`;
    }

    // Äáº¿m tá»•ng sá»‘ báº£n ghi
    const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;
    const countRes = await prisma.$queryRawUnsafe(countQuery, ...queryParams);
    const total = countRes[0]?.total || 0;

    // Sáº¯p xáº¿p
    const allowedSortFields = ["subject_category_id", "display_name", "subject_area_id"];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : "display_name";
    const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

    // PhÃ¢n trang
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

    const dataRes = await prisma.$queryRawUnsafe(dataQuery, ...queryParams);
    return {
      items: dataRes,
      total
    };
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch Subject Category:", error.message);
    throw error;
  }
};

/**
 * Láº¥y thÃ´ng tin chi tiáº¿t má»™t Subject Category vÃ  JOIN vá»›i Subject Area.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Category.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng chi tiáº¿t hoáº·c null.
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
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y chi tiáº¿t Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Cáº­p nháº­t thÃ´ng tin Subject Category.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Category.
 * @param {Object} data - Dá»¯ liá»‡u cáº­p nháº­t.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng sau cáº­p nháº­t hoáº·c null.
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
    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * XÃ³a má»m má»™t Subject Category.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Category.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng Ä‘Ã£ xÃ³a hoáº·c null.
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
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a má»m Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * KhÃ´i phá»¥c má»™t Subject Category Ä‘Ã£ bá»‹ xÃ³a má»m.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Category.
 * @returns {Promise<Object|null>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng Ä‘Ã£ khÃ´i phá»¥c hoáº·c null.
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
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c Subject Category ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * TÃ­nh toÃ¡n thá»‘ng kÃª dá»¯ liá»‡u liÃªn quan tá»›i Subject Category: total_journals, total_articles, total_authors.
 * Sá»­ dá»¥ng Promise.all Ä‘á»ƒ tá»‘i Æ°u hÃ³a hiá»‡u nÄƒng.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Subject Category.
 * @returns {Promise<Object>} Äá»‘i tÆ°á»£ng thá»‘ng kÃª.
 */
export const getSubjectCategoryStatistics = async (id) => {
  try {
    const parsedId = BigInt(id);

    // 1. Láº¥y thÃ´ng tin Subject Category trÆ°á»›c
    const scRes = await prisma.$queryRawUnsafe(
      `SELECT display_name FROM "Subject_Category" WHERE subject_category_id = $1 AND is_deleted = false`,
      parsedId
    );

    if (scRes.length === 0) {
      return null;
    }

    const { display_name } = scRes[0];

    // 2. Äá»‹nh nghÄ©a cÃ¡c cÃ¢u truy váº¥n Ä‘áº¿m song song
    // Äáº¿m tá»•ng sá»‘ Journal Ä‘ang hoáº¡t Ä‘á»™ng thuá»™c Subject Category
    const journalsQuery = `
      SELECT COUNT(DISTINCT j.journal_id)::integer AS count
      FROM "Journal" j
      JOIN "Journal_Subject_Category" jsc ON j.journal_id = jsc.journal_id
      WHERE jsc.subject_category_id = $1 AND COALESCE(j.is_deleted, false) = false
    `;

    // Äáº¿m tá»•ng sá»‘ Article Ä‘ang hoáº¡t Ä‘á»™ng (Article -> Issue -> Volume -> Journal) thuá»™c Category nÃ y
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

    // Äáº¿m tá»•ng sá»‘ Author duy nháº¥t cá»§a cÃ¡c Article nÃ y
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

    // 3. Thá»±c hiá»‡n song song truy váº¥n báº±ng Promise.all
    const [journalsRes, articlesRes, authorsRes] = await Promise.all([
      prisma.$queryRawUnsafe(journalsQuery, parsedId),
      prisma.$queryRawUnsafe(articlesQuery, parsedId),
      prisma.$queryRawUnsafe(authorsQuery, parsedId)
    ]);

    return {
      subject_category_id: id.toString(),
      display_name,
      total_journals: journalsRes[0]?.count || 0,
      total_articles: articlesRes[0]?.count || 0,
      total_authors: authorsRes[0]?.count || 0
    };
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y thá»‘ng kÃª Subject Category ID ${id}:`, error.message);
    throw error;
  }
};



