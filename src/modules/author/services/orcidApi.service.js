import axios from "axios";
import {
  extractOrcidId,
  normalizeDoi,
  normalizeIssn,
  normalizeOrcid,
} from "../../../utils/orcid.js";
import {
  getOrcidAccessToken,
  invalidateOrcidToken,
} from "../../auth/services/orcidToken.service.js";

const requestOrcid = async (
  path,
  {
    httpClient,
    tokenProvider,
    tokenInvalidator,
    signal,
    retryUnauthorized = true,
  },
) => {
  const token = await tokenProvider();

  try {
    return await httpClient.get(path, {
      baseURL:
        process.env.ORCID_API_BASE_URL || "https://pub.orcid.org/v3.0",
      headers: {
        Accept: "application/vnd.orcid+json",
        Authorization: `Bearer ${token}`,
      },
      signal,
      timeout: 10000,
    });
  } catch (error) {
    if (error.response?.status === 401 && retryUnauthorized) {
      await tokenInvalidator();
      return requestOrcid(path, {
        httpClient,
        tokenProvider: () => tokenProvider({ forceRefresh: true }),
        tokenInvalidator,
        signal,
        retryUnauthorized: false,
      });
    }
    throw error;
  }
};

const valueOf = (valueObject) => valueObject?.value || null;

export const mapOrcidPerson = (person, orcidId) => {
  const givenNames = valueOf(person?.name?.["given-names"]);
  const familyName = valueOf(person?.name?.["family-name"]);
  const creditName = valueOf(person?.name?.["credit-name"]);
  const displayName =
    creditName || [givenNames, familyName].filter(Boolean).join(" ") || null;

  return {
    orcid: normalizeOrcid(orcidId),
    display_name: displayName,
    given_name: givenNames,
    family_name: familyName,
  };
};

const findExternalId = (summary, type) => {
  const externalIds =
    summary?.["external-ids"]?.["external-id"] ||
    summary?.["external-ids"]?.external_id ||
    [];

  return externalIds.find(
    (item) => item?.["external-id-type"]?.toLowerCase() === type,
  )?.["external-id-value"];
};

const findExternalIds = (summary, type) => {
  const externalIds =
    summary?.["external-ids"]?.["external-id"] ||
    summary?.["external-ids"]?.external_id ||
    [];
  return externalIds
    .filter(
      (item) => item?.["external-id-type"]?.toLowerCase() === type,
    )
    .map((item) => item?.["external-id-value"])
    .filter(Boolean);
};

const getPublicationYear = (summary) => {
  const year = summary?.["publication-date"]?.year?.value;
  const numericYear = Number(year);
  return Number.isInteger(numericYear) ? numericYear : null;
};

export const mapOrcidWorks = (
  worksResponse,
  { limit = Number.POSITIVE_INFINITY } = {},
) => {
  const groups = worksResponse?.group || [];
  const mappedWorks = [];
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.floor(Number(limit)))
    : Number.POSITIVE_INFINITY;

  for (const group of groups) {
    if (mappedWorks.length >= safeLimit) break;
    const summaries = group?.["work-summary"] || [];
    const summary = summaries.find(
      (item) => item?.type?.toLowerCase() === "journal-article",
    );
    if (!summary) continue;

    const doi = normalizeDoi(findExternalId(summary, "doi"));
    const title = valueOf(summary?.title?.title);
    const journalTitle = valueOf(summary?.["journal-title"]);
    const journalIssue = summary?.["journal-issue"] || {};
    const journalIssns = [
      ...new Set(
        findExternalIds(summary, "issn")
          .map(normalizeIssn)
          .filter(Boolean),
      ),
    ];

    mappedWorks.push({
      source: "orcid",
      source_type: summary.type,
      doi,
      openalex_id: null,
      title,
      abstract: null,
      publication_year: getPublicationYear(summary),
      publication_date: null,
      landing_url: valueOf(summary.url),
      pdf_url: null,
      pages: null,
      is_open_access: null,
      citation_count: null,
      reference_count: null,
      references: null,
      authors: [],
      primary_topic: null,
      topics: [],
      keywords: [],
      journal:
        journalTitle && journalIssns.length
          ? {
              source_id: null,
              display_name: journalTitle,
              issn_l: null,
              issns: journalIssns,
              type: null,
              is_open_access: null,
            }
          : null,
      volume_number: valueOf(journalIssue?.["volume"]),
      issue_number: valueOf(journalIssue?.["issue"]),
      orcid_put_code: summary["put-code"] ?? null,
    });
  }

  return mappedWorks;
};

export const fetchOrcidData = async (
  orcidId,
  {
    httpClient = axios,
    tokenProvider = getOrcidAccessToken,
    tokenInvalidator = invalidateOrcidToken,
    signal,
    maxWorks = Number.POSITIVE_INFINITY,
  } = {},
) => {
  const canonicalId = extractOrcidId(orcidId);
  const dependencies = {
    httpClient,
    tokenProvider,
    tokenInvalidator,
    signal,
  };

  const [personResult, worksResult] = await Promise.allSettled([
    requestOrcid(`/${canonicalId}/person`, dependencies),
    requestOrcid(`/${canonicalId}/works`, dependencies),
  ]);

  if (personResult.status === "rejected" && worksResult.status === "rejected") {
    throw worksResult.reason || personResult.reason;
  }

  return {
    profile:
      personResult.status === "fulfilled"
        ? mapOrcidPerson(personResult.value.data, canonicalId)
        : { orcid: normalizeOrcid(canonicalId), display_name: null },
    works:
      worksResult.status === "fulfilled"
        ? mapOrcidWorks(worksResult.value.data, { limit: maxWorks })
        : [],
    partial:
      personResult.status === "rejected" || worksResult.status === "rejected",
  };
};


