import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/**
 * Láº¥y danh sÃ¡ch comment cá»§a má»™t bÃ i bÃ¡o, kÃ¨m thÃ´ng tin ngÆ°á»i bÃ¬nh luáº­n
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
    logger.error(`Lá»—i khi láº¥y danh sÃ¡ch comment cá»§a bÃ i bÃ¡o ${articleId}:`, error);
    throw error;
  }
};

/**
 * Táº¡o comment má»›i cho má»™t bÃ i bÃ¡o
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
    logger.error(`Lá»—i khi táº¡o comment cho bÃ i bÃ¡o ${articleId}:`, error);
    throw error;
  }
};

/**
 * Cáº­p nháº­t ná»™i dung comment, chá»‰ cho phÃ©p chá»§ sá»Ÿ há»¯u comment
 * @param {number} commentId
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<Object|null>} null náº¿u comment khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng thuá»™c quyá»n sá»Ÿ há»¯u
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
    logger.error(`Lá»—i khi cáº­p nháº­t comment ${commentId}:`, error);
    throw error;
  }
};

/**
 * XÃ³a comment, chá»‰ cho phÃ©p chá»§ sá»Ÿ há»¯u comment
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
    logger.error(`Lá»—i khi xÃ³a comment ${commentId}:`, error);
    throw error;
  }
};



