import * as journalService from '../services/journal.service.js';
import * as adminService from '../services/admin.service.js';
import * as logService from '../services/log.service.js';
import logger from '../utils/logger.js';

/**
 * Controller lấy dữ liệu tổng quan cho một tạp chí (Repository Summary).
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
export const getJournalRepositorySummary = async (req, res) => {
  try {
    const { journalId } = req.params;

    // Kiểm tra sự tồn tại của Journal trước khi query
    const journalExists = await journalService.journalExist(journalId);
    if (!journalExists) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy tạp chí với ID: ${journalId}`,
        errorCode: 'JOURNAL_NOT_FOUND',
      });
    }

    const summaryData = await journalService.getJournalRepositorySummary(journalId);

    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu tổng quan của kho lưu trữ thành công',
      data: summaryData,
    });
  } catch (error) {
    logger.error('[Admin Controller] Lỗi khi lấy repository summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy dữ liệu tổng quan',
      errorCode: 'INTERNAL_ERROR',
    });
  }
};

export const summary = async (req, res) => {
  try {
    const data = await adminService.summary();
    return res.status(200).json({
      success: true,
      code: "GET_SUMMARY_SUCCESS",
      message: "Lấy số liệu thống kê tổng quan thành công",
      data,
    });
  } catch (error) {
    logger.error("[Admin Controller] Lỗi get summary:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống server" });
  }
};

export const publicationTrends = async (req, res) => {
  try {
    const { year, limit } = req.query;
    const data = await adminService.getPublicationTrends(year, limit);
    return res.status(200).json({
      success: true,
      code: "GET_PUBLICATION_TRENDS_SUCCESS",
      message: "Lấy dữ liệu biểu đồ xu hướng xuất bản thành công",
      data,
    });
  } catch (error) {
    logger.error("[Admin Controller] Lỗi get publication trends:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống server" });
  }
};

export const getVolumeIssueStatus = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await adminService.getVolumeIssueStatus({ page, limit });
    return res.status(200).json({
      success: true,
      code: "GET_VOLUME_ISSUE_STATUS_SUCCESS",
      message: "Lấy danh sách Volume & Issue Status thành công",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("[Admin Controller] Lỗi get volume issue status:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống server" });
  }
};

export const exportVolumeIssueStatusCSV = async (req, res) => {
  try {
    const data = await adminService.exportVolumeIssueStatus();

    if (!data || data.length === 0) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="volume_issue_status.csv"');
      return res.status(200).send("volume_id,volume_number,publication_year,journal_name,total_issues,status,progress\n");
    }

    const header = Object.keys(data[0]).join(",") + "\n";
    const rows = data
      .map((row) => {
        return Object.values(row)
          .map((val) => {
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(",");
      })
      .join("\n");

    // Thêm BOM (\uFEFF) để Excel hiển thị đúng chuẩn tiếng Việt (UTF-8)
    const csvContent = "\uFEFF" + header + rows;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="volume_issue_status.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    logger.error("[Admin Controller] Lỗi export CSV:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống server" });
  }
};

export const getRecentActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Dùng getLogs từ log.service.js để lấy lịch sử hoạt động
    const result = await logService.getLogs({ page, limit });
    
    return res.status(200).json({
      success: true,
      code: "GET_RECENT_ACTIVITIES_SUCCESS",
      message: "Lấy danh sách hoạt động gần đây thành công",
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("[Admin Controller] Lỗi get recent activities:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống server" });
  }
};