import * as issueService from '../services/issue.service.js';
import logger from '../utils/logger.js';

/**
 * Controller lấy danh sách Issue.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 */
export const getIssues = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            volume_id,
            journal_id
        } = req.query;

        const result = await issueService.getIssues({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            volume_id,
            journal_id
        });

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách Issue thành công',
            data: result.items,
            pagination: result.pagination
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách Issue',
            errorCode: 'INTERNAL_ERROR'
        });
    }
};

export const createIssue = async (req, res) => {
    try {
        const { volume_id, issue_number, publication_year } = req.body;
        const newIssue = await issueService.createIssue({ volume_id, issue_number, publication_year });
        
        return res.status(201).json({
            success: true,
            code: 'CREATE_ISSUE_SUCCESS',
            message: 'Tạo Issue thành công',
            data: newIssue
        });
    } catch (error) {
        logger.error('Lỗi khi tạo Issue ở controller:', error.message);
        return res.status(500).json({
            success: false,
            code: 'SERVER_ERROR',
            message: 'Lỗi hệ thống khi tạo mới Issue'
        });
    }
};

export const getIssueById = async (req, res) => {
    try {
        const { id } = req.params;
        const issue = await issueService.getIssueById(id);
        
        if (!issue) {
            return res.status(404).json({
                success: false,
                code: 'ISSUE_NOT_FOUND',
                message: 'Không tìm thấy Issue hoặc đã bị xóa'
            });
        }
        
        return res.status(200).json({
            success: true,
            code: 'GET_ISSUE_DETAIL_SUCCESS',
            message: 'Lấy chi tiết Issue thành công',
            data: issue
        });
    } catch (error) {
        logger.error(`Lỗi khi lấy chi tiết Issue ID ${req.params.id} ở controller:`, error.message);
        return res.status(500).json({
            success: false,
            code: 'SERVER_ERROR',
            message: 'Lỗi hệ thống khi lấy chi tiết Issue'
        });
    }
};

export const updateIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const { issue_number, publication_year } = req.body;
        
        const updatedIssue = await issueService.updateIssue(id, { issue_number, publication_year });
        
        return res.status(200).json({
            success: true,
            code: 'UPDATE_ISSUE_SUCCESS',
            message: 'Cập nhật Issue thành công',
            data: updatedIssue
        });
    } catch (error) {
        logger.error(`Lỗi khi cập nhật Issue ID ${req.params.id} ở controller:`, error.message);
        return res.status(500).json({
            success: false,
            code: 'SERVER_ERROR',
            message: 'Lỗi hệ thống khi cập nhật Issue'
        });
    }
};

export const deleteIssue = async (req, res) => {
    try {
        const { id } = req.params;
        
        const exists = await issueService.issueExist(id);
        if (!exists) {
            return res.status(404).json({ success: false, code: 'ISSUE_NOT_FOUND', message: 'Issue không tồn tại' });
        }
        
        const isDeleted = await issueService.issueIsDeleted(id);
        if (isDeleted) {
            return res.status(400).json({ success: false, code: 'ISSUE_ALREADY_DELETED', message: 'Issue đã bị xóa' });
        }
        
        const deletedIssue = await issueService.deleteIssue(id);
        
        return res.status(200).json({
            success: true,
            code: 'DELETE_ISSUE_SUCCESS',
            message: 'Xóa Issue thành công',
            data: deletedIssue
        });
    } catch (error) {
        logger.error(`Lỗi khi xóa Issue ID ${req.params.id} ở controller:`, error.message);
        return res.status(500).json({
            success: false,
            code: 'SERVER_ERROR',
            message: 'Lỗi hệ thống khi xóa Issue'
        });
    }
};

export const restoreIssue = async (req, res) => {
    try {
        const { id } = req.params;
        
        const exists = await issueService.issueExist(id);
        if (!exists) {
            return res.status(404).json({ success: false, code: 'ISSUE_NOT_FOUND', message: 'Issue không tồn tại' });
        }
        
        const isDeleted = await issueService.issueIsDeleted(id);
        if (!isDeleted) {
            return res.status(400).json({ success: false, code: 'ISSUE_NOT_DELETED', message: 'Issue chưa bị xóa' });
        }
        
        const restoredIssue = await issueService.restoreIssue(id);
        
        return res.status(200).json({
            success: true,
            code: 'RESTORE_ISSUE_SUCCESS',
            message: 'Khôi phục Issue thành công',
            data: restoredIssue
        });
    } catch (error) {
        logger.error(`Lỗi khi khôi phục Issue ID ${req.params.id} ở controller:`, error.message);
        return res.status(500).json({
            success: false,
            code: 'SERVER_ERROR',
            message: 'Lỗi hệ thống khi khôi phục Issue'
        });
    }
};