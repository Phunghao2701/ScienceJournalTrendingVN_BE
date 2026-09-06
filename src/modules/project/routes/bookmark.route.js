import * as bookmarkController from '../controllers/bookmark.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateAddBookmark, validateArticleIdParam } from '../middlewares/bookmarkValidation.middleware.js';

export default async function bookmarkRoutes(fastify, options) {
  fastify.get('/', { preHandler: [requireAuth] }, bookmarkController.getBookmarks);
  fastify.post('/', { preHandler: [requireAuth, validateAddBookmark] }, bookmarkController.addBookmark);
  fastify.delete('/:articleId', { preHandler: [requireAuth, validateArticleIdParam] }, bookmarkController.removeBookmark);
}
