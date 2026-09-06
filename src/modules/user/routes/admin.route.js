import * as userController from '../controllers/user.controller.js';
import { verifyToken, verifyAdmin } from '../../auth/middlewares/auth.middleware.js';
import { validateJournalId } from '../../journal/middlewares/journalValidation.middleware.js';

export default async function adminRoutes(fastify, options) {
  // --- Admin User Management ---
  fastify.get('/users', { preHandler: [verifyToken, verifyAdmin] }, userController.getUsers);
  fastify.get('/users/:id', { preHandler: [verifyToken, verifyAdmin] }, userController.getUserDetail);
  fastify.post('/users', { preHandler: [verifyToken, verifyAdmin] }, userController.createUser);
  fastify.put('/users/:id', { preHandler: [verifyToken, verifyAdmin] }, userController.adminUpdateUser);

  // --- Admin Dashboard & Others ---
  fastify.get('/dashboard/summary', { preHandler: [verifyToken, verifyAdmin] }, userController.summary);
  fastify.get('/dashboard/publication-trends', { preHandler: [verifyToken, verifyAdmin] }, userController.publicationTrends);
  fastify.get('/dashboard/volume-issue-status', { preHandler: [verifyToken, verifyAdmin] }, userController.getVolumeIssueStatus);
  fastify.get('/dashboard/volume-issue-status/export', { preHandler: [verifyToken, verifyAdmin] }, userController.exportVolumeIssueStatusCSV);
  fastify.get('/dashboard/recent-activities', { preHandler: [verifyToken, verifyAdmin] }, userController.getRecentActivities);

  // --- Admin Repository ---
  // Note: We'll assume validateJournalId is already migrated or we'll migrate it soon.
  // We'll leave the preHandler here for now.
  fastify.get('/repositories/journals/:journalId/summary', { preHandler: [verifyToken, verifyAdmin, validateJournalId] }, userController.getJournalRepositorySummary);
}
