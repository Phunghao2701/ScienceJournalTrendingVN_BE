import prisma from '../../../config/prisma.js';
import { fetchOpenAlexWorksByIds } from '../../author/services/openAlexApi.service.js';
import {
  normalizeDoi,
  normalizeOpenAlexId,
} from "../../../utils/orcid.js";

const ARTICLE_OPENALEX_SQL =
  "upper(regexp_replace(trim(openalex_id), '^https?://openalex\\.org/', '', 'i'))";

const createHydrationError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const hasReferenceMetadata = (reference) =>
  Boolean(
    reference?.referenced_article_id ||
      reference?.title ||
      reference?.doi ||
      reference?.publication_year,
  );

const needsReferenceHydration = (reference) =>
  !reference?.referenced_article_id && !reference?.title;

const mapLocalArticle = (row) => ({
  openalex_work_id: normalizeOpenAlexId(row.openalex_id, "W"),
  referenced_article_id: row.article_id,
  doi: normalizeDoi(row.doi),
  title: row.title || null,
  publication_year: row.publication_year ?? null,
  landing_url: row.landing_url || null,
  pdf_url: row.pdf_url || null,
  cited_by_count: row.citation_count ?? null,
});

const mapOpenAlexReference = (work) => {
  const location =
    work?.best_oa_location || work?.primary_location || {};
  const source = location?.source || null;
  return {
    openalex_work_id: normalizeOpenAlexId(work?.id, "W"),
    referenced_article_id: null,
    doi: normalizeDoi(work?.doi),
    title: work?.title || null,
    publication_year: Number(work?.publication_year) || null,
    source_name: source?.display_name || null,
    source_url: source?.homepage_url || source?.id || null,
    landing_url: location?.landing_page_url || work?.doi || null,
    pdf_url: location?.pdf_url || null,
    cited_by_count: Number.isFinite(work?.cited_by_count)
      ? work.cited_by_count
      : null,
    type: work?.type || null,
    authors: (work?.authorships || [])
      .map((authorship) => ({
        openalex_id: normalizeOpenAlexId(
          authorship?.author?.id,
          "A",
        ),
        display_name: authorship?.author?.display_name || null,
        author_position: authorship?.author_position || null,
      }))
      .filter((author) => author.openalex_id || author.display_name),
    raw: work || null,
  };
};

const loadHydrationState = async (databasePool, articleId) => {
  const articleResult = await databasePool.$queryRawUnsafe(
    `
      SELECT article_id, "references", is_deleted
      FROM "Article"
      WHERE article_id = $1
    `,
    articleId
  );
  const article = articleResult[0];
  if (!article || article.is_deleted) {
    throw createHydrationError(
      "KhÃ´ng tÃ¬m tháº¥y bÃ i bÃ¡o",
      404,
      "ARTICLE_NOT_FOUND",
    );
  }

  const ids = [
    ...new Set(
      (Array.isArray(article.references) ? article.references : [])
        .map((id) => normalizeOpenAlexId(id, "W"))
        .filter(Boolean),
    ),
  ];
  if (!ids.length) {
    return {
      article,
      ids,
      existingById: new Map(),
      localById: new Map(),
    };
  }

  const compactIds = ids.map((id) => id.split("/").at(-1));
  const [existingResult, localResult] = await Promise.all([
    databasePool.$queryRawUnsafe(
      `
        SELECT *
        FROM "Article_Reference"
        WHERE article_id = $1
          AND openalex_work_id = ANY($2::text[])
      `,
      articleId, ids
    ),
    databasePool.$queryRawUnsafe(
      `
        SELECT
          article_id,
          openalex_id,
          doi,
          title,
          publication_year,
          landing_url,
          pdf_url,
          citation_count
        FROM "Article"
        WHERE ${ARTICLE_OPENALEX_SQL} = ANY($1::text[])
          AND COALESCE(is_deleted, false) = false
      `,
      compactIds
    ),
  ]);

  return {
    article,
    ids,
    existingById: new Map(
      existingResult
        .map((row) => [
          normalizeOpenAlexId(row.openalex_work_id, "W"),
          row,
        ])
        .filter(([id]) => id),
    ),
    localById: new Map(
      localResult.map((row) => {
        const mapped = mapLocalArticle(row);
        return [mapped.openalex_work_id, mapped];
      }),
    ),
  };
};

