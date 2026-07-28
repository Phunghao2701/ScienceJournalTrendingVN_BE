import axios from "axios";
import {
  normalizeDoi,
  normalizeIssn,
  normalizeOpenAlexId,
  normalizeOrcid,
} from "../utils/orcid.js";
import { withSourceRetry } from "./orcidScanRetry.service.js";

// OpenAlex `select` supports comma-separated root fields (not nested paths).
// These lists intentionally include every field consumed by the mappers.
export const OPENALEX_WORK_SELECT = [
  "id",
  "type",
  "doi",
  "title",
  "display_name",
  "abstract_inverted_index",
  "publication_year",
  "publication_date",
  "best_oa_location",
  "primary_location",
  "biblio",
  "open_access",
  "cited_by_count",
  "referenced_works",
  "authorships",
  "primary_topic",
  "topics",
  "keywords",
].join(",");

export const OPENALEX_AUTHOR_SELECT = [
  "id",
  "display_name",
  "works_count",
  "cited_by_count",
  "summary_stats",
  "last_known_institutions",
].join(",");

export const OPENALEX_REFERENCE_SELECT = [
  "id",
  "doi",
  "title",
  "publication_year",
  "primary_location",
  "best_oa_location",
  "cited_by_count",
  "type",
  "authorships",
].join(",");

const reconstructAbstract = (invertedIndex) => {
  if (!invertedIndex || typeof invertedIndex !== "object") return null;

  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions || []) {
      words[position] = word;
    }
  }

  const abstract = words.filter(Boolean).join(" ").trim();
  return abstract || null;
};

const mapOpenAlexAuthor = (authorship) => {
  const author = authorship?.author || {};
  const institutions = (authorship?.institutions || [])
    .map((institution) => ({
      openalex_id: normalizeOpenAlexId(institution?.id, "I"),
      display_name: institution?.display_name?.trim() || null,
      country_code:
        institution?.country_code?.trim()?.toUpperCase() || null,
      type: institution?.type?.trim()?.toLowerCase() || null,
    }))
    .filter(
      (institution) =>
        institution.openalex_id && institution.display_name,
    );
  const institution = institutions[0] || null;

  return {
    display_name: author.display_name || null,
    orcid: normalizeOrcid(author.orcid),
    openalex_id: normalizeOpenAlexId(author.id, "A"),
    author_position: authorship?.author_position || null,
    last_known_institution: institution?.display_name || null,
    last_known_institution_id:
      institution?.openalex_id || null,
    institutions,
  };
};

export const mapOpenAlexWork = (work) => {
  const bestLocation = work?.best_oa_location || work?.primary_location || {};
  const source =
    work?.primary_location?.source || work?.best_oa_location?.source || null;
  const sourceIssns = [
    ...new Set(
      [
        source?.issn_l,
        ...(Array.isArray(source?.issn) ? source.issn : []),
      ]
        .map(normalizeIssn)
        .filter(Boolean),
    ),
  ];
  const topics = (work?.topics || [])
    .filter((topic) => topic?.display_name)
    .map((topic) => ({
      display_name: topic.display_name,
      score: Number(topic.score) || 0,
    }));
  const keywords = (work?.keywords || [])
    .filter((keyword) => keyword?.display_name)
    .map((keyword) => ({
      display_name: keyword.display_name,
      score: Number(keyword.score) || 0,
    }));

  return {
    source: "openalex",
    source_type: work?.type || null,
    doi: normalizeDoi(work?.doi),
    openalex_id: normalizeOpenAlexId(work?.id, "W"),
    title: work?.title || work?.display_name || null,
    abstract: reconstructAbstract(work?.abstract_inverted_index),
    publication_year: Number(work?.publication_year) || null,
    publication_date: work?.publication_date || null,
    landing_url: bestLocation?.landing_page_url || work?.doi || null,
    pdf_url: bestLocation?.pdf_url || null,
    pages:
      work?.biblio?.first_page && work?.biblio?.last_page
        ? `${work.biblio.first_page}-${work.biblio.last_page}`
        : work?.biblio?.first_page || null,
    is_open_access:
      typeof work?.open_access?.is_oa === "boolean"
        ? work.open_access.is_oa
        : null,
    citation_count: Number.isFinite(work?.cited_by_count)
      ? work.cited_by_count
      : null,
    reference_count: Array.isArray(work?.referenced_works)
      ? work.referenced_works.length
      : null,
    references: Array.isArray(work?.referenced_works)
      ? work.referenced_works
      : null,
    authors: (work?.authorships || []).map(mapOpenAlexAuthor),
    primary_topic: work?.primary_topic?.display_name
      ? {
          display_name: work.primary_topic.display_name,
          score: Number(work.primary_topic.score) || 0,
        }
      : null,
    topics,
    keywords,
    journal:
      source?.display_name &&
      (normalizeOpenAlexId(source?.id, "S") || sourceIssns.length)
        ? {
            source_id: normalizeOpenAlexId(source.id, "S"),
            display_name: source.display_name,
            issn_l: normalizeIssn(source.issn_l),
            issns: sourceIssns,
            type: source.type || null,
            is_open_access:
              typeof source.is_oa === "boolean" ? source.is_oa : null,
          }
        : null,
    volume_number: work?.biblio?.volume || null,
    issue_number: work?.biblio?.issue || null,
  };
};

const openAlexParams = () => {
  const params = {};
  if (process.env.OPENALEX_API_KEY) {
    params.api_key = process.env.OPENALEX_API_KEY;
  }
  if (process.env.CROSSREF_MAILTO) {
    params.mailto = process.env.CROSSREF_MAILTO;
  }
  return params;
};

