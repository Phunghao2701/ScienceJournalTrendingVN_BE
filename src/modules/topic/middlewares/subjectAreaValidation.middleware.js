import pool from "../../../config/database.js";
import { subjectAreaExist, subjectAreaIsDeleted, checkDuplicateSubjectArea } from '../../topic/services/subjectArea.service.js';

/**
 * Middleware kiá»ƒm tra URL parameter id pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng há»£p lá»‡.
 */
export const validateSubjectAreaId = (req, res, next) => {
  const { id } = req.params;
  const idNumber = Number(id);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    return res.status(400).json({
      success: false,
      message: "Subject Area ID khÃ´ng há»£p lá»‡",
      code: "INVALID_ID",
      data: null
    });
  }

  return;
};

/**
 * Middleware kiá»ƒm tra tÃ­nh há»£p lá»‡ cá»§a phÃ¢n trang (page, limit).
 */
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page !== undefined && page !== null) {
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Trang (page) pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng",
        code: "INVALID_PAGE",
        data: null
      });
    }
  }

  if (limit !== undefined && limit !== null) {
    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Sá»‘ lÆ°á»£ng báº£n ghi má»—i trang (limit) pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng",
        code: "INVALID_LIMIT",
        data: null
      });
    }
  }

  return;
};

/**
 * Middleware kiá»ƒm tra tÃ­nh há»£p lá»‡ khi táº¡o má»›i má»™t Subject Area.
 */
export const validateCreateSubjectArea = async (req, res) => {
  try {
    const { display_name } = req.body;

    // 1. Kiá»ƒm tra trÆ°á»ng display_name
    if (display_name === undefined || display_name === null || typeof display_name !== "string" || display_name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "TÃªn hiá»ƒn thá»‹ display_name khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng vÃ  pháº£i lÃ  má»™t chuá»—i kÃ½ tá»±",
        code: "INVALID_DISPLAY_NAME",
        data: null
      });
    }

    // 2. Kiá»ƒm tra trÃ¹ng láº·p trong DB
    const { duplicateName } = await checkDuplicateSubjectArea(display_name);

    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: "TÃªn hiá»ƒn thá»‹ display_name Ä‘Ã£ tá»“n táº¡i trong há»‡ thá»‘ng",
        code: "DUPLICATE_DISPLAY_NAME",
        data: null
      });
    }

    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u táº¡o Subject Area",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};

/**
 * Middleware kiá»ƒm tra tÃ­nh há»£p lá»‡ khi cáº­p nháº­t má»™t Subject Area.
 */
export const validateUpdateSubjectArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name } = req.body;

    // 1. Kiá»ƒm tra xem Subject Area cÃ³ tá»“n táº¡i khÃ´ng
    const exists = await subjectAreaExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y Subject Area",
        code: "SUBJECT_AREA_NOT_FOUND",
        data: null
      });
    }

    // 2. Cháº·n cáº­p nháº­t náº¿u Ä‘Ã£ bá»‹ xÃ³a má»m
    const isDeleted = await subjectAreaIsDeleted(id);
    if (isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Subject Area Ä‘Ã£ bá»‹ xÃ³a má»m, khÃ´ng thá»ƒ cáº­p nháº­t",
        code: "SUBJECT_AREA_ALREADY_DELETED",
        data: null
      });
    }

    // 3. Kiá»ƒm tra display_name náº¿u cÃ³ truyá»n lÃªn
    if (display_name !== undefined) {
      if (display_name === null || typeof display_name !== "string" || display_name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "TÃªn hiá»ƒn thá»‹ display_name khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng",
          code: "INVALID_DISPLAY_NAME",
          data: null
        });
      }
    }

    // 4. Kiá»ƒm tra trÃ¹ng láº·p display_name
    if (display_name !== undefined) {
      const currentRes = await prisma.$queryRawUnsafe(
        `SELECT display_name FROM "Subject_Area" WHERE subject_area_id = $1`,
        [BigInt(id)]
      );
      const current = currentRes[0];
      const finalName = display_name;

      const { duplicateName } = await checkDuplicateSubjectArea(finalName, id);

      if (duplicateName) {
        return res.status(400).json({
          success: false,
          message: "TÃªn hiá»ƒn thá»‹ display_name Ä‘Ã£ tá»“n táº¡i trong há»‡ thá»‘ng",
          code: "DUPLICATE_DISPLAY_NAME",
          data: null
        });
      }
    }

    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u cáº­p nháº­t Subject Area",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};




