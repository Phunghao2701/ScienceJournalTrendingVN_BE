import prisma from '../../../config/prisma.js';

/**
 * Láº¥y danh sÃ¡ch cÃ¡c lÄ©nh vá»±c lá»›n (Subject Area) trong há»‡ thá»‘ng.
 *
 * @async
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch cÃ¡c subject areas.
 */
export const getSubjectAreas = async () => {
  const query = `
    SELECT 
      subject_area_id::text AS subject_area_id,
      display_name,
      description
    FROM "Subject_Area"
    ORDER BY display_name ASC
  `;
  const res = await prisma.$queryRawUnsafe(query);
  return res;
};

/**
 * Láº¥y danh sÃ¡ch chuyÃªn ngÃ nh háº¹p (Subject Category), cÃ³ há»— trá»£ lá»c theo Subject Area.
 *
 * @async
 * @param {Object} params - Tham sá»‘ lá»c.
 * @param {string} [params.subjectAreaId] - ID cá»§a lÄ©nh vá»±c lá»›n cáº§n lá»c.
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch chuyÃªn ngÃ nh háº¹p.
 */
export const getSubjectCategories = async ({ subjectAreaId } = {}) => {
  let query = `
    SELECT 
      subject_category_id::text AS subject_category_id,
      subject_area_id::text AS subject_area_id,
      display_name,
      description
    FROM "Subject_Category"
  `;
  const params = [];

  if (subjectAreaId && subjectAreaId.trim() !== '') {
    params.push(subjectAreaId.trim());
    query += ` WHERE subject_area_id = $1`;
  }

  query += ` ORDER BY display_name ASC`;
  const res = await prisma.$queryRawUnsafe(query, ...params);
  return res;
};

/**
 * Láº¥y lá»‹ch sá»­ xáº¿p háº¡ng (ranking) cá»§a má»™t journal cá»¥ thá»ƒ kÃ¨m theo bá»™ lá»c Ä‘á»™ng.
 *
 * @async
 * @param {string} journalId - ID cá»§a journal cáº§n láº¥y lá»‹ch sá»­ ranking.
 * @param {Object} [filters] - CÃ¡c bá»™ lá»c bá»• sung.
 * @param {number|string} [filters.year] - NÄƒm cáº§n lá»c.
 * @param {string} [filters.metric_code] - MÃ£ chá»‰ sá»‘ (SJR, H_INDEX, RANK...).
 * @param {string} [filters.quartile] - PhÃ¢n háº¡ng cáº§n lá»c (Q1, Q2, Q3, Q4).
 * @param {string} [filters.source] - Nguá»“n dá»¯ liá»‡u (SCIMAGO, SCOPUS, WOS).
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch lá»‹ch sá»­ xáº¿p háº¡ng Ä‘Ã£ Ä‘á»‹nh dáº¡ng.
 * @throws {Error} Lá»—i 404 náº¿u journal khÃ´ng tá»“n táº¡i.
 */
export const getJournalRankings = async (journalId, filters = {}) => {
  // 1. Kiá»ƒm tra xem journal cÃ³ tá»“n táº¡i trong há»‡ thá»‘ng khÃ´ng
  const journalCheck = await prisma.$queryRawUnsafe(
    'SELECT 1 FROM "Journal" WHERE journal_id = $1',
    journalId
  );

  if (journalCheck.length === 0) {
    const error = new Error('Táº¡p chÃ­ khÃ´ng tá»“n táº¡i');
    error.statusCode = 404;
    throw error;
  }

  const rankingSourceSql = `'SCIMAGO'::text`;

  // 2. XÃ¢y dá»±ng cÃ¢u truy váº¥n Ä‘á»™ng láº¥y rankings
  let query = `
    SELECT 
      jr.journal_ranking_id::text AS journal_ranking_id,
      jr.journal_id::text AS journal_id,
      jr.year,
      ${rankingSourceSql} AS source,
      rm.code AS metric_code,
      rm.display_name AS metric_name,
      rm.metric_type,
      jr.value_txt,
      jr.value_float,
      jr.value_int,
      sc.subject_category_id::text AS subject_category_id,
      sc.display_name AS category_display_name
    FROM "Journal_Ranking" jr
    INNER JOIN "Ranking_Metric" rm ON rm.metric_id = jr.metric_id
    LEFT JOIN "Subject_Category" sc ON sc.subject_category_id = jr.subject_category_id
    WHERE jr.journal_id = $1
  `;

  const values = [journalId];
  let paramCount = 1;

  if (filters.year) {
    paramCount++;
    query += ` AND jr.year = $${paramCount}`;
    values.push(parseInt(filters.year, 10));
  }

  if (filters.metric_code && filters.metric_code.trim() !== '') {
    paramCount++;
    query += ` AND UPPER(rm.code) = UPPER($${paramCount})`;
    values.push(filters.metric_code.trim());
  }

  if (filters.quartile && filters.quartile.trim() !== '') {
    paramCount++;
    query += ` AND UPPER(jr.value_txt) = UPPER($${paramCount}) AND rm.metric_type = 'QUARTILE'`;
    values.push(filters.quartile.trim());
  }

  if (filters.source && filters.source.trim() !== '') {
    paramCount++;
    query += ` AND UPPER(${rankingSourceSql}) = UPPER($${paramCount})`;
    values.push(filters.source.trim());
  }

  query += ` ORDER BY jr.year DESC, rm.code ASC`;

  const res = await prisma.$queryRawUnsafe(query, ...values);

  // 3. Äá»‹nh dáº¡ng láº¡i trÆ°á»ng value dá»±a theo metric_type vÃ  nhÃ³m theo nÄƒm
  const list = res.map(row => {
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
      journal_ranking_id: row.journal_ranking_id,
      journal_id: row.journal_id,
      year: row.year,
      source: row.source,
      metric_code: row.metric_code,
      metric_name: row.metric_name,
      metric_type: row.metric_type,
      value,
      subject_category: row.subject_category_id ? {
        subject_category_id: row.subject_category_id,
        display_name: row.category_display_name
      } : null
    };
  });

  const grouped = {};
  for (const item of list) {
    const yr = String(item.year);
    if (!grouped[yr]) {
      grouped[yr] = [];
    }
    grouped[yr].push(item);
  }
  return grouped;
};

