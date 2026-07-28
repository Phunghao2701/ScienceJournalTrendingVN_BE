import * as institutionService from "../services/institution.service.js";

export const getInstitutionById = async (req, res) => {
  try {
    const institutionId = Number(req.params.id);
    if (!Number.isInteger(institutionId) || institutionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã cơ sở nghiên cứu không hợp lệ",
        errorCode: "INVALID_INSTITUTION_ID",
      });
    }

    const institution = await institutionService.getInstitutionById(institutionId);
    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cơ sở nghiên cứu",
        errorCode: "INSTITUTION_NOT_FOUND",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy chi tiết cơ sở nghiên cứu thành công",
      data: institution,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy chi tiết cơ sở nghiên cứu",
      errorCode: "INTERNAL_ERROR",
      error: error.message,
    });
  }
};

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
