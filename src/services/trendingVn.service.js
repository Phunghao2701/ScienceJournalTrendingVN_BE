import pool from "../config/database.js";

const clampInt = (value, fallback, min, max) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const groupRowsByJournal = (rows) => {
  return rows.reduce((acc, row) => {
    const journalId = String(row.journal_id);
    if (!acc[journalId]) acc[journalId] = [];
    acc[journalId].push(row);
    return acc;
  }, {});
};

/**
 * Top Journals - Cách A.
 *
 * Definition:
 * - Use articles in the latest N-year publication window, default 2 years.
 * - Rank journals by total citation count of those recent articles.
 * - Attach top keywords and topics that appear most frequently in that same window.
 */
export const getTopJournals = async ({ years = 2, limit = 10 } = {}) => {
  const yearsWindow = clampInt(years, 2, 1, 10);
  const limitNum = clampInt(limit, 10, 1, 50);

  const windowResult = await pool.query(`
    SELECT MAX(a."publication_year")::integer AS "to_year"
    FROM "Article" a
    WHERE a."publication_year" IS NOT NULL
      AND COALESCE(a."is_deleted", false) = false;
  `);

  const toYear = windowResult.rows[0]?.to_year;
  if (!toYear) {
    return {
      window: {
        from_year: null,
        to_year: null,
        years: yearsWindow,
      },
      items: [],
    };
  }

  const fromYear = toYear - yearsWindow + 1;

  const journalsResult = await pool.query(
    `
    WITH recent_articles AS (
      SELECT
        a."article_id",
        a."citation_count",
        a."publication_year",
        j."journal_id",
        j."display_name" AS "journal_name",
        j."issn",
        j."type" AS "journal_type",
        j."is_open_access" AS "journal_is_open_access",
        p."display_name" AS "publisher_name"
      FROM "Article" a
      INNER JOIN "Issue" i ON i."issue_id" = a."issue_id"
      INNER JOIN "Volume" v ON v."volume_id" = i."volume_id"
      INNER JOIN "Journal" j ON j."journal_id" = v."journal_id"
      LEFT JOIN "Publisher" p ON p."publisher_id" = j."publisher_id"
      WHERE COALESCE(a."is_deleted", false) = false
        AND COALESCE(i."is_deleted", false) = false
        AND COALESCE(v."is_deleted", false) = false
        AND COALESCE(j."is_deleted", false) = false
        AND a."publication_year" BETWEEN $1 AND $2
    )
    SELECT
      ra."journal_id"::text AS "journal_id",
      ra."journal_name",
      ra."issn",
      ra."journal_type",
      ra."journal_is_open_access",
      ra."publisher_name",
      COUNT(ra."article_id")::integer AS "recent_articles_count",
      COALESCE(SUM(ra."citation_count"), 0)::integer AS "total_recent_citations",
      ROUND(COALESCE(AVG(ra."citation_count"), 0)::numeric, 2)::float AS "avg_recent_citations",
      MAX(ra."publication_year")::integer AS "latest_publication_year",
      MIN(ra."publication_year")::integer AS "earliest_publication_year",
      0::integer AS "open_access_articles_count"
    FROM recent_articles ra
    GROUP BY
      ra."journal_id",
      ra."journal_name",
      ra."issn",
      ra."journal_type",
      ra."journal_is_open_access",
      ra."publisher_name"
    ORDER BY
      "total_recent_citations" DESC,
      "recent_articles_count" DESC,
      ra."journal_name" ASC
    LIMIT $3;
    `,
    [fromYear, toYear, limitNum]
  );

  const journals = journalsResult.rows;
  const journalIds = journals.map((journal) => journal.journal_id);
  if (journalIds.length === 0) {
    return {
      window: {
        from_year: fromYear,
        to_year: toYear,
        years: yearsWindow,
      },
      items: [],
    };
  }

  const [keywordsResult, topicsResult] = await Promise.all([
    pool.query(
      `
      WITH recent_articles AS (
        SELECT a."article_id", j."journal_id"
        FROM "Article" a
        INNER JOIN "Issue" i ON i."issue_id" = a."issue_id"
        INNER JOIN "Volume" v ON v."volume_id" = i."volume_id"
        INNER JOIN "Journal" j ON j."journal_id" = v."journal_id"
        WHERE COALESCE(a."is_deleted", false) = false
          AND COALESCE(i."is_deleted", false) = false
          AND COALESCE(v."is_deleted", false) = false
          AND COALESCE(j."is_deleted", false) = false
          AND a."publication_year" BETWEEN $1 AND $2
          AND j."journal_id"::text = ANY($3::text[])
      ),
      keyword_counts AS (
        SELECT
          ra."journal_id"::text AS "journal_id",
          k."keyword_id"::text AS "keyword_id",
          k."display_name",
          COUNT(*)::integer AS "count",
          ROW_NUMBER() OVER (
            PARTITION BY ra."journal_id"
            ORDER BY COUNT(*) DESC, k."display_name" ASC
          ) AS rn
        FROM recent_articles ra
        INNER JOIN "Keyword_Article" ka ON ka."article_id" = ra."article_id"
        INNER JOIN "Keyword" k ON k."keyword_id" = ka."keyword_id"
        GROUP BY ra."journal_id", k."keyword_id", k."display_name"
      )
      SELECT "journal_id", "keyword_id", "display_name", "count"
      FROM keyword_counts
      WHERE rn <= 5
      ORDER BY "journal_id", "count" DESC, "display_name" ASC;
      `,
      [fromYear, toYear, journalIds]
    ),
    pool.query(
      `
      WITH recent_articles AS (
        SELECT a."article_id", a."primary_topic", j."journal_id"
        FROM "Article" a
        INNER JOIN "Issue" i ON i."issue_id" = a."issue_id"
        INNER JOIN "Volume" v ON v."volume_id" = i."volume_id"
        INNER JOIN "Journal" j ON j."journal_id" = v."journal_id"
        WHERE COALESCE(a."is_deleted", false) = false
          AND COALESCE(i."is_deleted", false) = false
          AND COALESCE(v."is_deleted", false) = false
          AND COALESCE(j."is_deleted", false) = false
          AND a."publication_year" BETWEEN $1 AND $2
          AND j."journal_id"::text = ANY($3::text[])
      ),
      article_topics AS (
        SELECT DISTINCT
          ra."journal_id",
          ra."article_id",
          ra."primary_topic" AS "topic_id"
        FROM recent_articles ra
        WHERE ra."primary_topic" IS NOT NULL

        UNION

        SELECT DISTINCT
          ra."journal_id",
          ra."article_id",
          st."topic_id"
        FROM recent_articles ra
        INNER JOIN "Sub_Topic" st ON st."article_id" = ra."article_id"
      ),
      topic_counts AS (
        SELECT
          at."journal_id"::text AS "journal_id",
          t."topic_id"::text AS "topic_id",
          t."display_name",
          COUNT(*)::integer AS "count",
          ROW_NUMBER() OVER (
            PARTITION BY at."journal_id"
            ORDER BY COUNT(*) DESC, t."display_name" ASC
          ) AS rn
        FROM article_topics at
        INNER JOIN "Topic" t ON t."topic_id" = at."topic_id"
        WHERE COALESCE(t."is_deleted", false) = false
        GROUP BY at."journal_id", t."topic_id", t."display_name"
      )
      SELECT "journal_id", "topic_id", "display_name", "count"
      FROM topic_counts
      WHERE rn <= 5
      ORDER BY "journal_id", "count" DESC, "display_name" ASC;
      `,
      [fromYear, toYear, journalIds]
    ),
  ]);

  const keywordsByJournal = groupRowsByJournal(keywordsResult.rows);
  const topicsByJournal = groupRowsByJournal(topicsResult.rows);

  return {
    window: {
      from_year: fromYear,
      to_year: toYear,
      years: yearsWindow,
    },
    items: journals.map((journal, index) => ({
      rank: index + 1,
      ...journal,
      top_keywords: keywordsByJournal[journal.journal_id] || [],
      top_topics: topicsByJournal[journal.journal_id] || [],
    })),
  };
};

