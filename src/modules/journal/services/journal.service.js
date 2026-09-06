import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import { publisherExist } from "./publisher.service.js";
import { zoneExist } from '../../system/services/zone.service.js';

/**
 * Láº¥y danh sÃ¡ch journal cÃ³ há»— trá»£ tÃ¬m kiáº¿m theo tÃªn vÃ�  phÃ¢n trang.
 *
 * @async
 * @param {Object} params - Tham sá»‘ Ä‘áº§u vÃ� o.
 * @param {string} [params.search] - TÃªn journal cáº§n tÃ¬m kiáº¿m.
 * @param {number} [params.page=1] - Trang hiá»‡n táº¡i.
 * @param {number} [params.limit=10] - Sá»‘ lÆ°á»£ng báº£n ghi má»—i trang.
 * @returns {Promise<{ items: Array<Object>, total: number }>} Danh sÃ¡ch journal vÃ�  tá»•ng sá»‘ lÆ°á»£ng báº£n ghi phÃ¹ há»£p.
 */
export const getJournals = async ({
  search,
  page = 1,
  limit = 10,
  sort = 'relevance',
  subjectAreaIds,
  subjectCategoryIds,
  isOpenAccess,
  quartiles,
  rankingYear,
  isOaDiamond,
  countryIds,
  subject_area_id,
  publisher_id,
  sort_by,
  sort_order,
} = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const offset = (pageNum - 1) * limitNum;

  const values = [];
  const whereClauses = ['j.is_deleted = false'];

  const pushCsvFilter = (rawValue) => String(rawValue || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (search && search.trim() !== '') {
    const normalizedSearch = search.trim();
    values.push(`%${normalizedSearch}%`);
    const searchIndex = values.length;
    values.push(`%${normalizedSearch.replace(/-/g, '')}%`);
    const normalizedIssnIndex = values.length;
    whereClauses.push(`(
      j.display_name ILIKE $${searchIndex}
      OR j.issn ILIKE $${searchIndex}
      OR REPLACE(j.issn, '-', '') ILIKE $${normalizedIssnIndex}
    )`);
  }

  const areaIds = pushCsvFilter(subjectAreaIds || subject_area_id);
  if (areaIds.length > 0) {
    values.push(areaIds);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM "Journal_Subject_Category" jsc
      INNER JOIN "Subject_Category" sc ON sc.subject_category_id = jsc.subject_category_id
      WHERE jsc.journal_id = j.journal_id
        AND sc.subject_area_id::text = ANY($${values.length}::text[])
    )`);
  }

  const categoryIds = pushCsvFilter(subjectCategoryIds);
  if (categoryIds.length > 0) {
    values.push(categoryIds);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM "Journal_Subject_Category" jsc
      WHERE jsc.journal_id = j.journal_id
        AND jsc.subject_category_id::text = ANY($${values.length}::text[])
    )`);
  }

  if (String(isOpenAccess) === 'true' || String(isOpenAccess) === 'false') {
    values.push(String(isOpenAccess) === 'true');
    whereClauses.push(`j.is_open_access = $${values.length}`);
  }

  // Filter by OA Diamond when requested
  if (isOaDiamond === true || String(isOaDiamond) === 'true') {
    whereClauses.push(`j.is_oa_diamond = true`);
  }

  if (publisher_id) {
    values.push(BigInt(publisher_id));
    whereClauses.push(`j.publisher_id = $${values.length}`);
  }

  const countryIdValues = pushCsvFilter(countryIds);
  if (countryIdValues.length > 0) {
    values.push(countryIdValues);
    whereClauses.push(`j.country::text = ANY($${values.length}::text[])`);
  }

  const yearNum = rankingYear ? parseInt(rankingYear, 10) : null;

  const quartileValues = pushCsvFilter(quartiles).map(q => q.toUpperCase());
  if (quartileValues.length > 0) {
    values.push(quartileValues);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM "Journal_Ranking" jr
      INNER JOIN "Ranking_Metric" rm ON rm.metric_id = jr.metric_id
      WHERE jr.journal_id = j.journal_id
        AND rm.metric_type = 'QUARTILE'
        AND UPPER(jr.value_txt) = ANY($${values.length}::text[])
        ${yearNum ? `AND jr.year = ${yearNum}` : ''}
    )`);
  }

  const fromSql = `
    FROM "Journal" j
    LEFT JOIN "Publisher" p ON p.publisher_id = j.publisher_id
    LEFT JOIN "Zone" country_zone ON country_zone.zone_id = j.country
    LEFT JOIN LATERAL (
      SELECT jr.value_float AS metric_value, jr.year AS metric_year
      FROM "Journal_Ranking" jr
      INNER JOIN "Ranking_Metric" rm ON rm.metric_id = jr.metric_id
      WHERE jr.journal_id = j.journal_id
        AND UPPER(rm.code) = 'SJR'
        ${yearNum ? `AND jr.year = ${yearNum}` : ''}
      ORDER BY jr.year DESC NULLS LAST
      LIMIT 1
    ) latest_sjr ON true
    LEFT JOIN LATERAL (
      SELECT jr.value_txt AS quartile, jr.year AS quartile_year
      FROM "Journal_Ranking" jr
      INNER JOIN "Ranking_Metric" rm ON rm.metric_id = jr.metric_id
      WHERE jr.journal_id = j.journal_id
        AND rm.metric_type = 'QUARTILE'
        AND jr.value_txt IS NOT NULL
        ${yearNum ? `AND jr.year = ${yearNum}` : ''}
      ORDER BY jr.year DESC NULLS LAST
      LIMIT 1
    ) latest_quartile ON true
  `;

  // Filter by rankingYear: only journals that have an SJR entry for that year
  if (yearNum) {
    whereClauses.push(`latest_sjr.metric_year = ${yearNum}`);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  let orderBySql = 'ORDER BY j.display_name ASC';
  if (sort_by) {
    const order = (sort_order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    if (sort_by === 'display_name') {
      orderBySql = `ORDER BY j.display_name ${order}`;
    } else if (sort_by === 'created_at') {
      orderBySql = `ORDER BY j.created_at ${order}`;
    } else if (sort_by === 'volume_count') {
      orderBySql = `ORDER BY volume_count ${order}`;
    }
  } else {
    orderBySql = sort === 'name'
      ? 'ORDER BY j.display_name ASC'
      : sort === 'metric'
        ? 'ORDER BY latest_sjr.metric_value DESC NULLS LAST, j.display_name ASC'
        : 'ORDER BY j.display_name ASC';
  }

  const query = `
    SELECT
      j.journal_id::text AS journal_id,
      j.display_name,
      j.issn,
      j.type,
      j.coverage,
      j.is_open_access,
      j.is_oa_diamond,
      p.display_name AS publisher_name,
      j.country::text AS country_id,
      country_zone.name AS country_name,
      latest_sjr.metric_value,
      latest_sjr.metric_year,
      latest_quartile.quartile,
      latest_quartile.quartile AS best_quartile,
      latest_quartile.quartile_year,
      (SELECT COUNT(*) FROM "Volume" v WHERE v.journal_id = j.journal_id AND v.is_deleted = false)::integer AS volume_count
    ${fromSql}
    ${whereSql}
    ${orderBySql}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT j.journal_id)::integer AS total
    ${fromSql}
    ${whereSql}
  `;

  const [itemsRes, countRes] = await Promise.all([
    prisma.$queryRawUnsafe(query, ...values, limitNum, offset),
    prisma.$queryRawUnsafe(countQuery, ...values)
  ]);

  return {
    items: itemsRes,
    total: countRes[0]?.total || 0
  };
};

/**
 * Láº¥y thÃ´ng tin chi tiáº¿t cá»§a má»™t journal theo ID.
 * @async
 * @param {number} id - ID cá»§a journal cáº§n láº¥y thÃ´ng tin.
 * @returns {Promise<Object|null>} ThÃ´ng tin journal náº¿u tÃ¬m tháº¥y, hoáº·c null náº¿u khÃ´ng tÃ¬m tháº¥y.
 * @throws {Error} NÃ©m lá»—i náº¿u cÃ³ lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh truy váº¥n database.
 */
export const getJournalsById = async (id) => {
  try {
    const query = `
      SELECT
        j.journal_id::text AS journal_id,
        j.source_id,
        j.display_name,
        j.issn,
        j.type,
        j.coverage,
        j.coverage AS description,
        j.is_open_access,
        j.is_oa_diamond,
        p.publisher_id::text AS publisher_id,
        p.display_name AS publisher_name,
        p.image_url AS publisher_image_url,
        country_zone.zone_id::text AS country_id,
        country_zone.name AS country_name,
        country_zone.code AS country_code,
        country_zone.iso_code AS country_iso_code,
        region_zone.zone_id::text AS region_id,
        region_zone.name AS region_name,
        region_zone.code AS region_code,
        NULLIF(substring(j.coverage from '([0-9]{4})'), '')::int AS established_year
      FROM "Journal" j
      LEFT JOIN "Publisher" p ON p.publisher_id = j.publisher_id
      LEFT JOIN "Zone" country_zone ON country_zone.zone_id = j.country
      LEFT JOIN "Zone" region_zone ON region_zone.zone_id = j.region
      WHERE j.journal_id = $1 AND j.is_deleted = false
    `;

    const [journalRes, metricsRes, categoriesRes] = await Promise.all([
      prisma.$queryRawUnsafe(query, id),
      prisma.$queryRawUnsafe(`
        SELECT DISTINCT ON (UPPER(rm.code))
          UPPER(rm.code) AS metric_code,
          rm.display_name AS metric_name,
          rm.metric_type,
          jr.year,
          jr.value_txt,
          jr.value_int,
          jr.value_float
        FROM "Journal_Ranking" jr
        INNER JOIN "Ranking_Metric" rm ON rm.metric_id = jr.metric_id
        WHERE jr.journal_id = $1
        ORDER BY UPPER(rm.code), jr.year DESC NULLS LAST
      `, id),
      prisma.$queryRawUnsafe(`
        SELECT
          sc.subject_category_id::text AS id,
          sc.display_name,
          sc.subject_area_id::text AS subject_area_id
        FROM "Journal_Subject_Category" jsc
        INNER JOIN "Subject_Category" sc ON sc.subject_category_id = jsc.subject_category_id
        WHERE jsc.journal_id = $1 AND COALESCE(sc.is_deleted, false) = false
        ORDER BY sc.display_name ASC
        LIMIT 12
      `, id)
    ]);

    if (journalRes.length === 0) {
      return null;
    }

    const journal = journalRes[0];
    const metrics = metricsRes;
    const findMetric = (...codes) => metrics.find(metric => codes.includes(metric.metric_code));
    const metricValue = (metric) => {
      if (!metric) return null;
      if (metric.value_float !== null && metric.value_float !== undefined) return Number(metric.value_float);
      if (metric.value_int !== null && metric.value_int !== undefined) return Number(metric.value_int);
      return metric.value_txt ?? null;
    };

    const sjrMetric = findMetric('SJR');
    const hIndexMetric = findMetric('H_INDEX', 'H-INDEX', 'HINDEX');
    const citeScoreMetric = findMetric('CITE_SCORE', 'CITESCORE', 'CITE SCORE');
    const quartileMetric = metrics.find(metric => metric.metric_type === 'QUARTILE' && metric.value_txt);

    return {
      ...journal,
      description: journal.description,
      subject_categories: categoriesRes,
      quartile: quartileMetric?.value_txt || null,
      metric_value: metricValue(sjrMetric),
      metric_name: sjrMetric?.metric_name || 'SJR Score',
      metric_year: sjrMetric?.year ? String(sjrMetric.year) : null,
      h_index: metricValue(hIndexMetric),
      cite_score: metricValue(citeScoreMetric),
      latest_metrics: {
        year: sjrMetric?.year || hIndexMetric?.year || citeScoreMetric?.year || quartileMetric?.year || null,
        sjr: metricValue(sjrMetric),
        h_index: metricValue(hIndexMetric),
        cite_score: metricValue(citeScoreMetric),
        quartile: quartileMetric?.value_txt || null,
      }
    };
  } catch (error) {
    logger.error('Lá»—i khi láº¥y chi tiáº¿t journal:', error);
    throw error;
  }
};

/**
 * Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a má»™t journal trong database dá»±a trÃªn ID.
 * @async
 * @param {number|string} id - ID cá»§a journal cáº§n kiá»ƒm tra (cÃ³ thá»ƒ lÃ�  sá»‘ hoáº·c chuá»—i sá»‘).
 * @returns {Promise<boolean>} Tráº£ vá» true náº¿u journal tá»“n táº¡i vÃ�  chÆ°a bá»‹ xÃ³a má»m, false náº¿u khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ xÃ³a.
 * @throws {Error} NÃ©m lá»—i náº¿u cÃ³ lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh truy váº¥n database.
*/
export const journalExist = async (id) => {
  try {
    const query = `SELECT 1 FROM "Journal" WHERE journal_id = $1`;
    const result = await prisma.$queryRawUnsafe(query, id);
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi kiá»ƒm tra tá»“n táº¡i cá»§a journal vá»›i ID ${id}:`, error.message);
    throw error;
  }
}

