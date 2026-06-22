import * as issueService from "../services/issue.service.js";
import logger from "../utils/logger.js";

// Export một reference của service để hỗ trợ mocking trong unit tests
export const issueServiceRef = { ...issueService };

/**
 * API tạo mới một Issue.
 */
export const createIssue = async (req, res) => {
  try {
    const { volume_id, issue_number, publication_year } = req.body;
    const newIssue = await issueServiceRef.createIssue({
      volume_id,
      issue_number,
      publication_year
    });

    return res.status(201).json({
      success: true,
      code: "ISSUE_CREATED",
      message: "Tạo Issue thành công",
      data: newIssue
    });
  } catch (error) {
    logger.error("Lỗi khi tạo Issue ở controller:", error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi tạo mới Issue"
    });
  }
};

/**
 * API lấy danh sách Issue có hỗ trợ phân trang, lọc, sắp xếp và tìm kiếm.
 */
export const getIssues = async (req, res) => {
  try {
    const { page, limit, search, volume_id, sort_by, sort_order } = req.query;
    const { items, total } = await issueServiceRef.getIssues({
      page,
      limit,
      search,
      volume_id,
      sort_by,
      sort_order
    });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    return res.status(200).json({
      success: true,
      code: "ISSUES_FETCHED",
      message: "Lấy danh sách issue thành công",
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
    logger.error("Lỗi khi lấy danh sách Issue ở controller:", error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi lấy danh sách Issue"
    });
  }
};

/**
 * API lấy chi tiết một Issue theo ID.
 */
export const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;
    const issue = await issueServiceRef.getIssueById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        code: "ISSUE_NOT_FOUND",
        message: "Không tìm thấy issue hoặc issue đã bị xóa mềm"
      });
    }

    return res.status(200).json({
      success: true,
      code: "ISSUE_FETCHED",
      message: "Lấy chi tiết issue thành công",
      data: issue
    });
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Issue ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi lấy thông tin chi tiết Issue"
    });
  }
};

/**
 * API cập nhật thông tin Issue.
 */
export const updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { issue_number, publication_year } = req.body;

    const updatedIssue = await issueServiceRef.updateIssue(id, {
      issue_number,
      publication_year
    });

    return res.status(200).json({
      success: true,
      code: "ISSUE_UPDATED",
      message: "Cập nhật Issue thành công",
      data: updatedIssue
    });
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Issue ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi cập nhật Issue"
    });
  }
};

/**
 * API xóa mềm một Issue (is_deleted = true).
 */
export const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra sự tồn tại
    const exists = await issueServiceRef.issueExists(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        code: "ISSUE_NOT_FOUND",
        message: "Issue không tồn tại"
      });
    }

    // 2. Kiểm tra nếu đã bị xóa mềm
    const isDeleted = await issueServiceRef.issueIsDeleted(id);
    if (isDeleted) {
      return res.status(400).json({
        success: false,
        code: "ISSUE_ALREADY_DELETED",
        message: "Không delete issue đã bị delete"
      });
    }

    // 3. Thực hiện xóa mềm
    const deletedIssue = await issueServiceRef.deleteIssue(id);

    return res.status(200).json({
      success: true,
      code: "ISSUE_DELETED",
      message: "Xóa Issue thành công",
      data: deletedIssue
    });
  } catch (error) {
    logger.error(`Lỗi khi xóa mềm Issue ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi xóa Issue"
    });
  }
};

/**
 * API khôi phục một Issue đã bị xóa mềm (is_deleted = false).
 */
export const restoreIssue = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra sự tồn tại
    const exists = await issueServiceRef.issueExists(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        code: "ISSUE_NOT_FOUND",
        message: "Issue không tồn tại"
      });
    }

    // 2. Kiểm tra nếu chưa bị xóa mềm
    const isDeleted = await issueServiceRef.issueIsDeleted(id);
    if (!isDeleted) {
      return res.status(400).json({
        success: false,
        code: "ISSUE_NOT_DELETED",
        message: "Không khôi phục issue chưa bị delete"
      });
    }

    // 3. Thực hiện khôi phục
    const restoredIssue = await issueServiceRef.restoreIssue(id);

    return res.status(200).json({
      success: true,
      code: "ISSUE_RESTORED",
      message: "Khôi phục Issue thành công",
      data: restoredIssue
    });
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Issue ID ${req.params.id} ở controller:`, error.message);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi khôi phục Issue"
    });
  }
};
