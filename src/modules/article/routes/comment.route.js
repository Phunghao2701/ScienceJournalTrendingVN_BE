import * as articleController from '../controllers/article.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateCommentId, validateUpdateComment } from '../middlewares/commentValidation.middleware.js';

export default async function commentRoutes(fastify, options) {
  fastify.put('/:commentId', { preHandler: [requireAuth, validateUpdateComment] }, articleController.updateComment);
  fastify.delete('/:commentId', { preHandler: [requireAuth, validateCommentId] }, articleController.deleteComment);
}
