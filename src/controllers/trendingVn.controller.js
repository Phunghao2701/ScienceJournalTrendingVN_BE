import * as trendingVnService from "../services/trendingVn.service.js";
import logger from "../utils/logger.js";

export const getTopJournals = async (req, res) => {
  try {
    const result = await trendingVnService.getTopJournals({
      years: req.query.years,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      code: "TRENDING_VN_TOP_JOURNALS_SUCCESS",
      message: "Lấy danh sách top journal VN thành công!",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy top journals VN:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};

export const getTopUniversities = async (req, res) => {
  try {
    const result = await trendingVnService.getTopUniversities({
      years: req.query.years,
      limit: req.query.limit,
      hot_limit: req.query.hot_limit,
    });

    return res.status(200).json({
      success: true,
      code: "TRENDING_VN_TOP_UNIVERSITIES_SUCCESS",
      message: "Lấy danh sách top university VN thành công!",
      data: result,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy top universities VN:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Có lỗi xảy ra ở Server!",
    });
  }
};
