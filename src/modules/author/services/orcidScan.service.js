import {
  fetchCrossrefWorkByDoi,
  fetchCrossrefWorksByOrcid,
} from "./crossrefApi.service.js";
import { fetchOpenAlexData } from "./openAlexApi.service.js";
import { fetchOrcidData } from "./orcidApi.service.js";
import { persistOrcidScanInBatches } from "./orcidScanBatchPersistence.service.js";
import logger from '../../../utils/logger.js';
import {
  extractOrcidId,
  normalizeDoi,
  normalizeIssn,
  normalizeOpenAlexId,
  normalizeOrcid,
} from "../../../utils/orcid.js";

const CROSSREF_ENRICH_MAX_TARGETS = 10;
const CROSSREF_ENRICH_CONCURRENCY = 3;
const CROSSREF_ENRICH_BUDGET_MS = 5000;
const SCAN_ARTICLE_LIMIT = 100;
const RESPONSE_PAGE = 1;
const RESPONSE_LIMIT = 20;

const SOURCE_ORDER = ["crossref", "openalex", "orcid"];
const AUTHOR_SOURCE_ORDER = ["openalex", "crossref", "orcid"];

const isPresent = (value) => value !== null && value !== undefined && value !== "";

const pickField = (records, field, sourceOrder = SOURCE_ORDER) => {
  for (const source of sourceOrder) {
    const record = records.find(
      (candidate) =>
        candidate.source === source && isPresent(candidate[field]),
    );
    if (record) return record[field];
  }
  return null;
};

const authorKey = (author) => {
  const orcid = normalizeOrcid(author?.orcid);
  if (orcid) return `orcid:${orcid}`;

  const openAlexId = normalizeOpenAlexId(author?.openalex_id, "A");
  return openAlexId ? `openalex:${openAlexId}` : null;
};

