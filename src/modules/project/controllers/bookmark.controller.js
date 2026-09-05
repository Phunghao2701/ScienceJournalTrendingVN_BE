import * as bookmarkService from '../services/bookmark.service.js';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';

export const getBookmarks = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const bookmarks = await bookmarkService.getUserBookmarks(userId);
    return reply.status(200).send({ success: true, code: 'SUCCESS_GET_BOOKMARKS', message: 'Láº¥y danh sÃ¡ch bookmark thÃ nh cÃ´ng', data: bookmarks });
  } catch (error) {
    logger.error('[Bookmark Controller] Lá»—i khi láº¥y danh sÃ¡ch bookmark:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'CÃ³ lá»—i xáº£y ra khi láº¥y danh sÃ¡ch bookmark' });
  }
};

export const addBookmark = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const articleId = Number(request.body.article_id);
    const bookmark = await bookmarkService.addBookmark(userId, articleId);

    createLog({ userId, userRole: request.user.role, action: 'CREATE', entityTable: 'Bookmark', entityId: bookmark.bookmark_id, message: `ThÃªm bookmark cho bÃ i bÃ¡o ID: ${articleId}`, metadata: { ip: request.ip } });
    return reply.status(201).send({ success: true, code: 'SUCCESS_ADD_BOOKMARK', message: 'ThÃªm bookmark thÃ nh cÃ´ng', data: bookmark });
  } catch (error) {
    if (error.statusCode === 404) return reply.status(404).send({ success: false, code: 'ARTICLE_NOT_FOUND', message: error.message });
    logger.error('[Bookmark Controller] Lá»—i khi thÃªm bookmark:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'CÃ³ lá»—i xáº£y ra khi thÃªm bookmark' });
  }
};

export const removeBookmark = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const articleId = Number(request.params.articleId);
    const removed = await bookmarkService.removeBookmark(userId, articleId);

    if (!removed) return reply.status(404).send({ success: false, code: 'BOOKMARK_NOT_FOUND', message: 'KhÃ´ng tÃ¬m tháº¥y bookmark cho bÃ i bÃ¡o nÃ y' });

    createLog({ userId, userRole: request.user.role, action: 'DELETE', entityTable: 'Bookmark', entityId: articleId, message: `Bá» bookmark bÃ i bÃ¡o ID: ${articleId}`, metadata: { ip: request.ip } });
    return reply.status(200).send({ success: true, code: 'SUCCESS_REMOVE_BOOKMARK', message: 'Bá» bookmark thÃ nh cÃ´ng' });
  } catch (error) {
    logger.error('[Bookmark Controller] Lá»—i khi bá» bookmark:', error);
    return reply.status(500).send({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'CÃ³ lá»—i xáº£y ra khi bá» bookmark' });
  }
};



