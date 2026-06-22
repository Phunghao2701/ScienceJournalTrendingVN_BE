import * as articleService from "../services/article.service.js";
import {
  createAuthorArticleRelationships,
  updateAuthorArticleRelationships,
} from "../services/author.service.js";
import {
  addKeywordsToArticle,
  updateKeywordsToArticle,
} from "../services/keyword.service.js";
import { createSubTopicArticleRelationships } from "../services/topic.service.js";
import logger from "../utils/logger.js";

/**
 * Tìm kiếm bài báo theo danh sách từ khóa chuyên biệt.
 */
export const getArticlesByKeywords = async (req, res) => {
  try {
    const rawKeywords = req.query.keywords;

    if (!rawKeywords || rawKeywords.trim() === "") {
      return res.status(400).json({
        success: false,
        code: "MISSING_KEYWORDS",
        message:
          "Vui lòng cung cấp tham số 'keywords' trong query string! Ví dụ: ?keywords=Machine Learning,Deep Learning",
      });
    }

    const keywords = rawKeywords
      .split(",")
      .map((kw) => kw.trim().toLowerCase())
      .filter((kw) => kw.length > 0);

    if (keywords.length === 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_KEYWORDS",
        message: "Danh sách keyword không hợp lệ!",
      });
    }

    const limit = parseInt(req.query.limit, 10) || 20;
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      articleService.getArticlesByKeywords(keywords, limit, offset),
      articleService.countArticlesByKeywords(keywords),
    ]);

    return res.status(200).json({
      success: true,
      code: "ARTICLES_GET_BY_KEYWORDS_SUCCESS",
      message: "Lấy danh sách bài báo thành công!",
      data: {
        articles: articles,
        pagination: {
          total: total,
          page: page,
          limit: limit,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("getArticlesByKeywords error:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

/**
 * Lấy danh sách bài báo public, hỗ trợ search/filter/sort/pagination.
 */
export const getArticles = async (req, res) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;
    if (page <= 0) page = 1;
    if (limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "created_at";
    const sortOrder = (req.query.sortOrder || "DESC").toUpperCase();

    if (!["ASC", "DESC"].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SORT_ORDER",
        message: "Tham số 'sortOrder' phải là 'asc' hoặc 'desc'!",
      });
    }

    const serviceParams = {
      limit,
      offset,
      search: (req.query.search || "").trim(),
      sortBy,
      sortOrder,
      publicationYear: req.query.publication_year || req.query.year,
      journalId: req.query.journal_id || req.query.journal,
      topicId: req.query.topic_id || req.query.topic,
      volumeId: req.query.volume_id,
      issueId: req.query.issue_id,
      isOpenAccess: req.query.is_open_access || req.query.access,
    };

    if (serviceParams.isOpenAccess === "all" || serviceParams.isOpenAccess === "") {
      serviceParams.isOpenAccess = undefined;
    }
    if (serviceParams.isOpenAccess === "oa") {
      serviceParams.isOpenAccess = true;
    }

    const [articles, total, stats] = await Promise.all([
      articleService.getAllArticles(serviceParams),
      articleService.countAllArticles(serviceParams),
      articleService.getArticleListStats(),
    ]);

    return res.status(200).json({
      success: true,
      code: "ARTICLES_GET_SUCCESS",
      message: "Lấy danh sách bài báo thành công!",
      data: {
        articles,
        items: articles,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        stats,
      },
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách bài báo:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

/**
 * Router handler tổng hợp: chuyển hướng chế độ tìm kiếm.
 */
export const getArticle = async (req, res) => {
  const rawKeywords = req.query.keywords;
  if (!rawKeywords || rawKeywords.trim() === "") {
    return getArticles(req, res);
  } else {
    return getArticlesByKeywords(req, res);
  }
};

/**
 * Lấy chi tiết một bài báo theo article_id.
 */
export const getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await articleService.getArticleById(id);

    if (!article) {
      return res
        .status(404)
        .json({
          success: false,
          code: "ARTICLE_NOT_FOUND",
          message: "Bài báo không tồn tại!",
        });
    }

    if (article.is_deleted === true) {
      return res
        .status(410)
        .json({
          success: false,
          code: "ARTICLE_DELETED",
          message: "Bài báo này đã bị xóa khỏi hệ thống!",
        });
    }

    return res.status(200).json({
      success: true,
      code: "ARTICLE_GET_SUCCESS",
      message: "Lấy thông tin bài báo thành công!",
      data: article,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin bài báo theo ID:", error);
    return res
      .status(500)
      .json({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Có lỗi xảy ra ở Server!",
      });
  }
};

/**
 * Tạo mới một bài báo đầy đủ (Đã bóc tách Validation).
 */
export const createArticle = async (req, res) => {
  const {
    title,
    publication_year,
    version,
    issue_id,
    abstract,
    doi,
    primary_topic,
    sub_topic,
    authors,
    keywords,
  } = req.body;

  try {
    const newArticle = await articleService.createArticle({
      version,
      issue_id,
      title,
      abstract,
      publication_year,
      doi,
      primary_topic: primary_topic == 0 ? null : primary_topic,
    });

    // 2. Tạo các quan hệ đồng bộ
    await createAuthorArticleRelationships(
      newArticle.article_id,
      authors || [],
    );
    await createSubTopicArticleRelationships(
      newArticle.article_id,
      sub_topic || [],
      primary_topic == 0 ? null : primary_topic,
    );

    const hasKeywords =
      keywords &&
      (Array.isArray(keywords)
        ? keywords.length > 0
        : Object.keys(keywords).length > 0);
    if (hasKeywords) {
      await addKeywordsToArticle(newArticle.article_id, keywords);
    }

    return res.status(201).json({
      success: true,
      code: "ARTICLE_CREATE_SUCCESS",
      message: "Bài báo đã được tạo thành công!",
      data: newArticle,
    });
  } catch (error) {
    logger.error("Lỗi khi tạo dữ liệu bài báo tại Controller:", error);
    if (error.statusCode === 400) {
      return res
        .status(400)
        .json({
          success: false,
          code: "VALIDATION_ERROR",
          message: error.message,
        });
    }
    return res
      .status(500)
      .json({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Có lỗi xảy ra ở Server!",
      });
  }
};

/**
 * Cập nhật thông tin bài báo theo ID (Đã bóc tách Validation).
 */
export const updateArticle = async (req, res) => {
  const { id } = req.params;
  const dataBody = req.body;

  try {
    const article = await articleService.getArticleById(id);
    if (!article) {
      return res
        .status(404)
        .json({
          success: false,
          code: "ARTICLE_NOT_FOUND",
          message: "Article không tìm thấy",
        });
    }

    const updatedArticle = await articleService.updateArticle({
      article_id: article.article_id,
      ...dataBody,
    });

    if (dataBody.authors !== undefined) {
      await updateAuthorArticleRelationships(id, dataBody.authors);
    }

    if (dataBody.keywords !== undefined) {
      await updateKeywordsToArticle(id, dataBody.keywords);
    }

    return res.status(200).json({
      success: true,
      code: "ARTICLE_UPDATE_SUCCESS",
      message: "Article updated successfully",
      data: updatedArticle,
    });
  } catch (error) {
    if (error.message && error.message.startsWith("VALIDATION_ERROR:")) {
      const cleanMessage = error.message.replace("VALIDATION_ERROR: ", "");
      return res
        .status(400)
        .json({
          success: false,
          code: "VALIDATION_ERROR",
          message: cleanMessage,
        });
    }
    return res
      .status(500)
      .json({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      });
  }
};

/**
 * Xóa mềm bài báo.
 */
export const deleteArticle = async (req, res) => {
  const { id } = req.params;
  try {
    const article = await articleService.getArticleById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        code: "ARTICLE_NOT_FOUND",
        message: "Article không tìm thấy",
      });
    }

    await articleService.deleteArticle(id);
    return res
      .status(200)
      .json({
        success: true,
        code: "ARTICLE_DELETE_SUCCESS",
        message: "Article đã xóa thành công",
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      });
  }
};

/**
 * Khôi phục một bài báo đã bị xóa mềm.
 */
export const restoreArticle = async (req, res) => {
  const { id } = req.params;
  try {
    const restored = await articleService.restoreArticle(id);
    if (!restored) {
      return res
        .status(404)
        .json({
          success: false,
          code: "ARTICLE_NOT_FOUND",
          message: "Article không tìm thấy hoặc đã được khôi phục",
        });
    }
    return res
      .status(200)
      .json({
        success: true,
        code: "ARTICLE_RESTORE_SUCCESS",
        message: "Article đã khôi phục thành công",
        data: restored,
      });
  } catch (error) {
    logger.error(`Error restoring article ${id}:`, error);
    return res
      .status(500)
      .json({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      });
  }
};
