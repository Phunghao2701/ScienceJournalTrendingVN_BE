import pool from '../../../config/database.js';
import logger from '../../../utils/logger.js';
import {
  extractOrcidId,
  normalizeDoi,
  normalizeIssn,
  normalizeOpenAlexId,
} from "../../../utils/orcid.js";

const AUTHOR_ORCID_SQL =
  "upper(regexp_replace(trim(orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i'))";
const AUTHOR_OPENALEX_SQL =
  "upper(regexp_replace(trim(openalex_id), '^https?://openalex\\.org/', '', 'i'))";
const AUTHOR_ORCID_ALIAS_SQL =
  "upper(regexp_replace(trim(author.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i'))";
const AUTHOR_OPENALEX_ALIAS_SQL =
  "upper(regexp_replace(trim(author.openalex_id), '^https?://openalex\\.org/', '', 'i'))";
const ARTICLE_DOI_SQL =
  "lower(regexp_replace(trim(doi), '^(https?://(dx\\.)?doi\\.org/|doi:\\s*)', '', 'i'))";
const ARTICLE_OPENALEX_SQL =
  "upper(regexp_replace(trim(openalex_id), '^https?://openalex\\.org/', '', 'i'))";
const JOURNAL_SOURCE_ALIAS_SQL =
  "upper(regexp_replace(trim(journal.source_id), '^https?://openalex\\.org/', '', 'i'))";

const nullableAuthorFields = [
  "display_name",
  "orcid",
  "openalex_id",
  "works_count",
  "cited_by_count",
  "h_index",
  "i10_index",
  "last_known_institution",
  "last_known_institution_id",
];

const articleInsertFields = [
  "title",
  "abstract",
  "publication_year",
  "doi",
  "openalex_id",
  "citation_count",
  "landing_url",
  "pdf_url",
  "pages",
  "is_open_access",
  "references",
  "reference_count",
  "issue_id",
];

const ARTICLE_CHUNK_SIZE = 25;
const SCAN_RESPONSE_LIMIT = 20;

const lockIdentifiers = async (client, namespace, values) => {
  const keys = [...new Set(values.filter(Boolean))]
    .map((value) => `${namespace}:${value}`)
    .sort();

  if (!keys.length) return;
  await client.query(
    `
      SELECT pg_advisory_xact_lock(hashtextextended(lock_key, 0))
      FROM unnest($1::text[]) AS locks(lock_key)
      ORDER BY lock_key
    `,
    [keys],
  );
};

const lockScanIdentifiers = async (client, targetAuthor, articles) => {
  const keys = [];
  const addKey = (namespace, value) => {
    if (value) keys.push(`${namespace}:${value}`);
  };

  addKey("author", extractOrcidId(targetAuthor.orcid));
  addKey(
    "author",
    normalizeOpenAlexId(targetAuthor.openalex_id, "A"),
  );

  for (const article of articles) {
    addKey("article", normalizeDoi(article.doi));
    addKey(
      "article",
      normalizeOpenAlexId(article.openalex_id, "W"),
    );

    for (const author of article.authors || []) {
      addKey("author", extractOrcidId(author.orcid));
      addKey(
        "author",
        normalizeOpenAlexId(author.openalex_id, "A"),
      );
      for (const institution of author.institutions || []) {
        addKey(
          "institution",
          normalizeOpenAlexId(institution?.openalex_id, "I"),
        );
      }
    }
    for (const topic of [
      article.primary_topic,
      ...(article.topics || []).slice(0, 5),
    ]) {
      addKey("topic", topic?.display_name?.trim().toLowerCase());
    }
    for (const keyword of (article.keywords || []).slice(0, 10)) {
      addKey("keyword", keyword?.display_name?.trim().toLowerCase());
    }
    const journalSourceId = normalizeOpenAlexId(
      article.journal?.source_id,
      "S",
    );
    addKey("journal", journalSourceId);
    for (const issn of [
      article.journal?.issn_l,
      ...(article.journal?.issns || []),
    ]) {
      addKey("journal", normalizeIssn(issn));
    }
  }

  const sortedKeys = [...new Set(keys)].sort();
  if (!sortedKeys.length) return;
  await client.query(
    `
      SELECT pg_advisory_xact_lock(hashtextextended(lock_key, 0))
      FROM unnest($1::text[]) AS locks(lock_key)
      ORDER BY lock_key
    `,
    [sortedKeys],
  );
};

const countFillableFields = (existing, incoming, fields) =>
  fields.filter(
    (field) =>
      existing[field] == null &&
      incoming[field] !== null &&
      incoming[field] !== undefined,
  ).length;

const findAuthor = async (client, author) => {
  const orcidId = extractOrcidId(author.orcid);
  const openAlexId = normalizeOpenAlexId(author.openalex_id, "A")
    ?.split("/")
    .at(-1);

  if (!orcidId && !openAlexId) return null;

  const result = await client.query(
    `
      SELECT *
      FROM "Author"
      WHERE ($1::text IS NOT NULL AND ${AUTHOR_ORCID_SQL} = $1)
         OR ($2::text IS NOT NULL AND ${AUTHOR_OPENALEX_SQL} = $2)
      ORDER BY
        CASE WHEN $1::text IS NOT NULL AND ${AUTHOR_ORCID_SQL} = $1 THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE
    `,
    [orcidId, openAlexId],
  );

  return result.rows[0] || null;
};

const upsertAuthor = async (
  client,
  author,
  { isTarget = false, skipLock = false } = {},
) => {
  const orcidId = extractOrcidId(author.orcid);
  const openAlexId = normalizeOpenAlexId(author.openalex_id, "A");
  if (!orcidId && !openAlexId) return null;

  if (!skipLock) {
    await lockIdentifiers(client, "author", [orcidId, openAlexId]);
  }
  const existing = await findAuthor(client, author);

  if (existing) {
    if (existing.is_deleted) {
      if (isTarget) {
        const error = new Error(
          "TÃ¡c giáº£ mang ORCID nÃ y Ä‘ang á»Ÿ tráº¡ng thÃ¡i Ä‘Ã£ xÃ³a",
        );
        error.statusCode = 409;
        error.code = "ORCID_AUTHOR_DELETED";
        throw error;
      }
      return null;
    }

    const values = nullableAuthorFields.map((field) => author[field] ?? null);
    values.push(existing.author_id);
    const assignments = nullableAuthorFields
      .map(
        (field, index) =>
          `"${field}" = COALESCE("${field}", $${index + 1})`,
      )
      .join(", ");

    const updated = await client.query(
      `
        UPDATE "Author"
        SET ${assignments}
        WHERE author_id = $${values.length}
        RETURNING *
      `,
      values,
    );

    return {
      row: updated.rows[0],
      created: false,
      filledFields: countFillableFields(
        existing,
        author,
        nullableAuthorFields,
      ),
    };
  }

  const values = nullableAuthorFields.map((field) => author[field] ?? null);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await client.query(
    `
      INSERT INTO "Author" (${nullableAuthorFields.map((field) => `"${field}"`).join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `,
    values,
  );

  return { row: result.rows[0], created: true, filledFields: 0 };
};

const findArticle = async (client, article) => {
  const doi = normalizeDoi(article.doi);
  const openAlexId = normalizeOpenAlexId(article.openalex_id, "W")
    ?.split("/")
    .at(-1);

  const result = await client.query(
    `
      SELECT *
      FROM "Article"
      WHERE ($1::text IS NOT NULL AND ${ARTICLE_DOI_SQL} = $1)
         OR ($2::text IS NOT NULL AND ${ARTICLE_OPENALEX_SQL} = $2)
      ORDER BY
        CASE WHEN $1::text IS NOT NULL AND ${ARTICLE_DOI_SQL} = $1 THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE
    `,
    [doi, openAlexId],
  );

  return result.rows[0] || null;
};

const upsertArticleCore = async (client, article) => {
  await lockIdentifiers(client, "article", [
    normalizeDoi(article.doi),
    normalizeOpenAlexId(article.openalex_id, "W"),
  ]);

  const existing = await findArticle(client, article);
  if (existing) {
    if (existing.is_deleted) {
      return {
        row: existing,
        created: false,
        filledFields: 0,
        deleted: true,
      };
    }

    const updateFields = articleInsertFields.filter((field) => field !== "title");
    const values = updateFields.map((field) => {
      const value = article[field] ?? null;
      return field === "references" && value != null
        ? JSON.stringify(value)
        : value;
    });
    values.push(existing.article_id);

    const assignments = updateFields
      .map(
        (field, index) =>
          `"${field}" = COALESCE("${field}", $${index + 1})`,
      )
      .join(", ");
    const updated = await client.query(
      `
        UPDATE "Article"
        SET ${assignments}
        WHERE article_id = $${values.length}
        RETURNING *
      `,
      values,
    );

    return {
      row: updated.rows[0],
      created: false,
      filledFields: countFillableFields(existing, article, updateFields),
      deleted: false,
    };
  }

  const values = articleInsertFields.map((field) => {
    const value = article[field] ?? null;
    return field === "references" && value != null
      ? JSON.stringify(value)
      : value;
  });
  const result = await client.query(
    `
      INSERT INTO "Article" (
        ${articleInsertFields.map((field) => `"${field}"`).join(", ")}
      )
      VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")})
      RETURNING *
    `,
    values,
  );

  return {
    row: result.rows[0],
    created: true,
    filledFields: 0,
    deleted: false,
  };
};

const upsertTopic = async (client, topic) => {
  const displayName = topic?.display_name?.trim();
  if (!displayName) return null;

  await lockIdentifiers(client, "topic", [displayName.toLowerCase()]);
  const existing = await client.query(
    `
      SELECT *
      FROM "Topic"
      WHERE lower(trim(display_name)) = lower($1)
      LIMIT 1
      FOR UPDATE
    `,
    [displayName],
  );

  if (existing.rows[0]) {
    if (existing.rows[0].is_deleted) return null;
    const updated = await client.query(
      `
        UPDATE "Topic"
        SET score = COALESCE(score, $1)
        WHERE topic_id = $2
        RETURNING *
      `,
      [topic.score ?? null, existing.rows[0].topic_id],
    );
    return updated.rows[0];
  }

  const inserted = await client.query(
    `
      INSERT INTO "Topic" (display_name, score)
      VALUES ($1, $2)
      RETURNING *
    `,
    [displayName, topic.score ?? null],
  );
  return inserted.rows[0];
};

const fillTopicsIfMissing = async (client, articleId, article) => {
  let changed = false;
  const current = await client.query(
    `
      SELECT
        a.primary_topic,
        (SELECT COUNT(*)::int FROM "Sub_Topic" st WHERE st.article_id = a.article_id) AS sub_topic_count
      FROM "Article" a
      WHERE a.article_id = $1
    `,
    [articleId],
  );
  const state = current.rows[0];

  let primaryTopicId = state?.primary_topic || null;
  if (!primaryTopicId && article.primary_topic) {
    const primary = await upsertTopic(client, article.primary_topic);
    if (primary) {
      primaryTopicId = primary.topic_id;
      await client.query(
        `
          UPDATE "Article"
          SET primary_topic = $1
          WHERE article_id = $2 AND primary_topic IS NULL
        `,
        [primaryTopicId, articleId],
      );
      changed = true;
    }
  }

  if (Number(state?.sub_topic_count || 0) === 0) {
    const topicIds = [];
    for (const topic of (article.topics || []).slice(0, 5)) {
      const row = await upsertTopic(client, topic);
      if (row && String(row.topic_id) !== String(primaryTopicId)) {
        topicIds.push(row.topic_id);
      }
    }

    if (topicIds.length) {
      await client.query(
        `
          INSERT INTO "Sub_Topic" (article_id, topic_id)
          SELECT $1, unnest($2::bigint[])
          ON CONFLICT DO NOTHING
        `,
        [articleId, [...new Set(topicIds)]],
      );
      changed = true;
    }
  }

  return changed;
};

