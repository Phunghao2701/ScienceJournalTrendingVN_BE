import pool from "../config/database.js";
import { subjectAreaExist, subjectAreaIsDeleted, checkDuplicateSubjectArea } from "../services/subjectArea.service.js";

/**
 * Middleware kiểm tra URL parameter id phải là số nguyên dương hợp lệ.
 */
export const validateSubjectAreaId = (req, res, next) => {
  const { id } = req.params;
  const idNumber = Number(id);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    return res.status(400).json({
      success: false,
      message: "Subject Area ID không hợp lệ",
      code: "INVALID_ID",
      data: null
    });
  }

  next();
};

/**
 * Middleware kiểm tra tính hợp lệ của phân trang (page, limit).
 */
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page !== undefined && page !== null) {
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Trang (page) phải là số nguyên dương",
        code: "INVALID_PAGE",
        data: null
      });
    }
  }

  if (limit !== undefined && limit !== null) {
    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số lượng bản ghi mỗi trang (limit) phải là số nguyên dương",
        code: "INVALID_LIMIT",
        data: null
      });
    }
  }

  next();
};

/**
 * Middleware kiểm tra tính hợp lệ khi tạo mới một Subject Area.
 */
export const validateCreateSubjectArea = async (req, res, next) => {
  try {
    const { display_name } = req.body;

    // 1. Kiểm tra trường display_name
    if (display_name === undefined || display_name === null || typeof display_name !== "string" || display_name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị display_name không được để trống và phải là một chuỗi ký tự",
        code: "INVALID_DISPLAY_NAME",
        data: null
      });
    }

    // 2. Kiểm tra trùng lặp trong DB
    const { duplicateName } = await checkDuplicateSubjectArea(display_name);

    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị display_name đã tồn tại trong hệ thống",
        code: "DUPLICATE_DISPLAY_NAME",
        data: null
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu tạo Subject Area",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};

/**
 * Middleware kiểm tra tính hợp lệ khi cập nhật một Subject Area.
 */
export const validateUpdateSubjectArea = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { display_name } = req.body;

    // 1. Kiểm tra xem Subject Area có tồn tại không
    const exists = await subjectAreaExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Subject Area",
        code: "SUBJECT_AREA_NOT_FOUND",
        data: null
      });
    }

    // 2. Chặn cập nhật nếu đã bị xóa mềm
    const isDeleted = await subjectAreaIsDeleted(id);
    if (isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Subject Area đã bị xóa mềm, không thể cập nhật",
        code: "SUBJECT_AREA_ALREADY_DELETED",
        data: null
      });
    }

    // 3. Kiểm tra display_name nếu có truyền lên
    if (display_name !== undefined) {
      if (display_name === null || typeof display_name !== "string" || display_name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Tên hiển thị display_name không được để trống",
          code: "INVALID_DISPLAY_NAME",
          data: null
        });
      }
    }

    // 4. Kiểm tra trùng lặp display_name
    if (display_name !== undefined) {
      const currentRes = await pool.query(
        `SELECT display_name FROM "Subject_Area" WHERE subject_area_id = $1`,
        [BigInt(id)]
      );
      const current = currentRes.rows[0];
      const finalName = display_name;

      const { duplicateName } = await checkDuplicateSubjectArea(finalName, id);

      if (duplicateName) {
        return res.status(400).json({
          success: false,
          message: "Tên hiển thị display_name đã tồn tại trong hệ thống",
          code: "DUPLICATE_DISPLAY_NAME",
          data: null
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu cập nhật Subject Area",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};
