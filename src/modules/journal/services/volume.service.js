import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a má»™t Volume trong database dá»±a trÃªn ID.
 * KhÃ´ng phÃ¢n biá»‡t Ä‘Ã£ bá»‹ xÃ³a má»m hay chÆ°a.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Volume cáº§n kiá»ƒm tra.
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u Volume tá»“n táº¡i, ngÆ°á»£c láº¡i false.
 */
export const volumeExist = async (id) => {
  try {
    const query = `SELECT 1 FROM "Volume" WHERE volume_id = $1`;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a Volume vá»›i ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiá»ƒm tra xem Volume cÃ³ Ä‘ang bá»‹ xÃ³a má»m (is_deleted = true) hay khÃ´ng.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Volume cáº§n kiá»ƒm tra.
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u Volume Ä‘Ã£ bá»‹ xÃ³a má»m, ngÆ°á»£c láº¡i false.
 */
export const volumeIsDeleted = async (id) => {
  try {
    const query = `SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = true`;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi kiá»ƒm tra tráº¡ng thÃ¡i xÃ³a má»m cá»§a Volume vá»›i ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Kiá»ƒm tra xem cÃ³ Volume nÃ o khÃ¡c Ä‘ang hoáº¡t Ä‘á»™ng trÃ¹ng láº·p sá»‘ volume trong cÃ¹ng má»™t táº¡p chÃ­ khÃ´ng.
 * 
 * @async
 * @param {number|string} journalId - ID cá»§a Journal.
 * @param {number} volumeNumber - Sá»‘ volume cáº§n kiá»ƒm tra.
 * @param {number|string} [excludeId=null] - ID cá»§a Volume cáº§n loáº¡i trá»« (trong trÆ°á»ng há»£p update).
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u bá»‹ trÃ¹ng láº·p, ngÆ°á»£c láº¡i false.
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

    const result = await prisma.$queryRawUnsafe(query, ...params);
    return result.length > 0;
  } catch (error) {
    logger.error("Lá»—i khi kiá»ƒm tra trÃ¹ng láº·p volume:", error.message);
    throw error;
  }
};

/**
 * Táº¡o má»›i má»™t Volume.
 * 
 * @async
 * @param {Object} data - Dá»¯ liá»‡u Volume cáº§n táº¡o.
 * @param {number|string} data.journal_id - ID cá»§a Journal liÃªn káº¿t.
 * @param {number} data.volume_number - Sá»‘ volume.
 * @param {number} data.publication_year - NÄƒm xuáº¥t báº£n.
 * @returns {Promise<Object>} Tráº£ vá» Ä‘á»‘i tÆ°á»£ng Volume vá»«a Ä‘Æ°á»£c táº¡o.
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
    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result[0];
  } catch (error) {
    logger.error("Lá»—i khi táº¡o má»›i Volume:", error.message);
    throw error;
  }
};

/**
 * Láº¥y danh sÃ¡ch Volumes cÃ³ há»— trá»£ tÃ¬m kiáº¿m, lá»c, sáº¯p xáº¿p vÃ  phÃ¢n trang.
 * Chá»‰ láº¥y cÃ¡c Volume chÆ°a bá»‹ xÃ³a má»m (is_deleted = false).
 * 
 * @async
 * @param {Object} params - CÃ¡c tham sá»‘ lá»c vÃ  phÃ¢n trang.
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

    // Lá»c theo journal_id
    if (journal_id !== undefined && journal_id !== null && journal_id !== "") {
      queryParams.push(BigInt(journal_id));
      baseQuery += ` AND journal_id = $${queryParams.length}`;
    }

    // Lá»c theo publication_year
    if (publication_year !== undefined && publication_year !== null && publication_year !== "") {
      queryParams.push(parseInt(publication_year, 10));
      baseQuery += ` AND publication_year = $${queryParams.length}`;
    }

    // TÃ¬m kiáº¿m theo sá»‘ volume
    if (search !== undefined && search !== null && search.toString().trim() !== "") {
      queryParams.push(`%${search.toString().trim()}%`);
      baseQuery += ` AND volume_number::text ILIKE $${queryParams.length}`;
    }

    // Äáº¿m tá»•ng sá»‘ báº£n ghi
    const countQuery = `SELECT COUNT(*)::integer AS total ${baseQuery}`;
    const countRes = await prisma.$queryRawUnsafe(countQuery, ...queryParams);
    const total = countRes[0]?.total || 0;

    // Sáº¯p xáº¿p
    const allowedSortFields = ["volume_id", "volume_number", "publication_year"];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : "volume_number";
    const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

    // PhÃ¢n trang
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

    const dataRes = await prisma.$queryRawUnsafe(dataQuery, ...queryParams);
    return {
      items: dataRes,
      total
    };
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch Volume:", error.message);
    throw error;
  }
};

/**
 * Láº¥y thÃ´ng tin chi tiáº¿t má»™t Volume theo ID (chÆ°a bá»‹ xÃ³a má»m).
 * 
 * @async
 * @param {number|string} id - ID cá»§a Volume cáº§n láº¥y.
 * @returns {Promise<Object|null>} Tráº£ vá» thÃ´ng tin Volume hoáº·c null náº¿u khÃ´ng tÃ¬m tháº¥y.
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
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y chi tiáº¿t Volume ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * Cáº­p nháº­t thÃ´ng tin Volume.
 * 
 * @async
 * @param {number|string} id - ID cá»§a Volume cáº§n cáº­p nháº­t.
 * @param {Object} data - Dá»¯ liá»‡u cáº§n cáº­p nháº­t.
 * @param {number} [data.volume_number] - Sá»‘ volume má»›i.
 * @param {number} [data.publication_year] - NÄƒm xuáº¥t báº£n má»›i.
 * @returns {Promise<Object|null>} Tráº£ vá» Volume sau cáº­p nháº­t, hoáº·c null náº¿u khÃ´ng thÃ nh cÃ´ng.
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
    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Volume ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * XÃ³a má»m má»™t Volume (Ä‘áº·t is_deleted = true).
 * 
 * @async
 * @param {number|string} id - ID cá»§a Volume cáº§n xÃ³a má»m.
 * @returns {Promise<Object|null>} Tráº£ vá» thÃ´ng tin Volume Ä‘Ã£ xÃ³a má»m, hoáº·c null.
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
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a má»m Volume ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * KhÃ´i phá»¥c má»™t Volume Ä‘Ã£ bá»‹ xÃ³a má»m (Ä‘áº·t is_deleted = false).
 * 
 * @async
 * @param {number|string} id - ID cá»§a Volume cáº§n khÃ´i phá»¥c.
 * @returns {Promise<Object|null>} Tráº£ vá» thÃ´ng tin Volume Ä‘Ã£ khÃ´i phá»¥c, hoáº·c null.
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
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c Volume ID ${id}:`, error.message);
    throw error;
  }
};



