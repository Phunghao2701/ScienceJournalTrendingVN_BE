import * as trendingVnService from '../services/trendingVn.service.js';
import logger from '../../../utils/logger.js';

export const getTopJournals = async (request, reply) => {
  try {
    const result = await trendingVnService.getTopJournals({ years: request.query.years, limit: request.query.limit });
    return reply.status(200).send({ success: true, code: "TRENDING_VN_TOP_JOURNALS_SUCCESS", message: "Láº¥y danh sÃ¡ch top journal VN thÃ nh cÃ´ng!", data: result });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y top journals VN:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getTopUniversities = async (request, reply) => {
  try {
    const result = await trendingVnService.getTopUniversities({ years: request.query.years, limit: request.query.limit, hot_limit: request.query.hot_limit });
    return reply.status(200).send({ success: true, code: "TRENDING_VN_TOP_UNIVERSITIES_SUCCESS", message: "Láº¥y danh sÃ¡ch top university VN thÃ nh cÃ´ng!", data: result });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y top universities VN:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

const buildHandler = (serviceFn, code, message, logMessage, mapQuery = (query) => query) => async (request, reply) => {
  try {
    const result = await serviceFn(mapQuery(request.query));
    return reply.status(200).send({ success: true, code, message, data: result });
  } catch (error) {
    logger.error(logMessage, error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

const rankingQuery = (query) => ({ limit: query.limit });
const trendingQuery = (query) => ({ years: query.years, limit: query.limit, hot_limit: query.hot_limit });
const journalTrendingQuery = (query) => ({ years: query.years, limit: query.limit });

export const getJournalRankings = buildHandler(trendingVnService.getJournalRankings, "TRENDING_VN_RANKING_JOURNALS_SUCCESS", "Láº¥y ranking journal VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y ranking journals VN:", rankingQuery);
export const getTrendingJournals = buildHandler(trendingVnService.getTrendingJournals, "TRENDING_VN_TRENDING_JOURNALS_SUCCESS", "Láº¥y trending journal VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y trending journals VN:", journalTrendingQuery);
export const getUniversityRankings = buildHandler(trendingVnService.getUniversityRankings, "TRENDING_VN_RANKING_UNIVERSITIES_SUCCESS", "Láº¥y ranking university VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y ranking universities VN:", rankingQuery);
export const getTrendingUniversities = buildHandler(trendingVnService.getTrendingUniversities, "TRENDING_VN_TRENDING_UNIVERSITIES_SUCCESS", "Láº¥y trending university VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y trending universities VN:", trendingQuery);
export const getAuthorRankings = buildHandler(trendingVnService.getAuthorRankings, "TRENDING_VN_RANKING_AUTHORS_SUCCESS", "Láº¥y ranking author VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y ranking authors VN:", rankingQuery);
export const getTrendingAuthors = buildHandler(trendingVnService.getTrendingAuthors, "TRENDING_VN_TRENDING_AUTHORS_SUCCESS", "Láº¥y trending author VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y trending authors VN:", trendingQuery);
export const getTrendingArticles = buildHandler(trendingVnService.getTrendingArticles, "TRENDING_VN_TRENDING_ARTICLES_SUCCESS", "Láº¥y trending article VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y trending articles VN:", trendingQuery);
export const getTrendingKeywords = buildHandler(trendingVnService.getTrendingKeywords, "TRENDING_VN_TRENDING_KEYWORDS_SUCCESS", "Láº¥y trending keyword VN thÃ nh cÃ´ng!", "Lá»—i khi láº¥y trending keywords VN:", trendingQuery);