const mergeInstitutions = (...groups) => {
  const institutions = new Map();
  for (const institution of groups.flat()) {
    const openalexId = normalizeOpenAlexId(
      institution?.openalex_id,
      "I",
    );
    const displayName = institution?.display_name?.trim();
    if (!openalexId || !displayName) continue;
    const current = institutions.get(openalexId) || {};
    institutions.set(openalexId, {
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
  return [...institutions.values()];
};

const mergeAuthorRecords = (records) => {
  const merged = [];
  const orderedRecords = [...records].sort(
    (left, right) =>
      AUTHOR_SOURCE_ORDER.indexOf(left.source) -
      AUTHOR_SOURCE_ORDER.indexOf(right.source),
  );

  for (const record of orderedRecords) {
    for (const author of record.authors || []) {
      if (!authorKey(author)) continue;

      const normalizedOrcid = normalizeOrcid(author.orcid);
      const normalizedOpenAlexId = normalizeOpenAlexId(
        author.openalex_id,
        "A",
      );
      const existingIndex = merged.findIndex(
        (candidate) =>
          (normalizedOrcid && candidate.orcid === normalizedOrcid) ||
          (normalizedOpenAlexId &&
            candidate.openalex_id === normalizedOpenAlexId),
      );
      const existing =
        existingIndex >= 0 ? merged[existingIndex] : {};
      const next = {
        display_name: existing.display_name || author.display_name || null,
        orcid: existing.orcid || normalizedOrcid,
        openalex_id:
          existing.openalex_id || normalizedOpenAlexId,
        author_position:
          existing.author_position || author.author_position || null,
        last_known_institution:
          existing.last_known_institution ||
          author.last_known_institution ||
          null,
        last_known_institution_id:
          existing.last_known_institution_id ||
          author.last_known_institution_id ||
          null,
        institutions: mergeInstitutions(
          existing.institutions || [],
          record.source === "openalex"
            ? author.institutions || []
            : [],
        ),
      };

      if (existingIndex >= 0) {
        merged[existingIndex] = next;
      } else {
        merged.push(next);
      }
    }
  }

  return merged;
};

const normalizeJournalRecord = (journal) => {
  if (!journal?.display_name?.trim()) return null;
  const sourceId = normalizeOpenAlexId(journal.source_id, "S");
  const issns = [
    ...new Set(
      [
        journal.issn_l,
        ...(Array.isArray(journal.issns) ? journal.issns : []),
      ]
        .map(normalizeIssn)
        .filter(Boolean),
    ),
  ];
  if (!sourceId && !issns.length) return null;
  return {
    source_id: sourceId,
    display_name: journal.display_name.trim(),
    issn_l: normalizeIssn(journal.issn_l),
    issns,
    type: journal.type || null,
    is_open_access:
      typeof journal.is_open_access === "boolean"
        ? journal.is_open_access
        : null,
  };
};

const mergeJournalRecords = (records) => {
  const candidates = records
    .map((record) => ({
      source: record.source,
      journal: normalizeJournalRecord(record.journal),
    }))
    .filter(({ journal }) => journal)
    .sort(
      (left, right) =>
        AUTHOR_SOURCE_ORDER.indexOf(left.source) -
        AUTHOR_SOURCE_ORDER.indexOf(right.source),
    );
  if (!candidates.length) return null;

  const merged = { ...candidates[0].journal };
  for (const { journal } of candidates.slice(1)) {
    const sameStableIdentity =
      (merged.source_id &&
        journal.source_id &&
        merged.source_id === journal.source_id) ||
      merged.issns.some((issn) => journal.issns.includes(issn));
    const sameArticleSourceTitle =
      merged.display_name.toLowerCase() ===
      journal.display_name.toLowerCase();
    if (!sameStableIdentity && !sameArticleSourceTitle) continue;

    merged.source_id ||= journal.source_id;
    merged.display_name ||= journal.display_name;
    merged.issn_l ||= journal.issn_l;
    merged.issns = [...new Set([...merged.issns, ...journal.issns])];
    merged.type ||= journal.type;
    if (merged.is_open_access == null) {
      merged.is_open_access = journal.is_open_access;
    }
  }
  return merged;
};

const isJournalArticle = (record) => {
  const type = record?.source_type?.toLowerCase();
  if (record?.source === "openalex") return type === "article";
  return type === "journal-article";
};

const articleKey = (record) => {
  const doi = normalizeDoi(record?.doi);
  if (doi) return `doi:${doi}`;

  const openAlexId = normalizeOpenAlexId(record?.openalex_id, "W");
  return openAlexId ? `openalex:${openAlexId}` : null;
};

const mergeArticleGroup = (records) => ({
  doi: pickField(records, "doi"),
  openalex_id: pickField(records, "openalex_id", [
    "openalex",
    "crossref",
    "orcid",
  ]),
  title: pickField(records, "title"),
  abstract: pickField(records, "abstract"),
  publication_year: pickField(records, "publication_year"),
  publication_date: pickField(records, "publication_date"),
  citation_count: pickField(records, "citation_count", [
    "openalex",
    "crossref",
    "orcid",
  ]),
  landing_url: pickField(records, "landing_url"),
  pdf_url: pickField(records, "pdf_url", [
    "openalex",
    "crossref",
    "orcid",
  ]),
  pages: pickField(records, "pages"),
  is_open_access: pickField(records, "is_open_access", [
    "openalex",
    "crossref",
    "orcid",
  ]),
  reference_count: pickField(records, "reference_count", [
    "openalex",
    "crossref",
    "orcid",
  ]),
  references: pickField(records, "references", [
    "openalex",
    "crossref",
    "orcid",
  ]),
  authors: mergeAuthorRecords(records),
  primary_topic: pickField(records, "primary_topic", [
    "openalex",
    "crossref",
    "orcid",
  ]),
  topics:
    pickField(records, "topics", ["openalex", "crossref", "orcid"]) || [],
  keywords:
    pickField(records, "keywords", ["openalex", "crossref", "orcid"]) || [],
  journal: mergeJournalRecords(records),
  volume_number: pickField(records, "volume_number"),
  issue_number: pickField(records, "issue_number"),
  source_presence: [...new Set(records.map((record) => record.source))],
});

export const mergeArticleCandidates = (
  candidates,
  { limit = Number.POSITIVE_INFINITY } = {},
) => {
  const groups = new Map();
  const stats = {
    skipped_invalid_type: 0,
    skipped_missing_identifier: 0,
    skipped_invalid_data: 0,
  };

  for (const candidate of candidates) {
    if (!isJournalArticle(candidate)) {
      stats.skipped_invalid_type += 1;
      continue;
    }

    const key = articleKey(candidate);
    if (!key) {
      stats.skipped_missing_identifier += 1;
      continue;
    }

    const group = groups.get(key) || [];
    group.push({
      ...candidate,
      doi: normalizeDoi(candidate.doi),
      openalex_id: normalizeOpenAlexId(candidate.openalex_id, "W"),
    });
    groups.set(key, group);
  }

  const merged = [];
  for (const records of groups.values()) {
    const article = mergeArticleGroup(records);
    if (!article.title?.trim()) {
      stats.skipped_invalid_data += 1;
      continue;
    }
    merged.push(article);
  }

  merged.sort((left, right) => {
    const leftDate =
      left.publication_date ||
      (left.publication_year ? `${left.publication_year}-01-01` : "");
    const rightDate =
      right.publication_date ||
      (right.publication_year ? `${right.publication_year}-01-01` : "");
    return rightDate.localeCompare(leftDate);
  });

  return {
    articles: Number.isFinite(limit) ? merged.slice(0, limit) : merged,
    discovered: merged.length,
    stats,
  };
};

export const enrichCrossrefByDoi = async (
  articles,
  {
    fetchWorkByDoi,
    parentSignal,
    concurrency = CROSSREF_ENRICH_CONCURRENCY,
    budgetMs = CROSSREF_ENRICH_BUDGET_MS,
  },
) => {
  const targets = articles
    .filter(
      (article) =>
        article.doi && !article.source_presence?.includes("crossref"),
    )
    .slice(0, CROSSREF_ENRICH_MAX_TARGETS);
  if (!targets.length) return { works: [], failed: 0 };

  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const deadline = setTimeout(() => controller.abort(), budgetMs);
  const works = [];
  let failed = 0;
  let completed = 0;
  let cursor = 0;
  let acceptingResults = true;

  const worker = async () => {
    while (cursor < targets.length && !controller.signal.aborted) {
      const targetIndex = cursor;
      cursor += 1;
      try {
        const work = await fetchWorkByDoi(targets[targetIndex].doi, {
          signal: controller.signal,
        });
        if (acceptingResults && work) works.push(work);
      } catch {
        if (acceptingResults) failed += 1;
      } finally {
        if (acceptingResults) completed += 1;
      }
    }
  };

  try {
    const workers = Promise.all(
      Array.from(
        { length: Math.min(concurrency, targets.length) },
        () => worker(),
      ),
    );
    const aborted = new Promise((resolve) => {
      controller.signal.addEventListener("abort", resolve, { once: true });
    });
    await Promise.race([
      workers,
      aborted,
    ]);
  } finally {
    acceptingResults = false;
    failed += targets.length - completed;
    controller.abort();
    clearTimeout(deadline);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }

  return { works, failed };
};

const elapsedMs = (startedAt) =>
  Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);

const logStageDuration = (
  timingLogger,
  stage,
  durationMs,
  details = {},
) => {
  try {
    timingLogger?.info?.("[ORCID Scan Timing]", {
      event: "orcid_scan_stage_timing",
      stage,
      duration_ms: Math.max(0, Math.round(durationMs * 100) / 100),
      ...details,
    });
  } catch {
    // Observability must never change scan success/partial-success behavior.
  }
};

const logStageTiming = (timingLogger, stage, startedAt, details = {}) =>
  logStageDuration(
    timingLogger,
    stage,
    elapsedMs(startedAt),
    details,
  );

const sourceStatus = (result) => {
  if (result.status === "rejected") {
    return {
      status: "failed",
      count: 0,
      error: result.reason?.code || result.reason?.message || "UNKNOWN_ERROR",
    };
  }

  return {
    status: result.value?.partial ? "partial" : "success",
    count: result.value?.works?.length ?? result.value?.length ?? 0,
    ...(result.value?.error || result.value?.paginationError
      ? { error: result.value.error || result.value.paginationError }
      : {}),
  };
};

const buildTargetAuthor = (orcid, sourceResults, articles) => {
  const orcidProfile =
    sourceResults.orcid.status === "fulfilled"
      ? sourceResults.orcid.value.profile
      : null;
  const openAlexProfile =
    sourceResults.openalex.status === "fulfilled"
      ? sourceResults.openalex.value.profile
      : null;
  const matchingWorkAuthor = articles
    .flatMap((article) => article.authors || [])
    .find((author) => normalizeOrcid(author.orcid) === orcid);

  return {
    orcid,
    display_name:
      orcidProfile?.display_name ||
      openAlexProfile?.display_name ||
      matchingWorkAuthor?.display_name ||
      extractOrcidId(orcid),
    openalex_id:
      openAlexProfile?.openalex_id ||
      matchingWorkAuthor?.openalex_id ||
      null,
    works_count: openAlexProfile?.works_count ?? null,
    cited_by_count: openAlexProfile?.cited_by_count ?? null,
    h_index: openAlexProfile?.h_index ?? null,
    i10_index: openAlexProfile?.i10_index ?? null,
    last_known_institution:
      openAlexProfile?.last_known_institution ||
      matchingWorkAuthor?.last_known_institution ||
      null,
    last_known_institution_id:
      openAlexProfile?.last_known_institution_id ||
      matchingWorkAuthor?.last_known_institution_id ||
      null,
  };
};

const ensureTargetAuthorOnArticles = (articles, targetAuthor) =>
  articles.map((article) => {
    const targetIndex = (article.authors || []).findIndex(
      (author) =>
        normalizeOrcid(author.orcid) === targetAuthor.orcid ||
        (targetAuthor.openalex_id &&
          normalizeOpenAlexId(author.openalex_id, "A") ===
            targetAuthor.openalex_id),
    );

    if (targetIndex < 0) {
      return {
        ...article,
        authors: [...(article.authors || []), targetAuthor],
      };
    }

    const authors = [...article.authors];
    authors[targetIndex] = {
      ...targetAuthor,
      ...authors[targetIndex],
      orcid: targetAuthor.orcid,
      openalex_id:
        authors[targetIndex].openalex_id || targetAuthor.openalex_id,
    };
    return { ...article, authors };
  });

export const scanAuthorByOrcid = async (
  orcidInput,
  {
    fetchOrcid = fetchOrcidData,
    fetchCrossref = fetchCrossrefWorksByOrcid,
    fetchOpenAlex = fetchOpenAlexData,
    fetchCrossrefByDoi = fetchCrossrefWorkByDoi,
    persist = persistOrcidScanInBatches,
    timingLogger = logger,
    onProgress,
    jobId,
  } = {},
) => {
  const totalStartedAt = performance.now();
  let outcome = "failed";
  const orcid = normalizeOrcid(orcidInput);
  if (!orcid) {
    const error = new Error("ORCID khÃ´ng há»£p lá»‡");
    error.statusCode = 400;
    error.code = "ORCID_INVALID";
    throw error;
  }
  const orcidId = extractOrcidId(orcid);
  const sourceProgress = {};
  let lastReportedProgress = 0;
  let progressChain = Promise.resolve();
  const reportProgress = (event) => {
    if (!onProgress) return Promise.resolve();
    const progress = Number.isFinite(event.progress)
      ? Math.max(lastReportedProgress, Math.min(100, event.progress))
      : lastReportedProgress;
    lastReportedProgress = progress;
    progressChain = progressChain.then(() =>
      onProgress({ ...event, progress }),
    );
    return progressChain;
  };
  const reportSourcePage = async ({ source, fetched, total, page }) => {
    sourceProgress[source] = { fetched, total, page };
    const entries = Object.values(sourceProgress);
    const knownTotal = entries.reduce(
      (sum, value) => sum + Math.max(Number(value.total) || 0, value.fetched),
      0,
    );
    const fetchedTotal = entries.reduce(
      (sum, value) => sum + (Number(value.fetched) || 0),
      0,
    );
    const progress = knownTotal
      ? 5 + Math.floor(Math.min(1, fetchedTotal / knownTotal) * 50)
      : 5;
    await reportProgress({
      stage: "fetching",
      progress,
      sourceProgress: { ...sourceProgress },
    });
  };

  try {
    await reportProgress({ stage: "fetching", progress: 5 });
    const sourcesStartedAt = performance.now();
    const [orcidResult, crossrefResult, openAlexResult] =
      await Promise.allSettled([
        fetchOrcid(orcidId, { maxWorks: SCAN_ARTICLE_LIMIT }),
        fetchCrossref(orcidId, {
          onProgress: reportSourcePage,
          maxWorks: SCAN_ARTICLE_LIMIT,
        }),
        fetchOpenAlex(orcid, {
          onProgress: reportSourcePage,
          maxWorks: SCAN_ARTICLE_LIMIT,
        }),
      ]);
    if (orcidResult.status === "fulfilled") {
      const count = orcidResult.value?.works?.length || 0;
      await reportSourcePage({
        source: "orcid",
        fetched: count,
        total: count,
        page: 1,
      });
    }
    logStageTiming(timingLogger, "external_sources", sourcesStartedAt, {
      orcid_status: orcidResult.status,
      crossref_status: crossrefResult.status,
      openalex_status: openAlexResult.status,
    });

    if (
      orcidResult.status === "rejected" &&
      crossrefResult.status === "rejected" &&
      openAlexResult.status === "rejected"
    ) {
      const error = new Error("KhÃ´ng thá»ƒ káº¿t ná»‘i cÃ¡c nguá»“n dá»¯ liá»‡u há»c thuáº­t");
      error.statusCode = 502;
      error.code = "EXTERNAL_SOURCES_UNAVAILABLE";
      throw error;
    }

    const sourceResults = {
      orcid: orcidResult,
      crossref: crossrefResult,
      openalex: openAlexResult,
    };
    const orcidWorks =
      orcidResult.status === "fulfilled" ? orcidResult.value.works : [];
    const crossrefWorks =
      crossrefResult.status === "fulfilled" ? crossrefResult.value : [];
    const openAlexWorks =
      openAlexResult.status === "fulfilled" ? openAlexResult.value.works : [];

    let mergeDurationMs = 0;
    await reportProgress({
      stage: "merging",
      progress: 55,
      sourceProgress: { ...sourceProgress },
    });
    let mergeStartedAt = performance.now();
    const initialMerge = mergeArticleCandidates(
      [
        ...orcidWorks,
        ...crossrefWorks,
        ...openAlexWorks,
      ],
      { limit: SCAN_ARTICLE_LIMIT },
    );
    mergeDurationMs += elapsedMs(mergeStartedAt);
    const enrichmentStartedAt = performance.now();
    const crossrefEnrichment = await enrichCrossrefByDoi(
      initialMerge.articles,
      {
        fetchWorkByDoi: fetchCrossrefByDoi,
      },
    );
    logStageTiming(
      timingLogger,
      "crossref_doi_enrichment",
      enrichmentStartedAt,
      {
        enriched_count: crossrefEnrichment.works.length,
        failed_count: crossrefEnrichment.failed,
      },
    );
    mergeStartedAt = performance.now();
    const finalMerge = mergeArticleCandidates(
      [
        ...orcidWorks,
        ...crossrefWorks,
        ...openAlexWorks,
        ...crossrefEnrichment.works,
      ],
      { limit: SCAN_ARTICLE_LIMIT },
    );
    mergeDurationMs += elapsedMs(mergeStartedAt);

    const targetAuthor = buildTargetAuthor(
      orcid,
      sourceResults,
      finalMerge.articles,
    );
    const articles = ensureTargetAuthorOnArticles(
      finalMerge.articles,
      targetAuthor,
    );
    await reportProgress({
      stage: "merging",
      progress: 65,
      sourceProgress: { ...sourceProgress },
    });
    logStageDuration(timingLogger, "merge", mergeDurationMs, {
      discovered_count: finalMerge.discovered,
      selected_count: articles.length,
    });
    const persistStartedAt = performance.now();
    const persisted = await persist(
      { targetAuthor, articles },
      {
        jobId,
        onProgress: (event) =>
          reportProgress({
            stage: "persisting",
            processed: event.processed,
            total: event.total,
            summary: {
              discovered: articles.length,
              ...event.summary,
            },
            authorId: event.authorId,
            available: event.available,
          }),
      },
    );
    logStageTiming(timingLogger, "persist", persistStartedAt, {
      persisted_count:
        (persisted.summary?.created ?? 0) +
        (persisted.summary?.filled_missing ?? 0) +
        (persisted.summary?.already_existed ?? 0),
      db_article_count:
        persisted.article_total ?? persisted.articles?.length ?? 0,
      failed_count: persisted.summary?.failed_to_persist ?? 0,
    });

    const statuses = {
      orcid: sourceStatus(orcidResult),
      crossref: sourceStatus(crossrefResult),
      openalex: sourceStatus(openAlexResult),
    };
    if (
      crossrefEnrichment.failed > 0 ||
      (crossrefResult.status === "rejected" &&
        crossrefEnrichment.works.length > 0)
    ) {
      statuses.crossref.status = "partial";
    }
    const isPartial = Object.values(statuses).some(
      (source) => source.status !== "success",
    );
    const articleTotal =
      persisted.article_total ?? persisted.articles?.length ?? 0;
    const totalPages = Math.max(
      1,
      Math.ceil(articleTotal / RESPONSE_LIMIT),
    );
    const hasNext = articleTotal > RESPONSE_LIMIT;
    const authorId = persisted.author?.author_id;
    outcome = isPartial ? "partial" : "completed";

    return {
      author: persisted.author,
      articles: (persisted.articles || []).slice(0, RESPONSE_LIMIT),
      pagination: {
        page: RESPONSE_PAGE,
        limit: RESPONSE_LIMIT,
        total: articleTotal,
        total_pages: totalPages,
        has_next: hasNext,
        next_url:
          hasNext && authorId
            ? `/api/v1/author/${authorId}/articles?page=2&limit=${RESPONSE_LIMIT}`
            : null,
      },
      summary: {
        discovered: articles.length,
        ...persisted.summary,
        ...finalMerge.stats,
        ...(persisted.available != null
          ? { available_publications: persisted.available }
          : {}),
      },
      source_status: statuses,
      partial: isPartial,
    };
  } finally {
    await progressChain;
    logStageTiming(timingLogger, "total", totalStartedAt, { outcome });
  }
};



