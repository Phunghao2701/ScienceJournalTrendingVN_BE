import * as issueService from '../services/issue.service.js';
import logger from '../../../utils/logger.js';

export const getIssues = async (request, reply) => {
  try {
    const { page = 1, limit = 10, volume_id, journal_id } = request.query;
    const result = await issueService.getIssues({ page: parseInt(page, 10), limit: parseInt(limit, 10), volume_id, journal_id });
    return reply.status(200).send({ success: true, message: 'Láº¥y danh sÃ¡ch Issue thÃ nh cÃ´ng', data: result.items, pagination: result.pagination });
  } catch (error) {
    return reply.status(500).send({ success: false, message: 'Lá»—i há»‡ thá»‘ng khi láº¥y danh sÃ¡ch Issue', errorCode: 'INTERNAL_ERROR' });
  }
};

export const createIssue = async (request, reply) => {
  try {
    const { volume_id, issue_number, publication_year } = request.body;
    const newIssue = await issueService.createIssue({ volume_id, issue_number, publication_year });
    return reply.status(201).send({ success: true, code: 'CREATE_ISSUE_SUCCESS', message: 'Táº¡o Issue thÃ nh cÃ´ng', data: newIssue });
  } catch (error) {
    logger.error('Lá»—i khi táº¡o Issue á»Ÿ controller:', error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lá»—i há»‡ thá»‘ng khi táº¡o má»›i Issue' });
  }
};

export const getIssueById = async (request, reply) => {
  try {
    const { id } = request.params;
    const issue = await issueService.getIssueById(id);
    if (!issue) return reply.status(404).send({ success: false, code: 'ISSUE_NOT_FOUND', message: 'KhÃ´ng tÃ¬m tháº¥y Issue hoáº·c Ä‘Ã£ bá»‹ xÃ³a' });
    return reply.status(200).send({ success: true, code: 'GET_ISSUE_DETAIL_SUCCESS', message: 'Láº¥y chi tiáº¿t Issue thÃ nh cÃ´ng', data: issue });
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y chi tiáº¿t Issue ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lá»—i há»‡ thá»‘ng khi láº¥y chi tiáº¿t Issue' });
  }
};

export const updateIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const { issue_number, publication_year } = request.body;
    const updatedIssue = await issueService.updateIssue(id, { issue_number, publication_year });
    return reply.status(200).send({ success: true, code: 'UPDATE_ISSUE_SUCCESS', message: 'Cáº­p nháº­t Issue thÃ nh cÃ´ng', data: updatedIssue });
  } catch (error) {
    logger.error(`Lá»—i khi cáº­p nháº­t Issue ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lá»—i há»‡ thá»‘ng khi cáº­p nháº­t Issue' });
  }
};

export const deleteIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await issueService.issueExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: 'ISSUE_NOT_FOUND', message: 'Issue khÃ´ng tá»“n táº¡i' });
    
    const isDeleted = await issueService.issueIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: 'ISSUE_ALREADY_DELETED', message: 'Issue Ä‘Ã£ bá»‹ xÃ³a' });
    
    const deletedIssue = await issueService.deleteIssue(id);
    return reply.status(200).send({ success: true, code: 'DELETE_ISSUE_SUCCESS', message: 'XÃ³a Issue thÃ nh cÃ´ng', data: deletedIssue });
  } catch (error) {
    logger.error(`Lá»—i khi xÃ³a Issue ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lá»—i há»‡ thá»‘ng khi xÃ³a Issue' });
  }
};

export const restoreIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await issueService.issueExist(id);
    if (!exists) return reply.status(404).send({ success: false, code: 'ISSUE_NOT_FOUND', message: 'Issue khÃ´ng tá»“n táº¡i' });
    
    const isDeleted = await issueService.issueIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, code: 'ISSUE_NOT_DELETED', message: 'Issue chÆ°a bá»‹ xÃ³a' });
    
    const restoredIssue = await issueService.restoreIssue(id);
    return reply.status(200).send({ success: true, code: 'RESTORE_ISSUE_SUCCESS', message: 'KhÃ´i phá»¥c Issue thÃ nh cÃ´ng', data: restoredIssue });
  } catch (error) {
    logger.error(`Lá»—i khi khÃ´i phá»¥c Issue ID ${request.params.id} á»Ÿ controller:`, error.message);
    return reply.status(500).send({ success: false, code: 'SERVER_ERROR', message: 'Lá»—i há»‡ thá»‘ng khi khÃ´i phá»¥c Issue' });
  }
};