const groupRowsByInstitution = (rows, fieldName = "institution_name") => {
  return rows.reduce((acc, row) => {
    const key = row.institution_id || row[fieldName];
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
};

export const getTopUniversities = async ({ years = 2, limit = 10, hot_limit = 10 } = {}) => {
  const yearsWindow = clampInt(years, 2, 1, 10);
  const limitNum = clampInt(limit, 10, 1, 50);
  const hotLimitNum = clampInt(hot_limit, 10, 1, 50);

  const windowResult = await pool.query(`
    SELECT MAX(a."publication_year")::integer AS "to_year"
    FROM "Article" a
    WHERE a."publication_year" IS NOT NULL
      AND COALESCE(a."is_deleted", false) = false;
  `);

  const toYear = windowResult.rows[0]?.to_year;
  if (!toYear) {
    return {
      window: { from_year: null, to_year: null, years: yearsWindow },
      hot_basis: { keywords: [], topics: [] },
      items: [],
    };
  }

  const fromYear = toYear - yearsWindow + 1;

  const [hotKeywordsResult, hotTopicsResult] = await Promise.all([
    pool.query(
      `
      WITH recent_articles AS (
        SELECT a."article_id"
        FROM "Article" a
        WHERE COALESCE(a."is_deleted", false) = false
          AND a."publication_year" BETWEEN $1 AND $2
      )
      SELECT
        k."keyword_id"::text AS "keyword_id",
        k."display_name",
        COUNT(DISTINCT ra."article_id")::integer AS "article_count"
      FROM recent_articles ra
      INNER JOIN "Keyword_Article" ka ON ka."article_id" = ra."article_id"
      INNER JOIN "Keyword" k ON k."keyword_id" = ka."keyword_id"
      GROUP BY k."keyword_id", k."display_name"
      ORDER BY "article_count" DESC, k."display_name" ASC
      LIMIT $3;
      `,
      [fromYear, toYear, hotLimitNum]
    ),
    pool.query(
      `
      WITH recent_articles AS (
        SELECT a."article_id", a."primary_topic"
        FROM "Article" a
        WHERE COALESCE(a."is_deleted", false) = false
          AND a."publication_year" BETWEEN $1 AND $2
      ),
      article_topics AS (
        SELECT DISTINCT ra."article_id", ra."primary_topic" AS "topic_id"
        FROM recent_articles ra
        WHERE ra."primary_topic" IS NOT NULL

        UNION

        SELECT DISTINCT ra."article_id", st."topic_id"
        FROM recent_articles ra
        INNER JOIN "Sub_Topic" st ON st."article_id" = ra."article_id"
      )
      SELECT
        t."topic_id"::text AS "topic_id",
        t."display_name",
        COUNT(DISTINCT at."article_id")::integer AS "article_count"
      FROM article_topics at
      INNER JOIN "Topic" t ON t."topic_id" = at."topic_id"
      WHERE COALESCE(t."is_deleted", false) = false
      GROUP BY t."topic_id", t."display_name"
      ORDER BY "article_count" DESC, t."display_name" ASC
      LIMIT $3;
      `,
      [fromYear, toYear, hotLimitNum]
    ),
  ]);

  const hotKeywordIds = hotKeywordsResult.rows.map((row) => row.keyword_id);
  const hotTopicIds = hotTopicsResult.rows.map((row) => row.topic_id);

  if (hotKeywordIds.length === 0 && hotTopicIds.length === 0) {
    return {
      window: { from_year: fromYear, to_year: toYear, years: yearsWindow },
      hot_basis: { keywords: [], topics: [] },
      items: [],
    };
  }

  const universitiesResult = await pool.query(
    `
    WITH recent_articles AS (
      SELECT
        a."article_id",
        a."title",
        a."publication_year",
        COALESCE(a."citation_count", 0) AS "citation_count",
        a."primary_topic"
      FROM "Article" a
      WHERE COALESCE(a."is_deleted", false) = false
        AND a."publication_year" BETWEEN $1 AND $2
    ),
    keyword_articles AS (
      SELECT DISTINCT ra."article_id"
      FROM recent_articles ra
      INNER JOIN "Keyword_Article" ka ON ka."article_id" = ra."article_id"
      WHERE ka."keyword_id"::text = ANY($3::text[])
    ),
    topic_articles AS (
      SELECT DISTINCT ra."article_id"
      FROM recent_articles ra
      WHERE ra."primary_topic"::text = ANY($4::text[])

      UNION

      SELECT DISTINCT ra."article_id"
      FROM recent_articles ra
      INNER JOIN "Sub_Topic" st ON st."article_id" = ra."article_id"
      WHERE st."topic_id"::text = ANY($4::text[])
    ),
    trending_articles AS (
      SELECT "article_id" FROM keyword_articles
      UNION
      SELECT "article_id" FROM topic_articles
    ),
    first_author_articles AS (
      SELECT DISTINCT
        ra."article_id",
        ra."title",
        ra."publication_year",
        ra."citation_count",
        au."author_id",
        au."display_name" AS "first_author_name",
        au."last_known_institution" AS "institution_name",
        au."last_known_institution_id" AS "institution_id"
      FROM trending_articles ta
      INNER JOIN recent_articles ra ON ra."article_id" = ta."article_id"
      INNER JOIN "Author_Article" aa ON aa."article_id" = ra."article_id"
      INNER JOIN "Author" au ON au."author_id" = aa."author_id"
      WHERE LOWER(COALESCE(aa."author_position", '')) = 'first'
        AND COALESCE(au."is_deleted", false) = false
        AND NULLIF(TRIM(au."last_known_institution"), '') IS NOT NULL
    )
    SELECT
      COALESCE(faa."institution_id", faa."institution_name") AS "institution_key",
      faa."institution_id",
      faa."institution_name",
      COUNT(DISTINCT faa."article_id")::integer AS "trending_articles_count",
      COUNT(DISTINCT faa."author_id")::integer AS "first_authors_count",
      COALESCE(SUM(faa."citation_count"), 0)::integer AS "total_recent_citations",
      ROUND(COALESCE(AVG(faa."citation_count"), 0)::numeric, 2)::float AS "avg_recent_citations",
      MAX(faa."publication_year")::integer AS "latest_publication_year"
    FROM first_author_articles faa
    GROUP BY COALESCE(faa."institution_id", faa."institution_name"), faa."institution_id", faa."institution_name"
    ORDER BY "total_recent_citations" DESC, "trending_articles_count" DESC, faa."institution_name" ASC
    LIMIT $5;
    `,
    [fromYear, toYear, hotKeywordIds, hotTopicIds, limitNum]
  );

  const universities = universitiesResult.rows;
  const institutionKeys = universities.map((row) => row.institution_key);

  if (institutionKeys.length === 0) {
    return {
      window: { from_year: fromYear, to_year: toYear, years: yearsWindow },
      hot_basis: { keywords: hotKeywordsResult.rows, topics: hotTopicsResult.rows },
      items: [],
    };
  }

  const [keywordsResult, topicsResult, articlesResult] = await Promise.all([
    pool.query(
      `
      WITH first_author_articles AS (
        SELECT DISTINCT
          a."article_id",
          COALESCE(au."last_known_institution_id", au."last_known_institution") AS "institution_key"
        FROM "Article" a
        INNER JOIN "Author_Article" aa ON aa."article_id" = a."article_id"
        INNER JOIN "Author" au ON au."author_id" = aa."author_id"
        WHERE COALESCE(a."is_deleted", false) = false
          AND a."publication_year" BETWEEN $1 AND $2
          AND LOWER(COALESCE(aa."author_position", '')) = 'first'
          AND COALESCE(au."is_deleted", false) = false
          AND NULLIF(TRIM(au."last_known_institution"), '') IS NOT NULL
          AND COALESCE(au."last_known_institution_id", au."last_known_institution") = ANY($5::text[])
          AND (
            EXISTS (
              SELECT 1 FROM "Keyword_Article" ka
              WHERE ka."article_id" = a."article_id"
                AND ka."keyword_id"::text = ANY($3::text[])
            )
            OR a."primary_topic"::text = ANY($4::text[])
            OR EXISTS (
              SELECT 1 FROM "Sub_Topic" st
              WHERE st."article_id" = a."article_id"
                AND st."topic_id"::text = ANY($4::text[])
            )
          )
      ),
      keyword_counts AS (
        SELECT
          faa."institution_key",
          k."keyword_id"::text AS "keyword_id",
          k."display_name",
          COUNT(DISTINCT faa."article_id")::integer AS "count",
          ROW_NUMBER() OVER (
            PARTITION BY faa."institution_key"
            ORDER BY COUNT(DISTINCT faa."article_id") DESC, k."display_name" ASC
          ) AS rn
        FROM first_author_articles faa
        INNER JOIN "Keyword_Article" ka ON ka."article_id" = faa."article_id"
        INNER JOIN "Keyword" k ON k."keyword_id" = ka."keyword_id"
        WHERE ka."keyword_id"::text = ANY($3::text[])
        GROUP BY faa."institution_key", k."keyword_id", k."display_name"
      )
      SELECT "institution_key", "keyword_id", "display_name", "count"
      FROM keyword_counts
      WHERE rn <= 5
      ORDER BY "institution_key", "count" DESC, "display_name" ASC;
      `,
      [fromYear, toYear, hotKeywordIds, hotTopicIds, institutionKeys]
    ),
    pool.query(
      `
      WITH first_author_articles AS (
        SELECT DISTINCT
          a."article_id",
          a."primary_topic",
          COALESCE(au."last_known_institution_id", au."last_known_institution") AS "institution_key"
        FROM "Article" a
        INNER JOIN "Author_Article" aa ON aa."article_id" = a."article_id"
        INNER JOIN "Author" au ON au."author_id" = aa."author_id"
        WHERE COALESCE(a."is_deleted", false) = false
          AND a."publication_year" BETWEEN $1 AND $2
          AND LOWER(COALESCE(aa."author_position", '')) = 'first'
          AND COALESCE(au."is_deleted", false) = false
          AND NULLIF(TRIM(au."last_known_institution"), '') IS NOT NULL
          AND COALESCE(au."last_known_institution_id", au."last_known_institution") = ANY($5::text[])
          AND (
            EXISTS (
              SELECT 1 FROM "Keyword_Article" ka
              WHERE ka."article_id" = a."article_id"
                AND ka."keyword_id"::text = ANY($3::text[])
            )
            OR a."primary_topic"::text = ANY($4::text[])
            OR EXISTS (
              SELECT 1 FROM "Sub_Topic" st
              WHERE st."article_id" = a."article_id"
                AND st."topic_id"::text = ANY($4::text[])
            )
          )
      ),
      article_topics AS (
        SELECT DISTINCT "institution_key", "article_id", "primary_topic" AS "topic_id"
        FROM first_author_articles
        WHERE "primary_topic" IS NOT NULL AND "primary_topic"::text = ANY($4::text[])

        UNION

        SELECT DISTINCT faa."institution_key", faa."article_id", st."topic_id"
        FROM first_author_articles faa
        INNER JOIN "Sub_Topic" st ON st."article_id" = faa."article_id"
        WHERE st."topic_id"::text = ANY($4::text[])
      ),
      topic_counts AS (
        SELECT
          at."institution_key",
          t."topic_id"::text AS "topic_id",
          t."display_name",
          COUNT(DISTINCT at."article_id")::integer AS "count",
          ROW_NUMBER() OVER (
            PARTITION BY at."institution_key"
            ORDER BY COUNT(DISTINCT at."article_id") DESC, t."display_name" ASC
          ) AS rn
        FROM article_topics at
        INNER JOIN "Topic" t ON t."topic_id" = at."topic_id"
        WHERE COALESCE(t."is_deleted", false) = false
        GROUP BY at."institution_key", t."topic_id", t."display_name"
      )
      SELECT "institution_key", "topic_id", "display_name", "count"
      FROM topic_counts
      WHERE rn <= 5
      ORDER BY "institution_key", "count" DESC, "display_name" ASC;
      `,
      [fromYear, toYear, hotKeywordIds, hotTopicIds, institutionKeys]
    ),
    pool.query(
      `
      WITH first_author_articles AS (
        SELECT DISTINCT
          a."article_id"::text AS "article_id",
          a."title",
          a."publication_year",
          COALESCE(a."citation_count", 0)::integer AS "citation_count",
          au."display_name" AS "first_author_name",
          COALESCE(au."last_known_institution_id", au."last_known_institution") AS "institution_key",
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(au."last_known_institution_id", au."last_known_institution")
            ORDER BY COALESCE(a."citation_count", 0) DESC, a."publication_year" DESC NULLS LAST, a."title" ASC
          ) AS rn
        FROM "Article" a
        INNER JOIN "Author_Article" aa ON aa."article_id" = a."article_id"
        INNER JOIN "Author" au ON au."author_id" = aa."author_id"
        WHERE COALESCE(a."is_deleted", false) = false
          AND a."publication_year" BETWEEN $1 AND $2
          AND LOWER(COALESCE(aa."author_position", '')) = 'first'
          AND COALESCE(au."is_deleted", false) = false
          AND NULLIF(TRIM(au."last_known_institution"), '') IS NOT NULL
          AND COALESCE(au."last_known_institution_id", au."last_known_institution") = ANY($5::text[])
          AND (
            EXISTS (
              SELECT 1 FROM "Keyword_Article" ka
              WHERE ka."article_id" = a."article_id"
                AND ka."keyword_id"::text = ANY($3::text[])
            )
            OR a."primary_topic"::text = ANY($4::text[])
            OR EXISTS (
              SELECT 1 FROM "Sub_Topic" st
              WHERE st."article_id" = a."article_id"
                AND st."topic_id"::text = ANY($4::text[])
            )
          )
      )
      SELECT "institution_key", "article_id", "title", "publication_year", "citation_count", "first_author_name"
      FROM first_author_articles
      WHERE rn <= 3
      ORDER BY "institution_key", "citation_count" DESC, "publication_year" DESC NULLS LAST;
      `,
      [fromYear, toYear, hotKeywordIds, hotTopicIds, institutionKeys]
    ),
  ]);

  const keywordsByInstitution = groupRowsByInstitution(keywordsResult.rows, "institution_key");
  const topicsByInstitution = groupRowsByInstitution(topicsResult.rows, "institution_key");
  const articlesByInstitution = groupRowsByInstitution(articlesResult.rows, "institution_key");

  return {
    window: { from_year: fromYear, to_year: toYear, years: yearsWindow },
    hot_basis: {
      keywords: hotKeywordsResult.rows,
      topics: hotTopicsResult.rows,
    },
    items: universities.map((university, index) => ({
      rank: index + 1,
      institution_id: university.institution_id,
      institution_name: university.institution_name,
      trending_articles_count: university.trending_articles_count,
      first_authors_count: university.first_authors_count,
      total_recent_citations: university.total_recent_citations,
      avg_recent_citations: university.avg_recent_citations,
      latest_publication_year: university.latest_publication_year,
      top_keywords: keywordsByInstitution[university.institution_key] || [],
      top_topics: topicsByInstitution[university.institution_key] || [],
      representative_articles: articlesByInstitution[university.institution_key] || [],
    })),
  };
};
