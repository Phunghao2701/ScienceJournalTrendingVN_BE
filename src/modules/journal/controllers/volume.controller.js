import * as volumeService from '../services/volume.service.js';
import logger from '../../../utils/logger.js';

export const volumeServiceRef = { ...volumeService };

export const createVolume = async (request, reply) => {
  try {
    const { journal_id, volume_number, publication_year } = request.body;
    const newVolume = await volumeServiceRef.createVolume({ journal_id, volume_number, publication_year });
    return reply.status(201).send({ success: true, code: "CREATE_VOLUME_SUCCESS", message: "Táº¡o Volume thÃ nh cÃ´ng", data: newVolume });
  } catch (error) {
    logger.error("Lá»—i khi táº¡o Volume á»Ÿ controller:", error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi táº¡o má»›i Volume" });
  }
};

export const getVolumes = async (request, reply) => {
  try {
    const { page, limit, search, journal_id, publication_year, sort_by, sort_order } = request.query;
    const { items, total } = await volumeServiceRef.getVolumes({ page, limit, search, journal_id, publication_year, sort_by, sort_order });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return reply.status(200).send({ success: true, code: "GET_VOLUMES_SUCCESS", message: "Láº¥y danh sÃ¡ch volume thÃ nh cÃ´ng", data: { items, pagination: { page: pageNum, limit: limitNum, total } } });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch Volume á»Ÿ controller:", error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y danh sÃ¡ch Volume" });
  }
};

export const getVolumeById = async (request, reply) => {
  try {
    const { id } = request.params;
    const volume = await volumeServiceRef.getVolumeById(id);

    if (!volume) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "KhÃ´ng tÃ¬m tháº¥y volume hoáº·c volume Ä‘Ã£ bá»‹ xÃ³a má»m" });
    return reply.status(200).send({ success: true, code: "GET_VOLUME_DETAIL_SUCCESS", message: "Láº¥y chi tiáº¿t volume thÃ nh cÃ´ng", data: volume });
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y chi tiáº¿t Volume ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y thÃ´ng tin chi tiáº¿t Volume" });
  }
};

export const updateVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const { volume_number, publication_year } = request.body;

    const updatedVolume = await volumeServiceRef.updateVolume(id, { volume_number, publication_year });
    return reply.status(200).send({ success: true, code: "UPDATE_VOLUME_SUCCESS", message: "Cáº­p nháº­t Volume thÃ nh cÃ´ng", data: updatedVolume });
  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Volume ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi cáº­p nháº­t Volume" });
  }
};

export const deleteVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await volumeServiceRef.volumeExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "Volume khÃ´ng tá»“n táº¡i" });

    const isDeleted = await volumeServiceRef.volumeIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: "VOLUME_ALREADY_DELETED", message: "KhÃ´ng delete volume Ä‘Ã£ bá»‹ delete" });

    const deletedVolume = await volumeServiceRef.deleteVolume(id);
    return reply.status(200).send({ success: true, code: "DELETE_VOLUME_SUCCESS", message: "XÃ³a Volume thÃ nh cÃ´ng", data: deletedVolume });
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a má»m Volume ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi xÃ³a Volume" });
  }
};

export const restoreVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await volumeServiceRef.volumeExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "Volume khÃ´ng tá»“n táº¡i" });

    const isDeleted = await volumeServiceRef.volumeIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, code: "VOLUME_NOT_DELETED", message: "KhÃ´ng khÃ´i phá»¥c volume chÆ°a bá»‹ delete" });

    const restoredVolume = await volumeServiceRef.restoreVolume(id);
    return reply.status(200).send({ success: true, code: "RESTORE_VOLUME_SUCCESS", message: "KhÃ´i phá»¥c Volume thÃ nh cÃ´ng", data: restoredVolume });
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c Volume ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi khÃ´i phá»¥c Volume" });
  }
};



