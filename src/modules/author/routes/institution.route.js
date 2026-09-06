import * as institutionController from '../controllers/institution.controller.js';

export default async function institutionRoutes(fastify, options) {
  fastify.get('/', institutionController.getInstitutions);
  fastify.get('/:id', institutionController.getInstitutionById);
}
