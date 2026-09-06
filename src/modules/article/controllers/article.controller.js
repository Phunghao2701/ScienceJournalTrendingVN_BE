import * as articleService from '../services/article.service.js';
import { getArticleListData, getArticleAnalyticsData, getArticleAnalysisData } from '../services/articleDiscoveryCache.service.js';
import { hydrateArticleReferences as hydrateReferencesService } from '../services/articleReferenceHydration.service.js';
import { getArticleAnalysis as getArticleAnalysisService } from '../services/articleAnalysis.service.js';
import * as commentService from '../services/comment.service.js';
import { createAuthorArticleRelationships, updateAuthorArticleRelationships } from '../../author/services/author.service.js';
import { addKeywordsToArticle, updateKeywordsToArticle } from '../../topic/services/keyword.service.js';
import { createSubTopicArticleRelationships } from '../../topic/services/topic.service.js';
import logger from '../../../utils/logger.js';
import { buildCacheKey, getOrSetCache } from '../../../utils/cache.js';
import { createLog } from '../../system/services/log.service.js';

// --- ARTICLE ACTIONS ---

export const getArticlesByKeywords = async (request, reply) => {
  try {
    const rawKeywords = request.query.keywords;
    if (!rawKeywords || rawKeywords.trim() === "") {
      return reply.status(400).send({ success: false, code: "MISSING_KEYWORDS", message: "Vui lòng cung cấp tham số 'keywords' trong query string!" });
    }

    const keywords = rawKeywords.split(",").map((kw) => kw.trim().toLowerCase()).filter((kw) => kw.length > 0);
    if (keywords.length === 0) {
      return reply.status(400).send({ success: false, code: "INVALID_KEYWORDS", message: "Danh sách keyword không hợp lệ!" });
    }

    const limit = parseInt(request.query.limit, 10) || 20;
    const page = parseInt(request.query.page, 10) || 1;
    const offset = (page - 1) * limit;
    const scope = request.query.scope || "all";

    const [articles, total] = await Promise.all([
      articleService.getArticlesByKeywords(keywords, limit, offset, { scope }),
      articleService.countArticlesByKeywords(keywords, { scope }),
    ]);

    return reply.status(200).send({
      success: true, code: "ARTICLES_GET_BY_KEYWORDS_SUCCESS", message: "Lấy danh sách b� i báo th� nh công!",
      data: { scope, articles, pagination: { total, page, limit, total_pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    logger.error("getArticlesByKeywords error:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!" });
  }
};

export const getArticles = async (request, reply) => {
  try {
    let page = parseInt(request.query.page, 10) || 1;
    let limit = parseInt(request.query.limit, 10) || 10;
    if (page <= 0) page = 1;
    if (limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;
    const sortBy = request.query.sortBy || "created_at";
    const sortOrder = (request.query.sortOrder || "DESC").toUpperCase();

    if (!["ASC", "DESC"].includes(sortOrder)) {
      return reply.status(400).send({ success: false, code: "INVALID_SORT_ORDER", message: "Tham số 'sortOrder' phải l�  'asc' hoặc 'desc'!" });
    }

    const serviceParams = {
      limit, offset, search: (request.query.search || "").trim(), sortBy, sortOrder,
      publicationYear: request.query.publication_year || request.query.year,
      journalId: request.query.journal_id || request.query.journal,
      topicId: request.query.topic_id || request.query.topic,
      publisherId: request.query.publisher_id || request.query.publisher,
      authorId: request.query.author_id || request.query.author,
      keywordId: request.query.keyword_id || request.query.keyword,
      institutionId: request.query.institution_id || request.query.institution,
      volumeId: request.query.volume_id, issueId: request.query.issue_id,
      isOpenAccess: request.query.is_open_access, access: request.query.access,
      scope: request.query.scope || "all", countryId: request.query.country_id || request.query.country,
    };

    const { articles, total: cachedTotal, stats } = await getArticleListData(serviceParams);
    const total = Number(stats?.totalArticles) || cachedTotal || 0;

    return reply.status(200).send({
      success: true, code: "ARTICLES_GET_SUCCESS", message: "Lấy danh sách b� i báo th� nh công!",
      data: { scope: serviceParams.scope, articles, items: articles, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }, stats },
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách b� i báo:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!" });
  }
};

export const getArticleAnalytics = async (request, reply) => {
  try {
    const params = {
      search: (request.query.search || "").trim(),
      publicationYear: request.query.publication_year || request.query.year,
      journalId: request.query.journal_id || request.query.journal,
      topicId: request.query.topic_id || request.query.topic,
      publisherId: request.query.publisher_id || request.query.publisher,
      authorId: request.query.author_id || request.query.author,
      keywordId: request.query.keyword_id || request.query.keyword,
      institutionId: request.query.institution_id || request.query.institution,
      volumeId: request.query.volume_id, issueId: request.query.issue_id,
      isOpenAccess: request.query.is_open_access, access: request.query.access,
      scope: request.query.scope || "all", countryId: request.query.country_id || request.query.country,
    };

    const analytics = await getArticleAnalyticsData(params);
    return reply.status(200).send({ success: true, code: "ARTICLE_ANALYTICS_SUCCESS", message: "Lấy analytics b� i báo th� nh công!", data: analytics });
  } catch (error) {
    logger.error("Lỗi khi lấy analytics b� i báo:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: error.statusCode ? error.message : "Có lỗi xảy ra ở Server!" });
  }
};

export const getArticleAnalysis = async (request, reply) => {
  try {
    const params = {
      search: (request.query.search || "").trim(),
      publicationYear: request.query.publication_year || request.query.year,
      fromYear: request.query.from_year || request.query.current_from_year,
      toYear: request.query.to_year || request.query.current_to_year,
      journalId: request.query.journal_id || request.query.journal,
      topicId: request.query.topic_id || request.query.topic,
      publisherId: request.query.publisher_id || request.query.publisher,
      authorId: request.query.author_id || request.query.author,
      keywordId: request.query.keyword_id || request.query.keyword,
      institutionId: request.query.institution_id || request.query.institution,
      volumeId: request.query.volume_id, issueId: request.query.issue_id,
      isOpenAccess: request.query.is_open_access, access: request.query.access,
      scope: request.query.scope || "all", countryId: request.query.country_id || request.query.country,
      limit: request.query.limit,
    };

    const analysis = await getArticleAnalysisData(params);
    return reply.status(200).send({ success: true, code: "ARTICLE_ANALYSIS_SUCCESS", message: "Lay analysis bai bao thanh cong!", data: analysis });
  } catch (error) {
    logger.error("Loi khi lay analysis bai bao:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: error.statusCode ? error.message : "Co loi xay ra o Server!" });
  }
};

export const getArticle = async (request, reply) => {
  const rawKeywords = request.query.keywords;
  if (!rawKeywords || rawKeywords.trim() === "") {
    return getArticles(request, reply);
  } else {
    // verifyToken middleware should have run before this if keywords are present (handled in route)
    return getArticlesByKeywords(request, reply);
  }
};

export const getArticleById = async (request, reply) => {
  try {
    const { id } = request.params;
    const cacheKey = buildCacheKey(`detail:${id}`, {}, "article");
    const article = await getOrSetCache(cacheKey, () => articleService.getArticleById(id), {
      freshTtlSeconds: 15 * 60,
      staleTtlSeconds: 24 * 60 * 60,
    });

    if (!article) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "B� i báo không tồn tại!" });
    if (article.is_deleted === true) return reply.status(410).send({ success: false, code: "ARTICLE_DELETED", message: "B� i báo n� y đã bị xóa khỏi hệ thống!" });

    return reply.status(200).send({ success: true, code: "ARTICLE_GET_SUCCESS", message: "Lấy thông tin b� i báo th� nh công!", data: article });
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin b� i báo theo ID:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

const getPaginationParams = (request, defaultLimit = 20) => {
  const limit = Math.min(Math.max(parseInt(request.query.limit, 10) || defaultLimit, 1), 100);
  const page = Math.max(parseInt(request.query.page, 10) || 1, 1);
  const offset = request.query.offset !== undefined ? Math.max(parseInt(request.query.offset, 10) || 0, 0) : (page - 1) * limit;
  return { limit, page, offset };
};

export const getArticleCitingWorks = async (request, reply) => {
  try {
    const { id } = request.params;
    const { limit, page, offset } = getPaginationParams(request, 20);
    const cacheKey = buildCacheKey(`citing:${id}`, { limit, offset }, "article");
    const { items, total } = await getOrSetCache(cacheKey, async () => {
      const [cItems, cTotal] = await Promise.all([
        articleService.getArticleCitingWorks(id, { limit, offset }),
        articleService.countArticleCitingWorks(id)
      ]);
      return { items: cItems, total: cTotal };
    }, {
      freshTtlSeconds: 15 * 60,
      staleTtlSeconds: 24 * 60 * 60,
    });
    return reply.status(200).send({ success: true, code: "ARTICLE_CITING_WORKS_GET_SUCCESS", message: "Lấy danh sách b� i báo trích dẫn th� nh công!", data: { items, pagination: { total, page, limit, offset, total_pages: Math.ceil(total / limit) } } });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getArticleCitingWorksAnalytics = async (request, reply) => {
  try {
    const { id } = request.params;
    const cacheKey = buildCacheKey(`citing-analytics:${id}`, {}, "article");
    const analytics = await getOrSetCache(cacheKey, () => articleService.getArticleCitingWorksAnalytics(id), {
      freshTtlSeconds: 15 * 60,
      staleTtlSeconds: 24 * 60 * 60,
    });
    return reply.status(200).send({ success: true, code: "ARTICLE_CITING_WORKS_ANALYTICS_GET_SUCCESS", message: "Lấy thống kê b� i báo trích dẫn th� nh công!", data: analytics });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getArticleReferences = async (request, reply) => {
  try {
    const { id } = request.params;
    const { limit, page, offset } = getPaginationParams(request, 50);
    const [items, total] = await Promise.all([articleService.getArticleReferences(id, { limit, offset }), articleService.countArticleReferences(id)]);
    return reply.status(200).send({ success: true, code: "ARTICLE_REFERENCES_GET_SUCCESS", message: "Lấy danh sách t� i liệu tham khảo th� nh công!", data: { items, pagination: { total, page, limit, offset, total_pages: Math.ceil(total / limit) } } });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const hydrateArticleReferences = async (request, reply) => {
  try {
    const result = await hydrateReferencesService(request.params.id);
    const code = result.noReferences ? "ARTICLE_REFERENCES_NO_SOURCE" : result.partial ? "ARTICLE_REFERENCES_HYDRATED_PARTIAL" : "ARTICLE_REFERENCES_HYDRATED";
    return reply.status(200).send({
      success: true, code,
      message: result.noReferences ? "B� i báo không có OpenAlex reference ID để hydrate" : result.partial ? "Hydrate references ho� n tất một phần" : "Hydrate references th� nh công",
      data: { summary: result.summary },
    });
  } catch (error) {
    logger.error("Lỗi hydrate references của b� i báo:", error);
    const status = error.statusCode || 500;
    return reply.status(status).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: status === 500 ? "Có lỗi xảy ra ở Server!" : error.message });
  }
};

export const createArticle = async (request, reply) => {
  const { title, publication_year, version, issue_id, abstract, doi, primary_topic, sub_topic, authors, keywords } = request.body;
  try {
    const newArticle = await articleService.createArticle({ version, issue_id, title, abstract, publication_year, doi, primary_topic: primary_topic == 0 ? null : primary_topic });
    await createAuthorArticleRelationships(newArticle.article_id, authors || []);
    await createSubTopicArticleRelationships(newArticle.article_id, sub_topic || [], primary_topic == 0 ? null : primary_topic);

    const hasKeywords = keywords && (Array.isArray(keywords) ? keywords.length > 0 : Object.keys(keywords).length > 0);
    if (hasKeywords) await addKeywordsToArticle(newArticle.article_id, keywords);

    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'CREATE', entityTable: 'Article', entityId: newArticle.article_id, message: `Tạo mới b� i báo: ${newArticle.title}`, metadata: { ip: request.ip } });

    return reply.status(201).send({ success: true, code: "ARTICLE_CREATE_SUCCESS", message: "B� i báo đã được tạo th� nh công!", data: newArticle });
  } catch (error) {
    if (error.statusCode === 400) return reply.status(400).send({ success: false, code: "VALIDATION_ERROR", message: error.message });
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const updateArticle = async (request, reply) => {
  const { id } = request.params;
  const dataBody = request.body;
  try {
    const article = await articleService.getArticleById(id);
    if (!article) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "Article không tìm thấy" });

    const updatedArticle = await articleService.updateArticle({ article_id: article.article_id, ...dataBody });
    if (dataBody.authors !== undefined) await updateAuthorArticleRelationships(id, dataBody.authors);
    if (dataBody.keywords !== undefined) await updateKeywordsToArticle(id, dataBody.keywords);

    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'UPDATE', entityTable: 'Article', entityId: updatedArticle.article_id, message: `Cập nhật b� i báo: ${updatedArticle.title}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: "ARTICLE_UPDATE_SUCCESS", message: "Article updated successfully", data: updatedArticle });
  } catch (error) {
    if (error.message && error.message.startsWith("VALIDATION_ERROR:")) return reply.status(400).send({ success: false, code: "VALIDATION_ERROR", message: error.message.replace("VALIDATION_ERROR: ", "") });
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  }
};

export const deleteArticle = async (request, reply) => {
  const { id } = request.params;
  try {
    const article = await articleService.getArticleById(id);
    if (!article) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "Article không tìm thấy" });

    await articleService.deleteArticle(id);
    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'DELETE', entityTable: 'Article', entityId: id, message: `Xóa mềm b� i báo có ID: ${id}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: "ARTICLE_DELETE_SUCCESS", message: "Article đã xóa th� nh công" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  }
};

export const restoreArticle = async (request, reply) => {
  const { id } = request.params;
  try {
    const restored = await articleService.restoreArticle(id);
    if (!restored) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "Article không tìm thấy hoặc đã được khôi phục" });
    return reply.status(200).send({ success: true, code: "ARTICLE_RESTORE_SUCCESS", message: "Article đã khôi phục th� nh công", data: restored });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  }
};

// --- COMMENTS ACTIONS ---

const formatComment = (row) => ({
  id: row.comment_id, article_id: row.article_id, user_id: row.user_id,
  user: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null,
  avatar: row.url_image || null, content: row.content, created_at: row.created_at,
});

export const getArticleComments = async (request, reply) => {
  try {
    const articleId = Number(request.params.id);
    const comments = await commentService.getArticleComments(articleId);
    return reply.status(200).send({ success: true, code: 'SUCCESS_GET_COMMENTS', message: 'Lấy danh sách comment th� nh công', data: comments.map(formatComment) });
  } catch (error) {
    logger.error('[Comment Controller] Lỗi khi lấy danh sách comment:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Có lỗi xảy ra khi lấy danh sách comment' });
  }
};

export const createComment = async (request, reply) => {
  try {
    const articleId = Number(request.params.id);
    const userId = request.user.user_id;
    const { content } = request.body;

    const newComment = await commentService.createComment(articleId, userId, content.trim());
    createLog({ userId, userRole: request.user.role, action: 'CREATE', entityTable: 'Comment', entityId: newComment.comment_id, message: `Thêm comment cho b� i báo ID: ${articleId}`, metadata: { ip: request.ip } });

    return reply.status(201).send({ success: true, code: 'SUCCESS_CREATE_COMMENT', message: 'Thêm comment th� nh công', data: formatComment(newComment) });
  } catch (error) {
    if (error.code === '23503') return reply.status(404).send({ success: false, code: 'ARTICLE_NOT_FOUND', message: 'Không tìm thấy b� i báo với ID đã cho' });
    logger.error('[Comment Controller] Lỗi khi tạo comment:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Có lỗi xảy ra khi tạo comment' });
  }
};

export const updateComment = async (request, reply) => {
  try {
    const commentId = Number(request.params.commentId);
    const userId = request.user.user_id;
    const { content } = request.body;

    const updated = await commentService.updateComment(commentId, userId, content.trim());
    if (!updated) return reply.status(404).send({ success: false, code: 'COMMENT_NOT_FOUND_OR_ACCESS_DENIED', message: 'Không tìm thấy comment hoặc bạn không có quyền chỉnh sửa' });

    createLog({ userId, userRole: request.user.role, action: 'UPDATE', entityTable: 'Comment', entityId: commentId, message: `Cập nhật comment ID: ${commentId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: 'SUCCESS_UPDATE_COMMENT', message: 'Cập nhật comment th� nh công', data: { id: updated.comment_id, article_id: updated.article_id, user_id: updated.user_id, content: updated.content, created_at: updated.created_at, updated_at: updated.updated_at } });
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Có lỗi xảy ra khi cập nhật comment' });
  }
};

export const deleteComment = async (request, reply) => {
  try {
    const commentId = Number(request.params.commentId);
    const userId = request.user.user_id;

    const deleted = await commentService.deleteComment(commentId, userId);
    if (!deleted) return reply.status(404).send({ success: false, code: 'COMMENT_NOT_FOUND_OR_ACCESS_DENIED', message: 'Không tìm thấy comment hoặc bạn không có quyền xóa' });

    createLog({ userId, userRole: request.user.role, action: 'DELETE', entityTable: 'Comment', entityId: commentId, message: `Xóa comment ID: ${commentId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: 'SUCCESS_DELETE_COMMENT', message: 'Xóa comment th� nh công' });
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Có lỗi xảy ra khi xóa comment' });
  }
};



