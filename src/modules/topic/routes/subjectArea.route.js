import * as subjectAreaController from '../controllers/subjectArea.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateSubjectAreaId, validateCreateSubjectArea, validateUpdateSubjectArea, validatePagination } from '../middlewares/subjectAreaValidation.middleware.js';

export default async function subjectAreaRoutes(fastify, options) {
  fastify.post('/', { preHandler: [requireAuth, validateCreateSubjectArea] }, subjectAreaController.createSubjectArea);
  fastify.get('/', { preHandler: [validatePagination] }, subjectAreaController.getSubjectAreas);
  fastify.get('/:id', { preHandler: [validateSubjectAreaId] }, subjectAreaController.getSubjectAreaById);
  fastify.put('/:id', { preHandler: [requireAuth, validateSubjectAreaId, validateUpdateSubjectArea] }, subjectAreaController.updateSubjectArea);
  fastify.delete('/:id', { preHandler: [requireAuth, validateSubjectAreaId] }, subjectAreaController.deleteSubjectArea);
  fastify.patch('/:id/restore', { preHandler: [requireAuth, validateSubjectAreaId] }, subjectAreaController.restoreSubjectArea);
  fastify.get('/:id/statistics', { preHandler: [validateSubjectAreaId] }, subjectAreaController.getSubjectAreaStatistics);
}