/**
 * Táº¡o má»›i má»™t journal.
 *
 * @async
 * @param {Object} data - Dá»¯ liá»‡u journal cáº§n táº¡o.
 * @returns {Promise<Object>} Journal má»›i Ä‘Æ°á»£c táº¡o.
 */
export const createJournal = async (data) => {
  try {
    // Nháº­n cÃ¡c field tá»« object data truyá»n vÃ� o
    let {
      source_id, publisher_id, country, region, display_name,
      type, is_open_access, is_oa_diamond, coverage, issn, scope_detail, description
    } = data;

    // Chuáº©n hÃ³a dá»¯ liá»‡u sang null náº¿u trá»‘ng
    source_id = source_id || null;
    publisher_id = publisher_id || null;
    country = country || null;
    region = region || null;
    display_name = display_name || null;
    type = type || null;
    is_open_access = is_open_access ?? null;
    is_oa_diamond = is_oa_diamond ?? null;
    coverage = coverage || scope_detail || description || null;
    issn = issn || null;
    const is_deleted = false; 

    const query = `
        INSERT INTO "Journal" (
            source_id, publisher_id, country, region, display_name,
            type, is_open_access, is_oa_diamond, coverage, issn, is_deleted
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
    `;

    const values = [
        source_id,
        publisher_id ? BigInt(publisher_id) : null,
        country ? BigInt(country) : null,
        region ? BigInt(region) : null,
        display_name, type, is_open_access, is_oa_diamond, coverage, issn, is_deleted
    ];

    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result[0];

  } catch (error) {
    throw error;
  }
};

