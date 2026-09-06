import * as zoneController from '../controllers/zone.controller.js';

export default async function zoneRoutes(fastify, options) {
  fastify.get('/countries/stats', zoneController.getCountryStats);
  fastify.get('/regions/stats', zoneController.getRegionStats);
  fastify.get('/countries/:code/regions/stats', zoneController.getCountryRegionsStats);
}
