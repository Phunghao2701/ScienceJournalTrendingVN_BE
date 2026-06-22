import * as volumeService from "../services/volume.service.js";
import logger from "../utils/logger.js";

// Export một reference của service để hỗ trợ mocking trong unit tests
export const volumeServiceRef = { ...volumeService };

/**
 * API tạo mới một Volume.
 */
export const createVolume = async (req, res) => {
  try {
    const { journal_id, volume_number, publication_year } = req.body;
    const newVolume = await volumeServiceRef.createVolume({
      journal_id,
      volume_number,
      publication_year,
    });

    return res.status(201).json({
      success: true,
      code: "CREATE_VOLUME_SUCCESS",
      message: "Tạo Volume thành công",
      data: newVolume,
    });
  } catch (error) {
    logger.error("Lỗi khi tạo Volume ở controller:", error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi tạo mới Volume",
    });
  }
};

/**
 * API lấy danh sách Volume có hỗ trợ phân trang, lọc, sắp xếp và tìm kiếm.
 */
export const getVolumes = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      journal_id,
      publication_year,
      sort_by,
      sort_order,
    } = req.query;
    const { items, total } = await volumeServiceRef.getVolumes({
      page,
      limit,
      search,
      journal_id,
      publication_year,
      sort_by,
      sort_order,
    });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return res.status(200).json({
      success: true,
      code: "GET_VOLUMES_SUCCESS",
      message: "Lấy danh sách volume thành công",
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      },
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách Volume ở controller:", error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi lấy danh sách Volume",
    });
  }
};

/**
 * API lấy chi tiết một Volume theo ID.
 */
export const getVolumeById = async (req, res) => {
  try {
    const { id } = req.params;
    const volume = await volumeServiceRef.getVolumeById(id);

    if (!volume) {
      return res.status(404).json({
        success: false,
        code: "VOLUME_NOT_FOUND",
        message: "Không tìm thấy volume hoặc volume đã bị xóa mềm",
      });
    }

    return res.status(200).json({
      success: true,
      code: "GET_VOLUME_DETAIL_SUCCESS",
      message: "Lấy chi tiết volume thành công",
      data: volume,
    });
  } catch (error) {
    logger.error(
      `Lỗi khi lấy chi tiết Volume ID ${req.params.id} ở controller:`,
      error.message,
    );
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi lấy thông tin chi tiết Volume",
    });
  }
};

/**
 * API cập nhật thông tin Volume.
 */
export const updateVolume = async (req, res) => {
  try {
    const { id } = req.params;
    const { volume_number, publication_year } = req.body;

    const updatedVolume = await volumeServiceRef.updateVolume(id, {
      volume_number,
      publication_year,
    });

    return res.status(200).json({
      success: true,
      code: "UPDATE_VOLUME_SUCCESS",
      message: "Cập nhật Volume thành công",
      data: updatedVolume,
    });
  } catch (error) {
    logger.error(
      `Lỗi khi cập nhật Volume ID ${req.params.id} ở controller:`,
      error.message,
    );
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi cập nhật Volume",
    });
  }
};

/**
 * API xóa mềm một Volume (is_deleted = true).
 */
export const deleteVolume = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra sự tồn tại
    const exists = await volumeServiceRef.volumeExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        code: "VOLUME_NOT_FOUND",
        message: "Volume không tồn tại",
      });
    }

    // 2. Kiểm tra nếu đã bị xóa mềm
    const isDeleted = await volumeServiceRef.volumeIsDeleted(id);
    if (isDeleted) {
      return res.status(400).json({
        success: false,
        code: "VOLUME_ALREADY_DELETED",
        message: "Không delete volume đã bị delete",
      });
    }

    // 3. Thực hiện xóa mềm
    const deletedVolume = await volumeServiceRef.deleteVolume(id);

    return res.status(200).json({
      success: true,
      code: "DELETE_VOLUME_SUCCESS",
      message: "Xóa Volume thành công",
      data: deletedVolume,
    });
  } catch (error) {
    logger.error(
      `Lỗi khi xóa mềm Volume ID ${req.params.id} ở controller:`,
      error.message,
    );
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi xóa Volume",
    });
  }
};

/**
 * API khôi phục một Volume đã bị xóa mềm (is_deleted = false).
 */
export const restoreVolume = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra sự tồn tại
    const exists = await volumeServiceRef.volumeExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        code: "VOLUME_NOT_FOUND",
        message: "Volume không tồn tại",
      });
    }

    // 2. Kiểm tra nếu chưa bị xóa mềm
    const isDeleted = await volumeServiceRef.volumeIsDeleted(id);
    if (!isDeleted) {
      return res.status(400).json({
        success: false,
        code: "VOLUME_NOT_DELETED",
        message: "Không khôi phục volume chưa bị delete",
      });
    }

    // 3. Thực hiện khôi phục
    const restoredVolume = await volumeServiceRef.restoreVolume(id);

    return res.status(200).json({
      success: true,
      code: "RESTORE_VOLUME_SUCCESS",
      message: "Khôi phục Volume thành công",
      data: restoredVolume,
    });
  } catch (error) {
    logger.error(
      `Lỗi khi khôi phục Volume ID ${req.params.id} ở controller:`,
      error.message,
    );
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi khôi phục Volume",
    });
  }
};
