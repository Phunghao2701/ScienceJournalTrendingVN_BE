import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';
import { articleExists } from '../../article/services/article.service.js';

/**
 * Láº¥y danh sÃ¡ch bÃ i bÃ¡o Ä‘Ã£ bookmark cá»§a má»™t user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getUserBookmarks = async (userId) => {
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT b.bookmark_id, b.article_id, b.created_at AS bookmarked_at,
              a.title, a.abstract, a.publication_year, a.doi
       FROM "Bookmark" b
       JOIN "Article" a ON b.article_id = a.article_id
       WHERE b.user_id = $1::uuid
       ORDER BY b.created_at DESC`,
      userId
    );
    return result;
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y danh sÃ¡ch bookmark cá»§a user ${userId}:`, error);
    throw error;
  }
};

/**
 * ThÃªm bookmark cho má»™t bÃ i bÃ¡o. Náº¿u Ä‘Ã£ bookmark tá»« trÆ°á»›c, tráº£ vá» báº£n ghi hiá»‡n cÃ³ (idempotent).
 * @param {string} userId
 * @param {number} articleId
 * @returns {Promise<Object>}
 * @throws {Error} error.statusCode = 404 náº¿u bÃ i bÃ¡o khÃ´ng tá»“n táº¡i
 */
export const addBookmark = async (userId, articleId) => {
  const exists = await articleExists(articleId);
  if (!exists) {
    const error = new Error('KhÃ´ng tÃ¬m tháº¥y bÃ i bÃ¡o vá»›i ID Ä‘Ã£ cho');
    error.statusCode = 404;
    throw error;
  }

  try {
    const insertResult = await prisma.$queryRawUnsafe(
      `INSERT INTO "Bookmark" (user_id, article_id)
       VALUES ($1::uuid, $2)
       ON CONFLICT (user_id, article_id) DO NOTHING
       RETURNING bookmark_id, user_id, article_id, created_at AS bookmarked_at`,
      userId, articleId
    );

    if (insertResult.length > 0) {
      return insertResult[0];
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT bookmark_id, user_id, article_id, created_at AS bookmarked_at
       FROM "Bookmark" WHERE user_id = $1::uuid AND article_id = $2`,
      userId, articleId
    );
    return existing[0];
  } catch (error) {
    logger.error(`Lá»—i khi thÃªm bookmark cho user ${userId}, bÃ i bÃ¡o ${articleId}:`, error);
    throw error;
  }
};

/**
 * Bá» bookmark má»™t bÃ i bÃ¡o
 * @param {string} userId
 * @param {number} articleId
 * @returns {Promise<boolean>}
 */
export const removeBookmark = async (userId, articleId) => {
  try {
    const result = await prisma.$queryRawUnsafe(
      `DELETE FROM "Bookmark" WHERE user_id = $1::uuid AND article_id = $2 RETURNING bookmark_id`,
      userId, articleId
    );
    return result.length > 0;
  } catch (error) {
    logger.error(`Lá»—i khi bá» bookmark cho user ${userId}, bÃ i bÃ¡o ${articleId}:`, error);
    throw error;
  }
};