/**
 * Láº¥y danh sÃ¡ch Volume, há»— trá»£ lá»c theo journal_id.
 *
 * @async
 * @param {Object} [params] - Tham sá»‘ lá»c.
 * @param {string|number} [params.journalId] - ID cá»§a journal cáº§n lá»c.
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch Volume.
 */
export const getVolumes = async ({ journalId, page = 1, limit = 10 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;
  let query = `
    SELECT 
      v.volume_id::text AS volume_id,
      v.volume_id::text AS id,
      v.journal_id::text AS journal_id,
      j.display_name AS journal_name,
      v.volume_number,
      v.publication_year,
      v.publication_year AS year,
      COUNT(DISTINCT i.issue_id)::integer AS issue_count,
      COUNT(DISTINCT a.article_id)::integer AS article_count
    FROM "Volume" v
    LEFT JOIN "Journal" j ON j.journal_id = v.journal_id
    LEFT JOIN "Issue" i ON i.volume_id = v.volume_id
    LEFT JOIN "Article" a ON a.issue_id = i.issue_id
  `;
  const params = [];

  if (journalId) {
    query += ` WHERE v.journal_id = $1`;
    params.push(journalId);
  }

  query += `
    GROUP BY v.volume_id, v.journal_id, j.display_name, v.volume_number, v.publication_year
    ORDER BY v.publication_year DESC NULLS LAST, v.volume_number DESC NULLS LAST
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*)::integer AS total
    FROM "Volume" v
    ${journalId ? 'WHERE v.journal_id = $1' : ''}
  `;

  const [listRes, countRes] = await Promise.all([
    prisma.$queryRawUnsafe(query, ...params, limitNum, offset),
    prisma.$queryRawUnsafe(countQuery, ...params),
  ]);

  const total = Number(countRes[0]?.total || 0);
  return {
    items: listRes,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

/**
 * Láº¥y danh sÃ¡ch Issue, há»— trá»£ lá»c theo volume_id.
 *
 * @async
 * @param {Object} [params] - Tham sá»‘ lá»c.
 * @param {string|number} [params.volumeId] - ID cá»§a volume cáº§n lá»c.
 * @returns {Promise<Array<Object>>} Danh sÃ¡ch Issue.
 */
export const getIssues = async ({ volumeId, page = 1, limit = 10 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;
  let query = `
    SELECT 
      i.issue_id::text AS issue_id,
      i.issue_id::text AS id,
      i.volume_id::text AS volume_id,
      i.issue_number,
      i.publication_year,
      i.publication_year AS year,
      COUNT(DISTINCT a.article_id)::integer AS article_count
    FROM "Issue" i
    LEFT JOIN "Article" a ON a.issue_id = i.issue_id
  `;
  const params = [];

  if (volumeId) {
    query += ` WHERE i.volume_id = $1`;
    params.push(volumeId);
  }

  query += `
    GROUP BY i.issue_id, i.volume_id, i.issue_number, i.publication_year
    ORDER BY i.publication_year DESC NULLS LAST, i.issue_number DESC NULLS LAST
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*)::integer AS total
    FROM "Issue" i
    ${volumeId ? 'WHERE i.volume_id = $1' : ''}
  `;

  const [listRes, countRes] = await Promise.all([
    prisma.$queryRawUnsafe(query, ...params, limitNum, offset),
    prisma.$queryRawUnsafe(countQuery, ...params),
  ]);

  const total = Number(countRes[0]?.total || 0);
  return {
    items: listRes,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};


