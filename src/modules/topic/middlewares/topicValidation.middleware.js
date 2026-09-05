import pool from "../../../config/database.js";

/**
 * Helper kiá»ƒm tra má»™t giÃ¡ trá»‹ cÃ³ pháº£i lÃ  chuá»—i/sá»‘ chá»‰ chá»©a cÃ¡c chá»¯ sá»‘ vÃ  lá»›n hÆ¡n 0 hay khÃ´ng.
 */
export const isValidPositiveInt = (val) => {
  if (val === undefined || val === null || val === "") return false;
  const strVal = String(val);
  return /^\d+$/.test(strVal) && Number(strVal) > 0;
};

/**
 * Middleware kiá»ƒm tra URL parameter id pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng há»£p lá»‡.
 */
export const validateTopicId = (req, res, next) => {
  const { id } = req.params;

  if (!isValidPositiveInt(id)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_TOPIC_ID",
      message: "Id khÃ´ng há»£p lá»‡, pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng (khÃ´ng chá»©a chá»¯ hoáº·c kÃ½ tá»± Ä‘áº·c biá»‡t)"
    });
  }

  next();
};

