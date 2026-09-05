import * as issueService from '../services/issue.service.js';
import logger from '../../../utils/logger.js';

export const getIssues = async (request, reply) => {
  try {
    const { page = 1, limit = 10, volume_id, journal_id } = request.query;
    const result = await issueService.getIssues({ page: parseInt(page, 10), limit: parseInt(limit, 10), volume_id, journal_id });
    return reply.status(200).send({ success: true, message: 'Lấy danh sách Issue th� nh công', data: result.items, pagination: result.pagination });
  } catch (error) {
    return reply.status(500).send({ success: false, message: 'Lỗi hệ thống khi lấy danh sách Issue', errorCode: 'INTERNAL_ERROR' });
  }
};

export const createIssue = async (request, reply) => {
  try {
    const { volume_id, issue_number, publication_year } = request.body;
    const newIssue = await issueService.createIssue({ volume_id, issue_number, publication_year });
    return reply.status(201).send({ success: true, code: 'CREATE_ISSUE_SUCCESS', message: 'Tạo Issue th� nh công', data: newIssue });
  } catch (error) {
    logger.error('Lỗi khi tạo Issue ở controller:', error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lỗi hệ thống khi tạo mới Issue' });
  }
};

export const getIssueById = async (request, reply) => {
  try {
    const { id } = request.params;
    const issue = await issueService.getIssueById(id);
    if (!issue) return reply.status(404).send({ success: false, code: 'ISSUE_NOT_FOUND', message: 'Không tìm thấy Issue hoặc đã bị xóa' });
    return reply.status(200).send({ success: true, code: 'GET_ISSUE_DETAIL_SUCCESS', message: 'Lấy chi tiết Issue th� nh công', data: issue });
  } catch (error) {
    logger.error(`Lỗi khi lấy chi tiết Issue ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lỗi hệ thống khi lấy chi tiết Issue' });
  }
};

export const updateIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const { issue_number, publication_year } = request.body;
    const updatedIssue = await issueService.updateIssue(id, { issue_number, publication_year });
    return reply.status(200).send({ success: true, code: 'UPDATE_ISSUE_SUCCESS', message: 'Cập nhật Issue th� nh công', data: updatedIssue });
  } catch (error) {
    logger.error(`Lỗi khi cập nhật Issue ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lỗi hệ thống khi cập nhật Issue' });
  }
};

export const deleteIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await issueService.issueExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: 'ISSUE_NOT_FOUND', message: 'Issue không tồn tại' });
    
    const isDeleted = await issueService.issueIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: 'ISSUE_ALREADY_DELETED', message: 'Issue đã bị xóa' });
    
    const deletedIssue = await issueService.deleteIssue(id);
    return reply.status(200).send({ success: true, code: 'DELETE_ISSUE_SUCCESS', message: 'Xóa Issue th� nh công', data: deletedIssue });
  } catch (error) {
    logger.error(`Lỗi khi xóa Issue ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lỗi hệ thống khi xóa Issue' });
  }
};

export const restoreIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await issueService.issueExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: 'ISSUE_NOT_FOUND', message: 'Issue không tồn tại' });
    
    const isDeleted = await issueService.issueIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, code: 'ISSUE_NOT_DELETED', message: 'Issue chưa bị xóa' });
    
    const restoredIssue = await issueService.restoreIssue(id);
    return reply.status(200).send({ success: true, code: 'RESTORE_ISSUE_SUCCESS', message: 'Khôi phục Issue th� nh công', data: restoredIssue });
  } catch (error) {
    logger.error(`Lỗi khi khôi phục Issue ID ${request.params.id} ở controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lỗi hệ thống khi khôi phục Issue' });
  }
};