const upsertKeyword = async (client, keyword) => {
  const displayName = keyword?.display_name?.trim();
  if (!displayName) return null;

  await lockIdentifiers(client, "keyword", [displayName.toLowerCase()]);
  const existing = await client.query(
    `
      SELECT *
      FROM "Keyword"
      WHERE lower(trim(display_name)) = lower($1)
      LIMIT 1
      FOR UPDATE
    `,
    [displayName],
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await client.query(
    `INSERT INTO "Keyword" (display_name) VALUES ($1) RETURNING *`,
    [displayName],
  );
  return inserted.rows[0];
};

const fillKeywordsIfMissing = async (client, articleId, keywords) => {
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS total FROM "Keyword_Article" WHERE article_id = $1`,
    [articleId],
  );
  if (Number(countResult.rows[0]?.total || 0) > 0) return false;

  const keywordRows = [];
  for (const keyword of (keywords || []).slice(0, 10)) {
    const row = await upsertKeyword(client, keyword);
    if (row) {
      keywordRows.push({
        keyword_id: row.keyword_id,
        score: keyword.score ?? 0,
      });
    }
  }
  if (!keywordRows.length) return false;

  await client.query(
    `
      INSERT INTO "Keyword_Article" (article_id, keyword_id, score)
      SELECT $1, ids.keyword_id, ids.score
      FROM unnest($2::bigint[], $3::double precision[]) AS ids(keyword_id, score)
      ON CONFLICT DO NOTHING
    `,
    [
      articleId,
      keywordRows.map((item) => item.keyword_id),
      keywordRows.map((item) => item.score),
    ],
  );
  return true;
};

const linkAuthors = async (client, articleId, authorRows) => {
  for (const author of authorRows) {
    await client.query(
      `
        INSERT INTO "Author_Article" (author_id, article_id, author_position)
        VALUES ($1, $2, $3)
        ON CONFLICT (author_id, article_id)
        DO UPDATE SET author_position =
          COALESCE("Author_Article".author_position, EXCLUDED.author_position)
        WHERE "Author_Article".author_position IS NULL
          AND EXCLUDED.author_position IS NOT NULL
      `,
      [author.author_id, articleId, author.author_position ?? null],
    );
  }
};

const prefetchArticles = async (client, articles) => {
  const dois = [
    ...new Set(articles.map((article) => normalizeDoi(article.doi)).filter(Boolean)),
  ];
  const openAlexIds = [
    ...new Set(
      articles
        .map((article) =>
          normalizeOpenAlexId(article.openalex_id, "W")?.split("/").at(-1),
        )
        .filter(Boolean),
    ),
  ];

  if (!dois.length && !openAlexIds.length) {
    return { byDoi: new Map(), byOpenAlexId: new Map() };
  }

  const result = await client.query(
    `
      SELECT
        a.*,
        (SELECT COUNT(*)::int
         FROM "Sub_Topic" st
         WHERE st.article_id = a.article_id) AS sub_topic_count,
        (SELECT COUNT(*)::int
         FROM "Keyword_Article" ka
         WHERE ka.article_id = a.article_id) AS keyword_count
      FROM "Article" a
      WHERE ($1::text[] <> '{}'::text[] AND ${ARTICLE_DOI_SQL} = ANY($1::text[]))
         OR ($2::text[] <> '{}'::text[] AND ${ARTICLE_OPENALEX_SQL} = ANY($2::text[]))
      FOR UPDATE OF a
    `,
    [dois, openAlexIds],
  );

  const byDoi = new Map();
  const byOpenAlexId = new Map();
  for (const row of result.rows) {
    const doi = normalizeDoi(row.doi);
    const openAlexId = normalizeOpenAlexId(row.openalex_id, "W");
    if (doi) byDoi.set(doi, row);
    if (openAlexId) byOpenAlexId.set(openAlexId, row);
  }
  return { byDoi, byOpenAlexId };
};

const findPrefetchedArticle = (lookup, article) =>
  lookup.byDoi.get(normalizeDoi(article.doi)) ||
  lookup.byOpenAlexId.get(
    normalizeOpenAlexId(article.openalex_id, "W"),
  ) ||
  null;

const prepareInstitutions = (institutions) => {
  const unique = new Map();
  for (const institution of institutions || []) {
    const openalexId = normalizeOpenAlexId(
      institution?.openalex_id,
      "I",
    );
    const displayName = institution?.display_name?.trim();
    if (!openalexId || !displayName) continue;
    const current = unique.get(openalexId) || {};
    unique.set(openalexId, {
      identity_key: openalexId,
      openalex_id: openalexId,
      display_name: current.display_name || displayName,
      country_code:
        current.country_code ||
        institution?.country_code?.trim()?.toUpperCase() ||
        null,
      type:
        current.type ||
        institution?.type?.trim()?.toLowerCase() ||
        null,
    });
  }
  return [...unique.values()];
};

const prepareAuthors = (authors) => {
  const unique = new Map();
  for (const author of authors || []) {
    const orcidId = extractOrcidId(author.orcid);
    const orcid = orcidId ? `https://orcid.org/${orcidId}` : null;
    const openAlexId = normalizeOpenAlexId(author.openalex_id, "A");
    const identityKey = orcid
      ? `orcid:${orcid}`
      : openAlexId
        ? `openalex:${openAlexId}`
        : null;
    if (!identityKey) continue;

    const existing = unique.get(identityKey) || {};
    unique.set(identityKey, {
      identity_key: identityKey,
      orcid_key: orcidId,
      openalex_key: openAlexId?.split("/").at(-1) || null,
      display_name: existing.display_name || author.display_name || null,
      orcid: existing.orcid || orcid,
      openalex_id: existing.openalex_id || openAlexId,
      works_count: existing.works_count ?? author.works_count ?? null,
      cited_by_count:
        existing.cited_by_count ?? author.cited_by_count ?? null,
      h_index: existing.h_index ?? author.h_index ?? null,
      i10_index: existing.i10_index ?? author.i10_index ?? null,
      last_known_institution:
        existing.last_known_institution ||
        author.last_known_institution ||
        null,
      last_known_institution_id:
        existing.last_known_institution_id ||
        author.last_known_institution_id ||
        null,
      author_position:
        existing.author_position || author.author_position || null,
      institutions: prepareInstitutions([
        ...(existing.institutions || []),
        ...(author.institutions || []),
      ]),
    });
  }
  return [...unique.values()];
};

const ensureTargetAuthor = (article, targetAuthor) => {
  const targetOrcid = extractOrcidId(targetAuthor.orcid);
  const targetOpenAlexId = normalizeOpenAlexId(
    targetAuthor.openalex_id,
    "A",
  );
  const authors = [...(article.authors || [])];
  const hasTarget = authors.some(
    (author) =>
      (targetOrcid && extractOrcidId(author.orcid) === targetOrcid) ||
      (targetOpenAlexId &&
        normalizeOpenAlexId(author.openalex_id, "A") ===
          targetOpenAlexId),
  );

  if (!hasTarget) authors.push(targetAuthor);
  return { ...article, authors };
};

const prepareTopics = (article, existing) => {
  const topics = new Map();
  const addTopic = (topic, isPrimary = false) => {
    const displayName = topic?.display_name?.trim();
    if (!displayName) return;
    const identityKey = displayName.toLowerCase();
    const current = topics.get(identityKey);
    topics.set(identityKey, {
      identity_key: identityKey,
      display_name: current?.display_name || displayName,
      score: current?.score ?? topic.score ?? null,
      is_primary: Boolean(current?.is_primary || isPrimary),
    });
  };

  if (!existing?.primary_topic) {
    addTopic(article.primary_topic, true);
  }
  if (Number(existing?.sub_topic_count || 0) === 0) {
    for (const topic of (article.topics || []).slice(0, 5)) {
      addTopic(topic, false);
    }
  }
  return [...topics.values()];
};

const prepareKeywords = (article, existing) => {
  if (Number(existing?.keyword_count || 0) > 0) return [];

  const keywords = new Map();
  for (const keyword of (article.keywords || []).slice(0, 10)) {
    const displayName = keyword?.display_name?.trim();
    if (!displayName) continue;
    const identityKey = displayName.toLowerCase();
    if (!keywords.has(identityKey)) {
      keywords.set(identityKey, {
        identity_key: identityKey,
        display_name: displayName,
        score: keyword.score ?? 0,
      });
    }
  }
  return [...keywords.values()];
};

const prepareJournal = (article) => {
  if (!article.journal?.display_name?.trim()) {
    return null;
  }
  const sourceId = normalizeOpenAlexId(article.journal.source_id, "S");
  const issnKeys = [
    ...new Set(
      [
        article.journal.issn_l,
        ...(Array.isArray(article.journal.issns)
          ? article.journal.issns
          : []),
      ]
        .map(normalizeIssn)
        .filter(Boolean),
    ),
  ];
  if (!sourceId && !issnKeys.length) return null;

  const sourceKey = sourceId?.split("/").at(-1) || null;
  const aliasKeys = [
    ...(sourceKey ? [`source:${sourceKey}`] : []),
    ...issnKeys.map((issn) => `issn:${issn}`),
  ];
  return {
    identity_key: aliasKeys[0],
    alias_keys: aliasKeys,
    source_key: sourceKey,
    source_id: sourceId,
    display_name: article.journal.display_name.trim(),
    issn_l: normalizeIssn(article.journal.issn_l),
    issn_keys: issnKeys,
    primary_issn:
      normalizeIssn(article.journal.issn_l) || issnKeys[0] || null,
    issn: issnKeys.length ? issnKeys.join("; ") : null,
    type: article.journal.type || null,
    is_open_access:
      typeof article.journal.is_open_access === "boolean"
        ? article.journal.is_open_access
        : null,
  };
};

