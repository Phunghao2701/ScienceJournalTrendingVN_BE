export const ARTICLE_SCOPES = Object.freeze({
  ALL: 'all',
  VN_UNIVERSITIES: 'vn_universities',
});

export const ARTICLE_SORT_COLUMNS = Object.freeze({
  article_id: 'a."article_id"',
  title: 'a."title"',
  publication_year: 'a."publication_year"',
  created_at: 'a."created_at"',
  doi: 'a."doi"',
  citation_count: 'a."citation_count"',
  reference_count: 'a."reference_count"',
});

export const normalizeArticleScope = (scope = ARTICLE_SCOPES.ALL) => {
  const normalized = String(scope || ARTICLE_SCOPES.ALL).trim().toLowerCase();
  if (!Object.values(ARTICLE_SCOPES).includes(normalized)) {
    const error = new Error("Tham số 'scope' phải là 'all' hoặc 'vn_universities'.");
    error.statusCode = 400;
    error.code = 'INVALID_SCOPE';
    throw error;
  }
  return normalized;
};

export const normalizeAccessFilter = ({ access, isOpenAccess } = {}) => {
  if (access !== undefined && access !== null && String(access).trim() !== '') {
    const normalized = String(access).trim().toLowerCase();
    if (normalized === 'all') return undefined;
    if (normalized === 'oa') return true;
    if (normalized === 'closed') return false;

    const error = new Error("Tham số 'access' phải là 'oa' hoặc 'closed'.");
    error.statusCode = 400;
    error.code = 'INVALID_ACCESS';
    throw error;
  }

  if (isOpenAccess === undefined || isOpenAccess === null || String(isOpenAccess).trim() === '') {
    return undefined;
  }

  const normalized = String(isOpenAccess).trim().toLowerCase();
  if (normalized === 'all') return undefined;
  if (['true', '1', 'oa'].includes(normalized)) return true;
  if (['false', '0', 'closed'].includes(normalized)) return false;

  const error = new Error("Tham số 'is_open_access' phải là boolean, 'oa', hoặc 'closed'.");
  error.statusCode = 400;
  error.code = 'INVALID_ACCESS';
  throw error;
};

export const normalizeArticleSort = (sortBy = 'created_at', sortOrder = 'DESC', {
  allowedColumns = ARTICLE_SORT_COLUMNS,
  defaultSort = 'created_at',
  throwOnInvalid = false,
} = {}) => {
  const requestedSort = String(sortBy || defaultSort).trim();
  if (!allowedColumns[requestedSort]) {
    if (throwOnInvalid) {
      const error = new Error(`Tham số 'sortBy' không hợp lệ.`);
      error.statusCode = 400;
      error.code = 'INVALID_SORT_BY';
      throw error;
    }
    return {
      column: allowedColumns[defaultSort],
      sortBy: defaultSort,
      sortOrder: normalizeSortOrder(sortOrder),
    };
  }

  return {
    column: allowedColumns[requestedSort],
    sortBy: requestedSort,
    sortOrder: normalizeSortOrder(sortOrder),
  };
};

export const normalizeSortOrder = (sortOrder = 'DESC') => {
  const order = String(sortOrder || 'DESC').trim().toUpperCase();
  if (!['ASC', 'DESC'].includes(order)) {
    const error = new Error("Tham số 'sortOrder' phải là 'asc' hoặc 'desc'.");
    error.statusCode = 400;
    error.code = 'INVALID_SORT_ORDER';
    throw error;
  }
  return order;
};

