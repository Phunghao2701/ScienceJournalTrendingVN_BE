import * as subjectCategoryService from '../services/subjectCategory.service.js';
import logger from '../../../utils/logger.js';

export const subjectCategoryServiceRef = { ...subjectCategoryService };

export const createSubjectCategory = async (request, reply) => {
  try {
    const { subject_area_id, display_name, description } = request.body;
    const newSubjectCategory = await subjectCategoryServiceRef.createSubjectCategory({ subject_area_id, display_name, description });
    return reply.status(201).send({ success: true, message: "Tạo Subject Category th� nh công", code: "CREATE_SUBJECT_CATEGORY_SUCCESS", data: newSubjectCategory });
  } catch (error) {
    logger.error("Lỗi khi tạo Subject Category ở controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi tạo mới Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectCategories = async (request, reply) => {
  try {
    const { page, limit, search, subject_area_id, sort_by, sort_order } = request.query;
    const { items, total } = await subjectCategoryServiceRef.getSubjectCategories({ page, limit, search, subject_area_id, sort_by, sort_order });
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return reply.status(200).send({ success: true, message: "Lấy danh sách subject category th� nh công", code: "GET_SUBJECT_CATEGORIES_SUCCESS", data: { items, pagination: { page: pageNum, limit: limitNum, total } } });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách Subject Category ở controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy danh sách Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectCategoryById = async (request, reply) => {
  try {
    const { id } = request.params;
    const subjectCategory = await subjectCategoryServiceRef.getSubjectCategoryById(id);
    if (!subjectCategory) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    return reply.status(200).send({ success: true, message: "Lấy chi tiết subject category th� nh công", code: "GET_SUBJECT_CATEGORY_SUCCESS", data: subjectCategory });
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Subject Category ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy thông tin chi tiết Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const updateSubjectCategory = async (request, reply) => {
  try {
    const { id } = request.params;
    const { subject_area_id, display_name, description } = request.body;
    const updatedSubjectCategory = await subjectCategoryServiceRef.updateSubjectCategory(id, { subject_area_id, display_name, description });

    return reply.status(200).send({ success: true, message: "Cập nhật Subject Category th� nh công", code: "UPDATE_SUBJECT_CATEGORY_SUCCESS", data: updatedSubjectCategory });
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Subject Category ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi cập nhật Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const deleteSubjectCategory = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectCategoryServiceRef.subjectCategoryExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const isDeleted = await subjectCategoryServiceRef.subjectCategoryIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, message: "Không delete subject category đã bị delete", code: "SUBJECT_CATEGORY_ALREADY_DELETED", data: null });

    const deletedSubjectCategory = await subjectCategoryServiceRef.deleteSubjectCategory(id);
    return reply.status(200).send({ success: true, message: "Xóa Subject Category th� nh công", code: "DELETE_SUBJECT_CATEGORY_SUCCESS", data: deletedSubjectCategory });
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Subject Category ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi xóa Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const restoreSubjectCategory = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectCategoryServiceRef.subjectCategoryExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const isDeleted = await subjectCategoryServiceRef.subjectCategoryIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, message: "Không khôi phục subject category chưa bị delete", code: "SUBJECT_CATEGORY_NOT_DELETED", data: null });

    const restoredSubjectCategory = await subjectCategoryServiceRef.restoreSubjectCategory(id);
    return reply.status(200).send({ success: true, message: "Khôi phục Subject Category th� nh công", code: "RESTORE_SUBJECT_CATEGORY_SUCCESS", data: restoredSubjectCategory });
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Subject Category ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi khôi phục Subject Category", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectCategoryStatistics = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectCategoryServiceRef.subjectCategoryExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const isDeleted = await subjectCategoryServiceRef.subjectCategoryIsDeleted(id);
    if (isDeleted) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Category", code: "SUBJECT_CATEGORY_NOT_FOUND", data: null });

    const stats = await subjectCategoryServiceRef.getSubjectCategoryStatistics(id);
    return reply.status(200).send({ success: true, message: "Lấy thống kê subject category th� nh công", code: "GET_SUBJECT_CATEGORY_STATISTICS_SUCCESS", data: stats });
  } catch (error) {
    logger.error(`Lỗi khi lấy thống kê Subject Category ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy thống kê Subject Category", code: "SERVER_ERROR", data: null });
  }
};



