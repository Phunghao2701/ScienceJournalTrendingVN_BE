import * as projectService from "../services/project.service.js";
import logger from "../utils/logger.js";

export const projectServiceRef = { ...projectService };

/**
 * API Lấy danh sách dự án của người dùng hiện tại
 * @param {Object} req - Express request object
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa danh sách dự án
 */
export const getProjects = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const projects = await projectServiceRef.getUserProjects(userId);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách dự án thành công",
      code: "SUCCESS_GET_PROJECTS",
      data: projects,
    });
  } catch (error) {
    logger.error("[Project Controller] Lỗi khi lấy danh sách dự án:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra khi lấy danh sách dự án",
    });
  }
};

/**
 * API Lấy chi tiết dự án theo ID và thuộc về người dùng hiện tại
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.id - ID của dự án cần lấy thông tin
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa thông tin chi tiết dự án
 */
export const getProjectById = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.user_id;

    const project = await projectServiceRef.getProjectById(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED",
        message:
          "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này",
      });
    }

    return res.status(200).json({
      success: true,
      code: "SUCCESS_GET_PROJECT",
      message: "Lấy chi tiết dự án thành công",
      data: project,
    });
  } catch (error) {
    logger.error("[Project Controller] Lỗi khi lấy chi tiết dự án:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra khi lấy chi tiết dự án",
    });
  }
};

/**
 * API Tạo mới một dự án khoa học kèm theo các chuyên ngành và tạp chí liên kết
 * @param {Object} req - Express request object
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} req.body - Dữ liệu dự án truyền từ client
 * @param {string} req.body.title - Tiêu đề dự án
 * @param {number|string} [req.body.subject_area] - ID lĩnh vực chính
 * @param {number|string} [req.body.subject_area_id] - ID lĩnh vực chính (alternative)
 * @param {Array<number|string>} [req.body.subject_category_ids] - Danh sách ID chuyên ngành
 * @param {Array<number|string>} [req.body.journal_ids] - Danh sách ID tạp chí
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa thông tin dự án vừa tạo
 */
export const createProject = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      title,
      subject_area,
      subject_area_id,
      subject_category_ids = [],
      journal_ids = [],
    } = req.body;

    // Hỗ trợ cả hai cách đặt tên trường
    const finalSubjectArea =
      subject_area !== undefined ? subject_area : subject_area_id;

    const newProject = await projectServiceRef.createProject({
      userId,
      title: title.trim(),
      subject_area: finalSubjectArea,
      subject_category_ids,
      journal_ids,
    });

    return res.status(201).json({
      success: true,
      code: "SUCCESS_CREATE_PROJECT",
      message: "Tạo dự án thành công",
      data: newProject,
    });
  } catch (error) {
    logger.error("Lỗi khi tạo dự án mới:", error);

    if (
      error.message &&
      (error.message.includes("không tồn tại") ||
        error.message.includes("chưa tồn tại"))
    ) {
      return res.status(400).json({
        success: false,
        code: "PROJECT_CREATION_FAILED",
        message: error.message,
      });
    }

    logger.error("[Project Controller] Lỗi khi tạo dự án:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở server khi tạo dự án",
    });
  }
};

/**
 * API Cập nhật thông tin dự án và các mối quan hệ liên kết của nó
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.id - ID của dự án cần cập nhật
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} req.body - Dữ liệu cập nhật dự án
 * @param {string} [req.body.title] - Tiêu đề mới của dự án
 * @param {number|string} [req.body.subject_area] - ID mới của lĩnh vực chính
 * @param {number|string} [req.body.subject_area_id] - ID mới của lĩnh vực chính (alternative)
 * @param {Array<number|string>} [req.body.subject_category_ids] - Danh sách ID chuyên ngành mới
 * @param {Array<number|string>} [req.body.journal_ids] - Danh sách ID tạp chí mới
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response thông báo kết quả cập nhật
 */
export const updateProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.user_id;
    const {
      title,
      subject_area,
      subject_area_id,
      subject_category_ids,
      journal_ids,
    } = req.body;

    const finalSubjectArea =
      subject_area !== undefined ? subject_area : subject_area_id;

    const updated = await projectServiceRef.updateProject(projectId, userId, {
      title: title ? title.trim() : undefined,
      subject_area: finalSubjectArea,
      subject_category_ids,
      journal_ids,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED",
        message:
          "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này",
      });
    }

    return res.status(200).json({
      success: true,
      code: "SUCCESS_UPDATE_PROJECT",
      message: "Cập nhật dự án thành công",
    });
  } catch (error) {
    if (
      error.message &&
      (error.message.includes("không tồn tại") ||
        error.message.includes("chưa tồn tại"))
    ) {
      return res.status(400).json({
        success: false,
        code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED",
        message: error.message,
      });
    }

    logger.error("[Project Controller] Lỗi khi cập nhật dự án:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở server khi cập nhật dự án",
    });
  }
};

