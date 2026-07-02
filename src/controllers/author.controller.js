import * as authorService from "../services/author.service.js";
import logger from "../utils/logger.js";
import { AUTHOR_CODES } from "../middlewares/author.middleware.js";
export const authorServiceRef = { ...authorService };

/**
 * Lấy phân tích lĩnh vực nghiên cứu của một tác giả cùng thông tin tác giả.
 *
 * - Kiểm tra `req.params.id` là số nguyên hợp lệ (> 0).
 * - Gọi service để lấy thông tin tác giả và phân tích các lĩnh vực nghiên cứu.
 * - Trả về JSON chứa thông tin tác giả và trường `breakdown` (mảng/obj do service trả về).
 *
 * @param {import('express').Request} req - Express request object. Dùng `req.params.id`.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<import('express').Response>} Response HTTP: 200 khi thành công,
 * 400 khi ID không hợp lệ, 500 khi có lỗi phía server.
 */
export const getAuthorAreasBreakdown = async (req, res) => {
  try {
    const authorId = Number(req.params.id);

    if (!Number.isInteger(authorId) || authorId <= 0) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.INVALID_AUTHOR_ID,
        message: "ID tác giả không hợp lệ",
      });
    }

    //call service
    const authorInfo = await authorServiceRef.getAuthorById(authorId);
    const areasBreakdown =
      await authorServiceRef.getAuthorAreasBreakdownService(authorId);

    // 5. Trả response
    return res.status(200).json({
      success: true,
      message: "Phân tích lĩnh vực nghiên cứu của tác giả thành công",
      code: AUTHOR_CODES.AREA_BREAKDOWN_FETCHED,
      data: {
        ...authorInfo,
        breakdown: areasBreakdown,
      },
    });
  } catch (error) {
    logger.error("Lỗi phân tích lĩnh vực nghiên cứu của tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

/**
 * Lấy danh sách bài viết của một tác giả với thông tin phân trang cơ bản.
 *
 * - Kiểm tra `req.params.id` là số nguyên hợp lệ (> 0).
 * - Kiểm tra `req.query.limit` và `req.query.page` là số hợp lệ.
 * - Gọi service để lấy danh sách bài viết và trả về cùng object `pagination`.
 *
 * @param {import('express').Request} req - Express request object. Sử dụng
 * `req.params.id`, `req.query.limit`, `req.query.page`.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<import('express').Response>} Response HTTP: 200 khi thành công,
 * 400 khi input không hợp lệ, 500 khi có lỗi phía server.
 */
export const getAuthorArticles = async (req, res) => {
  try {
    const authorId = Number(req.params.id);
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 10;
    const page = req.query.page !== undefined ? Number(req.query.page) : 1;
    const safeLimit = limit === 0 ? 10 : limit;
    const safePage = page;

    if (!Number.isInteger(authorId) || authorId <= 0) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_ID,
        message: "ID tác giả không hợp lệ",
      });
    }

    if (!Number.isInteger(safeLimit) || safeLimit < 0) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_LIMIT,
        message: "Giá trị limit không hợp lệ",
      });
    }

    if (!Number.isInteger(safePage) || safePage < 1) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION,
        message: "Giá trị page không hợp lệ",
      });
    }

    const result = await authorServiceRef.getAuthorArticlesService(
      authorId,
      safeLimit,
      safePage,
    );

    return res.status(200).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_ARTICLES_FETCHED,
      message: "Lấy bài viết của tác giả thành công",
      pagination: result.pagination,
      data: result.items,
    });
  } catch (error) {
    logger.error("Lỗi lấy bài viết của tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

/**
 * Lấy bảng xếp hạng tác giả có phân trang.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<import('express').Response>}
 */
export const getAuthorLeaderboard = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;

    if (!Number.isInteger(limit) || limit < 0) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_LIMIT,
        message: "Giá trị limit không hợp lệ",
      });
    }

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION,
        message: "Giá trị page không hợp lệ",
      });
    }

    const result = await authorServiceRef.getAuthorLeaderboardService(
      limit,
      page,
    );

    return res.status(200).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_LEADERBOARD_FETCHED,
      message: "Lấy bảng xếp hạng tác giả thành công",
      pagination: result.pagination,
      data: result.items,
    });
  } catch (error) {
    logger.error("Lỗi lấy bảng xếp hạng tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

// ==========================================
// Author Management CRUD
// ==========================================

export const getAllAuthorsController = async (req, res) => {
  try {
    const { page, limit } = req.pagination;
    const search = req.query.search || "";
    const sort = req.query.sort || "impact";
    const result = await authorServiceRef.getAllAuthors({
      page,
      limit,
      search,
      sort,
    });
    return res.status(200).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_LIST_FETCHED,
      message: "Lấy danh sách tác giả thành công",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi lấy danh sách tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getAuthorByIdController = async (req, res) => {
  try {
    const idParam = req.params.id;
    const author = await authorServiceRef.getAuthorById(idParam);
    if (!author) {
      return res.status(404).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_NOT_FOUND,
        message: "Tác giả không tồn tại",
      });
    }
    return res.status(200).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_FETCHED,
      message: "Lấy thông tin tác giả thành công",
      data: author,
    });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi lấy tác giả theo ID:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const createAuthorController = async (req, res) => {
  try {
    const author = await authorServiceRef.createAuthor(req.body);
    return res.status(201).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_CREATED,
      message: "Tạo tác giả thành công",
      data: author,
    });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi tạo tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const updateAuthorController = async (req, res) => {
  try {
    const author = await authorServiceRef.updateAuthor(req.authorId, req.body);
    return res.status(200).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_UPDATED,
      message: "Cập nhật tác giả thành công",
      data: author,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Author Controller] Lỗi khi cập nhật tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const deleteAuthorController = async (req, res) => {
  try {
    await authorServiceRef.deleteAuthor(req.authorId);
    return res.status(200).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_DELETED,
      message: "Xóa tác giả thành công",
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Author Controller] Lỗi khi xóa tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const restoreAuthorController = async (req, res) => {
  try {
    const author = await authorServiceRef.restoreAuthor(req.authorId);
    return res.status(200).json({
      success: true,
      code: AUTHOR_CODES.AUTHOR_RESTORED,
      message: "Khôi phục tác giả thành công",
      data: author,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    logger.error("[Author Controller] Lỗi khi restore tác giả:", error);
    return res.status(500).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_SERVER_ERROR,
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};
