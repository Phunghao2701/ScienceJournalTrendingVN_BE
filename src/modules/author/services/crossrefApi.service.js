import axios from "axios";
import {
  normalizeDoi,
  normalizeIssn,
  normalizeOrcid,
  stripMarkup,
} from "../../../utils/orcid.js";
import { withSourceRetry } from "./orcidScanRetry.service.js";

// Crossref accepts a comma-separated `select` list on works endpoints.
// Keep this in sync with every root field consumed by mapCrossrefWork.
export const CROSSREF_WORK_SELECT = [
  "type",
  "DOI",
  "title",
  "abstract",
  "published-print",
  "published-online",
  "issued",
  "URL",
  "link",
  "page",
  "license",
  "is-referenced-by-count",
  "references-count",
  "author",
  "publisher",
  "container-title",
  "ISSN",
  "volume",
  "issue",
].join(",");

const getDateParts = (item) =>
  item?.["published-print"]?.["date-parts"]?.[0] ||
  item?.["published-online"]?.["date-parts"]?.[0] ||
  item?.issued?.["date-parts"]?.[0] ||
  null;

const toIsoDate = (dateParts) => {
  if (!dateParts?.length) return null;
  const [year, month = 1, day = 1] = dateParts.map(Number);
  if (!Number.isInteger(year)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const mapCrossrefAuthor = (author, index, totalAuthors) => ({
  display_name:
    [author?.given, author?.family].filter(Boolean).join(" ").trim() || null,
  orcid: normalizeOrcid(author?.ORCID),
  openalex_id: null,
  author_position:
    index === 0 ? "first" : index === totalAuthors - 1 ? "last" : "middle",
  last_known_institution: author?.affiliation?.[0]?.name || null,
  last_known_institution_id: null,
});

export const mapCrossrefWork = (item) => {
  const dateParts = getDateParts(item);
  const authors = Array.isArray(item?.author) ? item.author : [];
  const pdfLink = item?.link?.find(
    (link) =>
      link?.["content-type"] === "application/pdf" ||
      link?.URL?.toLowerCase().endsWith(".pdf"),
  );
  const journalIssns = [
    ...new Set(
      (Array.isArray(item?.ISSN) ? item.ISSN : [item?.ISSN])
        .map(normalizeIssn)
        .filter(Boolean),
    ),
  ];

  return {
    source: "crossref",
    source_type: item?.type || null,
    doi: normalizeDoi(item?.DOI),
    openalex_id: null,
    title: stripMarkup(item?.title?.[0]),
    abstract: stripMarkup(item?.abstract),
    publication_year: Number(dateParts?.[0]) || null,
    publication_date: toIsoDate(dateParts),
    landing_url: item?.URL || null,
    pdf_url: pdfLink?.URL || null,
    pages: item?.page || null,
    is_open_access: Array.isArray(item?.license)
      ? item.license.length > 0
      : null,
    citation_count: Number.isFinite(item?.["is-referenced-by-count"])
      ? item["is-referenced-by-count"]
      : null,
    // Crossref names this `references-count` on selected list responses but
    // `reference-count` on singleton DOI responses (which reject `select`).
    reference_count: Number.isFinite(
      item?.["references-count"] ?? item?.["reference-count"],
    )
      ? (item["references-count"] ?? item["reference-count"])
      : null,
    references: null,
    authors: authors.map((author, index) =>
      mapCrossrefAuthor(author, index, authors.length),
    ),
    primary_topic: null,
    topics: [],
    keywords: [],
    publisher: item?.publisher || null,
    journal_title: item?.["container-title"]?.[0] || null,
    journal:
      item?.["container-title"]?.[0] && journalIssns.length
        ? {
            source_id: null,
            display_name: item["container-title"][0],
            issn_l: null,
            issns: journalIssns,
            type: null,
            is_open_access: null,
          }
        : null,
    volume_number: item?.volume || null,
    issue_number: item?.issue || null,
  };
};

const crossrefRequestConfig = (signal) => ({
  baseURL: "https://api.crossref.org",
  headers: {
    Accept: "application/json",
    "User-Agent": `ScienceJournalTrendingVN/1.0 (mailto:${process.env.CROSSREF_MAILTO || "unknown@example.com"})`,
  },
  signal,
  timeout: 10000,
});

export const fetchCrossrefWorksByOrcid = async (
  orcidId,
  {
    httpClient = axios,
    signal,
    onProgress,
    pageSize =
      Number(process.env.CROSSREF_SCAN_PAGE_SIZE) || 500,
    maxWorks = Number.POSITIVE_INFINITY,
  } = {},
) => {
  const safePageSize = Math.min(1000, Math.max(1, Math.floor(pageSize)));
  const safeMaxWorks = Number.isFinite(Number(maxWorks))
    ? Math.max(1, Math.floor(Number(maxWorks)))
    : Number.POSITIVE_INFINITY;
  const works = [];
  const seenCursors = new Set();
  let cursor = "*";
  let page = 0;
  let total = null;
  let partial = false;
  let paginationError = null;

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
            ...crossrefRequestConfig(signal),
            params: {
              filter: `orcid:${orcidId},type:journal-article`,
              mailto: process.env.CROSSREF_MAILTO,
              rows: requestSize,
              cursor,
              sort: "published",
              order: "desc",
              select: CROSSREF_WORK_SELECT,
            },
          }),
        { signal },
      );
    } catch (error) {
      if (signal?.aborted || works.length === 0) throw error;
      partial = true;
      paginationError =
        error?.code || error?.response?.status || error?.message || "CROSSREF_PAGE_FAILED";
      break;
    }
    const message = response.data?.message || {};
    const items = Array.isArray(message.items) ? message.items : [];
    const remaining = safeMaxWorks - works.length;
    works.push(...items.slice(0, remaining).map(mapCrossrefWork));
    page += 1;
    total = Number.isFinite(Number(message["total-results"]))
      ? Number(message["total-results"])
      : total;
    await onProgress?.({
      source: "crossref",
      fetched: works.length,
      total: Number.isFinite(safeMaxWorks) && total != null
        ? Math.min(total, safeMaxWorks)
        : total,
      page,
    });

    if (
      works.length >= safeMaxWorks ||
      items.length < requestSize
    ) break;

    const nextCursor = message["next-cursor"];
    if (!nextCursor || seenCursors.has(nextCursor)) {
      partial = true;
      paginationError = "CROSSREF_CURSOR_NOT_ADVANCING";
      break;
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  Object.defineProperties(works, {
    partial: { value: partial, enumerable: false },
    paginationError: { value: paginationError, enumerable: false },
    total: { value: total, enumerable: false },
    pages: { value: page, enumerable: false },
  });
  return works;
};

export const fetchCrossrefWorkByDoi = async (
  doi,
  { httpClient = axios, signal } = {},
) => {
  const response = await httpClient.get(
    `/works/${encodeURIComponent(normalizeDoi(doi))}`,
    {
      ...crossrefRequestConfig(signal),
      timeout: 5000,
      params: {
        mailto: process.env.CROSSREF_MAILTO,
      },
    },
  );

  return mapCrossrefWork(response.data?.message || {});
};

