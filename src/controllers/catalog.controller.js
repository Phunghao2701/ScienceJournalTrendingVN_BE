import * as catalogService from "../services/catalog.service.js";
import logger from "../utils/logger.js";

/**
 * Controller lấy danh sách các lĩnh vực học thuật lớn (Subject Area).
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON danh sách subject areas.
 */
export const getSubjectAreas = async (req, res) => {
  try {
    const result = await catalogService.getSubjectAreas();
    return res.status(200).json({
      success: true,
      code: "CATALOG_SUBJECT_AREA_LIST_SUCCESS",
      message: "Lấy danh sách subject area thành công",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách subject areas:", error);
    return res.status(500).json({
      success: false,
      code: "CATALOG_SUBJECT_AREA_LIST_ERROR",
      message: "Lỗi hệ thống khi lấy danh sách subject areas",
    });
  }
};

/**
 * Controller lấy danh sách các chuyên ngành hẹp (Subject Category) kèm theo bộ lọc subject_area_id.
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON danh sách subject categories.
 */
export const getSubjectCategories = async (req, res) => {
  try {
    const { subject_area_id } = req.query;

    const result = await catalogService.getSubjectCategories({
      subjectAreaId: subject_area_id,
    });

    return res.status(200).json({
      success: true,
      code: "CATALOG_SUBJECT_CATEGORY_LIST_SUCCESS",
      message: "Lấy danh sách subject category thành công",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách subject categories:", error);
    return res.status(500).json({
      success: false,
      code: "CATALOG_SUBJECT_CATEGORY_LIST_ERROR",
      message: "Lỗi hệ thống khi lấy danh sách subject categories",
    });
  }
};

/**
 * Controller lấy lịch sử ranking của một journal theo ID và các bộ lọc.
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON lịch sử xếp hạng ranking của journal.
 */
export const getJournalRankings = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, metric_code, quartile, source } = req.query;

    if (!id || id.trim() === "") {
      return res.status(400).json({
        success: false,
        code: "CATALOG_JOURNAL_ID_REQUIRED",
        message: "ID của journal không được bỏ trống",
      });
    }

    const result = await catalogService.getJournalRankings(id.trim(), {
      year,
      metric_code,
      quartile,
      source,
    });

    return res.status(200).json({
      success: true,
      code: "CATALOG_JOURNAL_RANKING_HISTORY_SUCCESS",
      message: "Lấy lịch sử ranking của journal thành công",
      data: result,
    });
  } catch (error) {
    logger.error(
      `Lỗi khi lấy lịch sử ranking cho journal ${req.params?.id}:`,
      error,
    );

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      code: "CATALOG_JOURNAL_RANKING_HISTORY_ERROR",
      message: "Lỗi hệ thống khi lấy lịch sử ranking của journal",
    });
  }
};

/**
 * Controller lấy danh sách volume, hỗ trợ lọc theo journal_id.
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON danh sách volume.
 */
export const getVolumes = async (req, res) => {
  try {
    const { journal_id, page, limit } = req.query;

    if (journal_id !== undefined) {
      const idNum = Number(journal_id);
      if (
        isNaN(idNum) ||
        idNum <= 0 ||
        !/^\d+$/.test(String(journal_id).trim())
      ) {
        return res.status(400).json({
          success: false,
          code: "CATALOG_JOURNAL_ID_INVALID",
          message: "Tham số journal_id phải là số nguyên dương lớn hơn 0",
        });
      }
    }

    const result = await catalogService.getVolumes({ journalId: journal_id, page, limit });

    return res.status(200).json({
      success: true,
      code: "CATALOG_VOLUME_LIST_SUCCESS",
      message: "Lấy danh sách volume thành công",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách volume:", error);
    return res.status(500).json({
      success: false,
      code: "CATALOG_VOLUME_LIST_ERROR",
      message: "Lỗi hệ thống khi lấy danh sách volume",
    });
  }
};

/**
 * Controller lấy danh sách issue, hỗ trợ lọc theo volume_id.
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON danh sách issue.
 */
export const getIssues = async (req, res) => {
  try {
    const { volume_id, page, limit } = req.query;

    if (volume_id !== undefined) {
      const idNum = Number(volume_id);
      if (
        isNaN(idNum) ||
        idNum <= 0 ||
        !/^\d+$/.test(String(volume_id).trim())
      ) {
        return res.status(400).json({
          success: false,
          code: "CATALOG_VOLUME_ID_INVALID",
          message: "Tham số volume_id phải là số nguyên dương lớn hơn 0",
        });
      }
    }

    const result = await catalogService.getIssues({ volumeId: volume_id, page, limit });

    return res.status(200).json({
      success: true,
      code: "CATALOG_ISSUE_LIST_SUCCESS",
      message: "Lấy danh sách issue thành công",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách issue:", error);
    return res.status(500).json({
      success: false,
      code: "CATALOG_ISSUE_LIST_ERROR",
      message: "Lỗi hệ thống khi lấy danh sách issue",
    });
  }
};
