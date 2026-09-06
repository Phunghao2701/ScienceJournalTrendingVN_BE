import * as orcidScanController from '../controllers/orcidScan.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';

export default async function orcidRoutes(fastify, options) {
  fastify.post('/scan', { preHandler: [requireAuth, orcidScanController.validateOrcidScan] }, orcidScanController.scanAuthorWorksByOrcid);
  fastify.get('/scan/:jobId/publications', { preHandler: [requireAuth] }, orcidScanController.getOrcidScanJobPublicationPage);
  fastify.get('/scan/:jobId', { preHandler: [requireAuth] }, orcidScanController.getOrcidScanJobStatus);
}
