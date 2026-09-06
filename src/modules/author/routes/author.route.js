import * as authorController from '../controllers/author.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateAuthorId, validateCreateAuthor, validatePagination, validateUpdateAuthor } from '../middlewares/authorValidation.middleware.js';

export default async function authorRoutes(fastify, options) {
  fastify.get('/:id/areas-breakdown', { preHandler: [validateAuthorId] }, authorController.getAuthorAreasBreakdown);
  fastify.get('/:id/articles', { preHandler: [validateAuthorId] }, authorController.getAuthorArticles);
  fastify.get('/leaderboard', authorController.getAuthorLeaderboard);
  fastify.get('/', { preHandler: [validatePagination] }, authorController.getAllAuthorsController);
  fastify.post('/', { preHandler: [requireAuth, validateCreateAuthor] }, authorController.createAuthorController);
  fastify.patch('/:id/restore', { preHandler: [requireAuth, validateAuthorId] }, authorController.restoreAuthorController);
  fastify.get('/:id', { preHandler: [validateAuthorId] }, authorController.getAuthorByIdController);
  fastify.put('/:id', { preHandler: [requireAuth, validateAuthorId, validateUpdateAuthor] }, authorController.updateAuthorController);
  fastify.delete('/:id', { preHandler: [requireAuth, validateAuthorId] }, authorController.deleteAuthorController);
}