/**
 * API Xóa dự án khoa học và các mối quan hệ liên kết liên quan
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.id - ID của dự án cần xóa
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response thông báo kết quả xóa dự án
 */
export const deleteProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.user_id;

    const deleted = await projectServiceRef.deleteProject(projectId, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED",
        message: "Không tìm thấy dự án hoặc bạn không có quyền xóa dự án này",
      });
    }

    return res.status(200).json({
      success: true,
      code: "SUCCESS_DELETE_PROJECT",
      message: "Xóa dự án thành công",
    });
  } catch (error) {
    logger.error("[Project Controller] Lỗi khi xóa dự án:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở server khi xóa dự án",
    });
  }
};

/**
 * Controller xử lý yêu cầu lấy danh sách bài viết liên quan của một dự án.
 * * - Hàm này sẽ bóc tách `projectId` từ URL params và `limit` từ query string.
 * - Sau đó tự động phối hợp các dịch vụ để lấy danh sách các Journal IDs và Category IDs thuộc dự án,
 * rồi truy vấn ra các bài viết liên quan mới nhất.
 *
 * @async
 * @param {import('express').Request} req - Đối tượng Request của Express.
 * @param {Object} req.params - Các tham số định tuyến trên URL.
 * @param {string} req.params.id - ID của dự án (sẽ được ép kiểu sang số nguyên).
 * @param {Object} req.query - Các tham số truy vấn (Query String) trên URL.
 * @param {string} [req.query.limit] - Số lượng bài viết tối đa muốn lấy (mặc định hệ thống tự nhận là 5).
 * * @param {import('express').Response} res - Đối tượng Response của Express dùng để trả về dữ liệu cho Client.
 * * @returns {Promise<import('express').Response>} Trả về phản hồi HTTP JSON:
 * - **200 (OK):** Lấy danh sách bài viết thành công kèm theo mảng dữ liệu.
 * - **400 (Bad Request):** ID dự án hoặc giá trị limit không đúng định dạng số nguyên dương.
 * - **500 (Internal Server Error):** Lỗi hệ thống hoặc lỗi phát sinh tại máy chủ Database.
 */
export const getRelatedArticles = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    let limit = Number(req.query.limit);

    const journalIds =
      await projectServiceRef.getJournalIdsByProjectId(projectId);
    const categoryIds =
      await projectServiceRef.getCategoryIdsByProjectId(projectId);

    const relatedArticles = await projectServiceRef.getRelatedArticles(
      journalIds,
      categoryIds,
      { limit },
    );

    return res.status(200).json({
      success: true,
      code: "SUCCESS_GET_RELATED_ARTICLES",
      message: "Lấy bài viết liên quan thành công",
      data: relatedArticles,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy bài viết liên quan:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở server khi lấy bài viết liên quan",
    });
  }
};

/**
 * API Lấy dữ liệu phân tích/thống kê của một dự án (Trending Charts)
 *
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Các tham số trên URL
 * @param {string} req.params.id - ID của dự án cần phân tích
 * @param {Object} req.user - Thông tin người dùng đã xác thực
 * @param {string} req.user.user_id - ID người dùng
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response chứa dữ liệu phân tích dự án
 */
export const getProjectAnalytics = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.user_id;

    const analyticsData = await projectServiceRef.getProjectAnalytics(
      projectId,
      userId,
    );
    if (!analyticsData) {
      return res.status(404).json({
        success: false,
        code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED",
        message:
          "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án này",
      });
    }

    return res.status(200).json({
      success: true,
      code: "SUCCESS_GET_PROJECT_ANALYTICS",
      message: "Lấy dữ liệu phân tích dự án thành công",
      data: analyticsData,
    });
  } catch (error) {
    logger.error(
      "[Project Controller] Lỗi khi lấy dữ liệu phân tích dự án:",
      error,
    );
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra khi lấy dữ liệu phân tích dự án",
    });
  }
};
