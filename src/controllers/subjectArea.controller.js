import * as subjectAreaService from "../services/subjectArea.service.js";
import logger from "../utils/logger.js";

// Export một reference của service để hỗ trợ mocking trong unit tests
export const subjectAreaServiceRef = { ...subjectAreaService };

/**
 * API tạo mới một Subject Area.
 */
export const createSubjectArea = async (req, res) => {
  try {
    const { display_name, description } = req.body;
    const newSubjectArea = await subjectAreaServiceRef.createSubjectArea({
      display_name,
      description
    });

    return res.status(201).json({
      success: true,
      message: "Tạo Subject Area thành công",
      code: "CREATE_SUBJECT_AREA_SUCCESS",
      data: newSubjectArea
    });
  } catch (error) {
    logger.error("Lỗi khi tạo Subject Area ở controller:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo mới Subject Area",
      code: "SERVER_ERROR",
      data: null
    });
  }
};

/**
 * API lấy danh sách Subject Area có hỗ trợ phân trang, lọc và tìm kiếm.
 */
export const getSubjectAreas = async (req, res) => {
  try {
    const { page, limit, search, sort_by, sort_order } = req.query;
    const { items, total } = await subjectAreaServiceRef.getSubjectAreas({
      page,
      limit,
      search,
      sort_by,
      sort_order
    });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách subject area thành công",
      code: "GET_SUBJECT_AREAS_SUCCESS",
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total
        }
      }
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách Subject Area ở controller:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách Subject Area",
      code: "SERVER_ERROR",
      data: null
    });
  }
};

/**
 * API lấy chi tiết một Subject Area theo ID.
 */
export const getSubjectAreaById = async (req, res) => {
  try {
    const { id } = req.params;
    const subjectArea = await subjectAreaServiceRef.getSubjectAreaById(id);

    if (!subjectArea) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Subject Area",
        code: "SUBJECT_AREA_NOT_FOUND",
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy chi tiết subject area thành công",
      code: "GET_SUBJECT_AREA_SUCCESS",
      data: subjectArea
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Subject Area ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy thông tin chi tiết Subject Area",
      code: "SERVER_ERROR",
      data: null
    });
  }
};

/**
 * API cập nhật thông tin Subject Area.
 */
export const updateSubjectArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, description } = req.body;

    const updatedSubjectArea = await subjectAreaServiceRef.updateSubjectArea(id, {
      display_name,
      description
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật Subject Area thành công",
      code: "UPDATE_SUBJECT_AREA_SUCCESS",
      data: updatedSubjectArea
    });
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Subject Area ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật Subject Area",
      code: "SERVER_ERROR",
      data: null
    });
  }
};

/**
 * API xóa mềm một Subject Area.
 */
export const deleteSubjectArea = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra tồn tại
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Subject Area",
        code: "SUBJECT_AREA_NOT_FOUND",
        data: null
      });
    }

    // 2. Kiểm tra nếu đã bị xóa mềm
    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Không delete subject area đã bị delete",
        code: "SUBJECT_AREA_ALREADY_DELETED",
        data: null
      });
    }

    // 3. Thực hiện xóa mềm
    const deletedSubjectArea = await subjectAreaServiceRef.deleteSubjectArea(id);

    return res.status(200).json({
      success: true,
      message: "Xóa Subject Area thành công",
      code: "DELETE_SUBJECT_AREA_SUCCESS",
      data: deletedSubjectArea
    });
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Subject Area ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa Subject Area",
      code: "SERVER_ERROR",
      data: null
    });
  }
};

/**
 * API khôi phục một Subject Area đã bị xóa mềm.
 */
export const restoreSubjectArea = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra tồn tại
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Subject Area",
        code: "SUBJECT_AREA_NOT_FOUND",
        data: null
      });
    }

    // 2. Kiểm tra nếu chưa bị xóa mềm
    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (!isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Không khôi phục subject area chưa bị delete",
        code: "SUBJECT_AREA_NOT_DELETED",
        data: null
      });
    }

    // 3. Thực hiện khôi phục
    const restoredSubjectArea = await subjectAreaServiceRef.restoreSubjectArea(id);

    return res.status(200).json({
      success: true,
      message: "Khôi phục Subject Area thành công",
      code: "RESTORE_SUBJECT_AREA_SUCCESS",
      data: restoredSubjectArea
    });
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Subject Area ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khôi phục Subject Area",
      code: "SERVER_ERROR",
      data: null
    });
  }
};

/**
 * API lấy thống kê liên quan tới Subject Area.
 */
export const getSubjectAreaStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra tồn tại
    const exists = await subjectAreaServiceRef.subjectAreaExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Subject Area",
        code: "SUBJECT_AREA_NOT_FOUND",
        data: null
      });
    }

    // 2. Chặn nếu đã bị xóa mềm
    const isDeleted = await subjectAreaServiceRef.subjectAreaIsDeleted(id);
    if (isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Subject Area",
        code: "SUBJECT_AREA_NOT_FOUND",
        data: null
      });
    }

    // 3. Lấy dữ liệu thống kê
    const stats = await subjectAreaServiceRef.getSubjectAreaStatistics(id);

    return res.status(200).json({
      success: true,
      message: "Lấy thống kê subject area thành công",
      code: "GET_SUBJECT_AREA_STATISTICS_SUCCESS",
      data: stats
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy thống kê Subject Area ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy thống kê Subject Area",
      code: "SERVER_ERROR",
      data: null
    });
  }
};
