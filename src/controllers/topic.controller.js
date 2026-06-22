import * as topicService from '../services/topic.service.js';
import * as subjectAreaService from '../services/subjectArea.service.js';
import * as subjectCategoryService from '../services/subjectCategory.service.js';
import logger from '../utils/logger.js';

export const topicServiceRef = { ...topicService };
export const subjectAreaServiceRef = { ...subjectAreaService };
export const subjectCategoryServiceRef = { ...subjectCategoryService };

/**
 * Lấy danh sách Topic
 * Method: GET /api/v1/topics
 */
export const getTopics = async (req, res) => {
    try {
        const { page, limit, search, subject_area_id, subject_category_id, sort_by, sort_order } = req.query;

        // 1. Validate sort_by
        if (sort_by && !["topic_id", "display_name", "score"].includes(sort_by)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_FILTER",
                message: "sort_by không hợp lệ"
            });
        }

        // 2. Validate subject_area_id
        if (subject_area_id) {
            if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_FILTER",
                    message: "subject_area_id phải là số nguyên dương"
                });
            }
            const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
            if (!saExists) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_FILTER",
                    message: "subject_area_id không tồn tại"
                });
            }
        }

        // 3. Validate subject_category_id
        if (subject_category_id) {
            if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_FILTER",
                    message: "subject_category_id phải là số nguyên dương"
                });
            }
            const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
            if (!scExists) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_FILTER",
                    message: "subject_category_id không tồn tại"
                });
            }
        }

        const result = await topicServiceRef.getTopics({
            page,
            limit,
            search,
            subject_area_id,
            subject_category_id,
            sort_by,
            sort_order
        });

        return res.status(200).json({
            success: true,
            code: "GET_TOPICS_SUCCESS",
            message: "Lấy danh sách Topic thành công",
            data: result
        });
    } catch (error) {
        logger.error(`getTopics error: ${error.message}`);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Có lỗi xảy ra ở Server!"
        });
    }
};

/**
 * Lấy chi tiết Topic
 * Method: GET /api/v1/topics/:id
 */
export const getTopicById = async (req, res) => {
    try {
        const { id } = req.params;

        const topic = await topicServiceRef.getTopicById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                code: "TOPIC_NOT_FOUND",
                message: "Topic không tồn tại"
            });
        }

        return res.status(200).json({
            success: true,
            code: "GET_TOPIC_SUCCESS",
            message: "Lấy chi tiết Topic thành công",
            data: topic
        });
    } catch (error) {
        logger.error(`getTopicById error: ${error.message}`);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Có lỗi xảy ra ở Server!"
        });
    }
};

/**
 * Tạo mới Topic
 * Method: POST /api/v1/topics
 */
export const createTopic = async (req, res) => {
    try {
        const { display_name, score, subject_area_id, subject_category_id } = req.body;

        // 1. Validate display_name
        if (!display_name || typeof display_name !== 'string' || display_name.trim() === '') {
            return res.status(400).json({
                success: false,
                code: "INVALID_TOPIC_DATA",
                message: "display_name là bắt buộc và phải là chuỗi không rỗng"
            });
        }

        // 2. Validate score
        if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 1)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_TOPIC_DATA",
                message: "score phải là số từ 0 đến 1"
            });
        }

        // 3. Validate subject_area_id
        if (subject_area_id !== undefined && subject_area_id !== null) {
            if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_area_id phải là số nguyên dương"
                });
            }
            const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
            if (!saExists) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_area_id không tồn tại trong hệ thống"
                });
            }
        }

        // 4. Validate subject_category_id
        if (subject_category_id !== undefined && subject_category_id !== null) {
            if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_category_id phải là số nguyên dương"
                });
            }
            const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
            if (!scExists) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_category_id không tồn tại trong hệ thống"
                });
            }
        }

        // 5. Kiểm tra trùng lặp display_name
        const { duplicateName } = await topicServiceRef.checkDuplicateTopic(display_name);
        if (duplicateName) {
            return res.status(409).json({
                success: false,
                code: "TOPIC_NAME_DUPLICATED",
                message: "Tên Topic đã tồn tại trong hệ thống"
            });
        }

        // 6. Thực hiện tạo mới
        const newTopic = await topicServiceRef.createTopic({ display_name, score, subject_area_id, subject_category_id });

        return res.status(201).json({
            success: true,
            code: "TOPIC_CREATED",
            message: "Tạo mới Topic thành công",
            data: newTopic
        });

    } catch (error) {
        logger.error(`createTopic error: ${error.message}`);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Có lỗi xảy ra ở Server!"
        });
    }
};

