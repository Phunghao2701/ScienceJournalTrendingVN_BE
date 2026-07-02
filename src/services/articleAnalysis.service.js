import pool from '../config/database.js';
import { buildArticleFilter } from './articleFilter.service.js';

const DEFAULT_WINDOW_YEARS = 2;
const MIN_ANALYSIS_YEAR = 1800;
const MAX_ANALYSIS_WINDOW_YEARS = 25;

const makeAnalysisError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_ANALYSIS_WINDOW';
  return error;
};

const parseYear = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw makeAnalysisError(`Tham so '${fieldName}' phai la nam nguyen hop le.`);
  }
  const maxYear = new Date().getFullYear() + 1;
  if (parsed < MIN_ANALYSIS_YEAR || parsed > maxYear) {
    throw makeAnalysisError(`Tham so '${fieldName}' phai nam trong khoang ${MIN_ANALYSIS_YEAR}-${maxYear}.`);
  }
  return parsed;
};

const buildYears = (fromYear, toYear) => {
  if (fromYear === null || toYear === null) return [];
  const length = toYear - fromYear + 1;
  if (length < 0 || length > MAX_ANALYSIS_WINDOW_YEARS * 2) {
    throw makeAnalysisError(`Do dai cua khoang nam phan tich khong duoc vuot qua ${MAX_ANALYSIS_WINDOW_YEARS} nam.`);
  }
  const years = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    years.push(year);
  }
  return years;
};

export const buildAnalysisFilter = (params = {}) => {
  const {
    fromYear,
    toYear,
    current_from_year,
    current_to_year,
    publicationYear,
    publication_year,
    year,
    ...filterParams
  } = params;

  return buildArticleFilter({
    ...filterParams,
    publicationYear: undefined,
  });
};

export const resolveAnalysisWindows = async (params = {}) => {
  const explicitFrom = parseYear(params.fromYear ?? params.current_from_year ?? params.from_year, 'from_year');
  const explicitTo = parseYear(params.toYear ?? params.current_to_year ?? params.to_year, 'to_year');

  if ((explicitFrom === undefined) !== (explicitTo === undefined)) {
    throw makeAnalysisError("Tham so 'from_year' va 'to_year' phai duoc truyen cung nhau.");
  }

  if (explicitFrom !== undefined) {
    if (explicitFrom > explicitTo) {
      throw makeAnalysisError("Tham so 'from_year' phai nho hon hoac bang 'to_year'.");
    }
    const length = explicitTo - explicitFrom + 1;
    if (length > MAX_ANALYSIS_WINDOW_YEARS) {
      throw makeAnalysisError(`Do dai cua khoang nam phan tich khong duoc vuot qua ${MAX_ANALYSIS_WINDOW_YEARS} nam.`);
    }
    const comparisonTo = explicitFrom - 1;
    const comparisonFrom = comparisonTo - length + 1;
    return {
      current: { from_year: explicitFrom, to_year: explicitTo },
      comparison: { from_year: comparisonFrom, to_year: comparisonTo },
      years: buildYears(comparisonFrom, explicitTo),
      mode: 'explicit',
    };
  }

  const publicationYear = parseYear(
    params.publicationYear ?? params.publication_year ?? params.year,
    'publication_year',
  );
  if (publicationYear !== undefined) {
    return {
      current: { from_year: publicationYear, to_year: publicationYear },
      comparison: { from_year: publicationYear - 1, to_year: publicationYear - 1 },
      years: [publicationYear - 1, publicationYear],
      mode: 'publication_year',
    };
  }

  const filter = buildAnalysisFilter(params);
  const result = await pool.query(
    `
      SELECT MAX(a."publication_year")::integer AS "to_year"
      FROM "Article" a
      LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
      LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
      LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
      WHERE ${filter.whereSql}
        AND a."publication_year" IS NOT NULL;
    `,
    filter.values,
  );

  const toYear = result.rows[0]?.to_year ? Number(result.rows[0].to_year) : null;
  if (!toYear) {
    return {
      current: { from_year: null, to_year: null },
      comparison: { from_year: null, to_year: null },
      years: [],
      mode: 'empty',
    };
  }

  const fromYear = toYear - DEFAULT_WINDOW_YEARS + 1;
  const comparisonTo = fromYear - 1;
  const comparisonFrom = comparisonTo - DEFAULT_WINDOW_YEARS + 1;
  return {
    current: { from_year: fromYear, to_year: toYear },
    comparison: { from_year: comparisonFrom, to_year: comparisonTo },
    years: buildYears(comparisonFrom, toYear),
    mode: 'default_latest',
  };
};

