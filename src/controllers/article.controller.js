import * as articleService from "../services/article.service.js";
import {
  getArticleAnalysisData,
  getArticleAnalyticsData,
  getArticleListData,
} from "../services/articleDiscoveryCache.service.js";
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
import { createLog } from '../services/log.service.js';

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
    const scope = req.query.scope || "all";

    const [articles, total] = await Promise.all([
      articleService.getArticlesByKeywords(keywords, limit, offset, { scope }),
      articleService.countArticlesByKeywords(keywords, { scope }),
    ]);

    return res.status(200).json({
      success: true,
      code: "ARTICLES_GET_BY_KEYWORDS_SUCCESS",
      message: "Lấy danh sách bài báo thành công!",
      data: {
        scope,
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
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!",
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
      publisherId: req.query.publisher_id || req.query.publisher,
      authorId: req.query.author_id || req.query.author,
      keywordId: req.query.keyword_id || req.query.keyword,
      institutionId: req.query.institution_id || req.query.institution,
      volumeId: req.query.volume_id,
      issueId: req.query.issue_id,
      isOpenAccess: req.query.is_open_access,
      access: req.query.access,
      scope: req.query.scope || "all",
      countryId: req.query.country_id || req.query.country,
    };

    const { articles, total, stats } = await getArticleListData(serviceParams);

    return res.status(200).json({
      success: true,
      code: "ARTICLES_GET_SUCCESS",
      message: "Lấy danh sách bài báo thành công!",
      data: {
        scope: serviceParams.scope,
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
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getArticleAnalytics = async (req, res) => {
  try {
    const params = {
      search: (req.query.search || "").trim(),
      publicationYear: req.query.publication_year || req.query.year,
      journalId: req.query.journal_id || req.query.journal,
      topicId: req.query.topic_id || req.query.topic,
      publisherId: req.query.publisher_id || req.query.publisher,
      authorId: req.query.author_id || req.query.author,
      keywordId: req.query.keyword_id || req.query.keyword,
      institutionId: req.query.institution_id || req.query.institution,
      volumeId: req.query.volume_id,
      issueId: req.query.issue_id,
      isOpenAccess: req.query.is_open_access,
      access: req.query.access,
      scope: req.query.scope || "all",
      countryId: req.query.country_id || req.query.country,
    };

    const analytics = await getArticleAnalyticsData(params);
    return res.status(200).json({
      success: true,
      code: "ARTICLE_ANALYTICS_SUCCESS",
      message: "Lấy analytics bài báo thành công!",
      data: analytics,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy analytics bài báo:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getArticleAnalysis = async (req, res) => {
  try {
    const params = {
      search: (req.query.search || "").trim(),
      publicationYear: req.query.publication_year || req.query.year,
      fromYear: req.query.from_year || req.query.current_from_year,
      toYear: req.query.to_year || req.query.current_to_year,
      journalId: req.query.journal_id || req.query.journal,
      topicId: req.query.topic_id || req.query.topic,
      publisherId: req.query.publisher_id || req.query.publisher,
      authorId: req.query.author_id || req.query.author,
      keywordId: req.query.keyword_id || req.query.keyword,
      institutionId: req.query.institution_id || req.query.institution,
      volumeId: req.query.volume_id,
      issueId: req.query.issue_id,
      isOpenAccess: req.query.is_open_access,
      access: req.query.access,
      scope: req.query.scope || "all",
      countryId: req.query.country_id || req.query.country,
      limit: req.query.limit,
    };

    const analysis = await getArticleAnalysisData(params);
    return res.status(200).json({
      success: true,
      code: "ARTICLE_ANALYSIS_SUCCESS",
      message: "Lay analysis bai bao thanh cong!",
      data: analysis,
    });
  } catch (error) {
    logger.error("Loi khi lay analysis bai bao:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.statusCode ? error.message : "Co loi xay ra o Server!",
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

const getPaginationParams = (req, defaultLimit = 20) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = req.query.offset !== undefined
    ? Math.max(parseInt(req.query.offset, 10) || 0, 0)
    : (page - 1) * limit;
  return { limit, page, offset };
};

export const getArticleCitingWorks = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, page, offset } = getPaginationParams(req, 20);
    const [items, total] = await Promise.all([
      articleService.getArticleCitingWorks(id, { limit, offset }),
      articleService.countArticleCitingWorks(id),
    ]);

    return res.status(200).json({
      success: true,
      code: "ARTICLE_CITING_WORKS_GET_SUCCESS",
      message: "Lấy danh sách bài báo trích dẫn thành công!",
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          offset,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error("Lỗi khi lấy citing works của bài báo:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getArticleCitingWorksAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const analytics = await articleService.getArticleCitingWorksAnalytics(id);

    return res.status(200).json({
      success: true,
      code: "ARTICLE_CITING_WORKS_ANALYTICS_GET_SUCCESS",
      message: "Lấy thống kê bài báo trích dẫn thành công!",
      data: analytics,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy analytics citing works của bài báo:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getArticleReferences = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, page, offset } = getPaginationParams(req, 50);
    const [items, total] = await Promise.all([
      articleService.getArticleReferences(id, { limit, offset }),
      articleService.countArticleReferences(id),
    ]);

    return res.status(200).json({
      success: true,
      code: "ARTICLE_REFERENCES_GET_SUCCESS",
      message: "Lấy danh sách tài liệu tham khảo thành công!",
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          offset,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error("Lỗi khi lấy references của bài báo:", error);
    return res.status(500).json({
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

    createLog({
      userId: req.user?.user_id,
      userRole: req.user?.role,
      action: 'CREATE',
      entityTable: 'Article',
      entityId: newArticle.article_id,
      message: `Tạo mới bài báo: ${newArticle.title}`,
      metadata: { ip: req.ip }
    });

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

    createLog({
      userId: req.user?.user_id,
      userRole: req.user?.role,
      action: 'UPDATE',
      entityTable: 'Article',
      entityId: updatedArticle.article_id,
      message: `Cập nhật bài báo: ${updatedArticle.title}`,
      metadata: { ip: req.ip }
    });

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

    createLog({
      userId: req.user?.user_id,
      userRole: req.user?.role,
      action: 'DELETE',
      entityTable: 'Article',
      entityId: id,
      message: `Xóa mềm bài báo có ID: ${id}`,
      metadata: { ip: req.ip }
    });

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
