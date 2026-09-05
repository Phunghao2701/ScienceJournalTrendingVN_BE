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
    const { page, limit, search, subject_area_id, subject_category_id, sort_by, sort_order } = request.query;

    if (sort_by && !["topic_id", "display_name", "score"].includes(sort_by)) {
      return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "sort_by khÃ´ng há»£p lá»‡" });
    }

    if (subject_area_id) {
      if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_area_id pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
      const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
      if (!saExists) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_area_id khÃ´ng tá»“n táº¡i" });
    }

    if (subject_category_id) {
      if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_category_id pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
      const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
      if (!scExists) return reply.status(400).send({ success: false, code: "INVALID_FILTER", message: "subject_category_id khÃ´ng tá»“n táº¡i" });
    }

    const topicParams = { page, limit, search, subject_area_id, subject_category_id, sort_by, sort_order };
    const result = await getTopicsData(topicParams, () => topicServiceRef.getTopics(topicParams));

    return reply.status(200).send({ success: true, code: "GET_TOPICS_SUCCESS", message: "Láº¥y danh sÃ¡ch Topic thÃ nh cÃ´ng", data: result });
  } catch (error) {
    logger.error(`getTopics error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getTopicById = async (request, reply) => {
  try {
    const { id } = request.params;
    const topic = await topicServiceRef.getTopicById(id);
    if (!topic) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic khÃ´ng tá»“n táº¡i" });

    return reply.status(200).send({ success: true, code: "GET_TOPIC_SUCCESS", message: "Láº¥y chi tiáº¿t Topic thÃ nh cÃ´ng", data: topic });
  } catch (error) {
    logger.error(`getTopicById error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const createTopic = async (request, reply) => {
  try {
    const { display_name, score, subject_area_id, subject_category_id } = request.body;

    if (!display_name || typeof display_name !== 'string' || display_name.trim() === '') return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "display_name lÃ  báº¯t buá»™c" });
    if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 1)) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "score pháº£i tá»« 0 Ä‘áº¿n 1" });

    if (subject_area_id !== undefined && subject_area_id !== null) {
      if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id khÃ´ng há»£p lá»‡" });
      const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
      if (!saExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id khÃ´ng tá»“n táº¡i" });
    }

    if (subject_category_id !== undefined && subject_category_id !== null) {
      if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id khÃ´ng há»£p lá»‡" });
      const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
      if (!scExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id khÃ´ng tá»“n táº¡i" });
    }

    const { duplicateName } = await topicServiceRef.checkDuplicateTopic(display_name);
    if (duplicateName) return reply.status(409).send({ success: false, code: "TOPIC_NAME_DUPLICATED", message: "TÃªn Topic Ä‘Ã£ tá»“n táº¡i" });

    const newTopic = await topicServiceRef.createTopic({ display_name, score, subject_area_id, subject_category_id });
    return reply.status(201).send({ success: true, code: "TOPIC_CREATED", message: "Táº¡o má»›i Topic thÃ nh cÃ´ng", data: newTopic });
  } catch (error) {
    logger.error(`createTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const getArticlesByTopic = async (request, reply) => {
  try {
    const topicId = parseInt(request.params.id, 10);
    if (isNaN(topicId) || topicId <= 0) return reply.status(400).send({ success: false, code: "TOPIC_ID_INVALID", message: "topic_id khÃ´ng há»£p lá»‡" });

    const topic = await topicServiceRef.getTopicById(topicId);
    if (!topic) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic khÃ´ng tá»“n táº¡i" });

    let page = 1;
    let limit = 10;
    if (request.query.page !== undefined) {
      page = Number(request.query.page);
      if (!Number.isInteger(page) || page <= 0) return reply.status(400).send({ success: false, code: "PAGE_INVALID", message: "page khÃ´ng há»£p lá»‡" });
    }
    if (request.query.limit !== undefined) {
      limit = Number(request.query.limit);
      if (!Number.isInteger(limit) || limit <= 0) return reply.status(400).send({ success: false, code: "LIMIT_INVALID", message: "limit khÃ´ng há»£p lá»‡" });
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
      message: "Láº¥y danh sÃ¡ch bÃ i bÃ¡o theo topic thÃ nh cÃ´ng",
      data: { topic: { topic_id: topic.topic_id, display_name: topic.display_name }, articles, scope, pagination: { page, limit, total } }
    });
  } catch (error) {
    logger.error("getArticlesByTopic error:", error);
    return reply.status(error.statusCode || 500).send({ success: false, code: error.code || "SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const deleteTopic = async (request, reply) => {
  try {
    const { id } = request.params;
    const topicExists = await topicServiceRef.topicExists(id);
    if (!topicExists) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic khÃ´ng tá»“n táº¡i" });

    const isDeleted = await topicServiceRef.topicIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: "TOPIC_ALREADY_DELETED", message: "Topic Ä‘Ã£ bá»‹ xÃ³a tá»« trÆ°á»›c" });

    const deletedTopic = await topicServiceRef.deleteTopic(id);
    return reply.status(200).send({ success: true, code: "TOPIC_DELETED", message: "XÃ³a Topic thÃ nh cÃ´ng", data: deletedTopic });
  } catch (error) {
    logger.error(`deleteTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const restoreTopic = async (request, reply) => {
  try {
    const { id } = request.params;
    const topicExists = await topicServiceRef.topicExists(id);
    if (!topicExists) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic khÃ´ng tá»“n táº¡i" });

    const isDeleted = await topicServiceRef.topicIsDeleted(id);
    if (!isDeleted) return reply.status(400).send({ success: false, code: "TOPIC_NOT_DELETED", message: "Topic chÆ°a bá»‹ xÃ³a, khÃ´ng thá»ƒ khÃ´i phá»¥c" });

    const restoredTopic = await topicServiceRef.restoreTopic(id);
    return reply.status(200).send({ success: true, code: "TOPIC_RESTORED", message: "KhÃ´i phá»¥c Topic thÃ nh cÃ´ng", data: restoredTopic });
  } catch (error) {
    logger.error(`restoreTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};

export const updateTopic = async (request, reply) => {
  try {
    const { id } = request.params;
    const { display_name, score, subject_area_id, subject_category_id } = request.body;

    if (display_name !== undefined && (typeof display_name !== 'string' || display_name.trim() === '')) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "display_name pháº£i lÃ  chuá»—i khÃ´ng rá»—ng" });
    if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 1)) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "score pháº£i tá»« 0 Ä‘áº¿n 1" });

    if (subject_area_id !== undefined) {
      if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id khÃ´ng há»£p lá»‡" });
      const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
      if (!saExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_area_id khÃ´ng tá»“n táº¡i" });
    }

    if (subject_category_id !== undefined) {
      if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id khÃ´ng há»£p lá»‡" });
      const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
      if (!scExists) return reply.status(400).send({ success: false, code: "INVALID_TOPIC_DATA", message: "subject_category_id khÃ´ng tá»“n táº¡i" });
    }

    const topicExists = await topicServiceRef.topicExists(id);
    if (!topicExists) return reply.status(404).send({ success: false, code: "TOPIC_NOT_FOUND", message: "Topic khÃ´ng tá»“n táº¡i" });

    const isDeleted = await topicServiceRef.topicIsDeleted(id);
    if (isDeleted) return reply.status(400).send({ success: false, code: "TOPIC_DELETED", message: "KhÃ´ng thá»ƒ cáº­p nháº­t Topic Ä‘Ã£ bá»‹ xÃ³a má»m" });

    const updatedTopic = await topicServiceRef.updateTopic(id, { display_name, score, subject_area_id, subject_category_id });
    if (!updatedTopic) return reply.status(400).send({ success: false, code: "NO_DATA_UPDATED", message: "KhÃ´ng cÃ³ trÆ°á»ng há»£p lá»‡ nÃ o Ä‘Æ°á»£c cáº­p nháº­t" });

    return reply.status(200).send({ success: true, code: "TOPIC_UPDATED", message: "Cáº­p nháº­t Topic thÃ nh cÃ´ng", data: updatedTopic });
  } catch (error) {
    logger.error(`updateTopic error: ${error.message}`);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "CÃ³ lá»—i xáº£y ra á»Ÿ Server!" });
  }
};



