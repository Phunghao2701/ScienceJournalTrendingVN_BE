import pool from "../config/database.js";
import { subjectAreaExist, subjectAreaIsDeleted } from "../services/subjectArea.service.js";
import { subjectCategoryExist, subjectCategoryIsDeleted, checkDuplicateSubjectCategory } from "../services/subjectCategory.service.js";

/**
 * Middleware kiểm tra URL parameter id phải là số nguyên dương hợp lệ.
 */
export const validateSubjectCategoryId = (req, res, next) => {
  const { id } = req.params;
  const idNumber = Number(id);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    return res.status(400).json({
      success: false,
      message: "Subject Category ID không hợp lệ",
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
 * Middleware kiểm tra tính hợp lệ khi tạo mới một Subject Category.
 */
export const validateCreateSubjectCategory = async (req, res, next) => {
  try {
    const { subject_area_id, display_name } = req.body;

    // 1. Kiểm tra trường subject_area_id
    if (subject_area_id === undefined || subject_area_id === null) {
      return res.status(400).json({
        success: false,
        message: "Mã lĩnh vực subject_area_id không được để trống",
        code: "INVALID_SUBJECT_AREA_ID",
        data: null
      });
    }

    const areaIdNum = Number(subject_area_id);
    if (!Number.isInteger(areaIdNum) || areaIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã lĩnh vực subject_area_id phải là số nguyên dương hợp lệ",
        code: "INVALID_SUBJECT_AREA_ID",
        data: null
      });
    }

    // Kiểm tra sự tồn tại và hoạt động của Subject Area
    const areaExists = await subjectAreaExist(areaIdNum);
    const areaDeleted = areaExists ? await subjectAreaIsDeleted(areaIdNum) : false;

    if (!areaExists || areaDeleted) {
      return res.status(400).json({
        success: false,
        message: "Lĩnh vực học thuật (Subject Area) không tồn tại hoặc đã bị xóa",
        code: "INVALID_SUBJECT_AREA_ID",
        data: null
      });
    }

    // 2. Kiểm tra trường display_name
    if (display_name === undefined || display_name === null || typeof display_name !== "string" || display_name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị display_name không được để trống và phải là một chuỗi ký tự",
        code: "INVALID_DISPLAY_NAME",
        data: null
      });
    }

    // 3. Kiểm tra trùng lặp display_name trong cùng subject_area_id
    const { duplicateName } = await checkDuplicateSubjectCategory(areaIdNum, display_name);

    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị display_name đã tồn tại trong lĩnh vực này",
        code: "DUPLICATE_DISPLAY_NAME",
        data: null
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu tạo Subject Category",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};

/**
 * Middleware kiểm tra tính hợp lệ khi cập nhật một Subject Category.
 */
export const validateUpdateSubjectCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject_area_id, display_name } = req.body;

    // 1. Kiểm tra sự tồn tại của Subject Category
    const exists = await subjectCategoryExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Subject Category",
        code: "SUBJECT_CATEGORY_NOT_FOUND",
        data: null
      });
    }

    // 2. Chặn cập nhật nếu đã bị xóa mềm
    const isDeleted = await subjectCategoryIsDeleted(id);
    if (isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Subject Category đã bị xóa mềm, không thể cập nhật",
        code: "SUBJECT_CATEGORY_ALREADY_DELETED",
        data: null
      });
    }

    // 3. Lấy thông tin hiện tại của Subject Category trong DB
    const currentRes = await pool.query(
      `SELECT subject_area_id, display_name FROM "Subject_Category" WHERE subject_category_id = $1`,
      [BigInt(id)]
    );
    const current = currentRes.rows[0];

    let targetAreaId = current.subject_area_id;

    // 4. Nếu cập nhật subject_area_id
    if (subject_area_id !== undefined) {
      if (subject_area_id === null) {
        return res.status(400).json({
          success: false,
          message: "Mã lĩnh vực subject_area_id không được để trống",
          code: "INVALID_SUBJECT_AREA_ID",
          data: null
        });
      }

      const areaIdNum = Number(subject_area_id);
      if (!Number.isInteger(areaIdNum) || areaIdNum <= 0) {
        return res.status(400).json({
          success: false,
          message: "Mã lĩnh vực subject_area_id phải là số nguyên dương hợp lệ",
          code: "INVALID_SUBJECT_AREA_ID",
          data: null
        });
      }

      const areaExists = await subjectAreaExist(areaIdNum);
      const areaDeleted = areaExists ? await subjectAreaIsDeleted(areaIdNum) : false;

      if (!areaExists || areaDeleted) {
        return res.status(400).json({
          success: false,
          message: "Lĩnh vực học thuật (Subject Area) không tồn tại hoặc đã bị xóa",
          code: "INVALID_SUBJECT_AREA_ID",
          data: null
        });
      }

      targetAreaId = BigInt(areaIdNum);
    }

    // 5. Nếu cập nhật display_name
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

    // 6. Kiểm tra trùng lặp display_name trong cùng targetAreaId
    const finalName = display_name !== undefined ? display_name : current.display_name;

    const { duplicateName } = await checkDuplicateSubjectCategory(targetAreaId, finalName, id);

    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị display_name đã tồn tại trong lĩnh vực này",
        code: "DUPLICATE_DISPLAY_NAME",
        data: null
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu cập nhật Subject Category",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};
