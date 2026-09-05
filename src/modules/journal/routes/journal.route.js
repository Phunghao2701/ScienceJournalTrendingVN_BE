import * as journalController from '../controllers/journal.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateCreateJournal, validateJournalId, validateUpdateJournal } from '../middlewares/journalValidation.middleware.js';

export default async function journalRoutes(fastify, options) {
  fastify.get('/', journalController.getJournals);
  fastify.get('/:id', journalController.getJournalsById);
  fastify.post('/', { preHandler: [requireAuth, validateCreateJournal] }, journalController.createJournal);
  fastify.put('/:id', { preHandler: [requireAuth, validateUpdateJournal] }, journalController.updateJournal);
  fastify.delete('/:id', { preHandler: [requireAuth, validateJournalId] }, journalController.deleteJournal);
  fastify.patch('/:id/restore', { preHandler: [requireAuth, validateJournalId] }, journalController.restoreJournal);
}
