import * as zoneService from '../services/zone.service.js';
import logger from '../../../utils/logger.js';

export const getCountryStats = async (request, reply) => {
  try {
    let page = 1;
    let limit = 10;

    if (request.query.page !== undefined) {
      page = Number(request.query.page);
      if (!Number.isInteger(page) || page <= 0) return reply.status(400).send({ success: false, code: "PAGE_INVALID", message: "Trang phải l�  số nguyên dương" });
    }

    if (request.query.limit !== undefined) {
      limit = Number(request.query.limit);
      if (!Number.isInteger(limit) || limit <= 0) return reply.status(400).send({ success: false, code: "LIMIT_INVALID", message: "Số lượng phần tử mỗi trang phải l�  số nguyên dương" });
    }

    let year = request.query.year || request.query.publication_year;
    if (year !== undefined && year !== '') {
      if (isNaN(Number(year))) return reply.status(400).send({ success: false, code: "YEAR_INVALID", message: "Năm phải l�  số" });
      year = Number(year);
    } else {
      year = undefined;
    }

    const { countries, total } = await zoneService.getCountryStats({ page, limit, year });

    return reply.status(200).send({
      success: true,
      code: "GET_COUNTRY_STATS_SUCCESS",
      message: "Lấy danh sách thống kê quốc gia th� nh công",
      data: countries,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách thống kê quốc gia:", error);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi lấy thống kê quốc gia" });
  }
};

export const getRegionStats = async (request, reply) => {
  try {
    const countryCode = request.query.country_code || request.query.countryCode;
    const regions = await zoneService.getRegionStats({ countryCode });
    return reply.status(200).send({ success: true, code: "GET_REGION_STATS_SUCCESS", message: countryCode ? `Lấy danh sách phân vùng của quốc gia '${countryCode}' th� nh công` : "Lấy danh sách phân vùng to� n cầu th� nh công", data: regions });
  } catch (error) {
    logger.error("Lỗi khi lấy thống kê phân vùng:", error);
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.statusCode === 400 ? "REGION_STATS_ERROR" : "SERVER_ERROR", message: error.message });
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi lấy thống kê phân vùng" });
  }
};

export const getCountryRegionsStats = async (request, reply) => {
  try {
    const { code } = request.params;
    if (!code || code.trim() === "") return reply.status(400).send({ success: false, code: "COUNTRY_CODE_REQUIRED", message: "Mã quốc gia không được để trống" });

    const result = await zoneService.getCountryRegionsStats(code.trim());
    return reply.status(200).send({ success: true, code: "GET_COUNTRY_REGIONS_STATS_SUCCESS", message: "Lấy thống kê region theo quốc gia th� nh công", data: { country: result.country, regions: result.regions } });
  } catch (error) {
    logger.error(`Lỗi khi lấy thống kê phân vùng cho quốc gia ${request.params?.code}:`, error);
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.statusCode === 400 ? "COUNTRY_REGIONS_STATS_ERROR" : "SERVER_ERROR", message: error.message });
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lỗi hệ thống khi lấy thống kê phân vùng theo quốc gia" });
  }
};



