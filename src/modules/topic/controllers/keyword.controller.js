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
import * as keywordService from '../services/keyword.service.js';
export const keywordServiceRef = { ...keywordService };
import logger from '../../../utils/logger.js';

export const getTrendingKeywords = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, message: "ID dự án không hợp lệ" });

    const userId = request.user.user_id;
    const isOwner = await keywordServiceRef.checkProjectOwnership(projectId, userId);
    if (!isOwner) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND", message: "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án n� y" });

    const result = await keywordServiceRef.getTrendingKeywords(projectId, request.query);
    return reply.status(200).send({ success: true, message: "Lấy danh sách từ khóa trending th� nh công", data: result });
  } catch (error) {
    logger.error("[Keyword Controller] Lỗi khi lấy trending keywords:", error);
    return reply.status(500).send({ success: false, message: "Có lỗi xảy ra ở server khi lấy trending keywords" });
  }
};

export const getWatchedKeywordArticles = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, message: "ID dự án không hợp lệ" });

    const userId = request.user.user_id;
    const result = await keywordServiceRef.getWatchedKeywordArticles(projectId, userId, request.query);

    return reply.status(200).send({ success: true, message: "Lấy luồng b� i báo từ từ khóa theo dõi th� nh công", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, total_pages: result.total_pages } });
  } catch (error) {
    if ([400, 404].includes(error.statusCode)) return reply.status(error.statusCode).send({ success: false, message: error.message });
    logger.error("[Keyword Controller] Lỗi khi lấy watched keyword articles:", error);
    return reply.status(500).send({ success: false, message: "Có lỗi xảy ra ở server khi lấy b� i báo theo dõi" });
  }
};

export const watchKeywords = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, message: "ID dự án không hợp lệ" });

    const { keyword_ids } = request.body || {};
    const result = await keywordServiceRef.addWatchedKeywords(projectId, keyword_ids);

    if (!result.success) return reply.status(400).send({ success: false, code: "ERROR_KEYWORDS_ALREADY_WATCHED", message: "Có từ khóa đã tồn tại trong danh sách theo dõi của dự án" });
    return reply.status(201).send({ success: true, code: "SUCCESS_CREATE_WATCHED_KEYWORDS", message: `Thêm th� nh công ${result.insertedCount} từ khóa v� o danh sách theo dõi` });
  } catch (error) {
    logger.error("[watchKeywords] Error:", error);
    return reply.status(500).send({ success: false, code: "ERROR_SERVER_CREATE_WATCHED_KEYWORD", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const deleteWatchedKeyword = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    const keywordId = parseInt(request.params.keywordId);
    if (isNaN(projectId) || isNaN(keywordId)) return reply.status(400).send({ success: false, message: "ID dự án hoặc ID từ khóa không hợp lệ" });

    const isDeleted = await keywordServiceRef.removeWatchedKeyword(projectId, keywordId);
    if (!isDeleted) return reply.status(404).send({ success: false, code: "ERROR_KEYWORD_NOT_FOUND", message: "Từ khóa không nằm trong danh sách theo dõi của dự án" });

    return reply.status(200).send({ success: true, code: "SUCCESS_DELETE_WATCHED_KEYWORD", message: "Đã xóa từ khóa khỏi dự án th� nh công" });
  } catch (error) {
    logger.error("[deleteWatchedKeyword] Lỗi khi xóa từ khóa theo dõi:", error);
    return reply.status(500).send({ success: false, code: "ERROR_SERVER_DELETE_WATCHED_KEYWORD", message: "Có lỗi xảy ra ở server khi xóa từ khóa" });
  }
};

export const updateWatchedKeywords = async (request, reply) => {
  try {
    const projectId = parseInt(request.params.id);
    const { keyword_ids } = request.body || {};
    if (isNaN(projectId)) return reply.status(400).send({ success: false, message: "ID dự án không hợp lệ" });

    await keywordServiceRef.replaceWatchedKeywords(projectId, keyword_ids || []);
    return reply.status(200).send({ success: true, code: "SUCCESS_UPDATE_WATCHED_KEYWORD", message: "Cập nhật danh sách từ khóa theo dõi th� nh công" });
  } catch (error) {
    logger.error("[updateWatchedKeywords] Lỗi khi cập nhật từ khóa theo dõi:", error);
    return reply.status(500).send({ success: false, code: "ERROR_SERVER_UPDATE_WATCHED_KEYWORD", message: "Có lỗi xảy ra ở server khi cập nhật từ khóa" });
  }
};

export const getAllKeywordsController = async (request, reply) => {
  try {
    const page = Math.max(parseInt(request.query.page) || 1, 1);
    const limit = Math.min(parseInt(request.query.limit) || 10, 100);
    const search = request.query.search || request.query.keyword || "";
    const result = await keywordServiceRef.getAllKeywords({ page, limit, search });
    return reply.status(200).send({ success: true, code: "KEYWORD_LIST_FETCHED", message: "Lấy danh sách keyword th� nh công", data: result.data, pagination: result.pagination });
  } catch (error) {
    logger.error("[Keyword Controller] Lỗi khi lấy danh sách keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const createKeywordController = async (request, reply) => {
  try {
    const keyword = await keywordServiceRef.createKeyword(request.body.display_name);
    return reply.status(201).send({ success: true, code: "KEYWORD_CREATED", message: "Tạo keyword th� nh công", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lỗi khi tạo keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getKeywordByIdController = async (request, reply) => {
  try {
    const keyword = await keywordServiceRef.getKeywordById(request.keywordId);
    return reply.status(200).send({ success: true, code: "KEYWORD_FETCHED", message: "Lấy keyword th� nh công", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lỗi khi lấy keyword theo ID:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getArticlesByKeywordController = async (request, reply) => {
  try {
    const page = Math.max(parseInt(request.query.page) || 1, 1);
    const limit = Math.min(parseInt(request.query.limit) || 10, 50);
    const sortBy = request.query.sortBy || request.query.sort_by || "publication_year";
    const sortOrder = request.query.sortOrder || request.query.sort_order || "desc";
    const scope = request.query.scope || "all";

    const result = await keywordServiceRef.getArticlesByKeyword(request.keywordId, { page, limit, sortBy, sortOrder, scope });
    return reply.status(200).send({ success: true, code: "KEYWORD_ARTICLES_FETCHED", message: "Lấy danh sách b� i báo theo keyword th� nh công", data: result.data, scope: result.scope, pagination: result.pagination });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lỗi khi lấy b� i báo theo keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_ARTICLE_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const updateKeywordController = async (request, reply) => {
  try {
    const keyword = await keywordServiceRef.updateKeyword(request.keywordId, request.body.display_name);
    return reply.status(200).send({ success: true, code: "KEYWORD_UPDATED", message: "Cập nhật keyword th� nh công", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lỗi khi cập nhật keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const deleteKeywordController = async (request, reply) => {
  try {
    await keywordServiceRef.deleteKeyword(request.keywordId);
    return reply.status(200).send({ success: true, code: "KEYWORD_DELETED", message: "Xóa keyword th� nh công" });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lỗi khi xóa keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const restoreKeywordController = async (request, reply) => {
  try {
    const keyword = await keywordServiceRef.restoreKeyword(request.keywordId);
    return reply.status(200).send({ success: true, code: "KEYWORD_RESTORED", message: "Khôi phục keyword th� nh công", data: keyword });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Keyword Controller] Lỗi khi restore keyword:", error);
    return reply.status(500).send({ success: false, code: "KEYWORD_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};




