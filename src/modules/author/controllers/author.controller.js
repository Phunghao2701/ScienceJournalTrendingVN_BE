import * as authorService from '../services/author.service.js';
import logger from '../../../utils/logger.js';
import { AUTHOR_CODES } from '../middlewares/authorValidation.middleware.js';

export const authorServiceRef = { ...authorService };

export const getAuthorAreasBreakdown = async (request, reply) => {
  try {
    const authorId = Number(request.params.id);
    if (!Number.isInteger(authorId) || authorId <= 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.INVALID_AUTHOR_ID, message: "ID tÃ¡c giáº£ khÃ´ng há»£p lá»‡" });

    const authorInfo = await authorServiceRef.getAuthorById(authorId);
    const areasBreakdown = await authorServiceRef.getAuthorAreasBreakdownService(authorId);

    return reply.status(200).send({ success: true, message: "PhÃ¢n tÃ­ch lÄ©nh vá»±c nghiÃªn cá»©u cá»§a tÃ¡c giáº£ thÃ nh cÃ´ng", code: AUTHOR_CODES.AREA_BREAKDOWN_FETCHED, data: { ...authorInfo, breakdown: areasBreakdown } });
  } catch (error) {
    logger.error("Lá»—i phÃ¢n tÃ­ch lÄ©nh vá»±c nghiÃªn cá»©u cá»§a tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getAuthorArticles = async (request, reply) => {
  try {
    const authorId = Number(request.params.id);
    const limit = request.query.limit !== undefined ? Number(request.query.limit) : 10;
    const page = request.query.page !== undefined ? Number(request.query.page) : 1;
    const safeLimit = limit === 0 ? 10 : limit;

    if (!Number.isInteger(authorId) || authorId <= 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_ID, message: "ID tÃ¡c giáº£ khÃ´ng há»£p lá»‡" });
    if (!Number.isInteger(safeLimit) || safeLimit < 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_LIMIT, message: "GiÃ¡ trá»‹ limit khÃ´ng há»£p lá»‡" });
    if (!Number.isInteger(page) || page < 1) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION, message: "GiÃ¡ trá»‹ page khÃ´ng há»£p lá»‡" });

    const result = await authorServiceRef.getAuthorArticlesService(authorId, safeLimit, page);
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_ARTICLES_FETCHED, message: "Láº¥y bÃ i viáº¿t cá»§a tÃ¡c giáº£ thÃ nh cÃ´ng", pagination: result.pagination, data: result.items });
  } catch (error) {
    logger.error("Lá»—i láº¥y bÃ i viáº¿t cá»§a tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getAuthorLeaderboard = async (request, reply) => {
  try {
    const limit = Number(request.query.limit) || 10;
    const page = Number(request.query.page) || 1;

    if (!Number.isInteger(limit) || limit < 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_LIMIT, message: "GiÃ¡ trá»‹ limit khÃ´ng há»£p lá»‡" });
    if (!Number.isInteger(page) || page < 1) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION, message: "GiÃ¡ trá»‹ page khÃ´ng há»£p lá»‡" });

    const result = await authorServiceRef.getAuthorLeaderboardService(limit, page);
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_LEADERBOARD_FETCHED, message: "Láº¥y báº£ng xáº¿p háº¡ng tÃ¡c giáº£ thÃ nh cÃ´ng", pagination: result.pagination, data: result.items });
  } catch (error) {
    logger.error("Lá»—i láº¥y báº£ng xáº¿p háº¡ng tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getAllAuthorsController = async (request, reply) => {
  try {
    const { page, limit } = request.pagination;
    const search = request.query.search || "";
    const sort = request.query.sort || "impact";
    const result = await authorServiceRef.getAllAuthors({ page, limit, search, sort });

    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_LIST_FETCHED, message: "Láº¥y danh sÃ¡ch tÃ¡c giáº£ thÃ nh cÃ´ng", data: result.data, pagination: result.pagination });
  } catch (error) {
    logger.error("[Author Controller] Lá»—i khi láº¥y danh sÃ¡ch tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getAuthorByIdController = async (request, reply) => {
  try {
    const author = await authorServiceRef.getAuthorById(request.authorId);
    if (!author) return reply.status(404).send({ success: false, code: AUTHOR_CODES.AUTHOR_NOT_FOUND, message: "TÃ¡c giáº£ khÃ´ng tá»“n táº¡i" });
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_FETCHED, message: "Láº¥y thÃ´ng tin tÃ¡c giáº£ thÃ nh cÃ´ng", data: author });
  } catch (error) {
    logger.error("[Author Controller] Lá»—i khi láº¥y tÃ¡c giáº£ theo ID:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const createAuthorController = async (request, reply) => {
  try {
    const author = await authorServiceRef.createAuthor(request.body);
    return reply.status(201).send({ success: true, code: AUTHOR_CODES.AUTHOR_CREATED, message: "Táº¡o tÃ¡c giáº£ thÃ nh cÃ´ng", data: author });
  } catch (error) {
    logger.error("[Author Controller] Lá»—i khi táº¡o tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const updateAuthorController = async (request, reply) => {
  try {
    const author = await authorServiceRef.updateAuthor(request.authorId, request.body);
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_UPDATED, message: "Cáº­p nháº­t tÃ¡c giáº£ thÃ nh cÃ´ng", data: author });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Author Controller] Lá»—i khi cáº­p nháº­t tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const deleteAuthorController = async (request, reply) => {
  try {
    await authorServiceRef.deleteAuthor(request.authorId);
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_DELETED, message: "XÃ³a tÃ¡c giáº£ thÃ nh cÃ´ng" });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Author Controller] Lá»—i khi xÃ³a tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const restoreAuthorController = async (request, reply) => {
  try {
    const author = await authorServiceRef.restoreAuthor(request.authorId);
    return reply.status(200).send({ success: true, code: AUTHOR_CODES.AUTHOR_RESTORED, message: "KhÃ´i phá»¥c tÃ¡c giáº£ thÃ nh cÃ´ng", data: author });
  } catch (error) {
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message });
    logger.error("[Author Controller] Lá»—i khi restore tÃ¡c giáº£:", error);
    return reply.status(500).send({ success: false, code: AUTHOR_CODES.AUTHOR_SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};



