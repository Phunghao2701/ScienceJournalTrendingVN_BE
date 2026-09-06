import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Lấy danh sách comment của một b� i báo, kèm thông tin người bình luận
 * @param {number} articleId
 * @returns {Promise<Array>}
 */
export const getArticleComments = async (articleId) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { article_id: parseInt(articleId, 10) },
      orderBy: { created_at: 'asc' },
      include: {
        user: {
          select: { first_name: true, last_name: true, url_image: true }
        }
      }
    });

    return comments.map(c => {
      const { user, ...rest } = c;
      return {
        ...rest,
        first_name: user?.first_name || null,
        last_name: user?.last_name || null,
        url_image: user?.url_image || null,
      };
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy danh sách comment của b� i báo ${articleId}:`, error);
    throw error;
  }
};

/**
 * Tạo comment mới cho một b� i báo
 * @param {number} articleId
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<Object>}
 */
export const createComment = async (articleId, userId, content) => {
  try {
    const comment = await prisma.comment.create({
      data: {
        article_id: parseInt(articleId, 10),
        user_id: userId,
        content: content
      },
      include: {
        user: {
          select: { first_name: true, last_name: true, url_image: true }
        }
      }
    });

    const { user, ...rest } = comment;
    return {
      ...rest,
      first_name: user?.first_name || null,
      last_name: user?.last_name || null,
      url_image: user?.url_image || null,
    };
  } catch (error) {
    logger.error(`Lỗi khi tạo comment cho b� i báo ${articleId}:`, error);
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
    const parsedCommentId = parseInt(commentId, 10);
    const existing = await prisma.comment.findFirst({
      where: { comment_id: parsedCommentId, user_id: userId }
    });

    if (!existing) return null;

    const updated = await prisma.comment.update({
      where: { comment_id: parsedCommentId },
      data: { content: content, updated_at: new Date() }
    });

    return updated;
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
    const parsedCommentId = parseInt(commentId, 10);
    const existing = await prisma.comment.findFirst({
      where: { comment_id: parsedCommentId, user_id: userId }
    });

    if (!existing) return false;

    await prisma.comment.delete({
      where: { comment_id: parsedCommentId }
    });

    return true;
  } catch (error) {
    logger.error(`Lỗi khi xóa comment ${commentId}:`, error);
    throw error;
  }
};