export const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const toOptionalPositiveInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Tham số '${fieldName}' phải là số nguyên dương.`);
    error.statusCode = 400;
    error.code = 'INVALID_ENTITY_ID';
    throw error;
  }

  return parsed;
};

export const buildArticleFilter = ({
  search = '',
  publicationYear,
  journalId,
  topicId,
  publisherId,
  authorId,
  keywordId,
  institutionId,
  volumeId,
  issueId,
  access,
  isOpenAccess,
  countryId,
  scope = ARTICLE_SCOPES.ALL,
} = {}, {
  articleAlias = 'a',
  journalAlias = 'j',
  volumeAlias = 'v',
} = {}) => {
  const values = [];
  const where = [`${articleAlias}."is_deleted" = false`];
  const resolvedScope = normalizeArticleScope(scope);
  const resolvedAccess = normalizeAccessFilter({ access, isOpenAccess });

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    values.push(`%${trimmedSearch}%`);
    const placeholder = `$${values.length}`;
    where.push(`(
      ${articleAlias}."title" ILIKE ${placeholder}
      OR ${articleAlias}."doi" ILIKE ${placeholder}
      OR ${articleAlias}."abstract" ILIKE ${placeholder}
      OR ${journalAlias}."display_name" ILIKE ${placeholder}
      OR ${journalAlias}."issn" ILIKE ${placeholder}
      OR REPLACE(COALESCE(${journalAlias}."issn", ''), '-', '') ILIKE REPLACE(${placeholder}, '-', '')
      OR EXISTS (
        SELECT 1
        FROM "Publisher" search_publisher
        WHERE search_publisher."publisher_id" = ${journalAlias}."publisher_id"
          AND search_publisher."display_name" ILIKE ${placeholder}
      )
      OR EXISTS (
        SELECT 1
        FROM "Author_Article" search_aa
        JOIN "Author" search_author ON search_author."author_id" = search_aa."author_id"
        WHERE search_aa."article_id" = ${articleAlias}."article_id"
          AND COALESCE(search_author."is_deleted", false) = false
          AND search_author."display_name" ILIKE ${placeholder}
      )
      OR EXISTS (
        SELECT 1
        FROM "Keyword_Article" search_ka
        JOIN "Keyword" search_keyword ON search_keyword."keyword_id" = search_ka."keyword_id"
        WHERE search_ka."article_id" = ${articleAlias}."article_id"
          AND search_keyword."display_name" ILIKE ${placeholder}
      )
      OR EXISTS (
        SELECT 1
        FROM "Topic" search_primary_topic
        WHERE search_primary_topic."topic_id" = ${articleAlias}."primary_topic"
          AND COALESCE(search_primary_topic."is_deleted", false) = false
          AND search_primary_topic."display_name" ILIKE ${placeholder}
      )
      OR EXISTS (
        SELECT 1
        FROM "Sub_Topic" search_st
        JOIN "Topic" search_topic ON search_topic."topic_id" = search_st."topic_id"
        WHERE search_st."article_id" = ${articleAlias}."article_id"
          AND COALESCE(search_topic."is_deleted", false) = false
          AND search_topic."display_name" ILIKE ${placeholder}
      )
    )`);
  }

  const publicationYearNum = toOptionalNumber(publicationYear);
  if (publicationYearNum !== undefined) {
    values.push(publicationYearNum);
    where.push(`${articleAlias}."publication_year" = $${values.length}`);
  }

  const journalIdNum = toOptionalNumber(journalId);
  if (journalIdNum !== undefined) {
    values.push(journalIdNum);
    where.push(`${journalAlias}."journal_id" = $${values.length}`);
  }

  const topicIdNum = toOptionalNumber(topicId);
  if (topicIdNum !== undefined) {
    values.push(topicIdNum);
    const topicPlaceholder = `$${values.length}`;
    where.push(`(
      ${articleAlias}."primary_topic" = ${topicPlaceholder}
      OR EXISTS (
        SELECT 1
        FROM "Sub_Topic" filter_st
        JOIN "Topic" filter_st_topic ON filter_st_topic."topic_id" = filter_st."topic_id"
        WHERE filter_st."article_id" = ${articleAlias}."article_id"
          AND filter_st."topic_id" = ${topicPlaceholder}
          AND COALESCE(filter_st_topic."is_deleted", false) = false
      )
    )`);
  }

  const publisherIdNum = toOptionalPositiveInteger(publisherId, 'publisher_id');
  if (publisherIdNum !== undefined) {
    values.push(publisherIdNum);
    where.push(`${journalAlias}."publisher_id" = $${values.length}`);
  }

  const authorIdNum = toOptionalPositiveInteger(authorId, 'author_id');
  if (authorIdNum !== undefined) {
    values.push(authorIdNum);
    where.push(`EXISTS (
      SELECT 1
      FROM "Author_Article" filter_aa
      JOIN "Author" filter_author ON filter_author."author_id" = filter_aa."author_id"
      WHERE filter_aa."article_id" = ${articleAlias}."article_id"
        AND filter_aa."author_id" = $${values.length}
        AND COALESCE(filter_author."is_deleted", false) = false
    )`);
  }

  const keywordIdNum = toOptionalPositiveInteger(keywordId, 'keyword_id');
  if (keywordIdNum !== undefined) {
    values.push(keywordIdNum);
    where.push(`EXISTS (
      SELECT 1
      FROM "Keyword_Article" filter_ka
      WHERE filter_ka."article_id" = ${articleAlias}."article_id"
        AND filter_ka."keyword_id" = $${values.length}
    )`);
  }

  const institutionIdNum = toOptionalPositiveInteger(institutionId, 'institution_id');
  if (institutionIdNum !== undefined) {
    values.push(institutionIdNum);
    where.push(`EXISTS (
      SELECT 1
      FROM "Author_Article" filter_aia
      JOIN "Author" filter_inst_author ON filter_inst_author."author_id" = filter_aia."author_id"
      JOIN "Institution_Author" filter_ia ON filter_ia."author_id" = filter_aia."author_id"
        AND filter_ia."year" = ${articleAlias}."publication_year"
      JOIN "Institution" filter_inst ON filter_inst."institution_id" = filter_ia."institution_id"
      WHERE filter_aia."article_id" = ${articleAlias}."article_id"
        AND COALESCE(filter_inst_author."is_deleted", false) = false
        AND COALESCE(filter_inst."is_deleted", false) = false
        AND filter_inst."institution_id" = $${values.length}
    )`);
  }

  const volumeIdNum = toOptionalNumber(volumeId);
  if (volumeIdNum !== undefined) {
    values.push(volumeIdNum);
    where.push(`${volumeAlias}."volume_id" = $${values.length}`);
  }

  const issueIdNum = toOptionalNumber(issueId);
  if (issueIdNum !== undefined) {
    values.push(issueIdNum);
    where.push(`${articleAlias}."issue_id" = $${values.length}`);
  }

  if (resolvedAccess !== undefined) {
    where.push(`${articleAlias}."is_open_access" IS ${resolvedAccess ? 'TRUE' : 'FALSE'}`);
  }

  if (countryId) {
    values.push(Number(countryId));
    where.push(`${journalAlias}."country" = $${values.length}`);
  }

  if (resolvedScope === ARTICLE_SCOPES.VN_UNIVERSITIES) {
    where.push(`${articleAlias}."is_vn_journal" IS TRUE`);
  }

  return {
    values,
    where,
    whereSql: where.join(' AND '),
    scope: resolvedScope,
    access: resolvedAccess,
  };
};
