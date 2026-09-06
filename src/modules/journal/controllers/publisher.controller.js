import * as publisherService from '../services/publisher.service.js';

export const getPublishers = async (request, reply) => {
  try {
    const { page = 1, limit = 100, search = '' } = request.query;
    const result = await publisherService.getPublishers({ page, limit, search });
    return reply.status(200).send({ success: true, message: 'Lấy danh sách nh�  xuất bản th� nh công', data: result.data, pagination: result.pagination });
  } catch (error) {
    return reply.status(500).send({ success: false, message: 'Lỗi hệ thống khi lấy danh sách nh�  xuất bản', errorCode: 'INTERNAL_ERROR', error: error.message });
  }
};

export const getPublisherById = async (request, reply) => {
  try {
    const { id } = request.params;
    const publisher = await publisherService.getPublisherById(id);
    if (!publisher) return reply.status(404).send({ success: false, message: 'Không tìm thấy nh�  xuất bản', errorCode: 'NOT_FOUND' });
    return reply.status(200).send({ success: true, message: 'Lấy thông tin nh�  xuất bản th� nh công', data: publisher });
  } catch (error) {
    return reply.status(500).send({ success: false, message: 'Lỗi hệ thống khi lấy thông tin nh�  xuất bản', errorCode: 'INTERNAL_ERROR', error: error.message });
  }
};

export const createPublisher = async (request, reply) => {
  try {
    const { display_name, image_url } = request.body;
    if (!display_name || display_name.trim() === '') return reply.status(400).send({ success: false, message: 'Tên nh�  xuất bản (display_name) l�  bắt buộc', errorCode: 'VALIDATION_ERROR' });

    const newPublisher = await publisherService.createPublisher({ display_name, image_url });
    return reply.status(201).send({ success: true, message: 'Tạo nh�  xuất bản th� nh công', data: newPublisher });
  } catch (error) {
    if (error.code === '23505') return reply.status(400).send({ success: false, message: 'Tên nh�  xuất bản đã tồn tại', errorCode: 'VALIDATION_ERROR' });
    return reply.status(500).send({ success: false, message: 'Lỗi hệ thống khi tạo nh�  xuất bản', errorCode: 'INTERNAL_ERROR', error: error.message });
  }
};

export const updatePublisher = async (request, reply) => {
  try {
    const { id } = request.params;
    const { display_name, image_url } = request.body;
    const updatedPublisher = await publisherService.updatePublisher(id, { display_name, image_url });
    if (!updatedPublisher) return reply.status(404).send({ success: false, message: 'Không tìm thấy nh�  xuất bản để cập nhật', errorCode: 'NOT_FOUND' });

    return reply.status(200).send({ success: true, message: 'Cập nhật nh�  xuất bản th� nh công', data: updatedPublisher });
  } catch (error) {
    if (error.code === '23505') return reply.status(400).send({ success: false, message: 'Tên nh�  xuất bản đã tồn tại', errorCode: 'VALIDATION_ERROR' });
    return reply.status(500).send({ success: false, message: 'Lỗi hệ thống khi cập nhật nh�  xuất bản', errorCode: 'INTERNAL_ERROR', error: error.message });
  }
};

export const deletePublisher = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await publisherService.publisherExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: 'Không tìm thấy nh�  xuất bản', errorCode: 'NOT_FOUND' });

    const isDeleted = await publisherService.publisherIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, message: 'Nh�  xuất bản đã bị xóa từ trước', errorCode: 'ALREADY_DELETED' });

    await publisherService.deletePublisher(id);
    return reply.status(200).send({ success: true, message: 'Xóa nh�  xuất bản th� nh công' });
  } catch (error) {
    if (error.code === '23503') return reply.status(400).send({ success: false, message: 'Không thể xóa nh�  xuất bản vì đang có tạp chí hoặc thực thể khác liên kết', errorCode: 'VALIDATION_ERROR' });
    return reply.status(500).send({ success: false, message: 'Lỗi hệ thống khi xóa nh�  xuất bản', errorCode: 'INTERNAL_ERROR', error: error.message });
  }
};

export const restorePublisher = async (request, reply) => {
  try {
    const { id } = request.params;
    const exists = await publisherService.publisherExist(id);
    if (!exists) return reply.status(404).send({ success: false, message: 'Không tìm thấy nh�  xuất bản', errorCode: 'NOT_FOUND' });

    const isDeleted = await publisherService.publisherIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, message: 'Nh�  xuất bản đang hoạt động, không cần khôi phục', errorCode: 'NOT_DELETED' });

    const restoredPublisher = await publisherService.restorePublisher(id);
    return reply.status(200).send({ success: true, message: 'Khôi phục nh�  xuất bản th� nh công', data: restoredPublisher });
  } catch (error) {
    return reply.status(500).send({ success: false, message: 'Lỗi hệ thống khi khôi phục nh�  xuất bản', errorCode: 'INTERNAL_ERROR', error: error.message });
  }
};
