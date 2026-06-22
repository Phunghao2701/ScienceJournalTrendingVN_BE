import pool from "../config/database.js";
import { checkDuplicateIssue } from "../services/issue.service.js";

/**
 * Helper kiểm tra một giá trị có phải là chuỗi/số chỉ chứa các chữ số và lớn hơn 0 hay không.
 */
const isValidPositiveInt = (val) => {
  if (val === undefined || val === null || val === "") return false;
  const strVal = String(val);
  return /^\d+$/.test(strVal) && Number(strVal) > 0;
};

/**
 * Middleware kiểm tra URL parameter id phải là số nguyên dương hợp lệ.
 */
export const validateIssueId = (req, res, next) => {
  const { id } = req.params;

  if (!isValidPositiveInt(id)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ISSUE_ID",
      message: "Id không hợp lệ, phải là số nguyên dương (không chứa chữ hoặc ký tự đặc biệt)"
    });
  }

  next();
};

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào khi tạo mới Issue.
 */
export const validateCreateIssue = async (req, res, next) => {
  try {
    const { volume_id, issue_number, publication_year } = req.body;

    // 1. Kiểm tra volume_id
    if (!isValidPositiveInt(volume_id)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VOLUME_ID",
        message: "volume_id không hợp lệ, phải là số nguyên dương (không chứa chữ)"
      });
    }

    // Kiểm tra volume_id tồn tại và chưa bị xóa mềm trong DB
    const volumeRes = await pool.query(
      `SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = false`,
      [BigInt(volume_id)]
    );
    if (volumeRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        code: "VOLUME_NOT_FOUND",
        message: "volume_id không tồn tại hoặc đã bị xóa mềm trong hệ thống"
      });
    }

    // 2. Kiểm tra issue_number
    if (!isValidPositiveInt(issue_number)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ISSUE_NUMBER",
        message: "issue_number phải là số nguyên lớn hơn 0"
      });
    }

    // 3. Kiểm tra publication_year
    if (!isValidPositiveInt(publication_year)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PUBLICATION_YEAR",
        message: "Năm xuất bản không hợp lệ, phải là số nguyên dương"
      });
    }

    // 4. Kiểm tra trùng lặp issue_number trong cùng một volume
    const isDuplicate = await checkDuplicateIssue(volume_id, issue_number);
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        code: "DUPLICATE_ISSUE",
        message: "Số issue đã tồn tại trong cùng volume này"
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "SERVER_VALIDATION_ERROR",
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu tạo Issue",
      error: error.message
    });
  }
};

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào khi cập nhật Issue.
 */
export const validateUpdateIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { issue_number, publication_year } = req.body;

    // 1. Kiểm tra sự tồn tại của Issue
    const issueRes = await pool.query(
      `SELECT issue_id, volume_id, issue_number, publication_year, is_deleted FROM "Issue" WHERE issue_id = $1`,
      [BigInt(id)]
    );
    if (issueRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "ISSUE_NOT_FOUND",
        message: "Issue không tồn tại"
      });
    }

    const issue = issueRes.rows[0];

    // 2. Không cho phép cập nhật Issue đã bị xóa mềm
    if (issue.is_deleted) {
      return res.status(400).json({
        success: false,
        code: "ISSUE_ALREADY_DELETED",
        message: "Issue đã bị xóa mềm, không thể cập nhật"
      });
    }

    // 3. Kiểm tra issue_number nếu được truyền lên
    if (issue_number !== undefined) {
      if (!isValidPositiveInt(issue_number)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ISSUE_NUMBER",
          message: "issue_number phải là số nguyên lớn hơn 0"
        });
      }
    }

    // 4. Kiểm tra publication_year nếu được truyền lên
    if (publication_year !== undefined) {
      if (!isValidPositiveInt(publication_year)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PUBLICATION_YEAR",
          message: "Năm xuất bản không hợp lệ, phải là số nguyên dương"
        });
      }
    }

    // 5. Kiểm tra trùng lặp issue_number mới trong cùng một volume
    const finalIssueNum = issue_number !== undefined ? Number(issue_number) : issue.issue_number;
    const isDuplicate = await checkDuplicateIssue(issue.volume_id, finalIssueNum, id);
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        code: "DUPLICATE_ISSUE",
        message: "Số issue đã tồn tại trong cùng volume này"
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "SERVER_VALIDATION_ERROR",
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu cập nhật Issue",
      error: error.message
    });
  }
};

/**
 * Middleware kiểm tra tham số phân trang hợp lệ.
 */
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page !== undefined) {
    if (!isValidPositiveInt(page)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAGINATION",
        message: "page phải là số nguyên dương"
      });
    }
  }

  if (limit !== undefined) {
    if (!isValidPositiveInt(limit)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAGINATION",
        message: "limit phải là số nguyên dương"
      });
    }
  }

  next();
};

/**
 * Middleware kiểm tra filter volume_id khi get danh sách Issue
 */
export const validateVolumeFilter = async (req, res, next) => {
  const { volume_id } = req.query;
  if (volume_id !== undefined && volume_id !== null && volume_id !== "") {
    if (!isValidPositiveInt(volume_id)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VOLUME_ID",
        message: "volume_id không hợp lệ, phải là số nguyên dương"
      });
    }
    try {
      const volRes = await pool.query(
        `SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = false`,
        [BigInt(volume_id)]
      );
      if (volRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          code: "VOLUME_NOT_FOUND",
          message: "volume_id không tồn tại hoặc đã bị xóa mềm"
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        code: "SERVER_VALIDATION_ERROR",
        message: "Lỗi hệ thống trong quá trình kiểm tra volume_id",
        error: error.message
      });
    }
  }
  next();
};
