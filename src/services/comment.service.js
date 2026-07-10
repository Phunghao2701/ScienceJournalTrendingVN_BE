import pool from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Lấy danh sách comment của một bài báo, kèm thông tin người bình luận
 * @param {number} articleId
 * @returns {Promise<Array>}
 */
export const getArticleComments = async (articleId) => {
  try {
    const result = await pool.query(
      `SELECT c.comment_id, c.article_id, c.user_id, c.content, c.created_at,
              u.first_name, u.last_name, u.url_image
       FROM "Comment" c
       JOIN "user" u ON c.user_id = u.user_id
       WHERE c.article_id = $1
       ORDER BY c.created_at ASC`,
      [articleId]
    );
    return result.rows;
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách comment của bài báo ${articleId}:`, error);
    throw error;
  }
};

/**
 * Tạo comment mới cho một bài báo
 * @param {number} articleId
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<Object>}
 */
export const createComment = async (articleId, userId, content) => {
  try {
    const result = await pool.query(
      `INSERT INTO "Comment" (article_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING comment_id, article_id, user_id, content, created_at`,
      [articleId, userId, content]
    );
    const comment = result.rows[0];

    const userResult = await pool.query(
      `SELECT first_name, last_name, url_image FROM "user" WHERE user_id = $1`,
      [userId]
    );
    const user = userResult.rows[0] || {};

    return {
      ...comment,
      first_name: user.first_name,
      last_name: user.last_name,
      url_image: user.url_image,
    };
  } catch (error) {
    logger.error(`Lỗi khi tạo comment cho bài báo ${articleId}:`, error);
    throw error;
  }
};

/**
 * Cập nhật nội dung comment, chỉ cho phép chủ sở hữu comment
 * @param {number} commentId
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<Object|null>} null nếu comment không tồn tại hoặc không thuộc quyền sở hữu
 */
export const updateComment = async (commentId, userId, content) => {
  try {
    const result = await pool.query(
      `UPDATE "Comment"
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE comment_id = $2 AND user_id = $3
       RETURNING comment_id, article_id, user_id, content, created_at, updated_at`,
      [content, commentId, userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error(`Lỗi khi cập nhật comment ${commentId}:`, error);
    throw error;
  }
};

/**
 * Xóa comment, chỉ cho phép chủ sở hữu comment
 * @param {number} commentId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export const deleteComment = async (commentId, userId) => {
  try {
    const result = await pool.query(
      `DELETE FROM "Comment" WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
      [commentId, userId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Lỗi khi xóa comment ${commentId}:`, error);
    throw error;
  }
};