const normalizeLimit = (value, fallback = 10, max = 50) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const filteredArticlesCte = (filter) => `
  filtered_articles AS (
    SELECT DISTINCT
      a."article_id",
      a."title",
      a."publication_year",
      a."citation_count",
      a."reference_count",
      a."citations_by_year",
      a."is_open_access",
      a."primary_topic",
      j."journal_id",
      j."display_name" AS "journal_name",
      j."issn" AS "journal_issn"
    FROM "Article" a
    LEFT JOIN "Issue" i   ON i."issue_id"   = a."issue_id" AND COALESCE(i."is_deleted", false) = false
    LEFT JOIN "Volume" v  ON v."volume_id"  = i."volume_id" AND COALESCE(v."is_deleted", false) = false
    LEFT JOIN "Journal" j ON j."journal_id" = v."journal_id" AND COALESCE(j."is_deleted", false) = false
    WHERE ${filter.whereSql}
  )
`;

const appendWindowValues = (values, window, limit) => {
  const next = [...values];
  next.push(window.current.from_year);
  const currentFrom = next.length;
  next.push(window.current.to_year);
  const currentTo = next.length;
  next.push(window.comparison.from_year);
  const comparisonFrom = next.length;
  next.push(window.comparison.to_year);
  const comparisonTo = next.length;
  let limitIndex;
  if (limit !== undefined) {
    next.push(limit);
    limitIndex = next.length;
  }
  return {
    values: next,
    currentFrom,
    currentTo,
    comparisonFrom,
    comparisonTo,
    limitIndex,
  };
};

const zeroFill = (years, rows, valueFactory) => {
  const byYear = new Map(rows.map((row) => [Number(row.year), row]));
  return years.map((year) => valueFactory(year, byYear.get(year)));
};

const mapGrowthRows = (rows) => rows.map((row, index) => ({
  rank: index + 1,
  ...row,
  growth_rate: row.growth_rate === undefined ? null : row.growth_rate,
}));

