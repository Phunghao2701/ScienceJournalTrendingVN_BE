import * as subjectCategoryService from '../services/subjectCategory.service.js';
import logger from '../../../utils/logger.js';

export const subjectCategoryServiceRef = { ...subjectCategoryService };

export const createSubjectCategory = async (request, reply) => {
  try {
    const { subject_area_id, display_name, description } = request.body;
    const newSubjectCategory = await subjectCategoryServiceRef.createSubjectCategory({ subject_area_id, display_name, description });
    return reply.status(201).send({ success: true, message: "Táº¡o Subject Category thÃ nh cÃ´ng", code: "CREATE_SUBJECT_CATEGORY_SUCCESS", data: newSubjectCategory });
  } catch (error) {
    logger.error("Lá»—i khi táº¡o Subject Category á»Ÿ controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi táº¡o má»›i Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectCategories = async (request, reply) => {
  try {
    const { page, limit, search, subject_area_id, sort_by, sort_order } = request.query;
    const { items, total } = await subjectCategoryServiceRef.getSubjectCategories({ page, limit, search, subject_area_id, sort_by, sort_order });
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return reply.status(200).send({ success: true, message: "Láº¥y danh sÃ¡ch subject category thÃ nh cÃ´ng", code: "GET_SUBJECT_CATEGORIES_SUCCESS", data: { items, pagination: { page: pageNum, limit: limitNum, total } } });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch Subject Category á»Ÿ controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi láº¥y danh sÃ¡ch Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectCategoryById = async (request, reply) => {
  try {
    const { id } = request.params;
    const subjectCategory = await subjectCategoryServiceRef.getSubjectCategoryById(id);
    if (!subjectCategory) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    return reply.status(200).send({ success: true, message: "Láº¥y chi tiáº¿t subject category thÃ nh cÃ´ng", code: "GET_SUBJECT_CATEGORY_SUCCESS", data: subjectCategory });
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y chi tiáº¿t Subject Category ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi láº¥y thÃ´ng tin chi tiáº¿t Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const updateSubjectCategory = async (request, reply) => {
  try {
    const { id } = request.params;
    const { subject_area_id, display_name, description } = request.body;
    const updatedSubjectCategory = await subjectCategoryServiceRef.updateSubjectCategory(id, { subject_area_id, display_name, description });

    return reply.status(200).send({ success: true, message: "Cáº­p nháº­t Subject Category thÃ nh cÃ´ng", code: "UPDATE_SUBJECT_CATEGORY_SUCCESS", data: updatedSubjectCategory });
  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Subject Category ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi cáº­p nháº­t Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const deleteSubjectCategory = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectCategoryServiceRef.subjectCategoryExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const isDeleted = await subjectCategoryServiceRef.subjectCategoryIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, message: "KhÃ´ng delete subject category Ä‘Ã£ bá»‹ delete", code: "SUBJECT_CATEGORY_ALREADY_DELETED", data: null });

    const deletedSubjectCategory = await subjectCategoryServiceRef.deleteSubjectCategory(id);
    return reply.status(200).send({ success: true, message: "XÃ³a Subject Category thÃ nh cÃ´ng", code: "DELETE_SUBJECT_CATEGORY_SUCCESS", data: deletedSubjectCategory });
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a má»m Subject Category ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi xÃ³a Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const restoreSubjectCategory = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectCategoryServiceRef.subjectCategoryExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const isDeleted = await subjectCategoryServiceRef.subjectCategoryIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, message: "KhÃ´ng khÃ´i phá»¥c subject category chÆ°a bá»‹ delete", code: "SUBJECT_CATEGORY_NOT_DELETED", data: null });

    const restoredSubjectCategory = await subjectCategoryServiceRef.restoreSubjectCategory(id);
    return reply.status(200).send({ success: true, message: "KhÃ´i phá»¥c Subject Category thÃ nh cÃ´ng", code: "RESTORE_SUBJECT_CATEGORY_SUCCESS", data: restoredSubjectCategory });
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c Subject Category ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi khÃ´i phá»¥c Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectCategoryStatistics = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectCategoryServiceRef.subjectCategoryExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const isDeleted = await subjectCategoryServiceRef.subjectCategoryIsDeleted(id);
    if (isDeleted) return reply.status(404).send({ success: false, message: "KhÃ´ng tÃ¬m tháº¥y Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const stats = await subjectCategoryServiceRef.getSubjectCategoryStatistics(id);
    return reply.status(200).send({ success: true, message: "Láº¥y thá»‘ng kÃª subject category thÃ nh cÃ´ng", code: "GET_SUBJECT_CATEGORY_STATISTICS_SUCCESS", data: stats });
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y thá»‘ng kÃª Subject Category ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lá»—i há»‡ thá»‘ng khi láº¥y thá»‘ng kÃª Subject Category", code: "SERVER_ERROR", data: null });
  }
};



