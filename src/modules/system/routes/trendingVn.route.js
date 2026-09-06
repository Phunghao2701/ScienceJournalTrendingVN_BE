import * as trendingVnController from '../controllers/trendingVn.controller.js';

export default async function trendingVnRoutes(fastify, options) {
  fastify.get('/top-journals', trendingVnController.getTopJournals);
  fastify.get('/top-universities', trendingVnController.getTopUniversities);
  fastify.get('/ranking/journals', trendingVnController.getJournalRankings);
  fastify.get('/trending/journals', trendingVnController.getTrendingJournals);
  fastify.get('/ranking/universities', trendingVnController.getUniversityRankings);
  fastify.get('/trending/universities', trendingVnController.getTrendingUniversities);
  fastify.get('/ranking/authors', trendingVnController.getAuthorRankings);
  fastify.get('/trending/authors', trendingVnController.getTrendingAuthors);
  fastify.get('/trending/articles', trendingVnController.getTrendingArticles);
  fastify.get('/trending/keywords', trendingVnController.getTrendingKeywords);
}