/**
 * API Handler: Lấy danh sách bài báo theo topic
 * Method: GET /api/v1/topics/:id/articles?page=...&limit=...
 *
 * @param {import('express').Request} req  - Express Request (chứa req.params.id, req.query.page, req.query.limit)
 * @param {import('express').Response} res - Express Response
 * @returns {Promise<import('express').Response>} JSON chứa topic info, danh sách bài báo và thông tin phân trang
 */
export const getArticlesByTopic = async (req, res) => {
  try {
    // 1. Validate topic_id
    const topicId = parseInt(req.params.id, 10);
    if (isNaN(topicId) || topicId <= 0) {
      return res.status(400).json({
        success: false,
        code: "TOPIC_ID_INVALID",
        message: "topic_id không hợp lệ. Vui lòng truyền một số nguyên dương.",
      });
    }

    // 2. Kiểm tra topic có tồn tại không
    const topic = await topicServiceRef.getTopicById(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        code: "TOPIC_NOT_FOUND",
        message: `Topic với id = ${topicId} không tồn tại trong hệ thống.`,
      });
    }

    // 3. Phân trang
    let page = 1;
    let limit = 10;

    if (req.query.page !== undefined) {
      page = Number(req.query.page);
      if (!Number.isInteger(page) || page <= 0) {
        return res.status(400).json({
          success: false,
          code: "PAGE_INVALID",
          message: "page phải là số nguyên dương.",
        });
      }
    }

    if (req.query.limit !== undefined) {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit <= 0) {
        return res.status(400).json({
          success: false,
          code: "LIMIT_INVALID",
          message: "limit phải là số nguyên dương.",
        });
      }
    }

    const offset = (page - 1) * limit;

    // 4. Gọi service song song (lấy data + đếm tổng)
    const [articles, total] = await Promise.all([
      topicServiceRef.getArticlesByTopicId(topicId, limit, offset),
      topicServiceRef.countArticlesByTopicId(topicId),
    ]);

    // 5. Trả response
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách bài báo theo topic thành công",
      data: {
        topic: {
          topic_id: topic.topic_id,
          display_name: topic.display_name,
        },
        articles: articles.map((a) => ({
          article_id: a.article_id,
          title: a.title,
          publication_year: a.publication_year,
          doi: a.doi,
        })),
        pagination: {
          page,
          limit,
          total,
        },
      },
    });
  } catch (error) {
    logger.error("getArticlesByTopic error:", error);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

/**
 * Xóa mềm bài báo (đặt is_deleted = true)
 */
export const deleteTopic = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Kiểm tra tồn tại
        const topicExists = await topicServiceRef.topicExists(id);
        if (!topicExists) {
            return res.status(404).json({
                success: false,
                code: "TOPIC_NOT_FOUND",
                message: "Topic không tồn tại"
            });
        }

        // 2. Kiểm tra xem đã bị xóa mềm chưa
        const isDeleted = await topicServiceRef.topicIsDeleted(id);
        if (isDeleted) {
            return res.status(400).json({
                success: false,
                code: "TOPIC_ALREADY_DELETED",
                message: "Topic đã bị xóa từ trước"
            });
        }

        // 3. Thực hiện xóa mềm
        const deletedTopic = await topicServiceRef.deleteTopic(id);

        return res.status(200).json({
            success: true,
            code: "TOPIC_DELETED",
            message: "Xóa Topic thành công",
            data: deletedTopic
        });

    } catch (error) {
        logger.error(`deleteTopic error: ${error.message}`);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Có lỗi xảy ra ở Server!"
        });
    }
};

