import * as articleService from "./article.service.js";
import { getArticleAnalysis } from "./articleAnalysis.service.js";
import { buildCacheKey, getOrSetCache } from "../utils/cache.js";
import logger from "../utils/logger.js";

const CACHE_NAMESPACE = "article-discovery";
const DYNAMIC_CACHE_OPTIONS = Object.freeze({
  freshTtlSeconds: 5 * 60,
  staleTtlSeconds: 60 * 60,
});

export const DEFAULT_ARTICLE_DISCOVERY_PARAMS = Object.freeze({
  limit: 10,
  offset: 0,
  search: "",
  sortBy: "created_at",
  sortOrder: "DESC",
  scope: "vn_universities",
});

const shouldCache = (params = {}) => params.scope === "vn_universities";

const hasValue = (value) => value !== undefined && value !== null && value !== "";
const isDynamicRequest = (params = {}) => (
  String(params.search || "").trim() !== ""
  || Number(params.offset || 0) > 0
  || (hasValue(params.limit) && Number(params.limit) !== 10)
  || (hasValue(params.sortBy) && params.sortBy !== "created_at")
  || (hasValue(params.sortOrder) && String(params.sortOrder).toUpperCase() !== "DESC")
  || [
    "publicationYear",
    "fromYear",
    "toYear",
    "journalId",
    "topicId",
    "publisherId",
    "authorId",
    "keywordId",
    "institutionId",
    "volumeId",
    "issueId",
    "isOpenAccess",
    "access",
    "countryId",
  ].some((key) => hasValue(params[key]))
);

const cached = (name, params, fetchFn) => {
  if (!shouldCache(params)) return fetchFn();
  return getOrSetCache(
    buildCacheKey(name, params, CACHE_NAMESPACE),
    fetchFn,
    isDynamicRequest(params) ? DYNAMIC_CACHE_OPTIONS : undefined
  );
};

export const getArticleListData = (params = {}) => cached("list", params, async () => {
  const [articles, total] = await Promise.all([
    articleService.getAllArticles(params),
    articleService.countAllArticles(params),
  ]);

  let stats = { totalArticles: 0, openAccessCount: 0, authorsCount: 0, topicsCount: 0 };
  try {
    stats = await articleService.getArticleListStats(params);
  } catch (error) {
    logger.error("Lỗi khi lấy stats cho article discovery cache:", error);
  }

  return { articles, total, stats };
});

export const getArticleAnalyticsData = (params = {}) => cached(
  "analytics",
  params,
  () => articleService.getArticleAnalytics(params)
);

export const getArticleAnalysisData = (params = {}) => cached(
  "analysis",
  params,
  () => getArticleAnalysis(params)
);

export const warmArticleDiscoveryCache = async () => {
  if (
    !process.env.REDIS_URL
    || process.env.CACHE_ENABLED === "false"
    || process.env.CACHE_WARMUP_ENABLED === "false"
  ) {
    return { skipped: true, durationMs: 0 };
  }

  const startedAt = Date.now();
  await getArticleListData(DEFAULT_ARTICLE_DISCOVERY_PARAMS);
  await getArticleAnalyticsData({ search: "", scope: "vn_universities" });

  return { skipped: false, durationMs: Date.now() - startedAt };
};
