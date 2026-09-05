import * as publisherController from '../controllers/publisher.controller.js';
import { verifyToken, verifyAdmin } from '../../auth/middlewares/auth.middleware.js';

export default async function publisherRoutes(fastify, options) {
  fastify.get('/', publisherController.getPublishers);
  fastify.get('/:id', publisherController.getPublisherById);
  fastify.post('/', { preHandler: [verifyToken, verifyAdmin] }, publisherController.createPublisher);
  fastify.put('/:id', { preHandler: [verifyToken, verifyAdmin] }, publisherController.updatePublisher);
  fastify.delete('/:id', { preHandler: [verifyToken, verifyAdmin] }, publisherController.deletePublisher);
  fastify.patch('/:id/restore', { preHandler: [verifyToken, verifyAdmin] }, publisherController.restorePublisher);
}
