import * as topicService from '../services/topic.service.js';
import * as subjectAreaService from '../services/subjectArea.service.js';
import * as subjectCategoryService from '../services/subjectCategory.service.js';
import logger from '../../../utils/logger.js';
import { getTopicsData } from '../../article/services/discoveryLookupCache.service.js';

export const topicServiceRef = { ...topicService };
export const subjectAreaServiceRef = { ...subjectAreaService };
export const subjectCategoryServiceRef = { ...subjectCategoryService };

export const getTopics = async (request, reply) => {
  try {
    const { page, limit, search, subject_area_id, subject_category_id } = request.query;
    const sort_by = request.query.sort_by || request.query.sortBy;
    const sort_order = request.query.sort_order || request.query.sortOrder;

    if (sort_by && !["topic_id", "display_name", "score"].includes(sort_by)) {
      return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "sort_by không hợp lệ" });
    }

    if (subject_area_id) {
      if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_area_id phải l�  số nguyên dương" });
      const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
      if (!saExists) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_area_id không tồn tại" });
    }

    if (subject_category_id) {
      if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_category_id phải l�  số nguyên dương" });
      const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
      if (!scExists) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_category_id không tồn tại" });
    }

    const topicParams = { page, limit, search, subject_area_id, subject_category_id, sort_by, sort_order };
    const result = await getTopicsData(topicParams, () => topicServiceRef.getTopics(topicParams));

    return reply.status(200).send({ success: true, code: "GET_TOPICS_SUCCESS", message: "Lấy danh sách Topic th� nh công", data: result });
  } catch (error) {
    logger.error(`getTopics error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getTopicById = async (request, reply) => {
  try {
    const { id } = request.params;
    const topic = await topicServiceRef.getTopicById(id);
    if (!topic) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic không tồn tại" });

    return reply.status(200).send({ success: true, code: "GET_TOPIC_SUCCESS", message: "Lấy chi tiết Topic th� nh công", data: topic });
  } catch (error) {
    logger.error(`getTopicById error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const createTopic = async (request, reply) => {
  try {
    const { display_name, score, subject_area_id, subject_category_id } = request.body;

    if (!display_name || typeof display_name !== 'string' || display_name.trim() === '') return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "display_name l�  bắt buộc" });
    if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 1)) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "score phải từ 0 đến 1" });

    if (subject_area_id !== undefined && subject_area_id !== null) {
      if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id không hợp lệ" });
      const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
      if (!saExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id không tồn tại" });
    }

    if (subject_category_id !== undefined && subject_category_id !== null) {
      if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id không hợp lệ" });
      const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
      if (!scExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id không tồn tại" });
    }

    const { duplicateName } = await topicServiceRef.checkDuplicateTopic(display_name);
    if (duplicateName) return reply.status(409).send({ success: false, code: "TOPIC_NAME_DUPLICATED", message: "Tên Topic đã tồn tại" });

    const newTopic = await topicServiceRef.createTopic({ display_name, score, subject_area_id, subject_category_id });
    return reply.status(201).send({ success: true, code: "TOPIC_CREATED", message: "Tạo mới Topic th� nh công", data: newTopic });
  } catch (error) {
    logger.error(`createTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const getArticlesByTopic = async (request, reply) => {
  try {
    const topicId = parseInt(request.params.id, 10);
    if (isNaN(topicId) || topicId <= 0) return reply.status(400).send({ success: false, code: "TOPIC_ID_INVALID", message: "topic_id không hợp lệ" });

    const topic = await topicServiceRef.getTopicById(topicId);
    if (!topic) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic không tồn tại" });

    let page = 1;
    let limit = 10;
    if (request.query.page !== undefined) {
      page = Number(request.query.page);
      if (!Number.isInteger(page) || page <= 0) return reply.status(400).send({ success: false, code: "PAGE_INVALID", message: "page không hợp lệ" });
    }
    if (request.query.limit !== undefined) {
      limit = Number(request.query.limit);
      if (!Number.isInteger(limit) || limit <= 0) return reply.status(400).send({ success: false, code: "LIMIT_INVALID", message: "limit không hợp lệ" });
    }

    const offset = (page - 1) * limit;
    const sortBy = request.query.sortBy || request.query.sort_by || "publication_year";
    const sortOrder = request.query.sortOrder || request.query.sort_order || "desc";
    const scope = request.query.scope || "all";

    const [articles, total] = await Promise.all([
      topicServiceRef.getArticlesByTopicId(topicId, limit, offset, { scope, sortBy, sortOrder }),
      topicServiceRef.countArticlesByTopicId(topicId, { scope }),
    ]);

    return reply.status(200).send({
      success: true,
      message: "Lấy danh sách b� i báo theo topic th� nh công",
      data: { topic: { topic_id: topic.topic_id, display_name: topic.display_name }, articles, scope, pagination: { page, limit, total } }
    });
  } catch (error) {
    logger.error("getArticlesByTopic error:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const deleteTopic = async (request, reply) => {
  try {
    const { id } = request.params;
    const topicExists = await topicServiceRef.topicExists(id);
    if (!topicExists) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic không tồn tại" });

    const isDeleted = await topicServiceRef.topicIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: "TOPIC_ALREADY_DELETED", message: "Topic đã bị xóa từ trước" });

    const deletedTopic = await topicServiceRef.deleteTopic(id);
    return reply.status(200).send({ success: true, code: "TOPIC_DELETED", message: "Xóa Topic th� nh công", data: deletedTopic });
  } catch (error) {
    logger.error(`deleteTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const restoreTopic = async (request, reply) => {
  try {
    const { id } = request.params;
    const topicExists = await topicServiceRef.topicExists(id);
    if (!topicExists) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic không tồn tại" });

    const isDeleted = await topicServiceRef.topicIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, code: "TOPIC_NOT_DELETED", message: "Topic chưa bị xóa, không thể khôi phục" });

    const restoredTopic = await topicServiceRef.restoreTopic(id);
    return reply.status(200).send({ success: true, code: "TOPIC_RESTORED", message: "Khôi phục Topic th� nh công", data: restoredTopic });
  } catch (error) {
    logger.error(`restoreTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};

export const updateTopic = async (request, reply) => {
  try {
    const { id } = request.params;
    const { display_name, score, subject_area_id, subject_category_id } = request.body;

    if (display_name !== undefined && (typeof display_name !== 'string' || display_name.trim() === '')) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "display_name phải l�  chuỗi không rỗng" });
    if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 1)) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "score phải từ 0 đến 1" });

    if (subject_area_id !== undefined) {
      if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id không hợp lệ" });
      const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
      if (!saExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id không tồn tại" });
    }

    if (subject_category_id !== undefined) {
      if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id không hợp lệ" });
      const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
      if (!scExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id không tồn tại" });
    }

    const topicExists = await topicServiceRef.topicExists(id);
    if (!topicExists) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic không tồn tại" });

    const isDeleted = await topicServiceRef.topicIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: "TOPIC_DELETED", message: "Không thể cập nhật Topic đã bị xóa mềm" });

    const updatedTopic = await topicServiceRef.updateTopic(id, { display_name, score, subject_area_id, subject_category_id });
    if (!updatedTopic) return reply.status(400).send({ success: false, code: "NO_DATA_UPDATED", message: "Không có trường hợp lệ n� o được cập nhật" });

    return reply.status(200).send({ success: true, code: "TOPIC_UPDATED", message: "Cập nhật Topic th� nh công", data: updatedTopic });
  } catch (error) {
    logger.error(`updateTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Có lỗi xảy ra ở Server!" });
  }
};



