import * as zoneService from '../services/zone.service.js';
import logger from '../../../utils/logger.js';

export const getCountryStats = async (request, reply) => {
  try {
    let page = 1;
    let limit = 10;

    if (request.query.page !== undefined) {
      page = Number(request.query.page);
      if (!Number.isInteger(page) || page <= 0) return reply.status(400).send({ success: false, code: "PAGE_INVALID", message: "Trang pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
    }

    if (request.query.limit !== undefined) {
      limit = Number(request.query.limit);
      if (!Number.isInteger(limit) || limit <= 0) return reply.status(400).send({ success: false, code: "LIMIT_INVALID", message: "Sá»‘ lÆ°á»£ng pháº§n tá»­ má»—i trang pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
    }

    let year = request.query.year || request.query.publication_year;
    if (year !== undefined && year !== '') {
      if (isNaN(Number(year))) return reply.status(400).send({ success: false, code: "YEAR_INVALID", message: "NÄƒm pháº£i lÃ  sá»‘" });
      year = Number(year);
    } else {
      year = undefined;
    }

    const { countries, total } = await zoneService.getCountryStats({ page, limit, year });

    return reply.status(200).send({
      success: true,
      code: "GET_COUNTRY_STATS_SUCCESS",
      message: "Láº¥y danh sÃ¡ch thá»‘ng kÃª quá»‘c gia thÃ nh cÃ´ng",
      data: countries,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y danh sÃ¡ch thá»‘ng kÃª quá»‘c gia:", error);
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y thá»‘ng kÃª quá»‘c gia" });
  }
};

export const getRegionStats = async (request, reply) => {
  try {
    const countryCode = request.query.country_code || request.query.countryCode;
    const regions = await zoneService.getRegionStats({ countryCode });
    return reply.status(200).send({ success: true, code: "GET_REGION_STATS_SUCCESS", message: countryCode ? `Láº¥y danh sÃ¡ch phÃ¢n vÃ¹ng cá»§a quá»‘c gia '${countryCode}' thÃ nh cÃ´ng` : "Láº¥y danh sÃ¡ch phÃ¢n vÃ¹ng toÃ n cáº§u thÃ nh cÃ´ng", data: regions });
  } catch (error) {
    logger.error("Lá»—i khi láº¥y thá»‘ng kÃª phÃ¢n vÃ¹ng:", error);
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.statusCode === 400 ? "REGION_STATS_ERROR" : "SERVER_ERROR", message: error.message });
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y thá»‘ng kÃª phÃ¢n vÃ¹ng" });
  }
};

export const getCountryRegionsStats = async (request, reply) => {
  try {
    const { code } = request.params;
    if (!code || code.trim() === "") return reply.status(400).send({ success: false, code: "COUNTRY_CODE_REQUIRED", message: "MÃ£ quá»‘c gia khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng" });

    const result = await zoneService.getCountryRegionsStats(code.trim());
    return reply.status(200).send({ success: true, code: "GET_COUNTRY_REGIONS_STATS_SUCCESS", message: "Láº¥y thá»‘ng kÃª region theo quá»‘c gia thÃ nh cÃ´ng", data: { country: result.country, regions: result.regions } });
  } catch (error) {
    logger.error(`Lá»—i khi láº¥y thá»‘ng kÃª phÃ¢n vÃ¹ng cho quá»‘c gia ${request.params?.code}:`, error);
    if (error.statusCode) return reply.status(error.statusCode).send({ success: false, code: error.statusCode === 400 ? "COUNTRY_REGIONS_STATS_ERROR" : "SERVER_ERROR", message: error.message });
    return reply.status(500).send({ success: false, code: "SERVER_ERROR", message: "Lá»—i há»‡ thá»‘ng khi láº¥y thá»‘ng kÃª phÃ¢n vÃ¹ng theo quá»‘c gia" });
  }
};