export const fetchOpenAlexWorksByIds = async (
  workIds,
  {
    httpClient = axios,
    signal,
    chunkSize = 100,
    concurrency = 2,
    timeout = 8000,
  } = {},
) => {
  const ids = [
    ...new Set(
      (workIds || [])
        .map((id) => normalizeOpenAlexId(id, "W"))
        .filter(Boolean),
    ),
  ];
  const chunks = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }

  const works = [];
  const failedIds = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor];
      cursor += 1;
      try {
        const response = await httpClient.get("/works", {
          baseURL: "https://api.openalex.org",
          params: {
            ...openAlexParams(),
            filter: `openalex_id:${chunk
              .map((id) => id.split("/").at(-1))
              .join("|")}`,
            "per-page": chunk.length,
            select: OPENALEX_REFERENCE_SELECT,
          },
          timeout,
          signal,
        });
        works.push(...(response?.data?.results || []));
      } catch {
        failedIds.push(...chunk);
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, chunks.length) },
      () => worker(),
    ),
  );
  return {
    works,
    failed_ids: failedIds,
    requested: ids.length,
  };
};

const mapOpenAlexProfile = (author, orcid) => ({
  orcid: normalizeOrcid(orcid),
  display_name: author?.display_name || null,
  openalex_id: normalizeOpenAlexId(author?.id, "A"),
  works_count: Number.isFinite(author?.works_count) ? author.works_count : null,
  cited_by_count: Number.isFinite(author?.cited_by_count)
    ? author.cited_by_count
    : null,
  h_index: Number.isFinite(author?.summary_stats?.h_index)
    ? author.summary_stats.h_index
    : null,
  i10_index: Number.isFinite(author?.summary_stats?.i10_index)
    ? author.summary_stats.i10_index
    : null,
  last_known_institution:
    author?.last_known_institutions?.[0]?.display_name || null,
  last_known_institution_id:
    normalizeOpenAlexId(author?.last_known_institutions?.[0]?.id) || null,
});

export const fetchOpenAlexData = async (
  orcid,
  {
    httpClient = axios,
    signal,
    onProgress,
    pageSize =
      Number(process.env.OPENALEX_SCAN_PAGE_SIZE) || 100,
    maxWorks = Number.POSITIVE_INFINITY,
  } = {},
) => {
  const baseConfig = {
    baseURL: "https://api.openalex.org",
    signal,
    timeout: 10000,
  };
  const sharedParams = openAlexParams();

  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const safeMaxWorks = Number.isFinite(Number(maxWorks))
    ? Math.max(1, Math.floor(Number(maxWorks)))
    : Number.POSITIVE_INFINITY;
  const authorPromise = withSourceRetry(
    () =>
      httpClient.get("/authors", {
        ...baseConfig,
        params: {
          ...sharedParams,
          filter: `orcid:${orcid}`,
          per_page: 1,
          select: OPENALEX_AUTHOR_SELECT,
        },
      }),
    { signal },
  );
  const worksPromise = (async () => {
    const works = [];
    const seenCursors = new Set();
    let cursor = "*";
    let page = 0;
    let total = null;

    while (cursor && works.length < safeMaxWorks) {
      const requestSize = Math.min(
        safePageSize,
        safeMaxWorks - works.length,
      );
      let response;
      try {
        response = await withSourceRetry(
          () =>
            httpClient.get("/works", {
              ...baseConfig,
              params: {
                ...sharedParams,
                filter: `author.orcid:${orcid},type:article`,
                per_page: requestSize,
                cursor,
                sort: "publication_date:desc",
                select: OPENALEX_WORK_SELECT,
              },
            }),
          { signal },
        );
      } catch (error) {
        if (signal?.aborted || works.length === 0) throw error;
        return {
          works,
          total,
          page,
          partial: true,
          error:
            error?.code ||
            error?.response?.status ||
            error?.message ||
            "OPENALEX_PAGE_FAILED",
        };
      }
      const results = Array.isArray(response.data?.results)
        ? response.data.results
        : [];
      const remaining = safeMaxWorks - works.length;
      works.push(...results.slice(0, remaining).map(mapOpenAlexWork));
      page += 1;
      total = Number.isFinite(Number(response.data?.meta?.count))
        ? Number(response.data.meta.count)
        : total;
      await onProgress?.({
        source: "openalex",
        fetched: works.length,
        total: Number.isFinite(safeMaxWorks) && total != null
          ? Math.min(total, safeMaxWorks)
          : total,
        page,
      });

      if (works.length >= safeMaxWorks) {
        return { works, total, page, partial: false, error: null };
      }

      const nextCursor = response.data?.meta?.next_cursor;
      if (!results.length || !nextCursor) {
        return { works, total, page, partial: false, error: null };
      }
      if (seenCursors.has(nextCursor)) {
        return {
          works,
          total,
          page,
          partial: true,
          error: "OPENALEX_CURSOR_NOT_ADVANCING",
        };
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    return { works, total, page, partial: false, error: null };
  })();
  const [authorResult, worksResult] = await Promise.allSettled([
    authorPromise,
    worksPromise,
  ]);

  if (authorResult.status === "rejected" && worksResult.status === "rejected") {
    throw worksResult.reason || authorResult.reason;
  }

  const author =
    authorResult.status === "fulfilled"
      ? authorResult.value.data?.results?.[0]
      : null;
  const works =
    worksResult.status === "fulfilled" ? worksResult.value.works : [];

  return {
    profile: mapOpenAlexProfile(author, orcid),
    works,
    partial:
      authorResult.status === "rejected" ||
      worksResult.status === "rejected" ||
      worksResult.value?.partial === true,
    error:
      worksResult.status === "rejected"
        ? worksResult.reason?.code || worksResult.reason?.message
        : worksResult.value?.error || null,
  };
};
