import * as publisherService from '../services/publisher.service.js';

export const getPublishers = async (req, res) => {
    try {
        const { page = 1, limit = 100, search = '' } = req.query;
        const result = await publisherService.getPublishers({ page, limit, search });
        
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách nhà xuất bản thành công',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách nhà xuất bản',
            errorCode: 'INTERNAL_ERROR',
            error: error.message
        });
    }
};

export const getPublisherById = async (req, res) => {
    try {
        const { id } = req.params;
        const publisher = await publisherService.getPublisherById(id);
        
        if (!publisher) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhà xuất bản',
                errorCode: 'NOT_FOUND'
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin nhà xuất bản thành công',
            data: publisher
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin nhà xuất bản',
            errorCode: 'INTERNAL_ERROR',
            error: error.message
        });
    }
};

export const createPublisher = async (req, res) => {
    try {
        const { display_name, image_url } = req.body;
        
        if (!display_name || display_name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Tên nhà xuất bản (display_name) là bắt buộc',
                errorCode: 'VALIDATION_ERROR'
            });
        }
        
        const newPublisher = await publisherService.createPublisher({ display_name, image_url });
        
        return res.status(201).json({
            success: true,
            message: 'Tạo nhà xuất bản thành công',
            data: newPublisher
        });
    } catch (error) {
        if (error.code === '23505') { // Postgres unique constraint violation
            return res.status(400).json({
                success: false,
                message: 'Tên nhà xuất bản đã tồn tại',
                errorCode: 'VALIDATION_ERROR'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tạo nhà xuất bản',
            errorCode: 'INTERNAL_ERROR',
            error: error.message
        });
    }
};

export const updatePublisher = async (req, res) => {
    try {
        const { id } = req.params;
        const { display_name, image_url } = req.body;
        
        const updatedPublisher = await publisherService.updatePublisher(id, { display_name, image_url });
        
        if (!updatedPublisher) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhà xuất bản để cập nhật',
                errorCode: 'NOT_FOUND'
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Cập nhật nhà xuất bản thành công',
            data: updatedPublisher
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Tên nhà xuất bản đã tồn tại',
                errorCode: 'VALIDATION_ERROR'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật nhà xuất bản',
            errorCode: 'INTERNAL_ERROR',
            error: error.message
        });
    }
};

export const deletePublisher = async (req, res) => {
    try {
        const { id } = req.params;
        
        const exists = await publisherService.publisherExist(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhà xuất bản',
                errorCode: 'NOT_FOUND'
            });
        }

        const isDeleted = await publisherService.publisherIsDeleted(id);
        if (isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Nhà xuất bản đã bị xóa từ trước',
                errorCode: 'ALREADY_DELETED'
            });
        }

        const deleted = await publisherService.deletePublisher(id);
        
        return res.status(200).json({
            success: true,
            message: 'Xóa nhà xuất bản thành công'
        });
    } catch (error) {
        if (error.code === '23503') { // Foreign key violation (ràng buộc toàn vẹn)
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa nhà xuất bản vì đang có tạp chí hoặc thực thể khác liên kết',
                errorCode: 'VALIDATION_ERROR'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa nhà xuất bản',
            errorCode: 'INTERNAL_ERROR',
            error: error.message
        });
    }
};

export const restorePublisher = async (req, res) => {
    try {
        const { id } = req.params;

        const exists = await publisherService.publisherExist(id);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhà xuất bản',
                errorCode: 'NOT_FOUND'
            });
        }

        const isDeleted = await publisherService.publisherIsDeleted(id);
        if (!isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Nhà xuất bản đang hoạt động, không cần khôi phục',
                errorCode: 'NOT_DELETED'
            });
        }

        const restoredPublisher = await publisherService.restorePublisher(id);
        
        return res.status(200).json({
            success: true,
            message: 'Khôi phục nhà xuất bản thành công',
            data: restoredPublisher
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi khôi phục nhà xuất bản',
            errorCode: 'INTERNAL_ERROR',
            error: error.message
        });
    }
};