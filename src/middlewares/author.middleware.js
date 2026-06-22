export const AUTHOR_CODES = {
  // Success
  AUTHOR_LIST_FETCHED: "AUTHOR_LIST_FETCHED",
  AUTHOR_FETCHED: "AUTHOR_FETCHED",
  AUTHOR_CREATED: "AUTHOR_CREATED",
  AUTHOR_UPDATED: "AUTHOR_UPDATED",
  AUTHOR_DELETED: "AUTHOR_DELETED",
  AUTHOR_RESTORED: "AUTHOR_RESTORED",
  AUTHOR_INVALID_LIMIT: "AUTHOR_INVALID_LIMIT",
  AUTHOR_ARTICLES_FETCHED: "AUTHOR_ARTICLES_FETCHED",
  AUTHOR_LEADERBOARD_FETCHED: "AUTHOR_LEADERBOARD_FETCHED",
  // Custom code for area breakdown
  AREA_BREAKDOWN_FETCHED: "AREA_BREAKDOWN_FETCHED",

  // Client errors
  AUTHOR_INVALID_ID: "AUTHOR_INVALID_ID",
  AUTHOR_INVALID_BODY: "AUTHOR_INVALID_BODY",
  AUTHOR_NOT_FOUND: "AUTHOR_NOT_FOUND",
  AUTHOR_ALREADY_DELETED: "AUTHOR_ALREADY_DELETED",
  AUTHOR_ALREADY_ACTIVE: "AUTHOR_ALREADY_ACTIVE",
  AUTHOR_INVALID_PAGINATION: "AUTHOR_INVALID_PAGINATION",

  // Server error
  AUTHOR_SERVER_ERROR: "AUTHOR_SERVER_ERROR",
};

// Biểu thức Regex kiểm tra tên hợp lệ (Chữ, số, khoảng trắng, ., -, ')
// Hỗ trợ đầy đủ tiếng Việt Unicode nhờ flag /u (Unicode)
const VALID_NAME_REGEX = /^[\p{L}]+(?:[\s'-][\p{L}]+)*$/u;
/**
 * Validate author ID từ params
 */
export const validateAuthorId = (req, res, next) => {
  const idParam = req.params.id;

  // Kiểm tra nếu ID chứa ký tự lạ không phải là số (ví dụ: "2dsaf", "abc")
  if (!/^\d+$/.test(idParam)) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_ID,
      message: "ID tác giả không hợp lệ, phải là số nguyên dương",
    });
  }

  const id = parseInt(idParam, 10);
  if (id <= 0) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_ID,
      message: "ID tác giả không hợp lệ, phải lớn hơn 0",
    });
  }

  req.authorId = id;
  next();
};

/**
 * Validate pagination (page, limit)
 */
export const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION,
      message: "Giá trị page không hợp lệ, phải >= 1",
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION,
      message: "Giá trị limit không hợp lệ, phải từ 1 đến 100",
    });
  }

  req.pagination = { page, limit };
  next();
};

/**
 * Validate body khi tạo mới author
 */
export const validateCreateAuthor = (req, res, next) => {
  const { display_name } = req.body;

  if (!display_name || display_name.trim() === "") {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
      message: "display_name không được để trống",
    });
  }

  const trimmedName = display_name.trim();

  if (trimmedName.length < 2) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
      message: "display_name phải có ít nhất 2 ký tự",
    });
  }

  if (trimmedName.length > 255) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
      message: "display_name không được vượt quá 255 ký tự",
    });
  }

  if (/<[^>]*>/.test(trimmedName)) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
      message: "display_name không được chứa HTML hoặc script",
    });
  }

  // --- ĐOẠN FIX: Kiểm tra ký tự đặc biệt ---
  if (!VALID_NAME_REGEX.test(trimmedName)) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
      message:
        "display_name không được chứa ký tự đặc biệt (ví dụ: @, !, #, ...)",
    });
  }

  req.body.display_name = trimmedName;
  next();
};

/**
 * Validate body khi update author
 */
export const validateUpdateAuthor = (req, res, next) => {
  const allowedFields = [
    "display_name",
    "orcid",
    "url_image",
    "homepage_url",
    "works_count",
    "cited_by_count",
    "h_index",
    "i10_index",
    "last_known_institution",
    "last_known_institution_id",
  ];

  const body = req.body;

  // Kiểm tra có ít nhất 1 field hợp lệ
  const hasValidField = allowedFields.some((f) => body[f] !== undefined);
  if (!hasValidField) {
    return res.status(400).json({
      success: false,
      code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
      message: "Cần có ít nhất một field hợp lệ để cập nhật",
    });
  }

  // Validate display_name nếu có
  if (body.display_name !== undefined) {
    const trimmedName = body.display_name.trim();

    if (trimmedName === "") {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
        message: "display_name không được để trống",
      });
    }
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
        message: "display_name phải có ít nhất 2 ký tự",
      });
    }
    if (/<[^>]*>/.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
        message: "display_name không được chứa HTML hoặc script",
      });
    }

    // --- ĐOẠN FIX: Kiểm tra ký tự đặc biệt ---
    if (!VALID_NAME_REGEX.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
        message:
          "display_name không được chứa ký tự đặc biệt (ví dụ: @, !, #, ...)",
      });
    }

    req.body.display_name = trimmedName;
  }

  // Validate số nguyên nếu có
  const intFields = ["works_count", "cited_by_count", "h_index", "i10_index"];
  for (const field of intFields) {
    if (body[field] !== undefined) {
      const val = parseInt(body[field]);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({
          success: false,
          code: AUTHOR_CODES.AUTHOR_INVALID_BODY,
          message: `${field} phải là số nguyên không âm`,
        });
      }
    }
  }

  next();
};
