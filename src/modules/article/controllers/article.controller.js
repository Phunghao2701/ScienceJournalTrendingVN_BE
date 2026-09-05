import * as articleService from '../services/article.service.js';
import { hydrateArticleReferences as hydrateReferencesService } from '../services/articleReferenceHydration.service.js';
import { getArticleAnalysis as getArticleAnalysisService } from '../services/articleAnalysis.service.js';
import * as commentService from '../services/comment.service.js';
import { createAuthorArticleRelationships, updateAuthorArticleRelationships } from '../../author/services/author.service.js';
import { addKeywordsToArticle, updateKeywordsToArticle } from '../../topic/services/keyword.service.js';
import { createSubTopicArticleRelationships } from '../../topic/services/topic.service.js';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';

// --- ARTICLE ACTIONS ---

export const getArticlesByKeywords = async (request, reply) => {
  try {
    const rawKeywords = request.query.keywords;
    if (!rawKeywords || rawKeywords.trim() === "") {
      return reply.status(400).send({ success: false, code: "MISSING_KEYWORDS", message: "Vui lÃ²ng cung cáº¥p tham sá»‘ 'keywords' trong query string!" });
    }

    const keywords = rawKeywords.split(",").map((kw) => kw.trim().toLowerCase()).filter((kw) => kw.length > 0);
    if (keywords.length === 0) {
      return reply.status(400).send({ success: false, code: "INVALID_KEYWORDS", message: "Danh sÃ¡ch keyword khÃ´ng há»£p lá»‡!" });
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
      success: true, code: "ARTICLES_GET_BY_KEYWORDS_SUCCESS", message: "Láº¥y danh sÃ¡ch bÃ i bÃ¡o thÃ nh cÃ´ng!",
      data: { scope, articles, pagination: { total, page, limit, total_pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    logger.error("getArticlesByKeywords error:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: error.statusCode ? error.message : "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
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
      return reply.status(400).send({ success: false, code: "INVALID_SORT_ORDER", message: "Tham sá»‘ 'sortOrder' pháº£i lÃ  'asc' hoáº·c 'desc'!" });
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

    const [articles, total] = await Promise.all([
      articleService.getAllArticles(serviceParams),
      articleService.countAllArticles(serviceParams),
    ]);

    let stats = { totalArticles: 0, openAccessCount: 0, authorsCount: 0, topicsCount: 0 };
    try {
      stats = await articleService.getArticleListStats(serviceParams);
    } catch (statsError) {
      logger.error("Lá»—i riÃªng láº» khi láº¥y stats:", statsError);
    }

    return reply.status(200).send({
      success: true, code: "ARTICLES_GET_SUCCESS", message: "Láº¥y danh sÃ¡ch bÃ i bÃ¡o thÃ nh cÃ´ng!",
      data: { scope: serviceParams.scope, articles, items: articles, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }, stats },
    });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch bÃ i bÃ¡o:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: error.statusCode ? error.message : "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
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

    const analytics = await articleService.getArticleAnalytics(params);
    return reply.status(200).send({ success: true, code: "ARTICLE_ANALYTICS_SUCCESS", message: "Láº¥y analytics bÃ i bÃ¡o thÃ nh cÃ´ng!", data: analytics });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y analytics bÃ i bÃ¡o:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: error.statusCode ? error.message : "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
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

    const analysis = await getArticleAnalysisService(params);
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
    const article = await articleService.getArticleById(id);

    if (!article) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "BÃ i bÃ¡o khÃ´ng tá»“n táº¡i!" });
    if (article.is_deleted === true) return reply.status(410).send({ success: false, code: "ARTICLE_DELETED", message: "BÃ i bÃ¡o nÃ y Ä‘Ã£ bá»‹ xÃ³a khá»i há»‡ thá»‘ng!" });

    return reply.status(200).send({ success: true, code: "ARTICLE_GET_SUCCESS", message: "Láº¥y thÃ´ng tin bÃ i bÃ¡o thÃ nh cÃ´ng!", data: article });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y thÃ´ng tin bÃ i bÃ¡o theo ID:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
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
    const [items, total] = await Promise.all([articleService.getArticleCitingWorks(id, { limit, offset }), articleService.countArticleCitingWorks(id)]);
    return reply.status(200).send({ success: true, code: "ARTICLE_CITING_WORKS_GET_SUCCESS", message: "Láº¥y danh sÃ¡ch bÃ i bÃ¡o trÃ­ch dáº«n thÃ nh cÃ´ng!", data: { items, pagination: { total, page, limit, offset, total_pages: Math.ceil(total / limit) } } });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getArticleCitingWorksAnalytics = async (request, reply) => {
  try {
    const { id } = request.params;
    const analytics = await articleService.getArticleCitingWorksAnalytics(id);
    return reply.status(200).send({ success: true, code: "ARTICLE_CITING_WORKS_ANALYTICS_GET_SUCCESS", message: "Láº¥y thá»‘ng kÃª bÃ i bÃ¡o trÃ­ch dáº«n thÃ nh cÃ´ng!", data: analytics });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getArticleReferences = async (request, reply) => {
  try {
    const { id } = request.params;
    const { limit, page, offset } = getPaginationParams(request, 50);
    const [items, total] = await Promise.all([articleService.getArticleReferences(id, { limit, offset }), articleService.countArticleReferences(id)]);
    return reply.status(200).send({ success: true, code: "ARTICLE_REFERENCES_GET_SUCCESS", message: "Láº¥y danh sÃ¡ch tÃ i liá»‡u tham kháº£o thÃ nh cÃ´ng!", data: { items, pagination: { total, page, limit, offset, total_pages: Math.ceil(total / limit) } } });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const hydrateArticleReferences = async (request, reply) => {
  try {
    const result = await hydrateReferencesService(request.params.id);
    const code = result.noReferences ? "ARTICLE_REFERENCES_NO_SOURCE" : result.partial ? "ARTICLE_REFERENCES_HYDRATED_PARTIAL" : "ARTICLE_REFERENCES_HYDRATED";
    return reply.status(200).send({
      success: true, code,
      message: result.noReferences ? "BÃ i bÃ¡o khÃ´ng cÃ³ OpenAlex reference ID Ä‘á»ƒ hydrate" : result.partial ? "Hydrate references hoÃ n táº¥t má»™t pháº§n" : "Hydrate references thÃ nh cÃ´ng",
      data: { summary: result.summary },
    });
  } catch (error) {
    logger.error("Lá»—i hydrate references cá»§a bÃ i bÃ¡o:", error);
    const status = error.statusCode || 500;
    return reply.status(status).send({ success: false, code: error.code || "INTERNAL_SERVER_ERROR", message: status === 500 ? "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" : error.message });
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

    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'CREATE', entityTable: 'Article', entityId: newArticle.article_id, message: `Táº¡o má»›i bÃ i bÃ¡o: ${newArticle.title}`, metadata: { ip: request.ip } });

    return reply.status(201).send({ success: true, code: "ARTICLE_CREATE_SUCCESS", message: "BÃ i bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c táº¡o thÃ nh cÃ´ng!", data: newArticle });
  } catch (error) {
    if (error.statusCode === 400) return reply.status(400).send({ success: false, code: "VALIDATION_ERROR", message: error.message });
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const updateArticle = async (request, reply) => {
  const { id } = request.params;
  const dataBody = request.body;
  try {
    const article = await articleService.getArticleById(id);
    if (!article) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "Article khÃ´ng tÃ¬m tháº¥y" });

    const updatedArticle = await articleService.updateArticle({ article_id: article.article_id, ...dataBody });
    if (dataBody.authors !== undefined) await updateAuthorArticleRelationships(id, dataBody.authors);
    if (dataBody.keywords !== undefined) await updateKeywordsToArticle(id, dataBody.keywords);

    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'UPDATE', entityTable: 'Article', entityId: updatedArticle.article_id, message: `Cáº­p nháº­t bÃ i bÃ¡o: ${updatedArticle.title}`, metadata: { ip: request.ip } });

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
    if (!article) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "Article khÃ´ng tÃ¬m tháº¥y" });

    await articleService.deleteArticle(id);
    createLog({ userId: request.user?.user_id, userRole: request.user?.role, action: 'DELETE', entityTable: 'Article', entityId: id, message: `XÃ³a má»m bÃ i bÃ¡o cÃ³ ID: ${id}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: "ARTICLE_DELETE_SUCCESS", message: "Article Ä‘Ã£ xÃ³a thÃ nh cÃ´ng" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  }
};

export const restoreArticle = async (request, reply) => {
  const { id } = request.params;
  try {
    const restored = await articleService.restoreArticle(id);
    if (!restored) return reply.status(404).send({ success: false, code: "ARTICLE_NOT_FOUND", message: "Article khÃ´ng tÃ¬m tháº¥y hoáº·c Ä‘Ã£ Ä‘Æ°á»£c khÃ´i phá»¥c" });
    return reply.status(200).send({ success: true, code: "ARTICLE_RESTORE_SUCCESS", message: "Article Ä‘Ã£ khÃ´i phá»¥c thÃ nh cÃ´ng", data: restored });
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
    return reply.status(200).send({ success: true, code: 'SUCCESS_GET_COMMENTS', message: 'Láº¥y danh sÃ¡ch comment thÃ nh cÃ´ng', data: comments.map(formatComment) });
  } catch (error) {
    logger.error('[Comment Controller] Lá»—i khi láº¥y danh sÃ¡ch comment:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'CÃ³ lá»—i xáº£y ra khi láº¥y danh sÃ¡ch comment' });
  }
};

export const createComment = async (request, reply) => {
  try {
    const articleId = Number(request.params.id);
    const userId = request.user.user_id;
    const { content } = request.body;

    const newComment = await commentService.createComment(articleId, userId, content.trim());
    createLog({ userId, userRole: request.user.role, action: 'CREATE', entityTable: 'Comment', entityId: newComment.comment_id, message: `ThÃªm comment cho bÃ i bÃ¡o ID: ${articleId}`, metadata: { ip: request.ip } });

    return reply.status(201).send({ success: true, code: 'SUCCESS_CREATE_COMMENT', message: 'ThÃªm comment thÃ nh cÃ´ng', data: formatComment(newComment) });
  } catch (error) {
    if (error.code === '23503') return reply.status(404).send({ success: false, code: 'ARTICLE_NOT_FOUND', message: 'KhÃ´ng tÃ¬m tháº¥y bÃ i bÃ¡o vá»›i ID Ä‘Ã£ cho' });
    logger.error('[Comment Controller] Lá»—i khi táº¡o comment:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'CÃ³ lá»—i xáº£y ra khi táº¡o comment' });
  }
};

export const updateComment = async (request, reply) => {
  try {
    const commentId = Number(request.params.commentId);
    const userId = request.user.user_id;
    const { content } = request.body;

    const updated = await commentService.updateComment(commentId, userId, content.trim());
    if (!updated) return reply.status(404).send({ success: false, code: 'COMMENT_NOT_FOUND_OR_ACCESS_DENIED', message: 'KhÃ´ng tÃ¬m tháº¥y comment hoáº·c báº¡n khÃ´ng cÃ³ quyá»n chá»‰nh sá»­a' });

    createLog({ userId, userRole: request.user.role, action: 'UPDATE', entityTable: 'Comment', entityId: commentId, message: `Cáº­p nháº­t comment ID: ${commentId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: 'SUCCESS_UPDATE_COMMENT', message: 'Cáº­p nháº­t comment thÃ nh cÃ´ng', data: { id: updated.comment_id, article_id: updated.article_id, user_id: updated.user_id, content: updated.content, created_at: updated.created_at, updated_at: updated.updated_at } });
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'CÃ³ lá»—i xáº£y ra khi cáº­p nháº­t comment' });
  }
};

export const deleteComment = async (request, reply) => {
  try {
    const commentId = Number(request.params.commentId);
    const userId = request.user.user_id;

    const deleted = await commentService.deleteComment(commentId, userId);
    if (!deleted) return reply.status(404).send({ success: false, code: 'COMMENT_NOT_FOUND_OR_ACCESS_DENIED', message: 'KhÃ´ng tÃ¬m tháº¥y comment hoáº·c báº¡n khÃ´ng cÃ³ quyá»n xÃ³a' });

    createLog({ userId, userRole: request.user.role, action: 'DELETE', entityTable: 'Comment', entityId: commentId, message: `XÃ³a comment ID: ${commentId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: 'SUCCESS_DELETE_COMMENT', message: 'XÃ³a comment thÃ nh cÃ´ng' });
  } catch (error) {
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'CÃ³ lá»—i xáº£y ra khi xÃ³a comment' });
  }
};



