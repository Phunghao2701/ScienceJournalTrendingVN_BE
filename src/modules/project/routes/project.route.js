import * as projectController from '../controllers/project.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateCreateProject, validateProjectId, validateRelatedArticlesLimit, validateUpdateProject } from '../middlewares/projectValidation.middleware.js';

export default async function projectRoutes(fastify, options) {
  fastify.get('/', { preHandler: [requireAuth] }, projectController.getProjects);
  fastify.get('/:id', { preHandler: [requireAuth, validateProjectId] }, projectController.getProjectById);
  fastify.get('/:id/related-articles', { preHandler: [requireAuth, validateProjectId, validateRelatedArticlesLimit] }, projectController.getRelatedArticles);
  fastify.post('/', { preHandler: [requireAuth, validateCreateProject] }, projectController.createProject);
  fastify.put('/:id', { preHandler: [requireAuth, validateProjectId, validateUpdateProject] }, projectController.updateProject);
  fastify.delete('/:id', { preHandler: [requireAuth, validateProjectId] }, projectController.deleteProject);
  fastify.get('/:id/analytics', { preHandler: [requireAuth, validateProjectId] }, projectController.getProjectAnalytics);
}