const entityQuery = (filter, entity, window, limit, ranking = 'top') => {
  const prepared = appendWindowValues(filter.values, window, limit);
  const base = filteredArticlesCte(filter);
  const orderSql = ranking === 'growth'
    ? 'ORDER BY "absolute_growth" DESC, "current_count" DESC, "display_name" ASC'
    : 'ORDER BY "current_count" DESC, "absolute_growth" DESC, "display_name" ASC';
  const articleCountSql = `
    COUNT(DISTINCT relation."article_id") FILTER (
      WHERE relation."publication_year" BETWEEN $${prepared.currentFrom} AND $${prepared.currentTo}
    )::integer AS "current_count",
    COUNT(DISTINCT relation."article_id") FILTER (
      WHERE relation."publication_year" BETWEEN $${prepared.comparisonFrom} AND $${prepared.comparisonTo}
    )::integer AS "previous_count"
  `;

  const relationSqlByEntity = {
    institutions: `
      SELECT DISTINCT
        fa."article_id",
        fa."publication_year",
        inst."institution_id"::text AS "entity_id",
        inst."display_name"
      FROM filtered_articles fa
      JOIN "Author_Article" aa ON aa."article_id" = fa."article_id"
      JOIN "Author" au ON au."author_id" = aa."author_id" AND COALESCE(au."is_deleted", false) = false
      JOIN "Institution_Author" ia ON ia."author_id" = aa."author_id" AND ia."year" = fa."publication_year"
      JOIN "Institution" inst ON inst."institution_id" = ia."institution_id" AND COALESCE(inst."is_deleted", false) = false
      WHERE fa."publication_year" BETWEEN $${prepared.comparisonFrom} AND $${prepared.currentTo}
        ${filter.scope === 'vn_universities' ? 'AND UPPER(TRIM(inst."country_code")) = \'VN\' AND LOWER(TRIM(inst."type")) = \'education\'' : ''}
    `,
    authors: `
      SELECT DISTINCT
        fa."article_id",
        fa."publication_year",
        au."author_id"::text AS "entity_id",
        au."display_name"
      FROM filtered_articles fa
      JOIN "Author_Article" aa ON aa."article_id" = fa."article_id"
      JOIN "Author" au ON au."author_id" = aa."author_id" AND COALESCE(au."is_deleted", false) = false
      WHERE fa."publication_year" BETWEEN $${prepared.comparisonFrom} AND $${prepared.currentTo}
    `,
    journals: `
      SELECT DISTINCT
        fa."article_id",
        fa."publication_year",
        fa."journal_id"::text AS "entity_id",
        fa."journal_name" AS "display_name"
      FROM filtered_articles fa
      WHERE fa."journal_id" IS NOT NULL
        AND fa."publication_year" BETWEEN $${prepared.comparisonFrom} AND $${prepared.currentTo}
    `,
    topics: `
      SELECT DISTINCT
        fa."article_id",
        fa."publication_year",
        t."topic_id"::text AS "entity_id",
        t."display_name"
      FROM filtered_articles fa
      JOIN (
        SELECT "article_id", "topic_id" FROM "Sub_Topic"
        UNION
        SELECT "article_id", "primary_topic" AS "topic_id"
        FROM "Article"
        WHERE "primary_topic" IS NOT NULL
      ) article_topics ON article_topics."article_id" = fa."article_id"
      JOIN "Topic" t ON t."topic_id" = article_topics."topic_id" AND COALESCE(t."is_deleted", false) = false
      WHERE fa."publication_year" BETWEEN $${prepared.comparisonFrom} AND $${prepared.currentTo}
    `,
    keywords: `
      SELECT DISTINCT
        fa."article_id",
        fa."publication_year",
        k."keyword_id"::text AS "entity_id",
        k."display_name"
      FROM filtered_articles fa
      JOIN "Keyword_Article" ka ON ka."article_id" = fa."article_id"
      JOIN "Keyword" k ON k."keyword_id" = ka."keyword_id"
      WHERE fa."publication_year" BETWEEN $${prepared.comparisonFrom} AND $${prepared.currentTo}
    `,
  };

  const sql = `
    WITH ${base},
    relation AS (
      ${relationSqlByEntity[entity]}
    ),
    counts AS (
      SELECT
        relation."entity_id",
        relation."display_name",
        ${articleCountSql}
      FROM relation
      GROUP BY relation."entity_id", relation."display_name"
    )
    SELECT
      "entity_id",
      "display_name",
      "current_count",
      "previous_count",
      ("current_count" - "previous_count")::integer AS "absolute_growth",
      CASE
        WHEN "previous_count" = 0 THEN NULL
        ELSE ROUND((("current_count" - "previous_count")::numeric / "previous_count"), 4)::float
      END AS "growth_rate"
    FROM counts
    WHERE "current_count" > 0 OR "previous_count" > 0
    ${orderSql}
    LIMIT $${prepared.limitIndex};
  `;

  return { sql, values: prepared.values };
};