//viáº¿t documentation cho hÃ� m updateJournal
/**
  * Cáº­p nháº­t thÃ´ng tin má»™t journal.
  * - Nháº­n ID cá»§a journal cáº§n cáº­p nháº­t vÃ�  dá»¯ liá»‡u má»›i tá»« tham sá»‘ Ä‘áº§u vÃ� o.
  * - Kiá»ƒm tra tÃ­nh há»£p lá»‡ cá»§a ID (pháº£i lÃ�  sá»‘ nguyÃªn dÆ°Æ¡ng).
  * - Cáº­p nháº­t cÃ¡c trÆ°á»ng Ä‘Æ°á»£c phÃ©p trong database náº¿u chÃºng tá»“n táº¡i trong dá»¯ liá»‡u má»›i.
  * - Tráº£ vá» thÃ´ng tin journal Ä‘Ã£ cáº­p nháº­t náº¿u thÃ� nh cÃ´ng, hoáº·c null náº¿u khÃ´ng tÃ¬m tháº¥y journal vá»›i ID Ä‘Ã³, hoáº·c lá»—i náº¿u cÃ³ lá»—i há»‡ thá»‘ng.
  * CÃ¡c trÆ°á»ng Ä‘Æ°á»£c phÃ©p cáº­p nháº­t bao gá»“m: source_id, publisher_id, country, region, display_name, type, is_open_access, is_oa_diamond, coverage, issn. Náº¿u client gá»­i scope_detail/description thÃ¬ service sáº½ Ã¡nh xáº¡ sang coverage vÃ¬ schema hiá»‡n táº¡i khÃ´ng cÃ³ cá»™t scope_detail. CÃ¡c trÆ°á»ng publisher_id, country, region sáº½ Ä‘Æ°á»£c chuyá»ƒn sang kiá»ƒu BigInt trÆ°á»›c khi cáº­p nháº­t.
  * @async
  * @param {number|string} id - ID cá»§a journal cáº§n cáº­p nháº­t (cÃ³ thá»ƒ lÃ�  sá»‘ hoáº·c chuá»—i sá»‘).
  * @param {Object} data - Dá»¯ liá»‡u má»›i Ä‘á»ƒ cáº­p nháº­t cho journal, cÃ³ thá»ƒ chá»©a má»™t hoáº·c nhiá»u trÆ°á»ng trong sá»‘ cÃ¡c trÆ°á»ng Ä‘Æ°á»£c phÃ©p cáº­p nháº­t.
  * @returns {Promise<Object|null>} ThÃ´ng tin journal Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t náº¿u thÃ� nh cÃ´ng, null náº¿u khÃ´ng tÃ¬m tháº¥y journal vá»›i ID Ä‘Ã³, hoáº·c lá»—i náº¿u cÃ³ lá»—i há»‡ thá»‘ng.
*/ 
export const updateJournal = async (id, data) => {
  try {
    const normalizedData = { ...data };
    if (normalizedData.coverage === undefined) {
      normalizedData.coverage = normalizedData.scope_detail ?? normalizedData.description;
    }

    const allowedFields = [
      'source_id', 'publisher_id', 'country', 'region', 'display_name',
      'type', 'is_open_access', 'is_oa_diamond', 'coverage', 'issn'
    ];

    const updateParts = [];
    const values = [];
    let placeholderIndex = 1;

    for (const field of allowedFields) {
      if (normalizedData[field] !== undefined && normalizedData[field] !== null) {
        let value = normalizedData[field];

        if (['publisher_id', 'country', 'region'].includes(field)) {
          value = BigInt(value);
        }

        updateParts.push(`"${field}" = $${placeholderIndex}`);
        values.push(value);
        placeholderIndex++;
      }
    }

    if (updateParts.length === 0) {
      logger.warn(`KhÃ´ng cÃ³ trÆ°á»ng nÃ� o há»£p lá»‡ Ä‘á»ƒ cáº­p nháº­t cho journal ID ${id}`);
      return null; 
    }

    values.push(BigInt(id));
    const idPlaceholder = `$${placeholderIndex}`;

    const query = `
        UPDATE "Journal" 
        SET ${updateParts.join(', ')}
        WHERE journal_id = ${idPlaceholder} AND is_deleted = false
        RETURNING *;
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);
    return result.length ? result[0] : null;

  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Ä‘á»™ng journal vá»›i ID ${id}:`, error.message);
    throw error;
  }
};

