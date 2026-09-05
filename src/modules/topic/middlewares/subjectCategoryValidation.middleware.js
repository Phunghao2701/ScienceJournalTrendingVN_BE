import pool from "../../../config/database.js";
import { subjectAreaExist, subjectAreaIsDeleted } from '../../topic/services/subjectArea.service.js';
import { subjectCategoryExist, subjectCategoryIsDeleted, checkDuplicateSubjectCategory } from '../../topic/services/subjectCategory.service.js';

/**
 * Middleware kiá»ƒm tra URL parameter id pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng há»£p lá»‡.
 */
export const validateSubjectCategoryId = (req, res, next) => {
  const { id } = req.params;
  const idNumber = Number(id);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    return res.status(400).json({
      success: false,
      message: "Subject Category ID khÃ´ng há»£p lá»‡",
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
 * Middleware kiá»ƒm tra tÃ­nh há»£p lá»‡ khi táº¡o má»›i má»™t Subject Category.
 */
export const validateCreateSubjectCategory = async (req, res) => {
  try {
    const { subject_area_id, display_name } = req.body;

    // 1. Kiá»ƒm tra trÆ°á»ng subject_area_id
    if (subject_area_id === undefined || subject_area_id === null) {
      return res.status(400).json({
        success: false,
        message: "MÃ£ lÄ©nh vá»±c subject_area_id khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng",
        code: "INVALID_SUBJECT_AREA_ID",
        data: null
      });
    }

    const areaIdNum = Number(subject_area_id);
    if (!Number.isInteger(areaIdNum) || areaIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "MÃ£ lÄ©nh vá»±c subject_area_id pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng há»£p lá»‡",
        code: "INVALID_SUBJECT_AREA_ID",
        data: null
      });
    }

    // Kiá»ƒm tra sá»± tá»“n táº¡i vÃ  hoáº¡t Ä‘á»™ng cá»§a Subject Area
    const areaExists = await subjectAreaExist(areaIdNum);
    const areaDeleted = areaExists ? await subjectAreaIsDeleted(areaIdNum) : false;

    if (!areaExists || areaDeleted) {
      return res.status(400).json({
        success: false,
        message: "LÄ©nh vá»±c há»c thuáº­t (Subject Area) khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ xÃ³a",
        code: "INVALID_SUBJECT_AREA_ID",
        data: null
      });
    }

    // 2. Kiá»ƒm tra trÆ°á»ng display_name
    if (display_name === undefined || display_name === null || typeof display_name !== "string" || display_name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "TÃªn hiá»ƒn thá»‹ display_name khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng vÃ  pháº£i lÃ  má»™t chuá»—i kÃ½ tá»±",
        code: "INVALID_DISPLAY_NAME",
        data: null
      });
    }

    // 3. Kiá»ƒm tra trÃ¹ng láº·p display_name trong cÃ¹ng subject_area_id
    const { duplicateName } = await checkDuplicateSubjectCategory(areaIdNum, display_name);

    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: "TÃªn hiá»ƒn thá»‹ display_name Ä‘Ã£ tá»“n táº¡i trong lÄ©nh vá»±c nÃ y",
        code: "DUPLICATE_DISPLAY_NAME",
        data: null
      });
    }

    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u táº¡o Subject Category",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};

/**
 * Middleware kiá»ƒm tra tÃ­nh há»£p lá»‡ khi cáº­p nháº­t má»™t Subject Category.
 */
export const validateUpdateSubjectCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_area_id, display_name } = req.body;

    // 1. Kiá»ƒm tra sá»± tá»“n táº¡i cá»§a Subject Category
    const exists = await subjectCategoryExist(id);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y Subject Category",
        code: "SUBJECT_CATEGORY_NOT_FOUND",
        data: null
      });
    }

    // 2. Cháº·n cáº­p nháº­t náº¿u Ä‘Ã£ bá»‹ xÃ³a má»m
    const isDeleted = await subjectCategoryIsDeleted(id);
    if (isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Subject Category Ä‘Ã£ bá»‹ xÃ³a má»m, khÃ´ng thá»ƒ cáº­p nháº­t",
        code: "SUBJECT_CATEGORY_ALREADY_DELETED",
        data: null
      });
    }

    // 3. Láº¥y thÃ´ng tin hiá»‡n táº¡i cá»§a Subject Category trong DB
    const currentRes = await prisma.$queryRawUnsafe(
      `SELECT subject_area_id, display_name FROM "Subject_Category" WHERE subject_category_id = $1`,
      [BigInt(id)]
    );
    const current = currentRes[0];

    let targetAreaId = current.subject_area_id;

    // 4. Náº¿u cáº­p nháº­t subject_area_id
    if (subject_area_id !== undefined) {
      if (subject_area_id === null) {
        return res.status(400).json({
          success: false,
          message: "MÃ£ lÄ©nh vá»±c subject_area_id khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng",
          code: "INVALID_SUBJECT_AREA_ID",
          data: null
        });
      }

      const areaIdNum = Number(subject_area_id);
      if (!Number.isInteger(areaIdNum) || areaIdNum <= 0) {
        return res.status(400).json({
          success: false,
          message: "MÃ£ lÄ©nh vá»±c subject_area_id pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng há»£p lá»‡",
          code: "INVALID_SUBJECT_AREA_ID",
          data: null
        });
      }

      const areaExists = await subjectAreaExist(areaIdNum);
      const areaDeleted = areaExists ? await subjectAreaIsDeleted(areaIdNum) : false;

      if (!areaExists || areaDeleted) {
        return res.status(400).json({
          success: false,
          message: "LÄ©nh vá»±c há»c thuáº­t (Subject Area) khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ xÃ³a",
          code: "INVALID_SUBJECT_AREA_ID",
          data: null
        });
      }

      targetAreaId = BigInt(areaIdNum);
    }

    // 5. Náº¿u cáº­p nháº­t display_name
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

    // 6. Kiá»ƒm tra trÃ¹ng láº·p display_name trong cÃ¹ng targetAreaId
    const finalName = display_name !== undefined ? display_name : current.display_name;

    const { duplicateName } = await checkDuplicateSubjectCategory(targetAreaId, finalName, id);

    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: "TÃªn hiá»ƒn thá»‹ display_name Ä‘Ã£ tá»“n táº¡i trong lÄ©nh vá»±c nÃ y",
        code: "DUPLICATE_DISPLAY_NAME",
        data: null
      });
    }

    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u cáº­p nháº­t Subject Category",
      code: "SERVER_VALIDATION_ERROR",
      data: null,
      error: error.message
    });
  }
};




