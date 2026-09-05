import * as volumeService from '../services/volume.service.js';
import logger from '../../../utils/logger.js';

export const volumeServiceRef = { ...volumeService };

export const createVolume = async (request, reply) => {
  try {
    const { journal_id, volume_number, publication_year } = request.body;
    const newVolume = await volumeServiceRef.createVolume({ journal_id, volume_number, publication_year });
    return reply.status(201).send({ success: true, code: "CREATE_VOLUME_SUCCESS", message: "Tạo Volume th� nh công", data: newVolume });
  } catch (error) {
    logger.error("Lỗi khi tạo Volume ở controller:", error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi tạo mới Volume" });
  }
};

export const getVolumes = async (request, reply) => {
  try {
    const { page, limit, search, journal_id, publication_year, sort_by, sort_order } = request.query;
    const { items, total } = await volumeServiceRef.getVolumes({ page, limit, search, journal_id, publication_year, sort_by, sort_order });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return reply.status(200).send({ success: true, code: "GET_VOLUMES_SUCCESS", message: "Lấy danh sách volume th� nh công", data: { items, pagination: { page: pageNum, limit: limitNum, total } } });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách Volume ở controller:", error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi lấy danh sách Volume" });
  }
};

export const getVolumeById = async (request, reply) => {
  try {
    const { id } = request.params;
    const volume = await volumeServiceRef.getVolumeById(id);

    if (!volume) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "Không tìm thấy volume hoặc volume đã bị xóa mềm" });
    return reply.status(200).send({ success: true, code: "GET_VOLUME_DETAIL_SUCCESS", message: "Lấy chi tiết volume th� nh công", data: volume });
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Volume ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi lấy thông tin chi tiết Volume" });
  }
};

export const updateVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const { volume_number, publication_year } = request.body;

    const updatedVolume = await volumeServiceRef.updateVolume(id, { volume_number, publication_year });
    return reply.status(200).send({ success: true, code: "UPDATE_VOLUME_SUCCESS", message: "Cập nhật Volume th� nh công", data: updatedVolume });
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Volume ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi cập nhật Volume" });
  }
};

export const deleteVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await volumeServiceRef.volumeExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "Volume không tồn tại" });

    const isDeleted = await volumeServiceRef.volumeIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: "VOLUME_ALREADY_DELETED", message: "Không delete volume đã bị delete" });

    const deletedVolume = await volumeServiceRef.deleteVolume(id);
    return reply.status(200).send({ success: true, code: "DELETE_VOLUME_SUCCESS", message: "Xóa Volume th� nh công", data: deletedVolume });
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Volume ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi xóa Volume" });
  }
};

export const restoreVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await volumeServiceRef.volumeExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "Volume không tồn tại" });

    const isDeleted = await volumeServiceRef.volumeIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, code: "VOLUME_NOT_DELETED", message: "Không khôi phục volume chưa bị delete" });

    const restoredVolume = await volumeServiceRef.restoreVolume(id);
    return reply.status(200).send({ success: true, code: "RESTORE_VOLUME_SUCCESS", message: "Khôi phục Volume th� nh công", data: restoredVolume });
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Volume ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi khôi phục Volume" });
  }
};