const normalizeVolumeNumber = (value) => {
  const raw = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const normalizeIssueNumber = (value) => {
  const normalized = String(value ?? "").trim();
  if (
    !normalized ||
    normalized.length > 100 ||
    /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
};

const preparePublicationHierarchy = (article, journalIds) => {
  const journal = prepareJournal(article);
  const journalId = journal?.alias_keys
    .map((alias) => journalIds.get(alias))
    .find((id) => id != null);
  const volumeNumber = normalizeVolumeNumber(article.volume_number);
  const issueNumber = normalizeIssueNumber(article.issue_number);
  if (journalId == null || volumeNumber == null || !issueNumber) return null;

  const volumeKey = `${journalId}:${volumeNumber}`;
  const issueKey = `${volumeKey}:${issueNumber.toLowerCase()}`;
  return {
    volume: {
      identity_key: volumeKey,
      journal_id: journalId,
      volume_number: volumeNumber,
      publication_year: article.publication_year ?? null,
    },
    issue: {
      identity_key: issueKey,
      volume_identity_key: volumeKey,
      issue_number: issueNumber,
      publication_year: article.publication_year ?? null,
    },
  };
};

const serializeJson = (value) =>
  value === null || value === undefined ? null : JSON.stringify(value);

const persistArticleBundle = async (
  client,
  article,
  existing,
) => {
  const authors = prepareAuthors(article.authors);
  const topics = prepareTopics(article, existing);
  const keywords = prepareKeywords(article, existing);
  const referenceJson = serializeJson(article.references);

  const result = await client.query(
    `
      WITH
      author_input AS (
        SELECT *
        FROM jsonb_to_recordset($14::jsonb) AS input(
          identity_key text,
          display_name text,
          orcid text,
          openalex_id text,
          works_count bigint,
          cited_by_count bigint,
          h_index bigint,
          i10_index bigint,
          last_known_institution text,
          last_known_institution_id text,
          author_position text
        )
      ),
      author_updated AS (
        UPDATE "Author" a
        SET
          display_name = COALESCE(a.display_name, input.display_name),
          orcid = COALESCE(a.orcid, input.orcid),
          openalex_id = COALESCE(a.openalex_id, input.openalex_id),
          works_count = COALESCE(a.works_count, input.works_count),
          cited_by_count = COALESCE(a.cited_by_count, input.cited_by_count),
          h_index = COALESCE(a.h_index, input.h_index),
          i10_index = COALESCE(a.i10_index, input.i10_index),
          last_known_institution = COALESCE(
            a.last_known_institution,
            input.last_known_institution
          ),
          last_known_institution_id = COALESCE(
            a.last_known_institution_id,
            input.last_known_institution_id
          )
        FROM author_input input
        WHERE COALESCE(a.is_deleted, false) = false
          AND (
            (input.orcid IS NOT NULL AND
             upper(regexp_replace(trim(a.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')))
            OR
            (input.openalex_id IS NOT NULL AND
             upper(regexp_replace(trim(a.openalex_id), '^https?://openalex\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.openalex_id), '^https?://openalex\\.org/', '', 'i')))
          )
        RETURNING a.*
      ),
      author_inserted AS (
        INSERT INTO "Author" (
          display_name, orcid, openalex_id, works_count, cited_by_count,
          h_index, i10_index, last_known_institution,
          last_known_institution_id
        )
        SELECT
          input.display_name, input.orcid, input.openalex_id,
          input.works_count, input.cited_by_count, input.h_index,
          input.i10_index, input.last_known_institution,
          input.last_known_institution_id
        FROM author_input input
        WHERE NOT EXISTS (
          SELECT 1
          FROM "Author" a
          WHERE
            (input.orcid IS NOT NULL AND
             upper(regexp_replace(trim(a.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')))
            OR
            (input.openalex_id IS NOT NULL AND
             upper(regexp_replace(trim(a.openalex_id), '^https?://openalex\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.openalex_id), '^https?://openalex\\.org/', '', 'i')))
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      ),
      author_rows AS (
        SELECT * FROM author_updated
        UNION
        SELECT * FROM author_inserted
      ),
      resolved_authors AS (
        SELECT DISTINCT ON (input.identity_key)
          rows.author_id,
          input.author_position
        FROM author_input input
        JOIN author_rows rows ON
          (input.orcid IS NOT NULL AND
           upper(regexp_replace(trim(rows.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
           upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')))
          OR
          (input.openalex_id IS NOT NULL AND
           upper(regexp_replace(trim(rows.openalex_id), '^https?://openalex\\.org/', '', 'i')) =
           upper(regexp_replace(trim(input.openalex_id), '^https?://openalex\\.org/', '', 'i')))
        ORDER BY
          input.identity_key,
          CASE
            WHEN input.orcid IS NOT NULL AND
                 upper(regexp_replace(trim(rows.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
                 upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i'))
            THEN 0 ELSE 1
          END
      ),
      topic_input AS (
        SELECT *
        FROM jsonb_to_recordset($15::jsonb) AS input(
          identity_key text,
          display_name text,
          score double precision,
          is_primary boolean
        )
      ),
      topic_updated AS (
        UPDATE "Topic" topic
        SET score = COALESCE(topic.score, input.score)
        FROM topic_input input
        WHERE lower(trim(topic.display_name)) = input.identity_key
          AND COALESCE(topic.is_deleted, false) = false
        RETURNING topic.*
      ),
      topic_inserted AS (
        INSERT INTO "Topic" (display_name, score)
        SELECT input.display_name, input.score
        FROM topic_input input
        WHERE NOT EXISTS (
          SELECT 1 FROM "Topic" topic
          WHERE lower(trim(topic.display_name)) = input.identity_key
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      ),
      topic_rows AS (
        SELECT * FROM topic_updated
        UNION
        SELECT * FROM topic_inserted
      ),
      resolved_topics AS (
        SELECT
          rows.topic_id,
          input.score,
          input.is_primary
        FROM topic_input input
        JOIN topic_rows rows
          ON lower(trim(rows.display_name)) = input.identity_key
      ),
      keyword_input AS (
        SELECT *
        FROM jsonb_to_recordset($16::jsonb) AS input(
          identity_key text,
          display_name text,
          score double precision
        )
      ),
      keyword_existing AS (
        SELECT keyword.*
        FROM "Keyword" keyword
        JOIN keyword_input input
          ON lower(trim(keyword.display_name)) = input.identity_key
      ),
      keyword_inserted AS (
        INSERT INTO "Keyword" (display_name)
        SELECT input.display_name
        FROM keyword_input input
        WHERE NOT EXISTS (
          SELECT 1 FROM "Keyword" keyword
          WHERE lower(trim(keyword.display_name)) = input.identity_key
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      ),
      keyword_rows AS (
        SELECT * FROM keyword_existing
        UNION
        SELECT * FROM keyword_inserted
      ),
      resolved_keywords AS (
        SELECT rows.keyword_id, input.score
        FROM keyword_input input
        JOIN keyword_rows rows
          ON lower(trim(rows.display_name)) = input.identity_key
      ),
      resolved_primary_topic AS (
        SELECT topic_id
        FROM resolved_topics
        WHERE is_primary = true
        LIMIT 1
      ),
      article_updated AS (
        UPDATE "Article" article
        SET
          abstract = COALESCE(article.abstract, $3),
          publication_year = COALESCE(article.publication_year, $4),
          doi = COALESCE(article.doi, $5),
          openalex_id = COALESCE(article.openalex_id, $6),
          citation_count = COALESCE(article.citation_count, $7),
          landing_url = COALESCE(article.landing_url, $8),
          pdf_url = COALESCE(article.pdf_url, $9),
          pages = COALESCE(article.pages, $10),
          is_open_access = COALESCE(article.is_open_access, $11),
          "references" = COALESCE(article."references", $12::jsonb),
          reference_count = COALESCE(article.reference_count, $13),
          primary_topic = COALESCE(
            article.primary_topic,
            (SELECT topic_id FROM resolved_primary_topic)
          )
        WHERE article.article_id = $1::bigint
          AND $1::bigint IS NOT NULL
          AND (
            (article.abstract IS NULL AND $3 IS NOT NULL) OR
            (article.publication_year IS NULL AND $4 IS NOT NULL) OR
            (article.doi IS NULL AND $5 IS NOT NULL) OR
            (article.openalex_id IS NULL AND $6 IS NOT NULL) OR
            (article.citation_count IS NULL AND $7 IS NOT NULL) OR
            (article.landing_url IS NULL AND $8 IS NOT NULL) OR
            (article.pdf_url IS NULL AND $9 IS NOT NULL) OR
            (article.pages IS NULL AND $10 IS NOT NULL) OR
            (article.is_open_access IS NULL AND $11 IS NOT NULL) OR
            (article."references" IS NULL AND $12::jsonb IS NOT NULL) OR
            (article.reference_count IS NULL AND $13 IS NOT NULL) OR
            (article.primary_topic IS NULL AND $14::bigint IS NOT NULL) OR
            (article.issue_id IS NULL AND $20::bigint IS NOT NULL)
          )
        RETURNING article.*, false AS created
      ),
      article_existing AS (
        SELECT article.*, false AS created
        FROM "Article" article
        WHERE article.article_id = $1::bigint
          AND $1::bigint IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM article_updated)
      ),
      article_inserted AS (
        INSERT INTO "Article" (
          title, abstract, publication_year, doi, openalex_id,
          citation_count, landing_url, pdf_url, pages, is_open_access,
          "references", reference_count, primary_topic
        )
        SELECT
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::jsonb, $13,
          (SELECT topic_id FROM resolved_primary_topic)
        WHERE $1::bigint IS NULL
        ON CONFLICT DO NOTHING
        RETURNING "Article".*, true AS created
      ),
      article_row AS (
        SELECT * FROM article_updated
        UNION ALL
        SELECT * FROM article_existing
        UNION ALL
        SELECT * FROM article_inserted
      ),
      author_links AS (
        INSERT INTO "Author_Article" (
          author_id, article_id, author_position
        )
        SELECT
          author.author_id,
          article.article_id,
          author.author_position
        FROM resolved_authors author
        CROSS JOIN article_row article
        ON CONFLICT (author_id, article_id)
        DO UPDATE SET author_position = COALESCE(
          "Author_Article".author_position,
          EXCLUDED.author_position
        )
        WHERE "Author_Article".author_position IS NULL
          AND EXCLUDED.author_position IS NOT NULL
        RETURNING 1
      ),
      topic_links AS (
        INSERT INTO "Sub_Topic" (article_id, topic_id)
        SELECT article.article_id, topic.topic_id
        FROM resolved_topics topic
        CROSS JOIN article_row article
        WHERE topic.is_primary = false
          AND topic.topic_id IS DISTINCT FROM article.primary_topic
        ON CONFLICT DO NOTHING
        RETURNING 1
      ),
      keyword_links AS (
        INSERT INTO "Keyword_Article" (article_id, keyword_id, score)
        SELECT article.article_id, keyword.keyword_id, keyword.score
        FROM resolved_keywords keyword
        CROSS JOIN article_row article
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      SELECT
        article.article_id,
        article.created,
        article.primary_topic,
        (SELECT COUNT(*)::int FROM topic_links) AS topics_linked,
        (SELECT COUNT(*)::int FROM keyword_links) AS keywords_linked
      FROM article_row article
    `,
    [
      existing?.article_id ?? null,
      article.title,
      article.abstract ?? null,
      article.publication_year ?? null,
      normalizeDoi(article.doi),
      normalizeOpenAlexId(article.openalex_id, "W"),
      article.citation_count ?? null,
      article.landing_url ?? null,
      article.pdf_url ?? null,
      article.pages ?? null,
      article.is_open_access ?? null,
      referenceJson,
      article.reference_count ?? null,
      JSON.stringify(authors),
      JSON.stringify(topics),
      JSON.stringify(keywords),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    const error = new Error(
      "KhÃ´ng thá»ƒ táº¡o hoáº·c cáº­p nháº­t bÃ i bÃ¡o do xung Ä‘á»™t Ä‘á»“ng thá»i",
    );
    error.code = "ARTICLE_CONCURRENT_CONFLICT";
    throw error;
  }

  const updateFields = articleInsertFields.filter(
    (field) => field !== "title",
  );
  return {
    row,
    created: Boolean(row.created),
    filledFields: existing
      ? countFillableFields(existing, article, updateFields)
      : 0,
    topicsChanged:
      (!existing?.primary_topic && row.primary_topic != null) ||
      Number(row.topics_linked || 0) > 0,
    keywordsChanged: Number(row.keywords_linked || 0) > 0,
    issueChanged: false,
  };
};

const mergeAuthorCandidates = (candidates) =>
  candidates.reduce(
    (current, author) => ({
      ...current,
      identity_key: current.identity_key || author.identity_key,
      orcid_key: current.orcid_key || author.orcid_key,
      openalex_key: current.openalex_key || author.openalex_key,
      display_name: current.display_name || author.display_name,
      orcid: current.orcid || author.orcid,
      openalex_id: current.openalex_id || author.openalex_id,
      works_count: current.works_count ?? author.works_count,
      cited_by_count:
        current.cited_by_count ?? author.cited_by_count,
      h_index: current.h_index ?? author.h_index,
      i10_index: current.i10_index ?? author.i10_index,
      last_known_institution:
        current.last_known_institution ||
        author.last_known_institution,
      last_known_institution_id:
        current.last_known_institution_id ||
        author.last_known_institution_id,
      institutions: prepareInstitutions([
        ...(current.institutions || []),
        ...(author.institutions || []),
      ]),
    }),
    {},
  );

const deduplicateAuthors = (candidates) => {
  const entries = new Set();
  const entriesByAlias = new Map();

  for (const candidate of candidates) {
    const candidateAliases = [
      candidate.orcid ? `orcid:${candidate.orcid}` : null,
      candidate.openalex_id
        ? `openalex:${candidate.openalex_id}`
        : null,
    ].filter(Boolean);
    const matches = [
      ...new Set(
        candidateAliases
          .map((alias) => entriesByAlias.get(alias))
          .filter(Boolean),
      ),
    ];
    const aliases = new Set([
      ...candidateAliases,
      ...matches.flatMap((entry) => [...entry.aliases]),
    ]);
    const entry = {
      aliases,
      value: mergeAuthorCandidates([
        candidate,
        ...matches.map((match) => match.value),
      ]),
    };

    for (const match of matches) entries.delete(match);
    entries.add(entry);
    for (const alias of aliases) entriesByAlias.set(alias, entry);
  }

  return [...entries].map((entry) => entry.value);
};

const mergeJournalCandidates = (candidates) =>
  candidates.reduce((current, journal) => {
    const sourceKey = current.source_key || journal.source_key;
    const issnKeys = [
      ...new Set([
        ...(current.issn_keys || []),
        ...(journal.issn_keys || []),
      ]),
    ];
    const aliasKeys = [
      ...(sourceKey ? [`source:${sourceKey}`] : []),
      ...issnKeys.map((issn) => `issn:${issn}`),
    ];
    return {
      ...current,
      identity_key: aliasKeys[0],
      alias_keys: aliasKeys,
      source_key: sourceKey,
      source_id: current.source_id || journal.source_id,
      display_name: current.display_name || journal.display_name,
      issn_l: current.issn_l || journal.issn_l,
      issn_keys: issnKeys,
      primary_issn:
        current.issn_l ||
        journal.issn_l ||
        issnKeys[0] ||
        null,
      issn: issnKeys.length ? issnKeys.join("; ") : null,
      type: current.type || journal.type,
      is_open_access:
        current.is_open_access ?? journal.is_open_access,
    };
  }, {});

const deduplicateJournals = (candidates) => {
  const entries = new Set();
  const entriesByAlias = new Map();

  for (const candidate of candidates) {
    const candidateAliases = [
      ...(candidate.source_key
        ? [`source:${candidate.source_key}`]
        : []),
      ...(candidate.issn_keys || []).map((issn) => `issn:${issn}`),
    ];
    const matches = [
      ...new Set(
        candidateAliases
          .map((alias) => entriesByAlias.get(alias))
          .filter(Boolean),
      ),
    ];
    const aliases = new Set([
      ...candidateAliases,
      ...matches.flatMap((entry) => [...entry.aliases]),
    ]);
    const entry = {
      aliases,
      value: mergeJournalCandidates([
        candidate,
        ...matches.map((match) => match.value),
      ]),
    };

    for (const match of matches) entries.delete(match);
    entries.add(entry);
    for (const alias of aliases) entriesByAlias.set(alias, entry);
  }

  return [...entries].map((entry) => entry.value);
};

const collectScanDimensions = (targetAuthor, articles, articleLookup) => {
  const authorCandidates = [];
  const topicMap = new Map();
  const keywordMap = new Map();
  const journalCandidates = [];

  for (const rawArticle of articles) {
    const article = ensureTargetAuthor(rawArticle, targetAuthor);
    const existing = findPrefetchedArticle(articleLookup, article);
    authorCandidates.push(...prepareAuthors(article.authors));

    for (const topic of prepareTopics(article, existing)) {
      const current = topicMap.get(topic.identity_key);
      topicMap.set(topic.identity_key, {
        ...topic,
        score: current?.score ?? topic.score,
        is_primary: Boolean(current?.is_primary || topic.is_primary),
      });
    }
    for (const keyword of prepareKeywords(article, existing)) {
      if (!keywordMap.has(keyword.identity_key)) {
        keywordMap.set(keyword.identity_key, keyword);
      }
    }
    const journal = prepareJournal(article, existing);
    if (journal) journalCandidates.push(journal);
  }

  const authors = deduplicateAuthors(authorCandidates);
  const journals = deduplicateJournals(journalCandidates);

  const institutions = prepareInstitutions(
    authors.flatMap((author) => author.institutions || []),
  );

  return {
    authors,
    institutions,
    topics: [...topicMap.values()],
    keywords: [...keywordMap.values()],
    journals,
  };
};

const resolveAuthorsBatch = async (client, authors) => {
  if (!authors.length) return new Map();
  const result = await client.query(
    `
      WITH author_input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          display_name text,
          orcid text,
          openalex_id text,
          works_count bigint,
          cited_by_count bigint,
          h_index bigint,
          i10_index bigint,
          last_known_institution text,
          last_known_institution_id text,
          author_position text
        )
      ),
      author_updated AS (
        UPDATE "Author" author
        SET
          display_name = COALESCE(author.display_name, input.display_name),
          orcid = COALESCE(author.orcid, input.orcid),
          openalex_id = COALESCE(author.openalex_id, input.openalex_id),
          works_count = COALESCE(author.works_count, input.works_count),
          cited_by_count = COALESCE(
            author.cited_by_count,
            input.cited_by_count
          ),
          h_index = COALESCE(author.h_index, input.h_index),
          i10_index = COALESCE(author.i10_index, input.i10_index),
          last_known_institution = COALESCE(
            author.last_known_institution,
            input.last_known_institution
          ),
          last_known_institution_id = COALESCE(
            author.last_known_institution_id,
            input.last_known_institution_id
          )
        FROM author_input input
        WHERE COALESCE(author.is_deleted, false) = false
          AND (
            (input.orcid IS NOT NULL AND
             upper(regexp_replace(trim(author.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')))
            OR
            (input.openalex_id IS NOT NULL AND
             upper(regexp_replace(trim(author.openalex_id), '^https?://openalex\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.openalex_id), '^https?://openalex\\.org/', '', 'i')))
          )
        RETURNING author.*
      ),
      author_inserted AS (
        INSERT INTO "Author" (
          display_name, orcid, openalex_id, works_count, cited_by_count,
          h_index, i10_index, last_known_institution,
          last_known_institution_id
        )
        SELECT
          input.display_name, input.orcid, input.openalex_id,
          input.works_count, input.cited_by_count, input.h_index,
          input.i10_index, input.last_known_institution,
          input.last_known_institution_id
        FROM author_input input
        WHERE NOT EXISTS (
          SELECT 1
          FROM "Author" author
          WHERE
            (input.orcid IS NOT NULL AND
             upper(regexp_replace(trim(author.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')))
            OR
            (input.openalex_id IS NOT NULL AND
             upper(regexp_replace(trim(author.openalex_id), '^https?://openalex\\.org/', '', 'i')) =
             upper(regexp_replace(trim(input.openalex_id), '^https?://openalex\\.org/', '', 'i')))
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      ),
      author_rows AS (
        SELECT * FROM author_updated
        UNION
        SELECT * FROM author_inserted
      )
      SELECT DISTINCT ON (input.identity_key)
        input.identity_key,
        rows.author_id
      FROM author_input input
      JOIN author_rows rows ON
        (input.orcid IS NOT NULL AND
         upper(regexp_replace(trim(rows.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
         upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')))
        OR
        (input.openalex_id IS NOT NULL AND
         upper(regexp_replace(trim(rows.openalex_id), '^https?://openalex\\.org/', '', 'i')) =
         upper(regexp_replace(trim(input.openalex_id), '^https?://openalex\\.org/', '', 'i')))
      ORDER BY
        input.identity_key,
        CASE
          WHEN input.orcid IS NOT NULL AND
               upper(regexp_replace(trim(rows.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i')) =
               upper(regexp_replace(trim(input.orcid), '^https?://(www\\.)?orcid\\.org/', '', 'i'))
          THEN 0 ELSE 1
        END
    `,
    [JSON.stringify(authors)],
  );
  const authorIds = new Map(
    result.rows.map((row) => [row.identity_key, row.author_id]),
  );
  for (const author of authors) {
    const authorId = authorIds.get(author.identity_key);
    if (authorId == null) continue;
    if (author.orcid) {
      authorIds.set(`orcid:${author.orcid}`, authorId);
    }
    if (author.openalex_id) {
      authorIds.set(`openalex:${author.openalex_id}`, authorId);
    }
  }
  return authorIds;
};

const resolveAuthorsBatchIndexed = async (client, authors) => {
  if (!authors.length) return new Map();
  const serializedAuthors = JSON.stringify(authors);
  const inputColumns = `
    identity_key text,
    orcid_key text,
    openalex_key text,
    display_name text,
    orcid text,
    openalex_id text,
    works_count bigint,
    cited_by_count bigint,
    h_index bigint,
    i10_index bigint,
    last_known_institution text,
    last_known_institution_id text,
    author_position text
  `;

  const matchResult = await client.query(
    `
      WITH author_input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(${inputColumns})
      ),
      author_candidates AS (
        SELECT
          input.identity_key,
          author.author_id,
          COALESCE(author.is_deleted, false) AS is_deleted,
          0 AS priority
        FROM author_input input
        JOIN "Author" author
          ON author.orcid IS NOT NULL
         AND trim(author.orcid) <> ''
         AND ${AUTHOR_ORCID_ALIAS_SQL} = input.orcid_key
        WHERE input.orcid_key IS NOT NULL

        UNION ALL

        SELECT
          input.identity_key,
          author.author_id,
          COALESCE(author.is_deleted, false) AS is_deleted,
          1 AS priority
        FROM author_input input
        JOIN "Author" author
          ON author.openalex_id IS NOT NULL
         AND trim(author.openalex_id) <> ''
         AND ${AUTHOR_OPENALEX_ALIAS_SQL} = input.openalex_key
        WHERE input.openalex_key IS NOT NULL
      )
      SELECT DISTINCT ON (identity_key)
        identity_key,
        author_id,
        is_deleted
      FROM author_candidates
      ORDER BY identity_key, priority, author_id
    `,
    [serializedAuthors],
  );

  const matches = new Map(
    matchResult.rows.map((row) => [row.identity_key, row]),
  );
  const matchedAuthors = [];
  const unmatchedAuthors = [];
  for (const author of authors) {
    const match = matches.get(author.identity_key);
    if (!match) {
      unmatchedAuthors.push(author);
    } else if (!match.is_deleted) {
      matchedAuthors.push({
        ...author,
        author_id: match.author_id,
      });
    }
  }

  await client.query(
    `
      WITH matched_input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          author_id bigint,
          identity_key text,
          orcid_key text,
          openalex_key text,
          display_name text,
          orcid text,
          openalex_id text,
          works_count bigint,
          cited_by_count bigint,
          h_index bigint,
          i10_index bigint,
          last_known_institution text,
          last_known_institution_id text,
          author_position text
        )
      ),
      author_updated AS (
        UPDATE "Author" author
        SET
          display_name = COALESCE(author.display_name, input.display_name),
          orcid = COALESCE(author.orcid, input.orcid),
          openalex_id = COALESCE(author.openalex_id, input.openalex_id),
          works_count = COALESCE(author.works_count, input.works_count),
          cited_by_count = COALESCE(
            author.cited_by_count,
            input.cited_by_count
          ),
          h_index = COALESCE(author.h_index, input.h_index),
          i10_index = COALESCE(author.i10_index, input.i10_index),
          last_known_institution = COALESCE(
            author.last_known_institution,
            input.last_known_institution
          ),
          last_known_institution_id = COALESCE(
            author.last_known_institution_id,
            input.last_known_institution_id
          )
        FROM matched_input input
        WHERE author.author_id = input.author_id
          AND COALESCE(author.is_deleted, false) = false
          AND num_nonnulls(
            CASE
              WHEN author.display_name IS NULL
              THEN input.display_name
            END,
            CASE WHEN author.orcid IS NULL THEN input.orcid END,
            CASE
              WHEN author.openalex_id IS NULL
              THEN input.openalex_id
            END,
            CASE
              WHEN author.works_count IS NULL
              THEN input.works_count
            END,
            CASE
              WHEN author.cited_by_count IS NULL
              THEN input.cited_by_count
            END,
            CASE WHEN author.h_index IS NULL THEN input.h_index END,
            CASE
              WHEN author.i10_index IS NULL
              THEN input.i10_index
            END,
            CASE
              WHEN author.last_known_institution IS NULL
              THEN input.last_known_institution
            END,
            CASE
              WHEN author.last_known_institution_id IS NULL
              THEN input.last_known_institution_id
            END
          ) > 0
        RETURNING author.author_id
      ),
      unmatched_input AS (
        SELECT *
        FROM jsonb_to_recordset($2::jsonb) AS input(${inputColumns})
      ),
      author_inserted AS (
        INSERT INTO "Author" (
          display_name, orcid, openalex_id, works_count, cited_by_count,
          h_index, i10_index, last_known_institution,
          last_known_institution_id
        )
        SELECT
          input.display_name, input.orcid, input.openalex_id,
          input.works_count, input.cited_by_count, input.h_index,
          input.i10_index, input.last_known_institution,
          input.last_known_institution_id
        FROM unmatched_input input
        ON CONFLICT DO NOTHING
        RETURNING author_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM author_updated) AS updated,
        (SELECT COUNT(*)::int FROM author_inserted) AS inserted
    `,
    [JSON.stringify(matchedAuthors), JSON.stringify(unmatchedAuthors)],
  );

  const resolvedResult = await client.query(
    `
      WITH author_input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(${inputColumns})
      ),
      author_candidates AS (
        SELECT
          input.identity_key,
          author.author_id,
          0 AS priority
        FROM author_input input
        JOIN "Author" author
          ON author.orcid IS NOT NULL
         AND trim(author.orcid) <> ''
         AND ${AUTHOR_ORCID_ALIAS_SQL} = input.orcid_key
        WHERE input.orcid_key IS NOT NULL
          AND COALESCE(author.is_deleted, false) = false

        UNION ALL

        SELECT
          input.identity_key,
          author.author_id,
          1 AS priority
        FROM author_input input
        JOIN "Author" author
          ON author.openalex_id IS NOT NULL
         AND trim(author.openalex_id) <> ''
         AND ${AUTHOR_OPENALEX_ALIAS_SQL} = input.openalex_key
        WHERE input.openalex_key IS NOT NULL
          AND COALESCE(author.is_deleted, false) = false
      )
      SELECT DISTINCT ON (identity_key)
        identity_key,
        author_id
      FROM author_candidates
      ORDER BY identity_key, priority, author_id
    `,
    [serializedAuthors],
  );

  const authorIds = new Map(
    resolvedResult.rows.map((row) => [
      row.identity_key,
      row.author_id,
    ]),
  );
  for (const author of authors) {
    const authorId = authorIds.get(author.identity_key);
    if (authorId == null) continue;
    if (author.orcid) authorIds.set(`orcid:${author.orcid}`, authorId);
    if (author.openalex_id) {
      authorIds.set(`openalex:${author.openalex_id}`, authorId);
    }
  }
  return authorIds;
};

const resolveTopicsBatch = async (client, topics) => {
  if (!topics.length) return new Map();
  const result = await client.query(
    `
      WITH topic_input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          display_name text,
          score double precision,
          is_primary boolean
        )
      ),
      topic_updated AS (
        UPDATE "Topic" topic
        SET score = COALESCE(topic.score, input.score)
        FROM topic_input input
        WHERE lower(trim(topic.display_name)) = input.identity_key
          AND COALESCE(topic.is_deleted, false) = false
        RETURNING topic.*
      ),
      topic_inserted AS (
        INSERT INTO "Topic" (display_name, score)
        SELECT input.display_name, input.score
        FROM topic_input input
        WHERE NOT EXISTS (
          SELECT 1 FROM "Topic" topic
          WHERE lower(trim(topic.display_name)) = input.identity_key
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      ),
      topic_rows AS (
        SELECT * FROM topic_updated
        UNION
        SELECT * FROM topic_inserted
      )
      SELECT input.identity_key, rows.topic_id
      FROM topic_input input
      JOIN topic_rows rows
        ON lower(trim(rows.display_name)) = input.identity_key
    `,
    [JSON.stringify(topics)],
  );
  return new Map(
    result.rows.map((row) => [row.identity_key, row.topic_id]),
  );
};

const resolveKeywordsBatch = async (client, keywords) => {
  if (!keywords.length) return new Map();
  const result = await client.query(
    `
      WITH keyword_input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          display_name text,
          score double precision
        )
      ),
      keyword_existing AS (
        SELECT keyword.*
        FROM "Keyword" keyword
        JOIN keyword_input input
          ON lower(trim(keyword.display_name)) = input.identity_key
      ),
      keyword_inserted AS (
        INSERT INTO "Keyword" (display_name)
        SELECT input.display_name
        FROM keyword_input input
        WHERE NOT EXISTS (
          SELECT 1 FROM "Keyword" keyword
          WHERE lower(trim(keyword.display_name)) = input.identity_key
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      ),
      keyword_rows AS (
        SELECT * FROM keyword_existing
        UNION
        SELECT * FROM keyword_inserted
      )
      SELECT input.identity_key, rows.keyword_id
      FROM keyword_input input
      JOIN keyword_rows rows
        ON lower(trim(rows.display_name)) = input.identity_key
    `,
    [JSON.stringify(keywords)],
  );
  return new Map(
    result.rows.map((row) => [row.identity_key, row.keyword_id]),
  );
};

const resolveJournalsBatch = async (client, journals) => {
  if (!journals.length) return new Map();
  const payload = JSON.stringify(journals);
  await client.query(
    `
      WITH journal_input AS MATERIALIZED (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          source_key text,
          source_id text,
          display_name text,
          issn_l text,
          issn_keys jsonb,
          primary_issn text,
          issn text,
          type text,
          is_open_access boolean
        )
      ),
      source_matches AS (
        SELECT input.identity_key, journal.journal_id, 0 AS priority
        FROM journal_input input
        JOIN "Journal" journal
          ON input.source_key IS NOT NULL
         AND ${JOURNAL_SOURCE_ALIAS_SQL} = input.source_key
         AND journal.source_id IS NOT NULL
         AND trim(journal.source_id) <> ''
      ),
      issn_matches AS (
        SELECT input.identity_key, mapping.journal_id, 1 AS priority
        FROM journal_input input
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(input.issn_keys, '[]'::jsonb)
        ) issn(value)
        JOIN "Journal_ISSN" mapping ON mapping.issn = issn.value
      ),
      matched AS (
        SELECT DISTINCT ON (identity_key)
          identity_key,
          journal_id
        FROM (
          SELECT * FROM source_matches
          UNION ALL
          SELECT * FROM issn_matches
        ) candidates
        ORDER BY identity_key, priority, journal_id
      ),
      journal_updated AS (
        UPDATE "Journal" journal
        SET
          source_id = COALESCE(journal.source_id, input.source_id),
          type = COALESCE(journal.type, input.type),
          is_open_access = COALESCE(
            journal.is_open_access,
            input.is_open_access
          ),
          issn = COALESCE(journal.issn, input.issn)
        FROM matched
        JOIN journal_input input USING (identity_key)
        WHERE journal.journal_id = matched.journal_id
          AND COALESCE(journal.is_deleted, false) = false
        RETURNING journal.journal_id, input.identity_key
      ),
      unmatched AS (
        SELECT input.*
        FROM journal_input input
        LEFT JOIN matched USING (identity_key)
        WHERE matched.journal_id IS NULL
      ),
      journal_inserted_rows AS (
        INSERT INTO "Journal" (
          source_id,
          display_name,
          type,
          is_open_access,
          issn,
          is_deleted
        )
        SELECT
          input.source_id,
          input.display_name,
          input.type,
          input.is_open_access,
          input.issn,
          false
        FROM unmatched input
        ON CONFLICT DO NOTHING
        RETURNING "Journal".*
      ),
      inserted_matches AS (
        SELECT input.identity_key, journal.journal_id
        FROM unmatched input
        JOIN journal_inserted_rows journal
          ON input.source_key IS NOT NULL
         AND ${JOURNAL_SOURCE_ALIAS_SQL} = input.source_key
        UNION ALL
        SELECT input.identity_key, journal.journal_id
        FROM unmatched input
        JOIN journal_inserted_rows journal
          ON input.source_key IS NULL
         AND input.primary_issn IS NOT NULL
         AND regexp_replace(
               upper(trim(split_part(journal.issn, ';', 1))),
               '[^0-9X]',
               '',
               'g'
             ) = input.primary_issn
      ),
      journal_rows AS (
        SELECT identity_key, journal_id FROM journal_updated
        UNION ALL
        SELECT identity_key, journal_id FROM inserted_matches
      ),
      issn_links AS (
        INSERT INTO "Journal_ISSN" (issn, journal_id)
        SELECT DISTINCT issn.value, rows.journal_id
        FROM journal_rows rows
        JOIN journal_input input USING (identity_key)
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(input.issn_keys, '[]'::jsonb)
        ) issn(value)
        ON CONFLICT (issn) DO NOTHING
        RETURNING 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM journal_updated) AS updated,
        (SELECT COUNT(*)::int FROM journal_inserted_rows) AS inserted,
        (SELECT COUNT(*)::int FROM issn_links) AS issns_linked
    `,
    [payload],
  );

  const resolved = await client.query(
    `
      WITH journal_input AS MATERIALIZED (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          source_key text,
          issn_keys jsonb
        )
      ),
      source_matches AS (
        SELECT input.identity_key, journal.journal_id, 0 AS priority
        FROM journal_input input
        JOIN "Journal" journal
          ON input.source_key IS NOT NULL
         AND ${JOURNAL_SOURCE_ALIAS_SQL} = input.source_key
         AND journal.source_id IS NOT NULL
         AND trim(journal.source_id) <> ''
        WHERE COALESCE(journal.is_deleted, false) = false
      ),
      issn_matches AS (
        SELECT input.identity_key, mapping.journal_id, 1 AS priority
        FROM journal_input input
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(input.issn_keys, '[]'::jsonb)
        ) issn(value)
        JOIN "Journal_ISSN" mapping ON mapping.issn = issn.value
        JOIN "Journal" journal ON journal.journal_id = mapping.journal_id
        WHERE COALESCE(journal.is_deleted, false) = false
      )
      SELECT DISTINCT ON (identity_key)
        identity_key,
        journal_id
      FROM (
        SELECT * FROM source_matches
        UNION ALL
        SELECT * FROM issn_matches
      ) candidates
      ORDER BY identity_key, priority, journal_id
    `,
    [payload],
  );

  const ids = new Map(
    resolved.rows.map((row) => [row.identity_key, row.journal_id]),
  );
  for (const journal of journals) {
    const journalId = ids.get(journal.identity_key);
    if (journalId == null) continue;
    for (const alias of journal.alias_keys) ids.set(alias, journalId);
  }
  return ids;
};

const resolveVolumesBatch = async (client, volumes) => {
  if (!volumes.length) return new Map();
  const result = await client.query(
    `
      WITH volume_input AS MATERIALIZED (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          journal_id bigint,
          volume_number integer,
          publication_year integer
        )
      ),
      matched AS (
        SELECT input.*, volume.volume_id, volume.is_deleted
        FROM volume_input input
        JOIN "Volume" volume
          ON volume.journal_id = input.journal_id
         AND volume.volume_number = input.volume_number
      ),
      volume_updated AS (
        UPDATE "Volume" volume
        SET publication_year = COALESCE(
          volume.publication_year,
          matched.publication_year
        )
        FROM matched
        WHERE volume.volume_id = matched.volume_id
          AND COALESCE(volume.is_deleted, false) = false
        RETURNING volume.volume_id, matched.identity_key
      ),
      volume_inserted AS (
        INSERT INTO "Volume" (
          journal_id, volume_number, publication_year, is_deleted
        )
        SELECT
          input.journal_id,
          input.volume_number,
          input.publication_year,
          false
        FROM volume_input input
        LEFT JOIN matched USING (identity_key)
        WHERE matched.volume_id IS NULL
        ON CONFLICT DO NOTHING
        RETURNING volume_id, journal_id, volume_number
      ),
      inserted_rows AS (
        SELECT input.identity_key, inserted.volume_id
        FROM volume_inserted inserted
        JOIN volume_input input
          ON input.journal_id = inserted.journal_id
         AND input.volume_number = inserted.volume_number
      )
      SELECT identity_key, volume_id FROM volume_updated
      UNION ALL
      SELECT identity_key, volume_id FROM inserted_rows
    `,
    [JSON.stringify(volumes)],
  );
  return new Map(
    result.rows.map((row) => [row.identity_key, row.volume_id]),
  );
};

const resolveIssuesBatch = async (client, issues, volumeIds) => {
  const payload = issues
    .map((issue) => ({
      ...issue,
      volume_id: volumeIds.get(issue.volume_identity_key) ?? null,
    }))
    .filter((issue) => issue.volume_id != null);
  if (!payload.length) return new Map();

  const result = await client.query(
    `
      WITH issue_input AS MATERIALIZED (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          volume_id bigint,
          issue_number text,
          publication_year integer
        )
      ),
      matched AS (
        SELECT input.*, issue.issue_id, issue.is_deleted
        FROM issue_input input
        JOIN "Issue" issue
          ON issue.volume_id = input.volume_id
         AND lower(trim(issue.issue_number)) =
             lower(trim(input.issue_number))
      ),
      issue_updated AS (
        UPDATE "Issue" issue
        SET publication_year = COALESCE(
          issue.publication_year,
          matched.publication_year
        )
        FROM matched
        WHERE issue.issue_id = matched.issue_id
          AND COALESCE(issue.is_deleted, false) = false
        RETURNING issue.issue_id, matched.identity_key
      ),
      issue_inserted AS (
        INSERT INTO "Issue" (
          volume_id, issue_number, publication_year, is_deleted
        )
        SELECT
          input.volume_id,
          input.issue_number,
          input.publication_year,
          false
        FROM issue_input input
        LEFT JOIN matched USING (identity_key)
        WHERE matched.issue_id IS NULL
        ON CONFLICT DO NOTHING
        RETURNING issue_id, volume_id, issue_number
      ),
      inserted_rows AS (
        SELECT input.identity_key, inserted.issue_id
        FROM issue_inserted inserted
        JOIN issue_input input
          ON input.volume_id = inserted.volume_id
         AND lower(trim(input.issue_number)) =
             lower(trim(inserted.issue_number))
      )
      SELECT identity_key, issue_id FROM issue_updated
      UNION ALL
      SELECT identity_key, issue_id FROM inserted_rows
    `,
    [JSON.stringify(payload)],
  );
  return new Map(
    result.rows.map((row) => [row.identity_key, row.issue_id]),
  );
};

const resolveInstitutionsBatch = async (client, institutions) => {
  if (!institutions.length) return new Map();
  const result = await client.query(
    `
      WITH institution_input AS MATERIALIZED (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          identity_key text,
          openalex_id text,
          display_name text,
          country_code text,
          type text
        )
      ),
      institution_updated AS (
        UPDATE "Institution" institution
        SET
          country_code = COALESCE(
            institution.country_code,
            input.country_code
          ),
          type = COALESCE(institution.type, input.type)
        FROM institution_input input
        WHERE institution.openalex_id = input.openalex_id
          AND COALESCE(institution.is_deleted, false) = false
        RETURNING institution.institution_id, input.identity_key
      ),
      institution_inserted AS (
        INSERT INTO "Institution" (
          openalex_id,
          display_name,
          country_code,
          type,
          is_deleted
        )
        SELECT
          input.openalex_id,
          input.display_name,
          input.country_code,
          input.type,
          false
        FROM institution_input input
        WHERE NOT EXISTS (
          SELECT 1
          FROM "Institution" institution
          WHERE institution.openalex_id = input.openalex_id
        )
        ON CONFLICT DO NOTHING
        RETURNING institution_id, openalex_id
      ),
      inserted_rows AS (
        SELECT input.identity_key, inserted.institution_id
        FROM institution_inserted inserted
        JOIN institution_input input
          ON input.openalex_id = inserted.openalex_id
      )
      SELECT identity_key, institution_id FROM institution_updated
      UNION ALL
      SELECT identity_key, institution_id FROM inserted_rows
    `,
    [JSON.stringify(institutions)],
  );
  return new Map(
    result.rows.map((row) => [
      row.identity_key,
      row.institution_id,
    ]),
  );
};

const resolveScanDimensions = async (
  client,
  targetAuthor,
  articles,
  articleLookup,
) => {
  const dimensions = collectScanDimensions(
    targetAuthor,
    articles,
    articleLookup,
  );
  const authorIds = await resolveAuthorsBatchIndexed(
    client,
    dimensions.authors,
  );
  const institutionIds = await resolveInstitutionsBatch(
    client,
    dimensions.institutions,
  );
  const topicIds = await resolveTopicsBatch(client, dimensions.topics);
  const keywordIds = await resolveKeywordsBatch(
    client,
    dimensions.keywords,
  );
  const journalIds = await resolveJournalsBatch(
    client,
    dimensions.journals,
  );
  const hierarchies = articles
    .filter(
      (article) =>
        !findPrefetchedArticle(articleLookup, article)?.issue_id,
    )
    .map((article) => preparePublicationHierarchy(article, journalIds))
    .filter(Boolean);
  const volumes = [
    ...new Map(
      hierarchies.map(({ volume }) => [volume.identity_key, volume]),
    ).values(),
  ];
  const issues = [
    ...new Map(
      hierarchies.map(({ issue }) => [issue.identity_key, issue]),
    ).values(),
  ];
  const volumeIds = await resolveVolumesBatch(client, volumes);
  const issueIds = await resolveIssuesBatch(client, issues, volumeIds);
  return {
    authorIds,
    institutionIds,
    topicIds,
    keywordIds,
    journalIds,
    volumeIds,
    issueIds,
  };
};

const buildResolvedLinks = (article, existing, dimensions) => {
  const authors = prepareAuthors(article.authors)
    .map((author) => ({
      author_id: dimensions.authorIds.get(author.identity_key),
      author_position: author.author_position,
      institution_ids: prepareInstitutions(author.institutions)
        .map((institution) =>
          dimensions.institutionIds.get(institution.identity_key),
        )
        .filter((institutionId) => institutionId != null),
    }))
    .filter((author) => author.author_id != null);

  const topics = prepareTopics(article, existing);
  const primaryTopic = topics.find((topic) => topic.is_primary);
  const primaryTopicId = primaryTopic
    ? dimensions.topicIds.get(primaryTopic.identity_key) || null
    : null;
  const subTopicIds = topics
    .filter((topic) => !topic.is_primary)
    .map((topic) => dimensions.topicIds.get(topic.identity_key))
    .filter(
      (topicId) =>
        topicId != null &&
        String(topicId) !== String(primaryTopicId),
    );

  const keywords = prepareKeywords(article, existing)
    .map((keyword) => ({
      keyword_id: dimensions.keywordIds.get(keyword.identity_key),
      score: keyword.score ?? 0,
    }))
    .filter((keyword) => keyword.keyword_id != null);
  const hierarchy = preparePublicationHierarchy(
    article,
    dimensions.journalIds,
  );
  const issueId =
    existing?.issue_id ??
    (hierarchy
      ? dimensions.issueIds.get(hierarchy.issue.identity_key)
      : null) ??
    null;

  return {
    authors,
    primaryTopicId,
    subTopicIds: [...new Set(subTopicIds)],
    keywords,
    issueId,
  };
};

const persistResolvedArticle = async (
  client,
  article,
  existing,
  dimensions,
) => {
  const links = buildResolvedLinks(article, existing, dimensions);
  const result = await client.query({
    text: `
      WITH article_updated AS (
        UPDATE "Article" article
        SET
          abstract = COALESCE(article.abstract, $3),
          publication_year = COALESCE(article.publication_year, $4),
          doi = COALESCE(article.doi, $5),
          openalex_id = COALESCE(article.openalex_id, $6),
          citation_count = COALESCE(article.citation_count, $7),
          landing_url = COALESCE(article.landing_url, $8),
          pdf_url = COALESCE(article.pdf_url, $9),
          pages = COALESCE(article.pages, $10),
          is_open_access = COALESCE(article.is_open_access, $11),
          "references" = COALESCE(article."references", $12::jsonb),
          reference_count = COALESCE(article.reference_count, $13),
          primary_topic = COALESCE(article.primary_topic, $14::bigint),
          issue_id = COALESCE(article.issue_id, $20::bigint)
        WHERE article.article_id = $1::bigint
          AND $1::bigint IS NOT NULL
          AND (
            (article.abstract IS NULL AND $3 IS NOT NULL) OR
            (article.publication_year IS NULL AND $4 IS NOT NULL) OR
            (article.doi IS NULL AND $5 IS NOT NULL) OR
            (article.openalex_id IS NULL AND $6 IS NOT NULL) OR
            (article.citation_count IS NULL AND $7 IS NOT NULL) OR
            (article.landing_url IS NULL AND $8 IS NOT NULL) OR
            (article.pdf_url IS NULL AND $9 IS NOT NULL) OR
            (article.pages IS NULL AND $10 IS NOT NULL) OR
            (article.is_open_access IS NULL AND $11 IS NOT NULL) OR
            (article."references" IS NULL AND $12::jsonb IS NOT NULL) OR
            (article.reference_count IS NULL AND $13 IS NOT NULL) OR
            (article.primary_topic IS NULL AND $14::bigint IS NOT NULL) OR
            (article.issue_id IS NULL AND $20::bigint IS NOT NULL)
          )
        RETURNING article.*, false AS created
      ),
      article_existing AS (
        SELECT article.*, false AS created
        FROM "Article" article
        WHERE article.article_id = $1::bigint
          AND $1::bigint IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM article_updated)
      ),
      article_inserted AS (
        INSERT INTO "Article" (
          title, abstract, publication_year, doi, openalex_id,
          citation_count, landing_url, pdf_url, pages, is_open_access,
          "references", reference_count, primary_topic, issue_id
        )
        SELECT
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::jsonb, $13, $14::bigint, $20::bigint
        WHERE $1::bigint IS NULL
        ON CONFLICT DO NOTHING
        RETURNING "Article".*, true AS created
      ),
      article_row AS (
        SELECT * FROM article_updated
        UNION ALL
        SELECT * FROM article_existing
        UNION ALL
        SELECT * FROM article_inserted
      ),
      author_links AS (
        INSERT INTO "Author_Article" (
          author_id, article_id, author_position
        )
        SELECT author.author_id, article.article_id, author.author_position
        FROM unnest(
          $15::bigint[],
          $16::text[]
        ) AS author(author_id, author_position)
        CROSS JOIN article_row article
        ON CONFLICT (author_id, article_id)
        DO UPDATE SET author_position = COALESCE(
          "Author_Article".author_position,
          EXCLUDED.author_position
        )
        WHERE "Author_Article".author_position IS NULL
          AND EXCLUDED.author_position IS NOT NULL
        RETURNING 1
      ),
      institution_links AS (
        INSERT INTO "Institution_Author" (
          author_id,
          institution_id,
          year
        )
        SELECT
          author.author_id,
          institution.value::bigint,
          article.publication_year
        FROM jsonb_to_recordset($21::jsonb) AS author(
          author_id bigint,
          institution_ids jsonb
        )
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(author.institution_ids, '[]'::jsonb)
        ) institution(value)
        CROSS JOIN article_row article
        WHERE article.publication_year IS NOT NULL
        ON CONFLICT DO NOTHING
        RETURNING 1
      ),
      topic_links AS (
        INSERT INTO "Sub_Topic" (article_id, topic_id)
        SELECT article.article_id, topic.topic_id
        FROM unnest($17::bigint[]) AS topic(topic_id)
        CROSS JOIN article_row article
        WHERE topic.topic_id IS DISTINCT FROM article.primary_topic
        ON CONFLICT DO NOTHING
        RETURNING 1
      ),
      keyword_links AS (
        INSERT INTO "Keyword_Article" (article_id, keyword_id, score)
        SELECT article.article_id, keyword.keyword_id, keyword.score
        FROM unnest(
          $18::bigint[],
          $19::double precision[]
        ) AS keyword(keyword_id, score)
        CROSS JOIN article_row article
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      SELECT
        article.article_id,
        article.created,
        article.primary_topic,
        article.issue_id,
        (SELECT COUNT(*)::int FROM topic_links) AS topics_linked,
        (SELECT COUNT(*)::int FROM keyword_links) AS keywords_linked,
        (SELECT COUNT(*)::int FROM institution_links)
          AS institutions_linked
      FROM article_row article
    `,
    values: [
      existing?.article_id ?? null,
      article.title,
      article.abstract ?? null,
      article.publication_year ?? null,
      normalizeDoi(article.doi),
      normalizeOpenAlexId(article.openalex_id, "W"),
      article.citation_count ?? null,
      article.landing_url ?? null,
      article.pdf_url ?? null,
      article.pages ?? null,
      article.is_open_access ?? null,
      serializeJson(article.references),
      article.reference_count ?? null,
      links.primaryTopicId,
      links.authors.map((author) => author.author_id),
      links.authors.map((author) => author.author_position ?? null),
      links.subTopicIds,
      links.keywords.map((keyword) => keyword.keyword_id),
      links.keywords.map((keyword) => keyword.score),
      links.issueId,
      JSON.stringify(links.authors),
    ],
  });

  const row = result.rows[0];
  if (!row) {
    const error = new Error(
      "KhÃ´ng thá»ƒ táº¡o hoáº·c cáº­p nháº­t bÃ i bÃ¡o do xung Ä‘á»™t Ä‘á»“ng thá»i",
    );
    error.code = "ARTICLE_CONCURRENT_CONFLICT";
    throw error;
  }
  const updateFields = articleInsertFields.filter(
    (field) => field !== "title",
  );
  return {
    row,
    created: Boolean(row.created),
    filledFields: existing
      ? countFillableFields(existing, article, updateFields)
      : 0,
    topicsChanged:
      (!existing?.primary_topic && row.primary_topic != null) ||
      Number(row.topics_linked || 0) > 0,
    keywordsChanged: Number(row.keywords_linked || 0) > 0,
    institutionsChanged:
      Number(row.institutions_linked || 0) > 0,
    issueChanged:
      !existing?.issue_id && row.issue_id != null,
  };
};

const buildBulkArticleInput = (
  scanIndex,
  article,
  existing,
  dimensions,
) => {
  const links = buildResolvedLinks(article, existing, dimensions);
  return {
    scan_index: scanIndex,
    existing_id: existing?.article_id ?? null,
    title: article.title,
    abstract: article.abstract ?? null,
    publication_year: article.publication_year ?? null,
    doi: normalizeDoi(article.doi),
    openalex_id: normalizeOpenAlexId(article.openalex_id, "W"),
    citation_count: article.citation_count ?? null,
    landing_url: article.landing_url ?? null,
    pdf_url: article.pdf_url ?? null,
    pages: article.pages ?? null,
    is_open_access: article.is_open_access ?? null,
    references_json: article.references ?? null,
    reference_count: article.reference_count ?? null,
    primary_topic_id: links.primaryTopicId,
    issue_id: links.issueId,
    authors: links.authors,
    sub_topic_ids: links.subTopicIds,
    keywords: links.keywords,
  };
};

const toArticlePersistenceResult = (article, existing, row) => {
  const updateFields = articleInsertFields.filter(
    (field) => field !== "title",
  );
  return {
    row,
    created: Boolean(row.created),
    filledFields: existing
      ? countFillableFields(existing, article, updateFields)
      : 0,
    topicsChanged:
      (!existing?.primary_topic && row.primary_topic != null) ||
      Number(row.topics_linked || 0) > 0,
    keywordsChanged: Number(row.keywords_linked || 0) > 0,
    institutionsChanged:
      Number(row.institutions_linked || 0) > 0,
    issueChanged:
      !existing?.issue_id && row.issue_id != null,
  };
};

const persistResolvedChunk = async (client, items, dimensions) => {
  const input = items.map(({ scanIndex, article, existing }) =>
    buildBulkArticleInput(scanIndex, article, existing, dimensions),
  );
  const result = await client.query({
    text: `
      WITH article_input AS MATERIALIZED (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS input(
          scan_index integer,
          existing_id bigint,
          title text,
          abstract text,
          publication_year integer,
          doi text,
          openalex_id text,
          citation_count integer,
          landing_url text,
          pdf_url text,
          pages text,
          is_open_access boolean,
          references_json jsonb,
          reference_count integer,
          primary_topic_id bigint,
          issue_id bigint,
          authors jsonb,
          sub_topic_ids jsonb,
          keywords jsonb
        )
      ),
      article_updated AS (
        UPDATE "Article" article
        SET
          abstract = COALESCE(article.abstract, input.abstract),
          publication_year = COALESCE(
            article.publication_year,
            input.publication_year
          ),
          doi = COALESCE(article.doi, input.doi),
          openalex_id = COALESCE(
            article.openalex_id,
            input.openalex_id
          ),
          citation_count = COALESCE(
            article.citation_count,
            input.citation_count
          ),
          landing_url = COALESCE(
            article.landing_url,
            input.landing_url
          ),
          pdf_url = COALESCE(article.pdf_url, input.pdf_url),
          pages = COALESCE(article.pages, input.pages),
          is_open_access = COALESCE(
            article.is_open_access,
            input.is_open_access
          ),
          "references" = COALESCE(
            article."references",
            input.references_json
          ),
          reference_count = COALESCE(
            article.reference_count,
            input.reference_count
          ),
          primary_topic = COALESCE(
            article.primary_topic,
            input.primary_topic_id
          ),
          issue_id = COALESCE(article.issue_id, input.issue_id)
        FROM article_input input
        WHERE article.article_id = input.existing_id
          AND input.existing_id IS NOT NULL
          AND (
            (article.abstract IS NULL AND input.abstract IS NOT NULL) OR
            (
              article.publication_year IS NULL AND
              input.publication_year IS NOT NULL
            ) OR
            (article.doi IS NULL AND input.doi IS NOT NULL) OR
            (
              article.openalex_id IS NULL AND
              input.openalex_id IS NOT NULL
            ) OR
            (
              article.citation_count IS NULL AND
              input.citation_count IS NOT NULL
            ) OR
            (
              article.landing_url IS NULL AND
              input.landing_url IS NOT NULL
            ) OR
            (article.pdf_url IS NULL AND input.pdf_url IS NOT NULL) OR
            (article.pages IS NULL AND input.pages IS NOT NULL) OR
            (
              article.is_open_access IS NULL AND
              input.is_open_access IS NOT NULL
            ) OR
            (
              article."references" IS NULL AND
              input.references_json IS NOT NULL
            ) OR
            (
              article.reference_count IS NULL AND
              input.reference_count IS NOT NULL
            ) OR
            (
              article.primary_topic IS NULL AND
              input.primary_topic_id IS NOT NULL
            ) OR
            (article.issue_id IS NULL AND input.issue_id IS NOT NULL)
          )
        RETURNING article.*, input.scan_index, false AS created
      ),
      article_existing AS (
        SELECT article.*, input.scan_index, false AS created
        FROM "Article" article
        JOIN article_input input
          ON input.existing_id = article.article_id
        WHERE input.existing_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM article_updated updated
            WHERE updated.scan_index = input.scan_index
          )
      ),
      article_inserted_rows AS (
        INSERT INTO "Article" (
          title, abstract, publication_year, doi, openalex_id,
          citation_count, landing_url, pdf_url, pages, is_open_access,
          "references", reference_count, primary_topic, issue_id
        )
        SELECT
          input.title,
          input.abstract,
          input.publication_year,
          input.doi,
          input.openalex_id,
          input.citation_count,
          input.landing_url,
          input.pdf_url,
          input.pages,
          input.is_open_access,
          input.references_json,
          input.reference_count,
          input.primary_topic_id,
          input.issue_id
        FROM article_input input
        WHERE input.existing_id IS NULL
        ON CONFLICT DO NOTHING
        RETURNING "Article".*
      ),
      inserted_matches AS (
        SELECT input.scan_index, inserted.article_id
        FROM article_input input
        JOIN article_inserted_rows inserted
          ON input.doi IS NOT NULL
         AND lower(trim(inserted.doi)) = input.doi
        WHERE input.existing_id IS NULL
        UNION ALL
        SELECT input.scan_index, inserted.article_id
        FROM article_input input
        JOIN article_inserted_rows inserted
          ON input.openalex_id IS NOT NULL
         AND upper(trim(inserted.openalex_id)) =
             upper(trim(input.openalex_id))
        WHERE input.existing_id IS NULL
          AND input.doi IS NULL
      ),
      article_inserted AS (
        SELECT
          inserted.*,
          matched.scan_index,
          true AS created
        FROM article_inserted_rows inserted
        JOIN inserted_matches matched
          ON matched.article_id = inserted.article_id
      ),
      article_row AS (
        SELECT * FROM article_updated
        UNION ALL
        SELECT * FROM article_existing
        UNION ALL
        SELECT * FROM article_inserted
      ),
      author_links AS (
        INSERT INTO "Author_Article" (
          author_id, article_id, author_position
        )
        SELECT
          author.author_id,
          article.article_id,
          author.author_position
        FROM article_row article
        JOIN article_input input USING (scan_index)
        CROSS JOIN LATERAL jsonb_to_recordset(
          COALESCE(input.authors, '[]'::jsonb)
        ) AS author(author_id bigint, author_position text)
        ON CONFLICT (author_id, article_id)
        DO UPDATE SET author_position = COALESCE(
          "Author_Article".author_position,
          EXCLUDED.author_position
        )
        WHERE "Author_Article".author_position IS NULL
          AND EXCLUDED.author_position IS NOT NULL
        RETURNING article_id
      ),
      institution_links AS (
        INSERT INTO "Institution_Author" (
          author_id,
          institution_id,
          year
        )
        SELECT
          author.author_id,
          institution.value::bigint,
          article.publication_year
        FROM article_row article
        JOIN article_input input USING (scan_index)
        CROSS JOIN LATERAL jsonb_to_recordset(
          COALESCE(input.authors, '[]'::jsonb)
        ) AS author(author_id bigint, institution_ids jsonb)
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(author.institution_ids, '[]'::jsonb)
        ) AS institution(value)
        WHERE article.publication_year IS NOT NULL
        ON CONFLICT DO NOTHING
        RETURNING author_id, year
      ),
      topic_links AS (
        INSERT INTO "Sub_Topic" (article_id, topic_id)
        SELECT
          article.article_id,
          topic.value::bigint
        FROM article_row article
        JOIN article_input input USING (scan_index)
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(input.sub_topic_ids, '[]'::jsonb)
        ) AS topic(value)
        WHERE topic.value::bigint IS DISTINCT FROM article.primary_topic
        ON CONFLICT DO NOTHING
        RETURNING article_id
      ),
      keyword_links AS (
        INSERT INTO "Keyword_Article" (article_id, keyword_id, score)
        SELECT
          article.article_id,
          keyword.keyword_id,
          keyword.score
        FROM article_row article
        JOIN article_input input USING (scan_index)
        CROSS JOIN LATERAL jsonb_to_recordset(
          COALESCE(input.keywords, '[]'::jsonb)
        ) AS keyword(keyword_id bigint, score double precision)
        ON CONFLICT DO NOTHING
        RETURNING article_id
      )
      SELECT
        article.scan_index,
        article.article_id,
        article.created,
        article.primary_topic,
        article.issue_id,
        (
          SELECT COUNT(*)::int
          FROM topic_links
          WHERE topic_links.article_id = article.article_id
        ) AS topics_linked,
        (
          SELECT COUNT(*)::int
          FROM keyword_links
          WHERE keyword_links.article_id = article.article_id
        ) AS keywords_linked,
        (
          SELECT COUNT(*)::int
          FROM institution_links link
          WHERE link.year = article.publication_year
            AND EXISTS (
              SELECT 1
              FROM jsonb_to_recordset(
                COALESCE(input.authors, '[]'::jsonb)
              ) AS linked_author(author_id bigint)
              WHERE linked_author.author_id = link.author_id
            )
        ) AS institutions_linked
      FROM article_row article
      JOIN article_input input USING (scan_index)
      ORDER BY article.scan_index
    `,
    values: [JSON.stringify(input)],
  });

  if (result.rows.length !== items.length) {
    const error = new Error(
      "KhÃ´ng thá»ƒ táº¡o hoáº·c cáº­p nháº­t Ä‘áº§y Ä‘á»§ chunk bÃ i bÃ¡o",
    );
    error.code = "ARTICLE_CHUNK_CONCURRENT_CONFLICT";
    throw error;
  }

  const rowsByIndex = new Map(
    result.rows.map((row) => [Number(row.scan_index), row]),
  );
  return items.map(({ scanIndex, article, existing }) => {
    const row = rowsByIndex.get(scanIndex);
    if (!row) {
      const error = new Error(
        `Thiáº¿u káº¿t quáº£ lÆ°u cho article táº¡i vá»‹ trÃ­ ${scanIndex}`,
      );
      error.code = "ARTICLE_CHUNK_RESULT_MISSING";
      throw error;
    }
    return {
      scanIndex,
      result: toArticlePersistenceResult(article, existing, row),
    };
  });
};

const recordPersistenceResult = (
  summary,
  articleResult,
) => {
  if (articleResult.created) {
    summary.created += 1;
  } else if (
    articleResult.filledFields > 0 ||
    articleResult.topicsChanged ||
    articleResult.keywordsChanged ||
    articleResult.institutionsChanged ||
    articleResult.issueChanged
  ) {
    summary.filled_missing += 1;
  } else {
    summary.already_existed += 1;
  }
};

const persistItemsIndividually = async (
  client,
  items,
  dimensions,
  summary,
) => {
  const persistedItems = [];
  for (const { scanIndex, article, existing } of items) {
    const savepoint = `orcid_article_${scanIndex}`;
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      const articleResult = await persistResolvedArticle(
        client,
        article,
        existing,
        dimensions,
      );
      recordPersistenceResult(
        summary,
        articleResult,
      );
      persistedItems.push({
        scanIndex,
        articleId: articleResult.row.article_id,
      });
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    } catch (error) {
      summary.failed_to_persist += 1;
      await client.query(
        `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`,
      );
      logger.error(
        `[ORCID Scan] KhÃ´ng thá»ƒ lÆ°u article táº¡i vá»‹ trÃ­ ${scanIndex}:`,
        error,
      );
    }
  }
  return persistedItems;
};

const persistResolvedItems = async (
  client,
  items,
  dimensions,
  summary,
) => {
  const persistedItems = [];
  for (
    let chunkStart = 0;
    chunkStart < items.length;
    chunkStart += ARTICLE_CHUNK_SIZE
  ) {
    const chunk = items.slice(
      chunkStart,
      chunkStart + ARTICLE_CHUNK_SIZE,
    );
    const activeItems = chunk.filter(({ existing }) => {
      if (!existing?.is_deleted) return true;
      summary.skipped_deleted += 1;
      return false;
    });
    if (!activeItems.length) continue;

    if (activeItems.length === 1) {
      persistedItems.push(...await persistItemsIndividually(
        client,
        activeItems,
        dimensions,
        summary,
      ));
      continue;
    }

    const chunkSavepoint = `orcid_chunk_${chunkStart}`;
    await client.query(`SAVEPOINT ${chunkSavepoint}`);
    try {
      const results = await persistResolvedChunk(
        client,
        activeItems,
        dimensions,
      );
      for (const { result } of results) {
        recordPersistenceResult(summary, result);
      }
      persistedItems.push(
        ...results.map(({ scanIndex, result }) => ({
          scanIndex,
          articleId: result.row.article_id,
        })),
      );
      await client.query(`RELEASE SAVEPOINT ${chunkSavepoint}`);
    } catch (error) {
      await client.query(
        `ROLLBACK TO SAVEPOINT ${chunkSavepoint}; RELEASE SAVEPOINT ${chunkSavepoint}`,
      );
      logger.warn(
        `[ORCID Scan] Bulk chunk ${chunkStart / ARTICLE_CHUNK_SIZE} lá»—i; chuyá»ƒn sang lÆ°u tá»«ng article`,
        {
          code: error.code || "ARTICLE_CHUNK_FAILED",
          item_count: activeItems.length,
        },
      );
      persistedItems.push(...await persistItemsIndividually(
        client,
        activeItems,
        dimensions,
        summary,
      ));
    }
  }
  return persistedItems;
};

const recordOrcidScanJobItems = async (
  client,
  jobId,
  persistedItems,
) => {
  if (!jobId) return null;

  const articleIds = [
    ...new Set(
      persistedItems
        .map(({ articleId }) => String(articleId || ""))
        .filter(Boolean),
    ),
  ];
  const result = await client.query(
    `
      WITH input AS MATERIALIZED (
        SELECT DISTINCT value::bigint AS article_id
        FROM jsonb_array_elements_text($2::jsonb)
      ),
      inserted AS (
        INSERT INTO public."Orcid_Scan_Job_Item" (
          job_id,
          article_id
        )
        SELECT $1::uuid, input.article_id
        FROM input
        ON CONFLICT (job_id, article_id) DO NOTHING
        RETURNING item_id
      )
      SELECT COUNT(*)::integer AS available_count
      FROM public."Orcid_Scan_Job_Item"
      WHERE job_id = $1::uuid
    `,
    [jobId, JSON.stringify(articleIds)],
  );
  return Number(result.rows[0]?.available_count || 0);
};

const queryAuthorArticlesPage = async (
  client,
  authorId,
  { page = 1, limit = SCAN_RESPONSE_LIMIT } = {},
) => {
  const offset = (page - 1) * limit;
  const result = await client.query(
    `
      WITH linked_articles AS MATERIALIZED (
        SELECT
          a.article_id,
          a.title,
          a.abstract,
          a.publication_year,
          a.doi,
          COALESCE(a.citation_count, 0) AS cited_by_count,
          COALESCE(a.citation_count, 0) AS citation_count,
          a.primary_topic,
          a.created_at,
          journal.journal_id::text AS journal_id,
          journal.display_name AS journal_name,
          journal.issn AS journal_issn
        FROM "Article" a
        JOIN "Author_Article" aa ON aa.article_id = a.article_id
        LEFT JOIN "Issue" issue
          ON issue.issue_id = a.issue_id
         AND COALESCE(issue.is_deleted, false) = false
        LEFT JOIN "Volume" volume
          ON volume.volume_id = issue.volume_id
         AND COALESCE(volume.is_deleted, false) = false
        LEFT JOIN "Journal" journal
          ON journal.journal_id = volume.journal_id
         AND COALESCE(journal.is_deleted, false) = false
        WHERE aa.author_id = $1
          AND COALESCE(a.is_deleted, false) = false
      ),
      page_rows AS (
        SELECT *
        FROM linked_articles
        ORDER BY publication_year DESC, article_id DESC
        LIMIT $2 OFFSET $3
      )
      SELECT page_rows.*, totals.total_count
      FROM (
        SELECT COUNT(*)::integer AS total_count
        FROM linked_articles
      ) totals
      LEFT JOIN page_rows ON true
      ORDER BY page_rows.publication_year DESC, page_rows.article_id DESC
    `,
    [authorId, limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  const articles = result.rows
    .filter((row) => row.article_id != null)
    .map(({ total_count: _totalCount, ...article }) => article);
  return { articles, total };
};

export const persistOrcidScan = async (
  { targetAuthor, articles },
  { databasePool = pool } = {},
) => {
  const client = await databasePool.connect();
  const summary = {
    created: 0,
    filled_missing: 0,
    already_existed: 0,
    skipped_deleted: 0,
    failed_to_persist: 0,
  };
  try {
    await client.query("BEGIN");
    await lockScanIdentifiers(client, targetAuthor, articles);
    const targetResult = await upsertAuthor(client, targetAuthor, {
      isTarget: true,
      skipLock: true,
    });
    const targetRow = targetResult.row;
    const articleLookup = await prefetchArticles(client, articles);
    // Resolve shared dimensions once for the whole scan. This deliberately
    // happens outside article savepoints so each article only writes its core
    // row and links. If one article later fails, an unlinked dimension row may
    // remain; it is stable-ID/name deduplicated and reusable by future scans.
    const dimensions = await resolveScanDimensions(
      client,
      targetAuthor,
      articles,
      articleLookup,
    );

    const items = articles.map((rawArticle, scanIndex) => {
      const article = ensureTargetAuthor(rawArticle, targetAuthor);
      return {
        scanIndex,
        article,
        existing: findPrefetchedArticle(articleLookup, article),
      };
    });

    await persistResolvedItems(client, items, dimensions, summary);

    const authorArticles = await queryAuthorArticlesPage(
      client,
      targetRow.author_id,
    );
    const refreshedTarget = await client.query(
      `SELECT * FROM "Author" WHERE author_id = $1`,
      [targetRow.author_id],
    );

    await client.query("COMMIT");
    return {
      author: refreshedTarget.rows[0],
      articles: authorArticles.articles,
      article_total: authorArticles.total,
      summary,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createPersistenceSummary = () => ({
  created: 0,
  filled_missing: 0,
  already_existed: 0,
  skipped_deleted: 0,
  failed_to_persist: 0,
});

const addPersistenceSummary = (target, source = {}) => {
  for (const key of Object.keys(target)) {
    target[key] += Number(source[key] || 0);
  }
};

export const persistOrcidScanBatched = async (
  { targetAuthor, articles },
  {
    databasePool = pool,
    batchSize = 25,
    batchAttempts = 2,
    onProgress,
    jobId,
  } = {},
) => {
  const client = await databasePool.connect();
  const sourceArticles = Array.isArray(articles) ? articles : [];
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const safeBatchAttempts = Math.max(1, Math.floor(batchAttempts));
  const summary = createPersistenceSummary();
  let targetRow;
  let dimensions;
  let processed = 0;
  let successfulBatches = 0;
  let lastBatchError = null;
  let available = 0;

  try {
    await client.query("BEGIN");
    try {
      await lockScanIdentifiers(client, targetAuthor, sourceArticles);
      const targetResult = await upsertAuthor(client, targetAuthor, {
        isTarget: true,
        skipLock: true,
      });
      targetRow = targetResult.row;
      const articleLookup = await prefetchArticles(
        client,
        sourceArticles,
      );
      dimensions = await resolveScanDimensions(
        client,
        targetAuthor,
        sourceArticles,
        articleLookup,
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    if (jobId) {
      const countResult = await client.query(
        `
          SELECT COUNT(*)::integer AS available_count
          FROM public."Orcid_Scan_Job_Item"
          WHERE job_id = $1::uuid
        `,
        [jobId],
      );
      available = Number(countResult.rows[0]?.available_count || 0);
    }
    await onProgress?.({
      processed: 0,
      total: sourceArticles.length,
      summary: { ...summary },
      authorId: targetRow.author_id,
      available,
    });

    const batches = sourceArticles.length
      ? Array.from(
          {
            length: Math.ceil(sourceArticles.length / safeBatchSize),
          },
          (_, index) => ({
            offset: index * safeBatchSize,
            articles: sourceArticles.slice(
              index * safeBatchSize,
              (index + 1) * safeBatchSize,
            ),
          }),
        )
      : [{ offset: 0, articles: [] }];

    for (const batch of batches) {
      let batchSummary = null;
      let batchError = null;
      let batchAvailable = available;

      for (
        let attempt = 1;
        attempt <= safeBatchAttempts;
        attempt += 1
      ) {
        await client.query("BEGIN");
        try {
          await lockScanIdentifiers(
            client,
            targetAuthor,
            batch.articles,
          );
          const articleLookup = await prefetchArticles(
            client,
            batch.articles,
          );
          const items = batch.articles.map(
            (rawArticle, localIndex) => {
              const article = ensureTargetAuthor(
                rawArticle,
                targetAuthor,
              );
              return {
                scanIndex: batch.offset + localIndex,
                article,
                existing: findPrefetchedArticle(
                  articleLookup,
                  article,
                ),
              };
            },
          );
          const attemptSummary = createPersistenceSummary();
          const persistedItems = await persistResolvedItems(
            client,
            items,
            dimensions,
            attemptSummary,
          );
          const recordedCount = await recordOrcidScanJobItems(
            client,
            jobId,
            persistedItems,
          );
          if (recordedCount != null) batchAvailable = recordedCount;
          await client.query("COMMIT");
          batchSummary = attemptSummary;
          batchError = null;
          successfulBatches += 1;
          break;
        } catch (error) {
          batchError = error;
          lastBatchError = error;
          await client.query("ROLLBACK");
        }
      }

      if (batchSummary) {
        addPersistenceSummary(summary, batchSummary);
        available = batchAvailable;
      } else {
        summary.failed_to_persist += batch.articles.length;
        logger.warn("[ORCID Scan] Batch persistence failed", {
          code: batchError?.code || "ORCID_SCAN_BATCH_FAILED",
          item_count: batch.articles.length,
        });
      }

      processed += batch.articles.length;
      await onProgress?.({
        processed,
        total: sourceArticles.length,
        summary: { ...summary },
        authorId: targetRow.author_id,
        available,
      });
    }

    if (sourceArticles.length && successfulBatches === 0) {
      throw (
        lastBatchError ||
        new Error("KhÃ´ng thá»ƒ lÆ°u dá»¯ liá»‡u ORCID theo batch")
      );
    }

    const authorArticles = await queryAuthorArticlesPage(
      client,
      targetRow.author_id,
    );
    const refreshedTarget = await client.query(
      `SELECT * FROM "Author" WHERE author_id = $1`,
      [targetRow.author_id],
    );
    return {
      author: refreshedTarget.rows[0],
      articles: authorArticles.articles,
      article_total: authorArticles.total,
      available,
      summary,
    };
  } finally {
    client.release();
  }
};



