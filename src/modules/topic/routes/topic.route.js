import * as topicController from '../controllers/topic.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateTopicId } from '../middlewares/topicValidation.middleware.js';

export default async function topicRoutes(fastify, options) {
  fastify.get('/', topicController.getTopics);
  fastify.get('/:id', { preHandler: [validateTopicId] }, topicController.getTopicById);
  fastify.get('/:id/articles', { preHandler: [validateTopicId] }, topicController.getArticlesByTopic);
  fastify.post('/', { preHandler: [requireAuth] }, topicController.createTopic);
  fastify.put('/:id', { preHandler: [requireAuth, validateTopicId] }, topicController.updateTopic);
  fastify.delete('/:id', { preHandler: [requireAuth, validateTopicId] }, topicController.deleteTopic);
  fastify.patch('/:id/restore', { preHandler: [requireAuth, validateTopicId] }, topicController.restoreTopic);
}
