import * as projectService from '../services/project.service.js';
import logger from '../../../utils/logger.js';
import { createLog } from '../../system/services/log.service.js';

export const projectServiceRef = { ...projectService };
export const projectAuditRef = { createLog };

export const getProjects = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const projects = await projectServiceRef.getUserProjects(userId);
    return reply.status(200).send({ success: true, message: "Láº¥y danh sÃ¡ch dá»± Ã¡n thÃ nh cÃ´ng", code: "SUCCESS_GET_PROJECTS", data: projects });
  } catch (error) {
    logger.error("[Project Controller] Lá»—i khi láº¥y danh sÃ¡ch dá»± Ã¡n:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra khi láº¥y danh sÃ¡ch dá»± Ã¡n" });
  }
};

export const getProjectById = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;
    const project = await projectServiceRef.getProjectById(projectId, userId);
    if (!project) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y" });

    return reply.status(200).send({ success: true, code: "SUCCESS_GET_PROJECT", message: "Láº¥y chi tiáº¿t dá»± Ã¡n thÃ nh cÃ´ng", data: project });
  } catch (error) {
    logger.error("[Project Controller] Lá»—i khi láº¥y chi tiáº¿t dá»± Ã¡n:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra khi láº¥y chi tiáº¿t dá»± Ã¡n" });
  }
};

export const createProject = async (request, reply) => {
  try {
    const userId = request.user.user_id;
    const { title, subject_area, subject_area_id, subject_category_ids = [], journal_ids = [] } = request.body;
    const finalSubjectArea = subject_area !== undefined ? subject_area : subject_area_id;

    const newProject = await projectServiceRef.createProject({ userId, title: title.trim(), subject_area: finalSubjectArea, subject_category_ids, journal_ids });

    projectAuditRef.createLog({ userId: userId, userRole: request.user.role, action: 'CREATE', entityTable: 'Project', entityId: newProject.project_id, message: `Táº¡o má»›i dá»± Ã¡n nghiÃªn cá»©u: ${newProject.title}`, metadata: { ip: request.ip } });

    return reply.status(201).send({ success: true, code: "SUCCESS_CREATE_PROJECT", message: "Táº¡o dá»± Ã¡n thÃ nh cÃ´ng", data: newProject });
  } catch (error) {
    logger.error("Lá»—i khi táº¡o dá»± Ã¡n má»›i:", error);
    if (error.message && (error.message.includes("khÃ´ng tá»“n táº¡i") || error.message.includes("chÆ°a tá»“n táº¡i"))) return reply.status(400).send({ success: false, code: "PROJECT_CREATION_FAILED", message: error.message });
    logger.error("[Project Controller] Lá»—i khi táº¡o dá»± Ã¡n:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi táº¡o dá»± Ã¡n" });
  }
};

export const updateProject = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;
    const { title, subject_area, subject_area_id, subject_category_ids, journal_ids } = request.body;
    const finalSubjectArea = subject_area !== undefined ? subject_area : subject_area_id;

    const updatedProject = await projectServiceRef.updateProject(projectId, userId, { title: title ? title.trim() : undefined, subject_area: finalSubjectArea, subject_category_ids, journal_ids });

    if (!updatedProject) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y" });

    projectAuditRef.createLog({ userId: userId, userRole: request.user.role, action: 'UPDATE', entityTable: 'Project', entityId: projectId, message: `Cáº­p nháº­t dá»± Ã¡n nghiÃªn cá»©u: ${title || projectId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: "SUCCESS_UPDATE_PROJECT", message: "Cáº­p nháº­t dá»± Ã¡n thÃ nh cÃ´ng", data: updatedProject });
  } catch (error) {
    if (error.message && (error.message.includes("khÃ´ng tá»“n táº¡i") || error.message.includes("chÆ°a tá»“n táº¡i"))) return reply.status(400).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: error.message });
    logger.error("[Project Controller] Lá»—i khi cáº­p nháº­t dá»± Ã¡n:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi cáº­p nháº­t dá»± Ã¡n" });
  }
};

export const deleteProject = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;
    const deleted = await projectServiceRef.deleteProject(projectId, userId);

    if (!deleted) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n xÃ³a dá»± Ã¡n nÃ y" });

    projectAuditRef.createLog({ userId: userId, userRole: request.user.role, action: 'DELETE', entityTable: 'Project', entityId: projectId, message: `XÃ³a dá»± Ã¡n nghiÃªn cá»©u cÃ³ ID: ${projectId}`, metadata: { ip: request.ip } });

    return reply.status(200).send({ success: true, code: "SUCCESS_DELETE_PROJECT", message: "XÃ³a dá»± Ã¡n thÃ nh cÃ´ng" });
  } catch (error) {
    logger.error("[Project Controller] Lá»—i khi xÃ³a dá»± Ã¡n:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi xÃ³a dá»± Ã¡n" });
  }
};

export const getRelatedArticles = async (request, reply) => {
  try {
    const projectId = Number(request.params.id);
    const limit = request.query.limit === undefined ? 5 : Number(request.query.limit);

    if (!Number.isInteger(projectId) || projectId <= 0) return reply.status(400).send({ success: false, code: "INVALID_PROJECT_ID", message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡" });
    if (!Number.isInteger(limit) || limit <= 0) return reply.status(400).send({ success: false, code: "INVALID_LIMIT", message: "GiÃ¡ trá»‹ limit khÃ´ng há»£p lá»‡" });

    const userId = request.user.user_id;
    const project = await projectServiceRef.getProjectById(projectId, userId);
    if (!project) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y" });

    const journalIds = await projectServiceRef.getJournalIdsByProjectId(projectId);
    const categoryIds = await projectServiceRef.getCategoryIdsByProjectId(projectId);
    const relatedArticles = await projectServiceRef.getRelatedArticles(journalIds, categoryIds, { limit });

    return reply.status(200).send({ success: true, code: "SUCCESS_GET_RELATED_ARTICLES", message: "Láº¥y bÃ i viáº¿t liÃªn quan thÃ nh cÃ´ng", data: relatedArticles });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y bÃ i viáº¿t liÃªn quan:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ server khi láº¥y bÃ i viáº¿t liÃªn quan" });
  }
};

export const getProjectAnalytics = async (request, reply) => {
  try {
    const projectId = request.params.id;
    const userId = request.user.user_id;

    if (!/^\d+$/.test(projectId) || Number(projectId) <= 0) return reply.status(400).send({ success: false, code: "INVALID_PROJECT_ID", message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡" });

    const analyticsData = await projectServiceRef.getProjectAnalytics(projectId, userId);
    if (!analyticsData) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND_OR_ACCESS_DENIED", message: "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y" });

    return reply.status(200).send({ success: true, code: "SUCCESS_GET_PROJECT_ANALYTICS", message: "Láº¥y dá»¯ liá»‡u phÃ¢n tÃ­ch dá»± Ã¡n thÃ nh cÃ´ng", data: analyticsData });
  } catch (error) {
    logger.error("[Project Controller] Lá»—i khi láº¥y dá»¯ liá»‡u phÃ¢n tÃ­ch dá»± Ã¡n:", error);
    return reply.status(500).send({ success: false, code: "INTERNAL_SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra khi láº¥y dá»¯ liá»‡u phÃ¢n tÃ­ch dá»± Ã¡n" });
  }
};



