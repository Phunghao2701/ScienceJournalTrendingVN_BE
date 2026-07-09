import pool from '../config/database.js';
import logger from '../utils/logger.js';
import { articleExists } from './article.service.js';

/**
 * Lấy danh sách bài báo đã bookmark của một user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getUserBookmarks = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT b.bookmark_id, b.article_id, b.created_at AS bookmarked_at,
              a.title, a.abstract, a.publication_year, a.doi
       FROM "Bookmark" b
       JOIN "Article" a ON b.article_id = a.article_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách bookmark của user ${userId}:`, error);
    throw error;
  }
};

/**
 * Thêm bookmark cho một bài báo. Nếu đã bookmark từ trước, trả về bản ghi hiện có (idempotent).
 * @param {string} userId
 * @param {number} articleId
 * @returns {Promise<Object>}
 * @throws {Error} error.statusCode = 404 nếu bài báo không tồn tại
 */
export const addBookmark = async (userId, articleId) => {
  const exists = await articleExists(articleId);
  if (!exists) {
    const error = new Error('Không tìm thấy bài báo với ID đã cho');
    error.statusCode = 404;
    throw error;
  }

  try {
    const insertResult = await pool.query(
      `INSERT INTO "Bookmark" (user_id, article_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, article_id) DO NOTHING
       RETURNING bookmark_id, user_id, article_id, created_at AS bookmarked_at`,
      [userId, articleId]
    );

    if (insertResult.rows.length > 0) {
      return insertResult.rows[0];
    }

    const existing = await pool.query(
      `SELECT bookmark_id, user_id, article_id, created_at AS bookmarked_at
       FROM "Bookmark" WHERE user_id = $1 AND article_id = $2`,
      [userId, articleId]
    );
    return existing.rows[0];
  } catch (error) {
    logger.error(`Lỗi khi thêm bookmark cho user ${userId}, bài báo ${articleId}:`, error);
    throw error;
  }
};

/**
 * Bỏ bookmark một bài báo
 * @param {string} userId
 * @param {number} articleId
 * @returns {Promise<boolean>}
 */
export const removeBookmark = async (userId, articleId) => {
  try {
    const result = await pool.query(
      `DELETE FROM "Bookmark" WHERE user_id = $1 AND article_id = $2 RETURNING bookmark_id`,
      [userId, articleId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Lỗi khi bỏ bookmark cho user ${userId}, bài báo ${articleId}:`, error);
    throw error;
  }
};
