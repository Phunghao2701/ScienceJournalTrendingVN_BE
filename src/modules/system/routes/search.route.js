import * as searchController from '../controllers/search.controller.js';
import { keywordValidation } from '../middlewares/searchValidation.middleware.js';

export default async function searchRoutes(fastify, options) {
  fastify.get('/:keyword', { preHandler: [keywordValidation] }, searchController.search);
}