/**
 * Khôi phục Topic đã xóa mềm (đặt is_deleted = false)
 */
export const restoreTopic = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Kiểm tra tồn tại
        const topicExists = await topicServiceRef.topicExists(id);
        if (!topicExists) {
            return res.status(404).json({
                success: false,
                code: "TOPIC_NOT_FOUND",
                message: "Topic không tồn tại"
            });
        }

        // 2. Kiểm tra xem có đang bị xóa mềm không
        const isDeleted = await topicServiceRef.topicIsDeleted(id);
        if (!isDeleted) {
            return res.status(400).json({
                success: false,
                code: "TOPIC_NOT_DELETED",
                message: "Topic chưa bị xóa, không thể khôi phục"
            });
        }

        // 3. Thực hiện khôi phục
        const restoredTopic = await topicServiceRef.restoreTopic(id);

        return res.status(200).json({
            success: true,
            code: "TOPIC_RESTORED",
            message: "Khôi phục Topic thành công",
            data: restoredTopic
        });

    } catch (error) {
        logger.error(`restoreTopic error: ${error.message}`);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Có lỗi xảy ra ở Server!"
        });
    }
};

/**
 * Cập nhật thông tin Topic
 * Method: PUT /api/v1/topics/:id
 */
export const updateTopic = async (req, res) => {
    try {
        const { id } = req.params;
        const { display_name, score, subject_area_id, subject_category_id } = req.body;

        // 1. Validate body
        if (display_name !== undefined && (typeof display_name !== 'string' || display_name.trim() === '')) {
            return res.status(400).json({
                success: false,
                code: "INVALID_TOPIC_DATA",
                message: "display_name phải là chuỗi không rỗng"
            });
        }

        if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 1)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_TOPIC_DATA",
                message: "score phải là số từ 0 đến 1"
            });
        }

        if (subject_area_id !== undefined) {
            if (!Number.isInteger(Number(subject_area_id)) || Number(subject_area_id) <= 0) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_area_id phải là số nguyên dương"
                });
            }
            const saExists = await subjectAreaServiceRef.subjectAreaExist(subject_area_id);
            if (!saExists) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_area_id không tồn tại trong hệ thống"
                });
            }
        }

        if (subject_category_id !== undefined) {
            if (!Number.isInteger(Number(subject_category_id)) || Number(subject_category_id) <= 0) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_category_id phải là số nguyên dương"
                });
            }
            const scExists = await subjectCategoryServiceRef.subjectCategoryExist(subject_category_id);
            if (!scExists) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_TOPIC_DATA",
                    message: "subject_category_id không tồn tại trong hệ thống"
                });
            }
        }

        // 2. Kiểm tra tồn tại
        const topicExists = await topicServiceRef.topicExists(id);
        if (!topicExists) {
            return res.status(404).json({
                success: false,
                code: "TOPIC_NOT_FOUND",
                message: "Topic không tồn tại"
            });
        }

        // 3. Kiểm tra xem đã bị xóa mềm chưa
        const isDeleted = await topicServiceRef.topicIsDeleted(id);
        if (isDeleted) {
            return res.status(400).json({
                success: false,
                code: "TOPIC_DELETED",
                message: "Không thể cập nhật Topic đã bị xóa mềm"
            });
        }

        // 4. Thực hiện cập nhật
        const updatedTopic = await topicServiceRef.updateTopic(id, { display_name, score, subject_area_id, subject_category_id });
        
        if (!updatedTopic) {
             return res.status(400).json({
                success: false,
                code: "NO_DATA_UPDATED",
                message: "Không có trường hợp lệ nào được cập nhật"
            });
        }

        return res.status(200).json({
            success: true,
            code: "TOPIC_UPDATED",
            message: "Cập nhật Topic thành công",
            data: updatedTopic
        });

    } catch (error) {
        logger.error(`updateTopic error: ${error.message}`);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Có lỗi xảy ra ở Server!"
        });
    }
};
