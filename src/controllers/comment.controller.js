import * as commentService from '../services/comment.service.js';
import logger from '../utils/logger.js';
import { createLog } from '../services/log.service.js';

/**
 * Ghép tên hiển thị và định dạng lại một bản ghi comment từ DB thành shape trả về cho FE
 * @param {Object} row
 * @returns {Object}
 */
const formatComment = (row) => ({
  id: row.comment_id,
  article_id: row.article_id,
  user_id: row.user_id,
  user: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null,
  avatar: row.url_image || null,
  content: row.content,
  created_at: row.created_at,
});

/**
 * API Lấy danh sách comment của một bài báo
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.id - ID của bài báo
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa danh sách comment
 */
export const getArticleComments = async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    const comments = await commentService.getArticleComments(articleId);

    return res.status(200).json({
      success: true,
      code: 'SUCCESS_GET_COMMENTS',
      message: 'Lấy danh sách comment thành công',
      data: comments.map(formatComment),
    });
  } catch (error) {
    logger.error('[Comment Controller] Lỗi khi lấy danh sách comment:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Có lỗi xảy ra khi lấy danh sách comment',
    });
  }
};

/**
 * API Thêm comment mới cho một bài báo
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.id - ID của bài báo
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} req.body - Dữ liệu comment
 * @param {string} req.body.content - Nội dung comment
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa comment vừa tạo
 */
export const createComment = async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    const userId = req.user.user_id;
    const { content } = req.body;

    const newComment = await commentService.createComment(articleId, userId, content.trim());

    createLog({
      userId,
      userRole: req.user.role,
      action: 'CREATE',
      entityTable: 'Comment',
      entityId: newComment.comment_id,
      message: `Thêm comment cho bài báo ID: ${articleId}`,
      metadata: { ip: req.ip },
    });

    return res.status(201).json({
      success: true,
      code: 'SUCCESS_CREATE_COMMENT',
      message: 'Thêm comment thành công',
      data: formatComment(newComment),
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(404).json({
        success: false,
        code: 'ARTICLE_NOT_FOUND',
        message: 'Không tìm thấy bài báo với ID đã cho',
      });
    }
    logger.error('[Comment Controller] Lỗi khi tạo comment:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Có lỗi xảy ra khi tạo comment',
    });
  }
};

/**
 * API Cập nhật nội dung comment (chỉ chủ sở hữu)
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.commentId - ID của comment cần cập nhật
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} req.body - Dữ liệu cập nhật
 * @param {string} req.body.content - Nội dung comment mới
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa comment đã cập nhật
 */
export const updateComment = async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.user_id;
    const { content } = req.body;

    const updated = await commentService.updateComment(commentId, userId, content.trim());
    if (!updated) {
      return res.status(404).json({
        success: false,
        code: 'COMMENT_NOT_FOUND_OR_ACCESS_DENIED',
        message: 'Không tìm thấy comment hoặc bạn không có quyền chỉnh sửa comment này',
      });
    }

    createLog({
      userId,
      userRole: req.user.role,
      action: 'UPDATE',
      entityTable: 'Comment',
      entityId: commentId,
      message: `Cập nhật comment ID: ${commentId}`,
      metadata: { ip: req.ip },
    });

    return res.status(200).json({
      success: true,
      code: 'SUCCESS_UPDATE_COMMENT',
      message: 'Cập nhật comment thành công',
      data: {
        id: updated.comment_id,
        article_id: updated.article_id,
        user_id: updated.user_id,
        content: updated.content,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    });
  } catch (error) {
    logger.error('[Comment Controller] Lỗi khi cập nhật comment:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Có lỗi xảy ra khi cập nhật comment',
    });
  }
};

/**
 * API Xóa comment (chỉ chủ sở hữu)
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.commentId - ID của comment cần xóa
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response thông báo kết quả xóa comment
 */
export const deleteComment = async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.user_id;

    const deleted = await commentService.deleteComment(commentId, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        code: 'COMMENT_NOT_FOUND_OR_ACCESS_DENIED',
        message: 'Không tìm thấy comment hoặc bạn không có quyền xóa comment này',
      });
    }

    createLog({
      userId,
      userRole: req.user.role,
      action: 'DELETE',
      entityTable: 'Comment',
      entityId: commentId,
      message: `Xóa comment ID: ${commentId}`,
      metadata: { ip: req.ip },
    });

    return res.status(200).json({
      success: true,
      code: 'SUCCESS_DELETE_COMMENT',
      message: 'Xóa comment thành công',
    });
  } catch (error) {
    logger.error('[Comment Controller] Lỗi khi xóa comment:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Có lỗi xảy ra khi xóa comment',
    });
  }
};
