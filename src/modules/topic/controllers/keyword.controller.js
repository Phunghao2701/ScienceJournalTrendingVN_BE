import {
  getTrendingKeywords as getTrendingKeywordsService,
  getWatchedKeywordArticles as getWatchedKeywordArticlesService,
  checkProjectOwnership,
  getKeywordById,
  getAllKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  restoreKeyword,
  removeWatchedKeyword,
  replaceWatchedKeywords,
  addWatchedKeywords,
  getArticlesByKeyword,
} from "../services/keyword.service.js";
import logger from '../../../utils/logger.js';

export const getTrendingKeywords = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡" });

    const userId = request.user.user_id;
    const isOwner = await checkProjectOwnership(projectId, userId);
    if (!isOwner) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND", message: "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y" });

    const result = await getTrendingKeywordsService(projectId, request.query);
    return reply.status(200).send({ success: true, message: "Láº¥y danh sÃ¡ch tá»« khÃ³a trending thÃ nh cÃ´ng", data: result });
  } catch (error) {
    logger.error("[Keyword Controller] Lá»—i khi láº¥y trending keywords:", error);
    return reply.status(500).send({ success: false, message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi láº¥y trending keywords" });
  }
};

export const getWatchedKeywordArticles = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡" });

    const userId = request.user.user_id;
    const result = await getWatchedKeywordArticlesService(projectId, userId, request.query);

    return reply.status(200).send({ success: true, message: "Láº¥y luá»“ng bÃ i bÃ¡o tá»« tá»« khÃ³a theo dÃµi thÃ nh cÃ´ng", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, total_pages: result.total_pages } });
  } catch (error) {
    if ([400, 404].includes(error.statusCode)) return reply.status(error.statusCode).send({ success: false, message: error.message });
    logger.error("[Keyword Controller] Lá»—i khi láº¥y watched keyword articles:", error);
    return reply.status(500).send({ success: false, message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi láº¥y bÃ i bÃ¡o theo dÃµi" });
  }
};

export const watchKeywords = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡" });

    const { keyword_ids } = request.body || {};
    const result = await addWatchedKeywords(projectId, keyword_ids);

    if (!result.success) return reply.status(400).send({ success: false, code: "ERROR_KEYWORDS_ALREADY_WATCHED", message: "CÃ³ tá»« khÃ³a Ä‘Ã£ tá»“n táº¡i trong danh sÃ¡ch theo dÃµi cá»§a dá»± Ã¡n" });
    return reply.status(201).send({ success: true, code: "SUCCESS_CREATE_WATCHED_KEYWORDS", message: `ThÃªm thÃ nh cÃ´ng ${result.insertedCount} tá»« khÃ³a vÃ o danh sÃ¡ch theo dÃµi` });
  } catch (error) {
    logger.error("[watchKeywords] Error:", error);
    return reply.status(500).send({ success: false, code: "ERROR_SERVER_CREATE_WATCHED_KEYWORD", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const deleteWatchedKeyword = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    const keywordId = parseInt(request.params.keywordId);
    if (isNaN(projectId) || isNaN(keywordId)) return reply.status(400).send({ success: false, message: "ID dá»± Ã¡n hoáº·c ID tá»« khÃ³a khÃ´ng há»£p lá»‡" });

    const isDeleted = await removeWatchedKeyword(projectId, keywordId);
    if (!isDeleted) return reply.status(404).send({ success: false, code: "ERROR_KEYWORD_NOT_FOUND", message: "Tá»« khÃ³a khÃ´ng náº±m trong danh sÃ¡ch theo dÃµi cá»§a dá»± Ã¡n" });

    return reply.status(200).send({ success: true, code: "SUCCESS_DELETE_WATCHED_KEYWORD", message: "ÄÃ£ xÃ³a tá»« khÃ³a khá»i dá»± Ã¡n thÃ nh cÃ´ng" });
  } catch (error) {
    logger.error("[deleteWatchedKeyword] Lá»—i khi xÃ³a tá»« khÃ³a theo dÃµi:", error);
    return reply.status(500).send({ success: false, code: "ERROR_SERVER_DELETE_WATCHED_KEYWORD", message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi xÃ³a tá»« khÃ³a" });
  }
};

export const updateWatchedKeywords = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    const { keyword_ids } = request.body || {};
    if (isNaN(projectId)) return reply.status(400).send({ success: false, message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡" });

    await replaceWatchedKeywords(projectId, keyword_ids || []);
    return reply.status(200).send({ success: true, code: "SUCCESS_UPDATE_WATCHED_KEYWORD", message: "Cáº­p nháº­t danh sÃ¡ch tá»« khÃ³a theo dÃµi thÃ nh cÃ´ng" });
  } catch (error) {
    logger.error("[updateWatchedKeywords] Lá»—i khi cáº­p nháº­t tá»« khÃ³a theo dÃµi:", error);
    return reply.status(500).send({ success: false, code: "ERROR_SERVER_UPDATE_WATCHED_KEYWORD", message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi cáº­p nháº­t tá»« khÃ³a" });
  }
};

export const getAllKeywordsController = async (request, reply) => {
  try {
    const page = Math.max(parseInt(request.query.page) || 1, 1);
    const limit = Math.min(parseInt(request.query.limit) || 10, 100);
    const search = request.query.search || request.query.keyword || "";
    const result = await getAllKeywords({ page, limit, search });
    return reply.status(200).send({ success: true, code: "KEYWORD_LIST_FETCHED", message: "Láº¥y danh sÃ¡ch keyword thÃ nh cÃ´ng", data: result.data, pagination: result.pagination });
  } catch (error) {
    logger.error("[Keyword Controller] Lá»—i khi láº¥y danh sÃ¡ch keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const createKeywordController = async (request, reply) => {
  try {
    const keyword = await createKeyword(request.body.display_name);
    return reply.status(201).send({ success: true, code: "KEYWORD_CREATED", message: "Táº¡o keyword thÃ nh cÃ´ng", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lá»—i khi táº¡o keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getKeywordByIdController = async (request, reply) => {
  try {
    const keyword = await getKeywordById(request.keywordId);
    return reply.status(200).send({ success: true, code: "KEYWORD_FETCHED", message: "Láº¥y keyword thÃ nh cÃ´ng", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lá»—i khi láº¥y keyword theo ID:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getArticlesByKeywordController = async (request, reply) => {
  try {
    const page = Math.max(parseInt(request.query.page) || 1, 1);
    const limit = Math.min(parseInt(request.query.limit) || 10, 50);
    const sortBy = request.query.sortBy || request.query.sort_by || "publication_year";
    const sortOrder = request.query.sortOrder || request.query.sort_order || "desc";
    const scope = request.query.scope || "all";

    const result = await getArticlesByKeyword(request.keywordId, { page, limit, sortBy, sortOrder, scope });
    return reply.status(200).send({ success: true, code: "KEYWORD_ARTICLES_FETCHED", message: "Láº¥y danh sÃ¡ch bÃ i bÃ¡o theo keyword thÃ nh cÃ´ng", data: result.data, scope: result.scope, pagination: result.pagination });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lá»—i khi láº¥y bÃ i bÃ¡o theo keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_ARTICLE_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const updateKeywordController = async (request, reply) => {
  try {
    const keyword = await updateKeyword(request.keywordId, request.body.display_name);
    return reply.status(200).send({ success: true, code: "KEYWORD_UPDATED", message: "Cáº­p nháº­t keyword thÃ nh cÃ´ng", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lá»—i khi cáº­p nháº­t keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const deleteKeywordController = async (request, reply) => {
  try {
    await deleteKeyword(request.keywordId);
    return reply.status(200).send({ success: true, code: "KEYWORD_DELETED", message: "XÃ³a keyword thÃ nh cÃ´ng" });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lá»—i khi xÃ³a keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const restoreKeywordController = async (request, reply) => {
  try {
    const keyword = await restoreKeyword(request.keywordId);
    return reply.status(200).send({ success: true, code: "KEYWORD_RESTORED", message: "KhÃ´i phá»¥c keyword thÃ nh cÃ´ng", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lá»—i khi restore keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};




