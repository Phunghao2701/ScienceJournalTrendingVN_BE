import * as projectService from '../services/project.service.js';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';

export const projectServiceRef = { ...projectService };
export const projectAuditRef = { createLog };

export const getProjects = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const projects = await projectServiceRef.getUserProjects(userId);
    return reply.status(200).send({ success: true, message: "Lấy danh sách dự án th� nh công", code: "SUCCESS_GET_PROJECTS", data: projects });
  } catch (error) {
    logger.error("[Project Controller] Lỗi khi lấy danh sách dự án:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra khi lấy danh sách dự án" });
  }
};

export const getProjectById = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;
    const project = await projectServiceRef.getProjectById(projectId, userId);
    if (!project) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án n� y" });

    return reply.status(200).send({ success: true, code: "SUCCESS_GET_PROJECT", message: "Lấy chi tiết dự án th� nh công", data: project });
  } catch (error) {
    logger.error("[Project Controller] Lỗi khi lấy chi tiết dự án:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra khi lấy chi tiết dự án" });
  }
};

export const createProject = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const { title, subject_area, subject_area_id, subject_category_ids = [], journal_ids = [] } = request.body;
    const finalSubjectArea = subject_area !== undefined ? subject_area : subject_area_id;

    const newProject = await projectServiceRef.createProject({ userId, title: title.trim(), subject_area: finalSubjectArea, subject_category_ids, journal_ids });

    projectAuditRef.createLog({ userId: userId, userRole: request.user.role, action: 'CREATE', entityTable: 'Project', entityId: newProject.project_id, message: `Tạo mới dự án nghiên cứu: ${newProject.title}`, metadata: { ip: request.ip } });

    return reply.status(201).send({ success: true, code: "SUCCESS_CREATE_PROJECT", message: "Tạo dự án th� nh công", data: newProject });
  } catch (error) {
    logger.error("Lỗi khi tạo dự án mới:", error);
    if (error.message && (error.message.includes("không tồn tại") || error.message.includes("chưa tồn tại"))) return reply.status(400).send({ success: false, code: "PROJECT_CREATION_FAILED", message: error.message });
    logger.error("[Project Controller] Lỗi khi tạo dự án:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở server khi tạo dự án" });
  }
};

export const updateProject = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;
    const { title, subject_area, subject_area_id, subject_category_ids, journal_ids } = request.body;
    const finalSubjectArea = subject_area !== undefined ? subject_area : subject_area_id;

    const updatedProject = await projectServiceRef.updateProject(projectId, userId, { title: title ? title.trim() : undefined, subject_area: finalSubjectArea, subject_category_ids, journal_ids });

    if (!updatedProject) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án n� y" });

    projectAuditRef.createLog({ userId: userId, userRole: request.user.role, action: 'UPDATE', entityTable: 'Project', entityId: projectId, message: `Cập nhật dự án nghiên cứu: ${title || projectId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: "SUCCESS_UPDATE_PROJECT", message: "Cập nhật dự án th� nh công", data: updatedProject });
  } catch (error) {
    if (error.message && (error.message.includes("không tồn tại") || error.message.includes("chưa tồn tại"))) return reply.status(400).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: error.message });
    logger.error("[Project Controller] Lỗi khi cập nhật dự án:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở server khi cập nhật dự án" });
  }
};

export const deleteProject = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;
    const deleted = await projectServiceRef.deleteProject(projectId, userId);

    if (!deleted) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "Không tìm thấy dự án hoặc bạn không có quyền xóa dự án n� y" });

    projectAuditRef.createLog({ userId: userId, userRole: request.user.role, action: 'DELETE', entityTable: 'Project', entityId: projectId, message: `Xóa dự án nghiên cứu có ID: ${projectId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: "SUCCESS_DELETE_PROJECT", message: "Xóa dự án th� nh công" });
  } catch (error) {
    logger.error("[Project Controller] Lỗi khi xóa dự án:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở server khi xóa dự án" });
  }
};

export const getRelatedArticles = async (request, reply) => {
  try {
    const projectId = Number(request.params.id);
    const limit = request.query.limit === undefined ? 5 : Number(request.query.limit);

    if (!Number.isInteger(projectId) || projectId <= 0) return reply.status(400).send({ success: false, code: "INVALID_PROJECT_ID", message: "ID dự án không hợp lệ" });
    if (!Number.isInteger(limit) || limit <= 0) return reply.status(400).send({ success: false, code: "INVALID_LIMIT", message: "Giá trị limit không hợp lệ" });

    const userId = request.user.user_id;
    const project = await projectServiceRef.getProjectById(projectId, userId);
    if (!project) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án n� y" });

    const journalIds = await projectServiceRef.getJournalIdsByProjectId(projectId);
    const categoryIds = await projectServiceRef.getCategoryIdsByProjectId(projectId);
    const relatedArticles = await projectServiceRef.getRelatedArticles(journalIds, categoryIds, { limit });

    return reply.status(200).send({ success: true, code: "SUCCESS_GET_RELATED_ARTICLES", message: "Lấy b� i viết liên quan th� nh công", data: relatedArticles });
  } catch (error) {
    logger.error("Lỗi khi lấy b� i viết liên quan:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra ở server khi lấy b� i viết liên quan" });
  }
};

export const getProjectAnalytics = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;

    if (!/^\d+$/.test(projectId) || Number(projectId) <= 0) return reply.status(400).send({ success: false, code: "INVALID_PROJECT_ID", message: "ID dự án không hợp lệ" });

    const analyticsData = await projectServiceRef.getProjectAnalytics(projectId, userId);
    if (!analyticsData) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án n� y" });

    return reply.status(200).send({ success: true, code: "SUCCESS_GET_PROJECT_ANALYTICS", message: "Lấy dữ liệu phân tích dự án th� nh công", data: analyticsData });
  } catch (error) {
    logger.error("[Project Controller] Lỗi khi lấy dữ liệu phân tích dự án:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Có lỗi xảy ra khi lấy dữ liệu phân tích dự án" });
  }
};



