import * as catalogController from '../controllers/catalog.controller.js';

export default async function catalogRoutes(fastify, options) {
  fastify.get('/subject-areas', catalogController.getSubjectAreas);
  fastify.get('/subject-categories', catalogController.getSubjectCategories);
  fastify.get('/journals/:id/rankings', catalogController.getJournalRankings);
  fastify.get('/volumes', catalogController.getVolumes);
  fastify.get('/issues', catalogController.getIssues);
}
