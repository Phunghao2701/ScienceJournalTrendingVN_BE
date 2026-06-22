import {
  getTrendingKeywords as getTrendingKeywordsService,
  getWatchedKeywordArticles as getWatchedKeywordArticlesService,
  syncWatchedKeywords,
  validateKeywordIds,
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
import logger from "../utils/logger.js";

/**
 * Validate display_name cho keyword
 * @param {string} display_name
 * @returns {string|null} message lỗi nếu không hợp lệ, null nếu hợp lệ
 */
const validateDisplayName = (display_name) => {
  if (!display_name) return "Tên keyword không được để trống";
  if (display_name.length < 2) return "Tên keyword phải có ít nhất 2 ký tự";
  if (display_name.length > 255)
    return "Tên keyword không được vượt quá 255 ký tự";
  if (/[!@#$%^&*()_+={}\[\]|\\:;"'<>,?\/~`]/.test(display_name))
    return "Tên keyword không được chứa ký tự đặc biệt";
  if (/<[^>]*>/.test(display_name))
    return "Tên keyword không được chứa HTML hoặc script";
  return null;
};

/**
 * API Lấy Top 20 từ khóa trending của project
 */
export const getTrendingKeywords = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID dự án không hợp lệ",
      });
    }

    const result = await getTrendingKeywordsService(projectId, req.query);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách từ khóa trending thành công",
      data: result,
    });
  } catch (error) {
    logger.error("[Keyword Controller] Lỗi khi lấy trending keywords:", error);
    return res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra ở server khi lấy trending keywords",
    });
  }
};

/**
 * API Lấy luồng bài báo mới nhất từ các từ khóa đang theo dõi
 */
export const getWatchedKeywordArticles = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID dự án không hợp lệ",
      });
    }

    const userId = req.user.user_id;
    const result = await getWatchedKeywordArticlesService(
      projectId,
      userId,
      req.query,
    );

    return res.status(200).json({
      success: true,
      message: "Lấy luồng bài báo từ từ khóa theo dõi thành công",
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    logger.error(
      "[Keyword Controller] Lỗi khi lấy watched keyword articles:",
      error,
    );
    return res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra ở server khi lấy bài báo theo dõi",
    });
  }
};

/**
 * Thêm/đồng bộ danh sách từ khóa theo dõi cho một Project (Hỗ trợ cả mảng keyword_ids hoặc single keyword_id)
 */
export const watchKeywords = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "ID dự án không hợp lệ" });
    }

    const { keyword_ids } = req.body || {};

    // Thêm mới các keyword vào danh sách (middleware đã validate)
    const result = await addWatchedKeywords(projectId, keyword_ids);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "ERROR_KEYWORDS_ALREADY_WATCHED",
        message:
          "Có từ khóa đã tồn tại trong danh sách theo dõi của dự án, không thể thêm mới",
      });
    }

    return res.status(201).json({
      success: true,
      code: "SUCCESS_CREATE_WATCHED_KEYWORDS",
      message: `Thêm thành công ${result.insertedCount} từ khóa vào danh sách theo dõi`,
    });
  } catch (error) {
    logger.error("[watchKeywords] Error:", error);
    return res.status(500).json({
      success: false,
      code: "ERROR_SERVER_CREATE_WATCHED_KEYWORD",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

/**
 * API Xóa một từ khóa khỏi danh sách theo dõi của dự án
 */
export const deleteWatchedKeyword = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const keywordId = parseInt(req.params.keywordId);

    if (isNaN(projectId) || isNaN(keywordId)) {
      return res.status(400).json({
        success: false,
        message: "ID dự án hoặc ID từ khóa không hợp lệ",
      });
    }

    // Check quyền sở hữu (Nếu middleware chưa check thì check tại đây)
    const userId = req.user.user_id;
    const isOwner = await checkProjectOwnership(projectId, userId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        code: "ERROR_FORBIDDEN_DELETE_WATCHED_KEYWORD",
        message:
          "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này",
      });
    }

    const isDeleted = await removeWatchedKeyword(projectId, keywordId);

    if (!isDeleted) {
      return res.status(404).json({
        success: false,
        code: "ERROR_KEYWORD_NOT_FOUND",
        message: "Từ khóa không nằm trong danh sách theo dõi của dự án",
      });
    }

    return res.status(200).json({
      success: true,
      code: "SUCCESS_DELETE_WATCHED_KEYWORD",
      message: "Đã xóa từ khóa khỏi dự án thành công",
    });
  } catch (error) {
    logger.error("[deleteWatchedKeyword] Lỗi khi xóa từ khóa theo dõi:", error);
    return res.status(500).json({
      success: false,
      code: "ERROR_SERVER_DELETE_WATCHED_KEYWORD",
      message: "Có lỗi xảy ra ở server khi xóa từ khóa",
    });
  }
};