/**
 * XÃ³a má»m má»™t journal báº±ng cÃ¡ch cáº­p nháº­t trÆ°á»ng is_deleted.
 *
 * @async
 * @param {string|number} id - ID cá»§a journal cáº§n xÃ³a.
 * @returns {Promise<Object|null>} Journal Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t, hoáº·c null náº¿u khÃ´ng tÃ¬m tháº¥y.
 */
export const deleteJournal = async (id) => {
  try {
    const query = `
      UPDATE "Journal"
      SET is_deleted = true
      WHERE journal_id = $1 AND is_deleted = false
      RETURNING *;
    `;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));

    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a journal vá»›i ID ${id}:`, error.message);
    throw error;
  }
}

/**
 * KhÃ´i phá»¥c má»™t journal Ä‘Ã£ bá»‹ xÃ³a má»m báº±ng cÃ¡ch cáº­p nháº­t trÆ°á»ng is_deleted.
 * @async
 * @param {string|number} id - ID cá»§a journal cáº§n khÃ´i phá»¥c (cÃ³ thá»ƒ lÃ�  sá»‘ hoáº·c chuá»—i sá»‘).
 * @return {Promise<Object|null>} Tráº£ vá» journal Ä‘Ã£ Ä‘Æ°á»£c khÃ´i phá»¥c náº¿u thÃ� nh cÃ´ng, null náº¿u khÃ´ng tÃ¬m tháº¥y journal vá»›i ID Ä‘Ã³ hoáº·c Ä‘Ã£ Ä‘Æ°á»£c khÃ´i phá»¥c trÆ°á»›c Ä‘Ã³, hoáº·c lá»—i náº¿u cÃ³ lá»—i há»‡ thá»‘ng.
 */
export const restoreJournal = async (id) => {
  try {
    const query = `
      UPDATE "Journal"
      SET is_deleted = false
      WHERE journal_id = $1 AND is_deleted = true
      RETURNING *;
    `;
    const result = await prisma.$queryRawUnsafe(query, BigInt(id));
    return result.length ? result[0] : null;
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c journal vá»›i ID ${id}:`, error.message);
    throw error;
  }
}

