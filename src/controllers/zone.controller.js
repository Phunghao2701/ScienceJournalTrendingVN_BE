import * as zoneService from "../services/zone.service.js";
import logger from "../utils/logger.js";

/**
 * Controller lấy danh sách thống kê sản lượng bài viết của tất cả quốc gia (có phân trang).
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.page] - Số trang cần lấy.
 * @param {string} [req.query.limit] - Số lượng phần tử mỗi trang.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON phản hồi kèm dữ liệu quốc gia và phân trang.
 */
export const getCountryStats = async (req, res) => {
  try {
    let page = 1;
    let limit = 10;

    if (req.query.page !== undefined) {
      page = Number(req.query.page);
      if (!Number.isInteger(page) || page <= 0) {
        return res.status(400).json({
          success: false,
          code: "PAGE_INVALID",
          message: "Trang phải là số nguyên dương",
        });
      }
    }

    if (req.query.limit !== undefined) {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit <= 0) {
        return res.status(400).json({
          success: false,
          code: "LIMIT_INVALID",
          message: "Số lượng phần tử mỗi trang phải là số nguyên dương",
        });
      }
    }

    const { countries, total } = await zoneService.getCountryStats({
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      code: "GET_COUNTRY_STATS_SUCCESS",
      message: "Lấy danh sách thống kê quốc gia thành công",
      data: countries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách thống kê quốc gia:", error);
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi lấy thống kê quốc gia",
    });
  }
};

/**
 * Controller lấy thống kê sản lượng bài viết theo phân vùng (Region).
 * Hỗ trợ tham số truy vấn lọc theo quốc gia: `country_code` hoặc `countryCode`.
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.country_code] - Mã quốc gia để lọc.
 * @param {string} [req.query.countryCode] - Mã quốc gia để lọc (tùy chọn thay thế).
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON phản hồi kèm dữ liệu phân vùng.
 */
export const getRegionStats = async (req, res) => {
  try {
    const countryCode = req.query.country_code || req.query.countryCode;

    const regions = await zoneService.getRegionStats({ countryCode });

    return res.status(200).json({
      success: true,
      code: "GET_REGION_STATS_SUCCESS",
      message: countryCode
        ? `Lấy danh sách phân vùng của quốc gia '${countryCode}' thành công`
        : "Lấy danh sách phân vùng toàn cầu thành công",
      data: regions,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy thống kê phân vùng:", error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.statusCode === 400 ? "REGION_STATS_ERROR" : "SERVER_ERROR",
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi lấy thống kê phân vùng",
    });
  }
};

/**
 * Controller lấy thống kê phân vùng nội bộ (Region) của một quốc gia cụ thể qua tham số URL.
 *
 * @async
 * @param {import('express').Request} req - Express request.
 * @param {Object} req.params - Tham số định tuyến.
 * @param {string} req.params.code - Mã quốc gia (ví dụ: 'US', 'VN').
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} JSON phản hồi kèm dữ liệu phân vùng của quốc gia đó.
 */
export const getCountryRegionsStats = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.trim() === "") {
      return res.status(400).json({
        success: false,
        code: "COUNTRY_CODE_REQUIRED",
        message: "Mã quốc gia không được để trống",
      });
    }

    const result = await zoneService.getCountryRegionsStats(code.trim());

    return res.status(200).json({
      success: true,
      code: "GET_COUNTRY_REGIONS_STATS_SUCCESS",
      message: "Lấy thống kê region theo quốc gia thành công",
      data: {
        country: result.country,
        regions: result.regions,
      },
    });
  } catch (error) {
    logger.error(
      `Lỗi khi lấy thống kê phân vùng cho quốc gia ${req.params?.code}:`,
      error,
    );

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code:
          error.statusCode === 400
            ? "COUNTRY_REGIONS_STATS_ERROR"
            : "SERVER_ERROR",
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Lỗi hệ thống khi lấy thống kê phân vùng theo quốc gia",
    });
  }
};
