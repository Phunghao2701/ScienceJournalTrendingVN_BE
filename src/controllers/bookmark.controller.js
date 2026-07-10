import * as bookmarkService from '../services/bookmark.service.js';
import logger from '../utils/logger.js';
import { createLog } from '../services/log.service.js';

/**
 * API Lấy danh sách bài báo đã bookmark của người dùng hiện tại
 * @param {Object} req - Express request object
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa danh sách bookmark
 */
export const getBookmarks = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const bookmarks = await bookmarkService.getUserBookmarks(userId);

    return res.status(200).json({
      success: true,
      code: 'SUCCESS_GET_BOOKMARKS',
      message: 'Lấy danh sách bookmark thành công',
      data: bookmarks,
    });
  } catch (error) {
    logger.error('[Bookmark Controller] Lỗi khi lấy danh sách bookmark:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Có lỗi xảy ra khi lấy danh sách bookmark',
    });
  }
};

/**
 * API Thêm bookmark cho một bài báo
 * @param {Object} req - Express request object
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} req.body - Dữ liệu truyền lên
 * @param {number|string} req.body.article_id - ID bài báo cần bookmark
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa bookmark vừa tạo
 */
export const addBookmark = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const articleId = Number(req.body.article_id);

    const bookmark = await bookmarkService.addBookmark(userId, articleId);

    createLog({
      userId,
      userRole: req.user.role,
      action: 'CREATE',
      entityTable: 'Bookmark',
      entityId: bookmark.bookmark_id,
      message: `Thêm bookmark cho bài báo ID: ${articleId}`,
      metadata: { ip: req.ip },
    });

    return res.status(201).json({
      success: true,
      code: 'SUCCESS_ADD_BOOKMARK',
      message: 'Thêm bookmark thành công',
      data: bookmark,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        code: 'ARTICLE_NOT_FOUND',
        message: error.message,
      });
    }
    logger.error('[Bookmark Controller] Lỗi khi thêm bookmark:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Có lỗi xảy ra khi thêm bookmark',
    });
  }
};

/**
 * API Bỏ bookmark một bài báo
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.articleId - ID bài báo cần bỏ bookmark
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response thông báo kết quả bỏ bookmark
 */
export const removeBookmark = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const articleId = Number(req.params.articleId);

    const removed = await bookmarkService.removeBookmark(userId, articleId);
    if (!removed) {
      return res.status(404).json({
        success: false,
        code: 'BOOKMARK_NOT_FOUND',
        message: 'Không tìm thấy bookmark cho bài báo này',
      });
    }

    createLog({
      userId,
      userRole: req.user.role,
      action: 'DELETE',
      entityTable: 'Bookmark',
      entityId: articleId,
      message: `Bỏ bookmark bài báo ID: ${articleId}`,
      metadata: { ip: req.ip },
    });

    return res.status(200).json({
      success: true,
      code: 'SUCCESS_REMOVE_BOOKMARK',
      message: 'Bỏ bookmark thành công',
    });
  } catch (error) {
    logger.error('[Bookmark Controller] Lỗi khi bỏ bookmark:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Có lỗi xảy ra khi bỏ bookmark',
    });
  }
};
