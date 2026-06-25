import * as trendingVnService from "../services/trendingVn.service.js";
import logger from "../utils/logger.js";

export const getTopJournals = async (req, res) => {
  try {
    const result = await trendingVnService.getTopJournals({
      years: req.query.years,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      code: "TRENDING_VN_TOP_JOURNALS_SUCCESS",
      message: "Lấy danh sách top journal VN thành công!",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy top journals VN:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getTopUniversities = async (req, res) => {
  try {
    const result = await trendingVnService.getTopUniversities({
      years: req.query.years,
      limit: req.query.limit,
      hot_limit: req.query.hot_limit,
    });

    return res.status(200).json({
      success: true,
      code: "TRENDING_VN_TOP_UNIVERSITIES_SUCCESS",
      message: "Lấy danh sách top university VN thành công!",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy top universities VN:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

const buildHandler = (serviceFn, code, message, logMessage, mapQuery = (query) => query) => async (req, res) => {
  try {
    const result = await serviceFn(mapQuery(req.query));
    return res.status(200).json({ success: true, code, message, data: result });
  } catch (error) {
    logger.error(logMessage, error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

const rankingQuery = (query) => ({ limit: query.limit });
const trendingQuery = (query) => ({ years: query.years, limit: query.limit, hot_limit: query.hot_limit });
const journalTrendingQuery = (query) => ({ years: query.years, limit: query.limit });

export const getJournalRankings = buildHandler(
  trendingVnService.getJournalRankings,
  "TRENDING_VN_RANKING_JOURNALS_SUCCESS",
  "Lấy ranking journal VN thành công!",
  "Lỗi khi lấy ranking journals VN:",
  rankingQuery
);

export const getTrendingJournals = buildHandler(
  trendingVnService.getTrendingJournals,
  "TRENDING_VN_TRENDING_JOURNALS_SUCCESS",
  "Lấy trending journal VN thành công!",
  "Lỗi khi lấy trending journals VN:",
  journalTrendingQuery
);

export const getUniversityRankings = buildHandler(
  trendingVnService.getUniversityRankings,
  "TRENDING_VN_RANKING_UNIVERSITIES_SUCCESS",
  "Lấy ranking university VN thành công!",
  "Lỗi khi lấy ranking universities VN:",
  rankingQuery
);

export const getTrendingUniversities = buildHandler(
  trendingVnService.getTrendingUniversities,
  "TRENDING_VN_TRENDING_UNIVERSITIES_SUCCESS",
  "Lấy trending university VN thành công!",
  "Lỗi khi lấy trending universities VN:",
  trendingQuery
);

export const getAuthorRankings = buildHandler(
  trendingVnService.getAuthorRankings,
  "TRENDING_VN_RANKING_AUTHORS_SUCCESS",
  "Lấy ranking author VN thành công!",
  "Lỗi khi lấy ranking authors VN:",
  rankingQuery
);

export const getTrendingAuthors = buildHandler(
  trendingVnService.getTrendingAuthors,
  "TRENDING_VN_TRENDING_AUTHORS_SUCCESS",
  "Lấy trending author VN thành công!",
  "Lỗi khi lấy trending authors VN:",
  trendingQuery
);

export const getTrendingArticles = buildHandler(
  trendingVnService.getTrendingArticles,
  "TRENDING_VN_TRENDING_ARTICLES_SUCCESS",
  "Lấy trending article VN thành công!",
  "Lỗi khi lấy trending articles VN:",
  trendingQuery
);

export const getTrendingKeywords = buildHandler(
  trendingVnService.getTrendingKeywords,
  "TRENDING_VN_TRENDING_KEYWORDS_SUCCESS",
  "Lấy trending keyword VN thành công!",
  "Lỗi khi lấy trending keywords VN:",
  trendingQuery
);
