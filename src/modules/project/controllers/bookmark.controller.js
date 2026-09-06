import * as bookmarkService from '../services/bookmark.service.js';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';

export const getBookmarks = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const bookmarks = await bookmarkService.getUserBookmarks(userId);
    return reply.status(200).send({ success: true, code: 'SUCCESS_GET_BOOKMARKS', message: 'Lấy danh sách bookmark th� nh công', data: bookmarks });
  } catch (error) {
    logger.error('[Bookmark Controller] Lỗi khi lấy danh sách bookmark:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Có lỗi xảy ra khi lấy danh sách bookmark' });
  }
};

export const addBookmark = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const articleId = Number(request.body.article_id);
    const bookmark = await bookmarkService.addBookmark(userId, articleId);

    createLog({ userId, userRole: request.user.role, action: 'CREATE', entityTable: 'Bookmark', entityId: bookmark.bookmark_id, message: `Thêm bookmark cho b� i báo ID: ${articleId}`, metadata: { ip: request.ip } });
    return reply.status(201).send({ success: true, code: 'SUCCESS_ADD_BOOKMARK', message: 'Thêm bookmark th� nh công', data: bookmark });
  } catch (error) {
    if (error.statusCode === 404) return reply.status(404).send({ success: false, code: 'ARTICLE_NOT_FOUND', message: error.message });
    logger.error('[Bookmark Controller] Lỗi khi thêm bookmark:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Có lỗi xảy ra khi thêm bookmark' });
  }
};

export const removeBookmark = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const articleId = Number(request.params.articleId);
    const removed = await bookmarkService.removeBookmark(userId, articleId);

    if (!removed) return reply.status(404).send({ success: false, code: 'BOOKMARK_NOT_FOUND', message: 'Không tìm thấy bookmark cho b� i báo n� y' });

    createLog({ userId, userRole: request.user.role, action: 'DELETE', entityTable: 'Bookmark', entityId: articleId, message: `Bỏ bookmark b� i báo ID: ${articleId}`, metadata: { ip: request.ip } });
    return reply.status(200).send({ success: true, code: 'SUCCESS_REMOVE_BOOKMARK', message: 'Bỏ bookmark th� nh công' });
  } catch (error) {
    logger.error('[Bookmark Controller] Lỗi khi bỏ bookmark:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Có lỗi xảy ra khi bỏ bookmark' });
  }
};



