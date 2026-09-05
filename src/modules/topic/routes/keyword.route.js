import * as keywordController from '../controllers/keyword.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateDeleteWatchedKeyword, validateUpdateWatchedKeywords, validateCreateWatchedKeyword, validateKeywordBody, validateKeywordId } from '../middlewares/keywordValidation.middleware.js';

export default async function keywordRoutes(fastify, options) {
  // Global Keywords
  fastify.get('/', keywordController.getAllKeywordsController);
  fastify.post('/', { preHandler: [requireAuth, validateKeywordBody] }, keywordController.createKeywordController);
  fastify.patch('/:id/restore', { preHandler: [requireAuth, validateKeywordId] }, keywordController.restoreKeywordController);
  fastify.get('/:id/articles', { preHandler: [validateKeywordId] }, keywordController.getArticlesByKeywordController);
  fastify.get('/:id', { preHandler: [validateKeywordId] }, keywordController.getKeywordByIdController);
  fastify.put('/:id', { preHandler: [requireAuth, validateKeywordId, validateKeywordBody] }, keywordController.updateKeywordController);
  fastify.delete('/:id', { preHandler: [requireAuth, validateKeywordId] }, keywordController.deleteKeywordController);

  // Project Watched Keywords
  // Since we prefix this module with /api/v1 in app.js for project keyword routes
  // wait, the app.js will register it as:
  // app.register(keywordRoutes, { prefix: '/api/v1' }); // for project keywords
  // app.register(keywordGlobalRoutes, { prefix: '/api/v1/keywords' }); // for global keywords
  // Actually let's just make keywordRoutes handle `/api/v1/keywords` and `/api/v1/projects/:id/keywords` by exporting two functions.

}

export async function projectKeywordRoutes(fastify, options) {
  fastify.get('/:id/keywords/trending', { preHandler: [requireAuth] }, keywordController.getTrendingKeywords);
  fastify.get('/:id/keywords/watch/articles', { preHandler: [requireAuth] }, keywordController.getWatchedKeywordArticles);
  fastify.post('/:id/keywords/watch', { preHandler: [requireAuth, validateCreateWatchedKeyword] }, keywordController.watchKeywords);
  fastify.put('/:id/keywords/watch', { preHandler: [requireAuth, validateUpdateWatchedKeywords] }, keywordController.updateWatchedKeywords);
  fastify.delete('/:id/keywords/:keywordId', { preHandler: [requireAuth, validateDeleteWatchedKeyword] }, keywordController.deleteWatchedKeyword);
}
