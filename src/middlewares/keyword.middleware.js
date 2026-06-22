import {
  checkProjectOwnership,
  validateKeywordIds,
} from "../services/keyword.service.js";

export const KEYWORD_CODES = {
  // Success
  KEYWORD_FETCHED: "KEYWORD_FETCHED",
  KEYWORD_LIST_FETCHED: "KEYWORD_LIST_FETCHED",
  KEYWORD_CREATED: "KEYWORD_CREATED",
  KEYWORD_UPDATED: "KEYWORD_UPDATED",
  KEYWORD_DELETED: "KEYWORD_DELETED",
  KEYWORD_RESTORED: "KEYWORD_RESTORED",

  // Client errors
  KEYWORD_INVALID_ID: "KEYWORD_INVALID_ID",
  KEYWORD_INVALID_BODY: "KEYWORD_INVALID_BODY",
  KEYWORD_NOT_FOUND: "KEYWORD_NOT_FOUND",
  KEYWORD_DUPLICATE: "KEYWORD_DUPLICATE",
  KEYWORD_ALREADY_DELETED: "KEYWORD_ALREADY_DELETED",
  KEYWORD_ALREADY_ACTIVE: "KEYWORD_ALREADY_ACTIVE",

  // Project/Watched specific codes (Đã chuẩn hóa đồng bộ)
  PROJECT_INVALID_ID: "PROJECT_INVALID_ID",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",

  // Server error
  KEYWORD_SERVER_ERROR: "KEYWORD_SERVER_ERROR",
};

/**
 * Validate display_name cho keyword
 * Dùng cho POST và PUT trực tiếp vào bảng Keyword
 */
export const validateKeywordBody = (req, res, next) => {
  const display_name = req.body.display_name?.trim();

  if (!display_name) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "Tên keyword không được để trống",
    });
  }
  if (display_name.length < 2) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "Tên keyword phải có ít nhất 2 ký tự",
    });
  }
  if (display_name.length > 255) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "Tên keyword không được vượt quá 255 ký tự",
    });
  }
  if (/[!@#$%^&*()_+={}\[\]|\\:;"'<>,?\/~`]/.test(display_name)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "Tên keyword không được chứa ký tự đặc biệt",
    });
  }
  if (/<[^>]*>/.test(display_name)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "Tên keyword không được chứa HTML hoặc script",
    });
  }

  req.body.display_name = display_name;
  next();
};

/**
 * Validate ID của bảng Keyword chính
 */
export const validateKeywordId = (req, res, next) => {
  const idParam = req.params.id;

  // CHÈN FIX: Kiểm tra nếu ID chứa bất kỳ ký tự chữ hoặc ký tự đặc biệt nào (ví dụ: "2dsaf", "abc")
  if (!/^\d+$/.test(idParam)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_ID,
      message: "ID từ đường dẫn không hợp lệ, phải là số nguyên dương",
    });
  }

  const id = parseInt(idParam, 10);
  if (id <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_ID,
      message: "ID phải lớn hơn 0",
    });
  }

  req.keywordId = id;
  next();
};

/**
 * Middleware validate các tham số và quyền cho việc xóa từ khóa theo dõi.
 */
export const validateDeleteWatchedKeyword = async (req, res, next) => {
  const projectId = parseInt(req.params.id);
  const keywordId = parseInt(req.params.keywordId);

  if (isNaN(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.PROJECT_INVALID_ID,
      message: "ID dự án không hợp lệ",
    });
  }

  if (isNaN(keywordId) || keywordId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_ID,
      message: "ID từ khóa không hợp lệ",
    });
  }

  const userId = req.user.user_id;
  try {
    const isOwner = await checkProjectOwnership(projectId, userId);

    if (!isOwner) {
      return res.status(404).json({
        success: false,
        code: KEYWORD_CODES.PROJECT_NOT_FOUND,
        message:
          "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_SERVER_ERROR,
      message: "Lỗi hệ thống khi xác thực quyền truy cập dự án",
    });
  }
};

/**
 * Middleware validate các tham số và quyền cho việc ghi đè (thay thế) danh sách từ khóa theo dõi.
 */
export const validateUpdateWatchedKeywords = async (req, res, next) => {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.PROJECT_INVALID_ID,
      message: "ID dự án không hợp lệ",
    });
  }

  const { keyword_ids } = req.body || {};

  if (!Array.isArray(keyword_ids)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "keyword_ids phải là một mảng",
    });
  }

  if (keyword_ids.length > 0) {
    const isValid = keyword_ids.every((id) => Number.isInteger(id) && id > 0);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
        message: "Các phần tử trong keyword_ids phải là số nguyên dương",
      });
    }
  }

  const userId = req.user.user_id;
  try {
    const isOwner = await checkProjectOwnership(projectId, userId);

    if (!isOwner) {
      return res.status(404).json({
        success: false,
        code: KEYWORD_CODES.PROJECT_NOT_FOUND,
        message:
          "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này",
      });
    }

    if (keyword_ids.length > 0) {
      const allExist = await validateKeywordIds(keyword_ids);
      if (!allExist) {
        return res.status(400).json({
          success: false,
          code: KEYWORD_CODES.KEYWORD_NOT_FOUND,
          message: "Một hoặc nhiều ID từ khóa không tồn tại trong hệ thống",
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_SERVER_ERROR,
      message: "Lỗi hệ thống khi xác thực quyền truy cập dự án",
    });
  }
};

/**
 * Middleware validate các tham số và quyền cho việc tạo mới (thêm nhiều) từ khóa theo dõi.
 */
export const validateCreateWatchedKeyword = async (req, res, next) => {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.PROJECT_INVALID_ID,
      message: "ID dự án không hợp lệ",
    });
  }

  const { keyword_ids } = req.body || {};

  if (!Array.isArray(keyword_ids)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "keyword_ids phải là một mảng",
    });
  }

  if (keyword_ids.length > 0) {
    const isValid = keyword_ids.every((id) => Number.isInteger(id) && id > 0);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
        message: "Các phần tử trong keyword_ids phải là số nguyên dương",
      });
    }
  }

  const userId = req.user.user_id;
  try {
    const isOwner = await checkProjectOwnership(projectId, userId);

    if (!isOwner) {
      return res.status(404).json({
        success: false,
        code: KEYWORD_CODES.PROJECT_NOT_FOUND,
        message:
          "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này",
      });
    }

    if (keyword_ids.length > 0) {
      const allExist = await validateKeywordIds(keyword_ids);
      if (!allExist) {
        return res.status(400).json({
          success: false,
          code: KEYWORD_CODES.KEYWORD_NOT_FOUND,
          message: "Một hoặc nhiều ID từ khóa không tồn tại trong hệ thống",
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_SERVER_ERROR,
      message: "Lỗi hệ thống khi xác thực quyền truy cập dự án",
    });
  }
};