/**
 * Láº¥y dá»¯ liá»‡u tá»•ng quan cho má»™t táº¡p chÃ­ (Repository Summary).
 * @async
 * @param {string|number} journalId - ID cá»§a táº¡p chÃ­.
 * @returns {Promise<Object>} Dá»¯ liá»‡u tá»•ng quan bao gá»“m total_volumes, active_issues, total_publications, next_release.
 */
export const getJournalRepositorySummary = async (journalId) => {
  try {
    const id = BigInt(journalId);

    const query = `
      SELECT 
        (
          SELECT COUNT(*)::integer 
          FROM "Volume" 
          WHERE journal_id = $1 AND is_deleted = false
        ) AS total_volumes,
        
        (
          SELECT COUNT(i.issue_id)::integer 
          FROM "Issue" i
          JOIN "Volume" v ON i.volume_id = v.volume_id
          WHERE v.journal_id = $1 AND i.is_deleted = false
        ) AS active_issues,
        
        (
          SELECT COUNT(a.article_id)::integer 
          FROM "Article" a
          JOIN "Issue" i ON a.issue_id = i.issue_id
          JOIN "Volume" v ON i.volume_id = v.volume_id
          WHERE v.journal_id = $1 AND a.is_deleted = false
        ) AS total_publications,
        
        (
          SELECT MIN(i.publication_year)::integer 
          FROM "Issue" i
          JOIN "Volume" v ON i.volume_id = v.volume_id
          WHERE v.journal_id = $1 AND i.is_deleted = false AND i.publication_year > EXTRACT(YEAR FROM NOW())
        ) AS next_release;
    `;

    // Chá»‰ gá»i pool.query ÄÃšNG 1 Láº¦N -> Chá»‰ tá»‘n 1 káº¿t ná»‘i
    const result = await prisma.$queryRawUnsafe(query, id);

    return result[0] || {
      total_volumes: 0,
      active_issues: 0,
      total_publications: 0,
      next_release: null
    };

  } catch (error) {
    logger.error(`Lá»—i khi láº¥y repository summary cho journal ID ${journalId}:`, error);
    throw error;
  }
};





