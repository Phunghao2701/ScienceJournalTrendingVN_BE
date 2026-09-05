import * as subjectAreaService from '../services/subjectArea.service.js';
import logger from '../../../utils/logger.js';

export const subjectAreaServiceRef = { ...subjectAreaService };

export const createSubjectArea = async (request, reply) => {
  try {
    const { display_name, description } = request.body;
    const newSubjectArea = await subjectAreaServiceRef.createSubjectArea({ display_name, description });
    return reply.status(201).send({ success: true, message: "Táº¡o Subject Area thÃ nh cÃ´ng", code: "CREATE_SUBJECT_AREA_SUCCESS", data: newSubjectArea });
  } catch (error) {
    logger.error("Lá»—i khi táº¡o Subject Area á»Ÿ controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi táº¡o má»›i Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectAreas = async (request, reply) => {
  try {
    const { page, limit, search, sort_by, sort_order } = request.query;
    const { items, total } = await subjectAreaServiceRef.getSubjectAreas({ page, limit, search, sort_by, sort_order });
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return reply.status(200).send({ success: true, message: "Láº¥y danh sÃ¡ch subject area thÃ nh cÃ´ng", code: "GET_SUBJECT_AREAS_SUCCESS", data: { items, pagination: { page: pageNum, limit: limitNum, total } } });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch Subject Area á»Ÿ controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi láº¥y danh sÃ¡ch Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectAreaById = async (request, reply) => {
  try {
    const { id } = request.params;
    const subjectArea = await subjectAreaServiceRef.getSubjectAreaById(id);
    if (!subjectArea) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    return reply.status(200).send({ success: true, message: "Láº¥y chi tiáº¿t subject area thÃ nh cÃ´ng", code: "GET_SUBJECT_AREA_SUCCESS", data: subjectArea });
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y chi tiáº¿t Subject Area ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi láº¥y thÃ´ng tin chi tiáº¿t Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const updateSubjectArea = async (request, reply) => {
  try {
    const { id } = request.params;
    const { display_name, description } = request.body;
    const updatedSubjectArea = await subjectAreaServiceRef.updateSubjectArea(id, { display_name, description });

    return reply.status(200).send({ success: true, message: "Cáº­p nháº­t Subject Area thÃ nh cÃ´ng", code: "UPDATE_SUBJECT_AREA_SUCCESS", data: updatedSubjectArea });
  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Subject Area ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi cáº­p nháº­t Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const deleteSubjectArea = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, message: "KhÃ´ng delete subject area Ä‘Ã£ bá»‹ delete", code: "SUBJECT_AREA_ALREADY_DELETED", data: null });

    const deletedSubjectArea = await subjectAreaServiceRef.deleteSubjectArea(id);
    return reply.status(200).send({ success: true, message: "XÃ³a Subject Area thÃ nh cÃ´ng", code: "DELETE_SUBJECT_AREA_SUCCESS", data: deletedSubjectArea });
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a má»m Subject Area ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi xÃ³a Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const restoreSubjectArea = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, message: "KhÃ´ng khÃ´i phá»¥c subject area chÆ°a bá»‹ delete", code: "SUBJECT_AREA_NOT_DELETED", data: null });

    const restoredSubjectArea = await subjectAreaServiceRef.restoreSubjectArea(id);
    return reply.status(200).send({ success: true, message: "KhÃ´i phá»¥c Subject Area thÃ nh cÃ´ng", code: "RESTORE_SUBJECT_AREA_SUCCESS", data: restoredSubjectArea });
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c Subject Area ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi khÃ´i phá»¥c Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectAreaStatistics = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (isDeleted) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const stats = await subjectAreaServiceRef.getSubjectAreaStatistics(id);
    return reply.status(200).send({ success: true, message: "Láº¥y thá»‘ng kÃª subject area thÃ nh cÃ´ng", code: "GET_SUBJECT_AREA_STATISTICS_SUCCESS", data: stats });
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y thá»‘ng kÃª Subject Area ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi láº¥y thá»‘ng kÃª Subject Area", code: "SERVER_ERROR", data: null });
  }
};



