import * as institutionService from "./institution.service.js";
import * as journalService from "./journal.service.js";
import * as topicService from "./topic.service.js";
import { buildCacheKey, getOrSetCache } from "../utils/cache.js";

const CACHE_NAMESPACE = "discovery-lookups";
const DYNAMIC_CACHE_OPTIONS = Object.freeze({
  freshTtlSeconds: 5 * 60,
  staleTtlSeconds: 60 * 60,
});

const hasValue = (value) => value !== undefined && value !== null && value !== "";
const cacheOptionsFor = (params = {}, defaultKeys = []) => {
  const hasDynamicValue = Object.entries(params).some(([key, value]) => (
    !defaultKeys.includes(key) && hasValue(value)
  ));
  const isLaterPage = hasValue(params.page) && Number(params.page) > 1;
  const hasSearch = String(params.search || "").trim() !== "";
  return hasDynamicValue || isLaterPage || hasSearch ? DYNAMIC_CACHE_OPTIONS : undefined;
};

const cached = (name, params, fetchFn, defaultKeys) => (
  getOrSetCache(
    buildCacheKey(name, params, CACHE_NAMESPACE),
    fetchFn,
    cacheOptionsFor(params, defaultKeys)
  )
);

export const getJournalsData = (params = {}) => cached(
  "journals",
  params,
  () => journalService.getJournals(params),
  ["page", "limit"]
);

export const getTopicsData = (params = {}, fetchFn = () => topicService.getTopics(params)) => cached(
  "topics",
  params,
  fetchFn,
  ["page", "limit", "sort_by", "sort_order"]
);

export const getInstitutionsData = (params = {}) => cached(
  "institutions",
  params,
  () => institutionService.getInstitutions(params),
  ["page", "limit", "search"]
);

export const warmDiscoveryLookupCache = async () => {
  if (
    !process.env.REDIS_URL
    || process.env.CACHE_ENABLED === "false"
    || process.env.CACHE_WARMUP_ENABLED === "false"
  ) {
    return { skipped: true, durationMs: 0 };
  }

  const startedAt = Date.now();
  await Promise.all([
    getJournalsData({ page: 1, limit: 100 }),
    getTopicsData({
      page: undefined,
      limit: "100",
      search: undefined,
      subject_area_id: undefined,
      subject_category_id: undefined,
      sort_by: "display_name",
      sort_order: "asc",
    }),
    getInstitutionsData({ page: 1, limit: "100", search: "" }),
  ]);

  return { skipped: false, durationMs: Date.now() - startedAt };
};
