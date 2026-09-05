import * as subjectAreaService from '../services/subjectArea.service.js';
import logger from '../../../utils/logger.js';

export const subjectAreaServiceRef = { ...subjectAreaService };

export const createSubjectArea = async (request, reply) => {
  try {
    const { display_name, description } = request.body;
    const newSubjectArea = await subjectAreaServiceRef.createSubjectArea({ display_name, description });
    return reply.status(201).send({ success: true, message: "Tạo Subject Area th� nh công", code: "CREATE_SUBJECT_AREA_SUCCESS", data: newSubjectArea });
  } catch (error) {
    logger.error("Lỗi khi tạo Subject Area ở controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi tạo mới Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectAreas = async (request, reply) => {
  try {
    const { page, limit, search, sort_by, sort_order } = request.query;
    const { items, total } = await subjectAreaServiceRef.getSubjectAreas({ page, limit, search, sort_by, sort_order });
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return reply.status(200).send({ success: true, message: "Lấy danh sách subject area th� nh công", code: "GET_SUBJECT_AREAS_SUCCESS", data: { items, pagination: { page: pageNum, limit: limitNum, total } } });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách Subject Area ở controller:", error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy danh sách Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectAreaById = async (request, reply) => {
  try {
    const { id } = request.params;
    const subjectArea = await subjectAreaServiceRef.getSubjectAreaById(id);
    if (!subjectArea) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    return reply.status(200).send({ success: true, message: "Lấy chi tiết subject area th� nh công", code: "GET_SUBJECT_AREA_SUCCESS", data: subjectArea });
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Subject Area ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy thông tin chi tiết Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const updateSubjectArea = async (request, reply) => {
  try {
    const { id } = request.params;
    const { display_name, description } = request.body;
    const updatedSubjectArea = await subjectAreaServiceRef.updateSubjectArea(id, { display_name, description });

    return reply.status(200).send({ success: true, message: "Cập nhật Subject Area th� nh công", code: "UPDATE_SUBJECT_AREA_SUCCESS", data: updatedSubjectArea });
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Subject Area ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi cập nhật Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const deleteSubjectArea = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, message: "Không delete subject area đã bị delete", code: "SUBJECT_AREA_ALREADY_DELETED", data: null });

    const deletedSubjectArea = await subjectAreaServiceRef.deleteSubjectArea(id);
    return reply.status(200).send({ success: true, message: "Xóa Subject Area th� nh công", code: "DELETE_SUBJECT_AREA_SUCCESS", data: deletedSubjectArea });
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Subject Area ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi xóa Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const restoreSubjectArea = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, message: "Không khôi phục subject area chưa bị delete", code: "SUBJECT_AREA_NOT_DELETED", data: null });

    const restoredSubjectArea = await subjectAreaServiceRef.restoreSubjectArea(id);
    return reply.status(200).send({ success: true, message: "Khôi phục Subject Area th� nh công", code: "RESTORE_SUBJECT_AREA_SUCCESS", data: restoredSubjectArea });
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Subject Area ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi khôi phục Subject Area", code: "SERVER_ERROR", data: null });
  }
};

export const getSubjectAreaStatistics = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (isDeleted) return reply.status(404).send({ success: false, message: "Không tìm thấy Subject Area", code: "SUBJECT_AREA_NOT_FOUND", data: null });

    const stats = await subjectAreaServiceRef.getSubjectAreaStatistics(id);
    return reply.status(200).send({ success: true, message: "Lấy thống kê subject area th� nh công", code: "GET_SUBJECT_AREA_STATISTICS_SUCCESS", data: stats });
  } catch (error) {
    logger.error(`Lỗi khi lấy thống kê Subject Area ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, message: "Lỗi hệ thống khi lấy thống kê Subject Area", code: "SERVER_ERROR", data: null });
  }
};



