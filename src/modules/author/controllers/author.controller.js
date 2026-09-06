import * as authorService from '../services/author.service.js';
import logger from '../../../utils/logger.js';
import { AUTHOR_CODES } from '../middlewares/authorValidation.middleware.js';
import { buildCacheKey, getOrSetCache } from '../../../utils/cache.js';

export const authorServiceRef = { ...authorService };

const AUTHOR_CACHE_OPTIONS = Object.freeze({
  freshTtlSeconds: 15 * 60,
  staleTtlSeconds: 2 * 60 * 60,
});

export const getAuthorAreasBreakdown = async (request, reply) => {
  try {
    const authorId = Number(request.params.id);
    if (!Number.isInteger(authorId) || authorId <= 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.INVALID_AUTHOR_ID, message: "ID tác giả không hợp lệ" });

    const cacheKey = buildCacheKey('breakdown', { authorId }, 'author');
    const data = await getOrSetCache(cacheKey, async () => {
      const [authorInfo, areasBreakdown] = await Promise.all([
        authorServiceRef.getAuthorById(authorId),
        authorServiceRef.getAuthorAreasBreakdownService(authorId),
      ]);
      return { ...authorInfo, breakdown: areasBreakdown };
    }, AUTHOR_CACHE_OPTIONS);

    return reply.status(200).send({ success: true, message: "Phân tích lĩnh vực nghiên cứu của tác giả thành công", code: AUTHOR_CODES.AREA_BREAKDOWN_FETCHED, data });
  } catch (error) {
    logger.error("Lỗi phân tích lĩnh vực nghiên cứu của tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getAuthorArticles = async (request, reply) => {
  try {
    const authorId = Number(request.params.id);
    const limit = request.query.limit !== undefined ? Number(request.query.limit) : 10;
    const page = request.query.page !== undefined ? Number(request.query.page) : 1;
    const safeLimit = limit === 0 ? 10 : limit;

    if (!Number.isInteger(authorId) || authorId <= 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_ID, message: "ID tác giả không hợp lệ" });
    if (!Number.isInteger(safeLimit) || safeLimit < 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_LIMIT, message: "Giá trị limit không hợp lệ" });
    if (!Number.isInteger(page) || page < 1) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION, message: "Giá trị page không hợp lệ" });

    const cacheKey = buildCacheKey('articles', { authorId, limit: safeLimit, page }, 'author');
    const result = await getOrSetCache(cacheKey, () => authorServiceRef.getAuthorArticlesService(authorId, safeLimit, page), AUTHOR_CACHE_OPTIONS);
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_ARTICLES_FETCHED, message: "Lấy bài viết của tác giả thành công", pagination: result.pagination, data: result.items });
  } catch (error) {
    logger.error("Lỗi lấy bài viết của tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getAuthorLeaderboard = async (request, reply) => {
  try {
    const limit = Number(request.query.limit) || 10;
    const page = Number(request.query.page) || 1;

    if (!Number.isInteger(limit) || limit < 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_LIMIT, message: "Giá trị limit không hợp lệ" });
    if (!Number.isInteger(page) || page < 1) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION, message: "Giá trị page không hợp lệ" });

    const cacheKey = buildCacheKey('leaderboard', { limit, page }, 'author');
    const result = await getOrSetCache(cacheKey, () => authorServiceRef.getAuthorLeaderboardService(limit, page), AUTHOR_CACHE_OPTIONS);
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_LEADERBOARD_FETCHED, message: "Lấy bảng xếp hạng tác giả thành công", pagination: result.pagination, data: result.items });
  } catch (error) {
    logger.error("Lỗi lấy bảng xếp hạng tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getAllAuthorsController = async (request, reply) => {
  try {
    const { page, limit } = request.pagination;
    const search = request.query.search || "";
    const sort = request.query.sort || "impact";

    const cacheKey = buildCacheKey('list', { page, limit, search, sort }, 'author');
    const result = await getOrSetCache(cacheKey, () => authorServiceRef.getAllAuthors({ page, limit, search, sort }), AUTHOR_CACHE_OPTIONS);

    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_LIST_FETCHED, message: "Lấy danh sách tác giả thành công", data: result.data, pagination: result.pagination });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi lấy danh sách tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getAuthorByIdController = async (request, reply) => {
  try {
    const authorId = request.authorId;
    const cacheKey = buildCacheKey('detail', { authorId }, 'author');
    const author = await getOrSetCache(cacheKey, () => authorServiceRef.getAuthorById(authorId), AUTHOR_CACHE_OPTIONS);
    if (!author) return reply.status(404).send({ success: false, code: AUTHOR_CODES.AUTHOR_NOT_FOUND, message: "Tác giả không tồn tại" });
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_FETCHED, message: "Lấy thông tin tác giả thành công", data: author });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi lấy tác giả theo ID:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const createAuthorController = async (request, reply) => {
  try {
    const author = await authorServiceRef.createAuthor(request.body);
    return reply.status(201).send({ success: true, code: AUTHOR_CODES.AUTHOR_CREATED, message: "Tạo tác giả thành công", data: author });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi tạo tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const updateAuthorController = async (request, reply) => {
  try {
    const author = await authorServiceRef.updateAuthor(request.authorId, request.body);
    if (!author) return reply.status(404).send({ success: false, code: AUTHOR_CODES.AUTHOR_NOT_FOUND, message: "Tác giả không tồn tại" });
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_UPDATED, message: "Cập nhật tác giả thành công", data: author });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi cập nhật tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const deleteAuthorController = async (request, reply) => {
  try {
    const author = await authorServiceRef.deleteAuthor(request.authorId);
    if (!author) return reply.status(404).send({ success: false, code: AUTHOR_CODES.AUTHOR_NOT_FOUND, message: "Tác giả không tồn tại" });
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_DELETED, message: "Xóa tác giả thành công", data: author });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi xóa tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};

export const restoreAuthorController = async (request, reply) => {
  try {
    const author = await authorServiceRef.restoreAuthor(request.authorId);
    if (!author) return reply.status(404).send({ success: false, code: AUTHOR_CODES.AUTHOR_NOT_FOUND, message: "Tác giả không tồn tại hoặc chưa bị xóa" });
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_RESTORED, message: "Khôi phục tác giả thành công", data: author });
  } catch (error) {
    logger.error("[Author Controller] Lỗi khi khôi phục tác giả:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "Có lỗi xảy ra ở Server!" });
  }
};
