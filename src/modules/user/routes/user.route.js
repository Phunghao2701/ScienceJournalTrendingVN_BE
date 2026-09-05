import * as userController from '../controllers/user.controller.js';
import { verifyToken, verifyAdmin } from '../../auth/middlewares/auth.middleware.js';

export default async function userRoutes(fastify, options) {
  fastify.get('/me', { preHandler: [verifyToken] }, userController.getMe);
  fastify.put('/me', { preHandler: [verifyToken] }, userController.updateMe);
  fastify.delete('/me', { preHandler: [verifyToken] }, userController.deleteMe);
  fastify.put('/:id', { preHandler: [verifyToken] }, userController.updateUserById);
}
