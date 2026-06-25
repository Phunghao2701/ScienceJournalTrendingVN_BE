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
        a."is_open_access",
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
      COUNT(*) FILTER (WHERE COALESCE(ra."is_open_access", false) = true)::integer AS "open_access_articles_count"
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