const persistReferences = async (
  databasePool,
  articleId,
  records,
) => {
  return await databasePool.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        SELECT pg_advisory_xact_lock(
          hashtextextended('article-reference:' || $1::text, 0)
        )
      `,
      articleId
    );
    const articleResult = await tx.$queryRawUnsafe(
      `
        SELECT article_id
        FROM "Article"
        WHERE article_id = $1
          AND COALESCE(is_deleted, false) = false
        FOR UPDATE
      `,
      articleId
    );
    if (!articleResult[0]) {
      throw createHydrationError(
        "KhÃ´ng tÃ¬m tháº¥y bÃ i bÃ¡o",
        404,
        "ARTICLE_NOT_FOUND",
      );
    }

    const keys = records.map((record) => record.reference_key);
    const existingResult = await tx.$queryRawUnsafe(
      `
        SELECT reference_key
        FROM "Article_Reference"
        WHERE article_id = $1
          AND reference_key = ANY($2::text[])
      `,
      articleId, keys
    );
    const existingKeys = new Set(
      existingResult.map((row) => row.reference_key),
    );

    await tx.$executeRawUnsafe(
      `
        WITH reference_input AS MATERIALIZED (
          SELECT *
          FROM jsonb_to_recordset($2::jsonb) AS input(
            reference_key text,
            openalex_work_id text,
            referenced_article_id bigint,
            doi text,
            title text,
            publication_year integer,
            source_name text,
            source_url text,
            landing_url text,
            pdf_url text,
            cited_by_count bigint,
            type text,
            authors jsonb,
            raw jsonb
          )
        )
        INSERT INTO "Article_Reference" (
          article_id,
          reference_key,
          openalex_work_id,
          referenced_article_id,
          doi,
          title,
          publication_year,
          source_name,
          source_url,
          landing_url,
          pdf_url,
          cited_by_count,
          type,
          authors,
          raw
        )
        SELECT
          $1,
          input.reference_key,
          input.openalex_work_id,
          input.referenced_article_id,
          input.doi,
          input.title,
          input.publication_year,
          input.source_name,
          input.source_url,
          input.landing_url,
          input.pdf_url,
          input.cited_by_count,
          input.type,
          input.authors,
          input.raw
        FROM reference_input input
        ON CONFLICT (article_id, reference_key)
        DO UPDATE SET
          openalex_work_id = COALESCE(
            "Article_Reference".openalex_work_id,
            EXCLUDED.openalex_work_id
          ),
          referenced_article_id = COALESCE(
            "Article_Reference".referenced_article_id,
            EXCLUDED.referenced_article_id
          ),
          doi = COALESCE("Article_Reference".doi, EXCLUDED.doi),
          title = COALESCE("Article_Reference".title, EXCLUDED.title),
          publication_year = COALESCE(
            "Article_Reference".publication_year,
            EXCLUDED.publication_year
          ),
          source_name = COALESCE(
            "Article_Reference".source_name,
            EXCLUDED.source_name
          ),
          source_url = COALESCE(
            "Article_Reference".source_url,
            EXCLUDED.source_url
          ),
          landing_url = COALESCE(
            "Article_Reference".landing_url,
            EXCLUDED.landing_url
          ),
          pdf_url = COALESCE(
            "Article_Reference".pdf_url,
            EXCLUDED.pdf_url
          ),
          cited_by_count = COALESCE(
            "Article_Reference".cited_by_count,
            EXCLUDED.cited_by_count
          ),
          type = COALESCE("Article_Reference".type, EXCLUDED.type),
          authors = COALESCE(
            "Article_Reference".authors,
            EXCLUDED.authors
          ),
          raw = COALESCE("Article_Reference".raw, EXCLUDED.raw),
          updated_at = CURRENT_TIMESTAMP
      `,
      articleId, JSON.stringify(records)
    );

    return {
      inserted: records.filter(
        (record) => !existingKeys.has(record.reference_key),
      ).length,
    };
  });
};

export const hydrateArticleReferences = async (
  articleId,
  {
    databasePool = prisma,
    fetchWorks = fetchOpenAlexWorksByIds,
  } = {},
) => {
  const state = await loadHydrationState(databasePool, articleId);
  if (!state.ids.length) {
    return {
      partial: false,
      noReferences: true,
      summary: {
        requested: 0,
        resolved: 0,
        inserted: 0,
        already_available: 0,
        failed: 0,
      },
    };
  }

  const externalIds = state.ids.filter(
    (id) =>
      !state.localById.has(id) &&
      needsReferenceHydration(state.existingById.get(id)),
  );
  const fetched = externalIds.length
    ? await fetchWorks(externalIds)
    : { works: [], failed_ids: [], requested: 0 };
  const externalById = new Map(
    (fetched.works || [])
      .map(mapOpenAlexReference)
      .filter((reference) => reference.openalex_work_id)
      .map((reference) => [
        reference.openalex_work_id,
        reference,
      ]),
  );

  const availableBeforeProvider = state.ids.filter(
    (id) =>
      state.localById.has(id) ||
      hasReferenceMetadata(state.existingById.get(id)),
  ).length;
  if (
    externalIds.length &&
    (fetched.failed_ids || []).length === externalIds.length &&
    availableBeforeProvider === 0
  ) {
    throw createHydrationError(
      "OpenAlex khÃ´ng kháº£ dá»¥ng vÃ  khÃ´ng cÃ³ reference cá»¥c bá»™",
      502,
      "REFERENCE_PROVIDER_UNAVAILABLE",
    );
  }

  const records = state.ids.flatMap((id) => {
    const metadata =
      state.localById.get(id) || externalById.get(id);
    if (!metadata) return [];
    return [{
      reference_key: id,
      openalex_work_id: id,
      referenced_article_id:
        metadata.referenced_article_id ?? null,
      doi: metadata.doi ?? null,
      title: metadata.title ?? null,
      publication_year: metadata.publication_year ?? null,
      source_name: metadata.source_name ?? null,
      source_url: metadata.source_url ?? null,
      landing_url: metadata.landing_url ?? null,
      pdf_url: metadata.pdf_url ?? null,
      cited_by_count: metadata.cited_by_count ?? null,
      type: metadata.type ?? null,
      authors: metadata.authors ?? null,
      raw: metadata.raw ?? null,
    }];
  });
  const persistence = records.length
    ? await persistReferences(databasePool, articleId, records)
    : { inserted: 0 };
  const resolved = state.ids.filter(
    (id) =>
      hasReferenceMetadata(state.existingById.get(id)) ||
      state.localById.has(id) ||
      externalById.has(id),
  ).length;
  const failed = state.ids.length - resolved;

  return {
    partial:
      failed > 0 || (fetched.failed_ids || []).length > 0,
    noReferences: false,
    summary: {
      requested: state.ids.length,
      resolved,
      inserted: persistence.inserted,
      already_available: [...state.existingById.values()].filter(
        hasReferenceMetadata,
      ).length,
      failed,
    },
  };
};



