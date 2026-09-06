import * as articleController from '../controllers/article.controller.js';
import { requireAuth, verifyToken } from '../../auth/middlewares/auth.middleware.js';
import { validateCreateArticle, validateId, validateUpdateArticle } from '../middlewares/articleValidation.middleware.js';
import { validateCreateComment } from '../middlewares/commentValidation.middleware.js';

export default async function articleRoutes(fastify, options) {
  // --- ARTICLES ---
  
  // Custom logic for GET / - If keywords are present, require auth, else public.
  fastify.get('/', async (request, reply) => {
    if (request.query.keywords !== undefined && request.query.keywords.trim() !== '') {
      const authRes = await verifyToken(request, reply);
      if (authRes) return authRes;
      return articleController.getArticlesByKeywords(request, reply);
    }
    return articleController.getArticles(request, reply);
  });

  fastify.get('/analytics', articleController.getArticleAnalytics);
  fastify.get('/analysis', articleController.getArticleAnalysis);

  fastify.get('/:id', { preHandler: [validateId] }, articleController.getArticleById);
  fastify.post('/', { preHandler: [verifyToken, validateCreateArticle] }, articleController.createArticle);
  fastify.put('/:id', { preHandler: [verifyToken, validateUpdateArticle] }, articleController.updateArticle);
  fastify.delete('/:id', { preHandler: [verifyToken, validateId] }, articleController.deleteArticle);
  fastify.patch('/:id/restore', { preHandler: [verifyToken, validateId] }, articleController.restoreArticle);

  // --- CITING WORKS ---
  fastify.get('/:id/citing-works/analytics', { preHandler: [validateId] }, articleController.getArticleCitingWorksAnalytics);
  fastify.get('/:id/citing-works', { preHandler: [validateId] }, articleController.getArticleCitingWorks);
  fastify.get('/:id/citing', { preHandler: [validateId] }, articleController.getArticleCitingWorks);

  // --- REFERENCES ---
  fastify.get('/:id/references', { preHandler: [validateId] }, articleController.getArticleReferences);
  fastify.get('/:id/refer', { preHandler: [validateId] }, articleController.getArticleReferences);
  fastify.post('/:id/references/hydrate', { preHandler: [requireAuth, validateId] }, articleController.hydrateArticleReferences);

  // --- COMMENTS ---
  fastify.get('/:id/comments', { preHandler: [validateId] }, articleController.getArticleComments);
  fastify.post('/:id/comments', { preHandler: [requireAuth, validateId, validateCreateComment] }, articleController.createComment);
  
  // Note: /api/v1/comments routes are mapped directly on article plugin or separate comment plugin?
  // In Express, they were on /api/v1/comments, but logically they belong to article/comment.
  // We'll put them in a separate comment route or register them on /api/v1/comments.
}
