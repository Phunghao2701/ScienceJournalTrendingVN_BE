import * as subjectCategoryController from '../controllers/subjectCategory.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateSubjectCategoryId, validateCreateSubjectCategory, validateUpdateSubjectCategory, validatePagination } from '../middlewares/subjectCategoryValidation.middleware.js';

export default async function subjectCategoryRoutes(fastify, options) {
  fastify.post('/', { preHandler: [requireAuth, validateCreateSubjectCategory] }, subjectCategoryController.createSubjectCategory);
  fastify.get('/', { preHandler: [validatePagination] }, subjectCategoryController.getSubjectCategories);
  fastify.get('/:id', { preHandler: [validateSubjectCategoryId] }, subjectCategoryController.getSubjectCategoryById);
  fastify.put('/:id', { preHandler: [requireAuth, validateSubjectCategoryId, validateUpdateSubjectCategory] }, subjectCategoryController.updateSubjectCategory);
  fastify.delete('/:id', { preHandler: [requireAuth, validateSubjectCategoryId] }, subjectCategoryController.deleteSubjectCategory);
  fastify.patch('/:id/restore', { preHandler: [requireAuth, validateSubjectCategoryId] }, subjectCategoryController.restoreSubjectCategory);
  fastify.get('/:id/statistics', { preHandler: [validateSubjectCategoryId] }, subjectCategoryController.getSubjectCategoryStatistics);
}
