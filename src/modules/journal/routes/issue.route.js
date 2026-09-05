import * as issueController from '../controllers/issue.controller.js';
import { requireAuth, verifyToken } from '../../auth/middlewares/auth.middleware.js';
import { validateIssueId, validateCreateIssue, validateUpdateIssue } from '../middlewares/issueValidation.middleware.js';

export default async function issueRoutes(fastify, options) {
  fastify.get('/', issueController.getIssues);
  fastify.post('/', { preHandler: [verifyToken, validateCreateIssue] }, issueController.createIssue);
  fastify.get('/:id', { preHandler: [verifyToken, validateIssueId] }, issueController.getIssueById);
  fastify.put('/:id', { preHandler: [verifyToken, validateIssueId, validateUpdateIssue] }, issueController.updateIssue);
  fastify.delete('/:id', { preHandler: [verifyToken, validateIssueId] }, issueController.deleteIssue);
  fastify.patch('/:id/restore', { preHandler: [verifyToken, validateIssueId] }, issueController.restoreIssue);
}
