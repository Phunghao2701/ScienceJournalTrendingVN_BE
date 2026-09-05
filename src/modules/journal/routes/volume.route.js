import * as volumeController from '../controllers/volume.controller.js';
import { requireAuth } from '../../auth/middlewares/auth.middleware.js';
import { validateVolumeId, validateCreateVolume, validateUpdateVolume } from '../middlewares/volumeValidation.middleware.js';

export default async function volumeRoutes(fastify, options) {
  fastify.get('/', { preHandler: [requireAuth] }, volumeController.getVolumes);
  fastify.post('/', { preHandler: [requireAuth, validateCreateVolume] }, volumeController.createVolume);
  fastify.get('/:id', { preHandler: [requireAuth, validateVolumeId] }, volumeController.getVolumeById);
  fastify.put('/:id', { preHandler: [requireAuth, validateVolumeId, validateUpdateVolume] }, volumeController.updateVolume);
  fastify.delete('/:id', { preHandler: [requireAuth, validateVolumeId] }, volumeController.deleteVolume);
  fastify.patch('/:id/restore', { preHandler: [requireAuth, validateVolumeId] }, volumeController.restoreVolume);
}