export const getArticleAnalysis = async (params = {}) => {
  const window = await resolveAnalysisWindows(params);
  const filter = buildAnalysisFilter(params);
  const limit = normalizeLimit(params.limit, 10, 50);
  const emptySeries = {
    summary: {
      scholarly_works: 0,
      total_citations: 0,
      total_references: 0,
      available_citing_works: 0,
      available_references: 0,
      authors: 0,
      institutions: 0,
      journals: 0,
      open_access_works: 0,
      closed_access_works: 0,
      oa_unavailable_works: 0,
    },
    works_over_time: window.years.map((year) => ({ year, count: 0 })),
    citations_over_time: window.years.map((year) => ({
      year,
      citations: 0,
      coverage_articles: 0,
      total_articles_with_history: 0,
    })),
  };

  if (window.mode === 'empty') {
    return {
      scope: filter.scope,
      window,
      ...emptySeries,
      top: { institutions: [], authors: [], journals: [], topics: [], keywords: [] },
      growth: { institutions: [], authors: [], journals: [], topics: [], keywords: [] },
      trending_articles: [],
      trending_article_coverage: { eligible_articles: 0, total_articles: 0 },
    };
  }

  const preparedWindow = appendWindowValues(filter.values, window);
  const base = filteredArticlesCte(filter);
  const currentWhere = `fa."publication_year" BETWEEN $${preparedWindow.currentFrom} AND $${preparedWindow.currentTo}`;
  const fullWhere = `fa."publication_year" BETWEEN $${preparedWindow.comparisonFrom} AND $${preparedWindow.currentTo}`;
  const windowParamsCte = `
    window_params AS (
      SELECT
        $${preparedWindow.currentFrom}::integer AS "current_from",
        $${preparedWindow.currentTo}::integer AS "current_to",
        $${preparedWindow.comparisonFrom}::integer AS "comparison_from",
        $${preparedWindow.comparisonTo}::integer AS "comparison_to"
    )
  `;

  const summaryQuery = `
    WITH ${base},
    current_articles AS (
      SELECT * FROM filtered_articles fa WHERE ${currentWhere}
    ),
    ${windowParamsCte},
    summary_window AS (
      SELECT 1 FROM window_params
    ),
    article_totals AS (
      SELECT
        COUNT(DISTINCT ca."article_id")::integer AS "scholarly_works",
        COALESCE(SUM(ca."citation_count"), 0)::integer AS "total_citations",
        COALESCE(SUM(ca."reference_count"), 0)::integer AS "total_references",
        COUNT(DISTINCT ca."journal_id") FILTER (WHERE ca."journal_id" IS NOT NULL)::integer AS "journals",
        COUNT(DISTINCT ca."article_id") FILTER (WHERE ca."is_open_access" IS TRUE)::integer AS "open_access_works",
        COUNT(DISTINCT ca."article_id") FILTER (WHERE ca."is_open_access" IS FALSE)::integer AS "closed_access_works",
        COUNT(DISTINCT ca."article_id") FILTER (WHERE ca."is_open_access" IS NULL)::integer AS "oa_unavailable_works"
      FROM current_articles ca
    ),
    citing_work_rows AS (
      SELECT DISTINCT
        ca."article_id",
        acw."openalex_work_id"
      FROM current_articles ca
      JOIN "Article_Citing_Work" acw ON acw."article_id" = ca."article_id"
      WHERE acw."openalex_work_id" IS NOT NULL
    ),
    citing_work_totals AS (
      SELECT COUNT(*)::integer AS "available_citing_works"
      FROM citing_work_rows
    ),
    reference_rows AS (
      SELECT DISTINCT
        ca."article_id",
        ar."reference_key"
      FROM current_articles ca
      JOIN "Article_Reference" ar ON ar."article_id" = ca."article_id"
      WHERE ar."reference_key" IS NOT NULL
    ),
    reference_totals AS (
      SELECT COUNT(*)::integer AS "available_references"
      FROM reference_rows
    ),
    valid_author_rows AS (
      SELECT DISTINCT
        ca."article_id",
        ca."publication_year",
        au."author_id"
      FROM current_articles ca
      JOIN "Author_Article" aa ON aa."article_id" = ca."article_id"
      JOIN "Author" au ON au."author_id" = aa."author_id" AND COALESCE(au."is_deleted", false) = false
    ),
    author_totals AS (
      SELECT COUNT(DISTINCT "author_id")::integer AS "authors"
      FROM valid_author_rows
    ),
    institution_rows AS (
      SELECT DISTINCT
        var."article_id",
        inst."institution_id"
      FROM valid_author_rows var
      JOIN "Institution_Author" ia ON ia."author_id" = var."author_id" AND ia."year" = var."publication_year"
      JOIN "Institution" inst ON inst."institution_id" = ia."institution_id"
        AND COALESCE(inst."is_deleted", false) = false
        ${filter.scope === 'vn_universities' ? 'AND UPPER(TRIM(inst."country_code")) = \'VN\' AND LOWER(TRIM(inst."type")) = \'education\'' : ''}
    ),
    institution_totals AS (
      SELECT COUNT(DISTINCT "institution_id")::integer AS "institutions"
      FROM institution_rows
    )
    SELECT
      article_totals."scholarly_works",
      article_totals."total_citations",
      article_totals."total_references",
      citing_work_totals."available_citing_works",
      reference_totals."available_references",
      author_totals."authors",
      institution_totals."institutions",
      article_totals."journals",
      article_totals."open_access_works",
      article_totals."closed_access_works",
      article_totals."oa_unavailable_works"
    FROM article_totals
    CROSS JOIN citing_work_totals
    CROSS JOIN reference_totals
    CROSS JOIN author_totals
    CROSS JOIN institution_totals;
  `;

  const worksQuery = `
    WITH ${base},
    ${windowParamsCte}
    SELECT fa."publication_year"::integer AS "year", COUNT(DISTINCT fa."article_id")::integer AS "count"
    FROM filtered_articles fa
    WHERE ${fullWhere}
    GROUP BY fa."publication_year"
    ORDER BY fa."publication_year" ASC;
  `;

  const citationsQuery = `
    WITH ${base},
    ${windowParamsCte},
    history_articles AS (
      SELECT fa."article_id", fa."citations_by_year"
      FROM filtered_articles fa
      WHERE fa."citations_by_year" IS NOT NULL
        AND jsonb_typeof(fa."citations_by_year"::jsonb) = 'object'
    ),
    citation_years AS (
      SELECT
        (history.key)::integer AS "year",
        SUM((history.value)::integer)::integer AS "citations",
        COUNT(DISTINCT a."article_id")::integer AS "coverage_articles"
      FROM history_articles a
      JOIN LATERAL jsonb_each_text(a."citations_by_year"::jsonb) AS history(key, value) ON true
      WHERE history.key ~ '^\\d{4}$'
        AND history.value ~ '^-?\\d+$'
        AND (history.key)::integer BETWEEN $${preparedWindow.comparisonFrom} AND $${preparedWindow.currentTo}
      GROUP BY (history.key)::integer
    ),
    coverage AS (
      SELECT COUNT(DISTINCT "article_id")::integer AS "total_articles_with_history"
      FROM history_articles
    ),
    year_series AS (
      SELECT generate_series($${preparedWindow.comparisonFrom}, $${preparedWindow.currentTo})::integer AS "year"
    )
    SELECT
      year_series."year",
      COALESCE(cy."citations", 0)::integer AS "citations",
      COALESCE(cy."coverage_articles", 0)::integer AS "coverage_articles",
      coverage."total_articles_with_history"
    FROM year_series
    LEFT JOIN citation_years cy ON cy."year" = year_series."year"
    CROSS JOIN coverage
    ORDER BY year_series."year" ASC;
  `;

  const entityNames = ['institutions', 'authors', 'journals', 'topics', 'keywords'];
  const topEntityQueries = Object.fromEntries(
    entityNames.map((entity) => [entity, entityQuery(filter, entity, window, limit, 'top')]),
  );
  const growthEntityQueries = Object.fromEntries(
    entityNames.map((entity) => [entity, entityQuery(filter, entity, window, limit, 'growth')]),
  );

  const trendingPrepared = appendWindowValues(filter.values, window, limit);
  const trendingQuery = `
    WITH ${base},
    history_articles AS (
      SELECT fa.*
      FROM filtered_articles fa
      WHERE fa."citations_by_year" IS NOT NULL
        AND jsonb_typeof(fa."citations_by_year"::jsonb) = 'object'
    ),
    citation_activity AS (
      SELECT
        ha."article_id",
        SUM((history.value)::integer) FILTER (
          WHERE (history.key)::integer BETWEEN $${trendingPrepared.currentFrom} AND $${trendingPrepared.currentTo}
        )::integer AS "current_citations",
        SUM((history.value)::integer) FILTER (
          WHERE (history.key)::integer BETWEEN $${trendingPrepared.comparisonFrom} AND $${trendingPrepared.comparisonTo}
        )::integer AS "previous_citations"
      FROM history_articles ha
      JOIN LATERAL jsonb_each_text(ha."citations_by_year"::jsonb) AS history(key, value) ON true
      WHERE history.key ~ '^\\d{4}$'
        AND history.value ~ '^-?\\d+$'
        AND (history.key)::integer BETWEEN $${trendingPrepared.comparisonFrom} AND $${trendingPrepared.currentTo}
      GROUP BY ha."article_id"
    )
    SELECT
      ha."article_id"::text AS "article_id",
      ha."title",
      ha."publication_year",
      ha."journal_id"::text AS "journal_id",
      ha."journal_name",
      ha."citation_count",
      ha."reference_count",
      COALESCE(ca."current_citations", 0)::integer AS "current_citations",
      COALESCE(ca."previous_citations", 0)::integer AS "previous_citations",
      (COALESCE(ca."current_citations", 0) - COALESCE(ca."previous_citations", 0))::integer AS "absolute_growth",
      CASE
        WHEN COALESCE(ca."previous_citations", 0) = 0 THEN NULL
        ELSE ROUND(((COALESCE(ca."current_citations", 0) - COALESCE(ca."previous_citations", 0))::numeric / ca."previous_citations"), 4)::float
      END AS "growth_rate"
    FROM history_articles ha
    JOIN citation_activity ca ON ca."article_id" = ha."article_id"
    ORDER BY "absolute_growth" DESC, "current_citations" DESC, ha."citation_count" DESC NULLS LAST, ha."publication_year" DESC NULLS LAST, ha."title" ASC
    LIMIT $${trendingPrepared.limitIndex};
  `;

  const coverageQuery = `
    WITH ${base},
    ${windowParamsCte},
    history_articles AS (
      SELECT fa.*
      FROM filtered_articles fa
      WHERE fa."citations_by_year" IS NOT NULL
        AND jsonb_typeof(fa."citations_by_year"::jsonb) = 'object'
    ),
    eligible_articles AS (
      SELECT DISTINCT ha."article_id"
      FROM history_articles ha
      JOIN LATERAL jsonb_each_text(ha."citations_by_year"::jsonb) AS history(key, value) ON true
      WHERE history.key ~ '^\\d{4}$'
        AND history.value ~ '^-?\\d+$'
        AND (history.key)::integer BETWEEN $${preparedWindow.comparisonFrom} AND $${preparedWindow.currentTo}
    )
    SELECT
      (SELECT COUNT(*)::integer FROM eligible_articles) AS "eligible_articles",
      (SELECT COUNT(DISTINCT fa."article_id")::integer FROM filtered_articles fa) AS "total_articles";
  `;

  const [
    summaryResult,
    worksResult,
    citationsResult,
    topInstitutionsResult,
    topAuthorsResult,
    topJournalsResult,
    topTopicsResult,
    topKeywordsResult,
    growthInstitutionsResult,
    growthAuthorsResult,
    growthJournalsResult,
    growthTopicsResult,
    growthKeywordsResult,
    trendingResult,
    coverageResult,
  ] = await Promise.all([
    pool.query(summaryQuery, preparedWindow.values),
    pool.query(worksQuery, preparedWindow.values),
    pool.query(citationsQuery, preparedWindow.values),
    pool.query(topEntityQueries.institutions.sql, topEntityQueries.institutions.values),
    pool.query(topEntityQueries.authors.sql, topEntityQueries.authors.values),
    pool.query(topEntityQueries.journals.sql, topEntityQueries.journals.values),
    pool.query(topEntityQueries.topics.sql, topEntityQueries.topics.values),
    pool.query(topEntityQueries.keywords.sql, topEntityQueries.keywords.values),
    pool.query(growthEntityQueries.institutions.sql, growthEntityQueries.institutions.values),
    pool.query(growthEntityQueries.authors.sql, growthEntityQueries.authors.values),
    pool.query(growthEntityQueries.journals.sql, growthEntityQueries.journals.values),
    pool.query(growthEntityQueries.topics.sql, growthEntityQueries.topics.values),
    pool.query(growthEntityQueries.keywords.sql, growthEntityQueries.keywords.values),
    pool.query(trendingQuery, trendingPrepared.values),
    pool.query(coverageQuery, preparedWindow.values),
  ]);

  const topEntityResults = {
    institutions: mapGrowthRows(topInstitutionsResult.rows),
    authors: mapGrowthRows(topAuthorsResult.rows),
    journals: mapGrowthRows(topJournalsResult.rows),
    topics: mapGrowthRows(topTopicsResult.rows),
    keywords: mapGrowthRows(topKeywordsResult.rows),
  };
  const growthEntityResults = {
    institutions: mapGrowthRows(growthInstitutionsResult.rows),
    authors: mapGrowthRows(growthAuthorsResult.rows),
    journals: mapGrowthRows(growthJournalsResult.rows),
    topics: mapGrowthRows(growthTopicsResult.rows),
    keywords: mapGrowthRows(growthKeywordsResult.rows),
  };
  const totalArticlesWithHistory = citationsResult.rows
    .map((row) => Number(row.total_articles_with_history) || 0)
    .find((count) => count > 0) || 0;

  return {
    scope: filter.scope,
    window,
    summary: summaryResult.rows[0] || emptySeries.summary,
    works_over_time: zeroFill(window.years, worksResult.rows, (year, row) => ({
      year,
      count: row?.count || 0,
    })),
    citations_over_time: zeroFill(window.years, citationsResult.rows, (year, row) => ({
      year,
      citations: row?.citations || 0,
      coverage_articles: row?.coverage_articles || 0,
      total_articles_with_history: row?.total_articles_with_history || totalArticlesWithHistory,
    })),
    top: topEntityResults,
    growth: growthEntityResults,
    trending_articles: trendingResult.rows,
    trending_article_coverage: coverageResult.rows[0] || { eligible_articles: 0, total_articles: 0 },
  };
};