/**
 * API Cập nhật (ghi đè hoàn toàn) danh sách từ khóa theo dõi của dự án
 */
export const updateWatchedKeywords = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { keyword_ids } = req.body || {};

    if (isNaN(projectId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID dự án không hợp lệ" });
    }

    await replaceWatchedKeywords(projectId, keyword_ids || []);

    return res.status(200).json({
      success: true,
      code: "SUCCESS_UPDATE_WATCHED_KEYWORD",
      message: "Cập nhật danh sách từ khóa theo dõi thành công",
    });
  } catch (error) {
    logger.error(
      "[updateWatchedKeywords] Lỗi khi cập nhật từ khóa theo dõi:",
      error,
    );
    return res.status(500).json({
      success: false,
      code: "ERROR_SERVER_UPDATE_WATCHED_KEYWORD",
      message: "Có lỗi xảy ra ở server khi cập nhật từ khóa",
    });
  }
};

//********* Những API liên quan tương tác trực tiếp tới Table Keyword
// Keyword Management

export const getAllKeywordsController = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = req.query.search || req.query.keyword || "";
    const result = await getAllKeywords({ page, limit, search });
    return res.status(200).json({
      success: true,
      code: "KEYWORD_LIST_FETCHED",
      message: "Lấy danh sách keyword thành công",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("[Keyword Controller] Lỗi khi lấy danh sách keyword:", error);
    return res.status(500).json({
      success: false,
      code: "KEYWORD_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const createKeywordController = async (req, res) => {
  try {
    const errorMsg = validateDisplayName(req.body.display_name);
    if (errorMsg) {
      return res.status(400).json({ success: false, message: errorMsg });
    }

    const keyword = await createKeyword(req.body.display_name);
    return res.status(201).json({
      success: true,
      code: "KEYWORD_CREATED",
      message: "Tạo keyword thành công",
      data: keyword,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Keyword Controller] Lỗi khi tạo keyword:", error);
    return res.status(500).json({
      success: false,
      code: "KEYWORD_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getKeywordByIdController = async (req, res) => {
  try {
    const keyword = await getKeywordById(req.keywordId);
    return res.status(200).json({
      success: true,
      code: "KEYWORD_FETCHED",
      message: "Lấy keyword thành công",
      data: keyword,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Keyword Controller] Lỗi khi lấy keyword theo ID:", error);
    return res.status(500).json({
      success: false,
      code: "KEYWORD_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getArticlesByKeywordController = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const sortBy = req.query.sortBy || req.query.sort_by || "publication_year";
    const sortOrder = req.query.sortOrder || req.query.sort_order || "desc";

    const result = await getArticlesByKeyword(req.keywordId, { page, limit, sortBy, sortOrder });
    return res.status(200).json({
      success: true,
      code: "KEYWORD_ARTICLES_FETCHED",
      message: "Lấy danh sách bài báo theo keyword thành công",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Keyword Controller] Lỗi khi lấy bài báo theo keyword:", error);
    return res.status(500).json({
      success: false,
      code: "KEYWORD_ARTICLE_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const updateKeywordController = async (req, res) => {
  try {
    const errorMsg = validateDisplayName(req.body.display_name);
    if (errorMsg) {
      return res.status(400).json({ success: false, message: errorMsg });
    }

    const keyword = await updateKeyword(req.keywordId, req.body.display_name);
    return res.status(200).json({
      success: true,
      code: "KEYWORD_UPDATED",
      message: "Cập nhật keyword thành công",
      data: keyword,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Keyword Controller] Lỗi khi cập nhật keyword:", error);
    return res.status(500).json({
      success: false,
      code: "KEYWORD_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const deleteKeywordController = async (req, res) => {
  try {
    await deleteKeyword(req.keywordId);
    return res.status(200).json({
      success: true,
      code: "KEYWORD_DELETED",
      message: "Xóa keyword thành công",
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Keyword Controller] Lỗi khi xóa keyword:", error);
    return res.status(500).json({
      success: false,
      code: "KEYWORD_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const restoreKeywordController = async (req, res) => {
  try {
    const keyword = await restoreKeyword(req.keywordId);
    return res.status(200).json({
      success: true,
      code: "KEYWORD_RESTORED",
      message: "Khôi phục keyword thành công",
      data: keyword,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Keyword Controller] Lỗi khi restore keyword:", error);
    return res.status(500).json({
      success: false,
      code: "KEYWORD_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};
