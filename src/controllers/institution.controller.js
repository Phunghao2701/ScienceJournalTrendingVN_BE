import * as institutionService from "../services/institution.service.js";

export const getInstitutions = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = "" } = req.query;
    const result = await institutionService.getInstitutions({ page, limit, search });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách cơ sở giáo dục thành công",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách cơ sở giáo dục",
      errorCode: "INTERNAL_ERROR",
      error: error.message,
    });
  }
};
