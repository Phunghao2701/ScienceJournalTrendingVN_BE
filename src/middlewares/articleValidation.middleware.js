import { articleExists } from "../services/article.service.js";
import { checkAuthorsExistence } from "../services/author.service.js";

/**
 * Middleware validate cho hàm tạo Bài báo (createArticle)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateCreateArticle = async (req, res, next) => {
  const {
    title,
    publication_year,
    issue_id,
    primary_topic,
    sub_topic,
    authors,
    keywords,
  } = req.body;

  // --- Validate các trường bắt buộc & định dạng cơ bản ---
  if (!title || title.trim() === "") {
    return res.status(400).json({ success: false, code: "TITLE_REQUIRED", message: "Title is required" });
  }
  if (publication_year === undefined || publication_year === null) {
    return res.status(400).json({ success: false, code: "PUBLICATION_YEAR_REQUIRED", message: "Publication year is required" });
  }
  if (typeof publication_year !== "number") {
    return res.status(400).json({ success: false, code: "PUBLICATION_YEAR_INVALID", message: "Publication year must be a number" });
  }
  if (issue_id !== undefined && issue_id !== null && typeof issue_id !== "number") {
    return res.status(400).json({ success: false, code: "ISSUE_ID_INVALID", message: "Issue ID must be a number" });
  }
  if (primary_topic !== undefined && primary_topic !== null && typeof primary_topic !== "number") {
    return res.status(400).json({ success: false, code: "PRIMARY_TOPIC_INVALID", message: "Primary topic must be a number" });
  }

  // --- Validate mảng Authors ---
  if (authors !== undefined && !Array.isArray(authors)) {
    return res.status(400).json({
      success: false,
      code: "AUTHORS_INVALID",
      message: "Authors must be an array of author IDs",
    });
  }
  if (Array.isArray(authors)) {
    if (!authors.every((id) => Number.isInteger(id))) {
      return res.status(400).json({ success: false, code: "AUTHORS_INVALID", message: "Each author ID must be an integer" });
    }
    
    // Kiểm tra các tác giả có tồn tại trong DB không
    if (authors.length > 0) {
      try {
        const authorIdsNotExist = await checkAuthorsExistence(authors);
        if (authorIdsNotExist.length > 0) {
          return res.status(400).json({
            success: false,
            code: "AUTHORS_NOT_FOUND",
            message: `Các tác giả với ID sau không tồn tại: ${authorIdsNotExist.join(", ")}`,
          });
        }
      } catch (error) {
        return res.status(500).json({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Lỗi hệ thống khi xác thực tác giả!" });
      }
    }
  }

  // --- Validate cấu trúc Keywords ---
  if (keywords !== undefined && keywords !== null) {
    if (Array.isArray(keywords)) {
      if (!keywords.every((kw) => typeof kw === "string")) {
        return res.status(400).json({
          success: false,
          code: "KEYWORDS_INVALID",
          message: "Each keyword must be a string when keywords is an array",
        });
      }
    } else if (typeof keywords === "object") {
      const invalidKeyword = Object.entries(keywords).find(
        ([keyword, score]) =>
          typeof keyword !== "string" ||
          keyword.trim() === "" ||
          typeof score !== "number",
      );
      if (invalidKeyword) {
        return res.status(400).json({
          success: false,
          code: "KEYWORDS_INVALID",
          message: "Keywords must be an object mapping string keyword names to numeric scores",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        code: "KEYWORDS_INVALID",
        message: "Keywords must be an array or object",
      });
    }
  }

  // --- Validate mảng Sub_topic ---
  if (sub_topic !== undefined && !Array.isArray(sub_topic)) {
    return res.status(400).json({
      success: false,
      code: "SUB_TOPIC_INVALID",
      message: "Sub_topic must be an array of strings or IDs",
    });
  }
  if (Array.isArray(sub_topic) && !sub_topic.every((item) => typeof item === "string" || Number.isInteger(item))) {
    return res.status(400).json({
      success: false,
      code: "SUB_TOPIC_INVALID",
      message: "Each sub_topic item must be a string or integer",
    });
  }

  next(); // Dữ liệu hợp lệ, chuyển tiếp sang Controller
};

/**
 * Middleware validate cho hàm cập nhật Bài báo (updateArticle)
 * Cho phép các trường có thể không tồn tại (undefined) nhưng nếu có thì phải đúng định dạng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateUpdateArticle = (req, res, next) => {
  const dataBody = req.body;

  if (dataBody.sub_topic !== undefined && !Array.isArray(dataBody.sub_topic)) {
    return res.status(400).json({
      success: false,
      code: "SUB_TOPIC_INVALID",
      message: "sub_topic phải là mảng",
    });
  }

  if (dataBody.authors !== undefined && !Array.isArray(dataBody.authors)) {
    return res.status(400).json({
      success: false,
      code: "AUTHORS_INVALID",
      message: "authors phải là mảng",
    });
  }

  if (dataBody.keywords !== undefined) {
    if (Array.isArray(dataBody.keywords)) {
      if (!dataBody.keywords.every((kw) => typeof kw === "string")) {
        return res.status(400).json({
          success: false,
          code: "KEYWORDS_INVALID",
          message: "Each keyword must be a string when keywords is an array",
        });
      }
    } else if (dataBody.keywords !== null && typeof dataBody.keywords === "object") {
      const invalidKeyword = Object.entries(dataBody.keywords).find(
        ([keyword, score]) =>
          typeof keyword !== "string" ||
          keyword.trim() === "" ||
          typeof score !== "number",
      );
      if (invalidKeyword) {
        return res.status(400).json({
          success: false,
          code: "KEYWORDS_INVALID",
          message: "Keywords must be an object mapping string keyword names to numeric scores",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        code: "KEYWORDS_INVALID",
        message: "Keywords must be an array or object",
      });
    }
  }

  next(); // Dữ liệu hợp lệ, chuyển tiếp sang Controller
};

//viết document (jsDoc) cho hàm validateId

/**
 * Middleware validate ID cho các route có tham số ID của Article
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateId = (req, res, next) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ 
      success: false, 
      code: "ID_INVALID", 
      message: "ID phải là một số nguyên" 
    });
  }

  if(articleExists(Number(id)) === false) {
    return res.status(404).json({ 
      success: false, 
      code: "ARTICLE_NOT_FOUND", 
      message: "Không tìm thấy Article với ID đã cho" 
    });
  }
  next();
}