import {
  checkProjectOwnership,
  validateKeywordIds,
} from "../services/keyword.service.js";

export const KEYWORD_CODES = {
  // Success
  KEYWORD_FETCHED: "KEYWORD_FETCHED",
  KEYWORD_LIST_FETCHED: "KEYWORD_LIST_FETCHED",
  KEYWORD_CREATED: "KEYWORD_CREATED",
  KEYWORD_UPDATED: "KEYWORD_UPDATED",
  KEYWORD_DELETED: "KEYWORD_DELETED",
  KEYWORD_RESTORED: "KEYWORD_RESTORED",

  // Client errors
  KEYWORD_INVALID_ID: "KEYWORD_INVALID_ID",
  KEYWORD_INVALID_BODY: "KEYWORD_INVALID_BODY",
  KEYWORD_NOT_FOUND: "KEYWORD_NOT_FOUND",
  KEYWORD_DUPLICATE: "KEYWORD_DUPLICATE",
  KEYWORD_ALREADY_DELETED: "KEYWORD_ALREADY_DELETED",
  KEYWORD_ALREADY_ACTIVE: "KEYWORD_ALREADY_ACTIVE",

  // Project/Watched specific codes (ÄÃ£ chuáº©n hÃ³a Ä‘á»“ng bá»™)
  PROJECT_INVALID_ID: "PROJECT_INVALID_ID",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",

  // Server error
  KEYWORD_SERVER_ERROR: "KEYWORD_SERVER_ERROR",
};

/**
 * Validate display_name cho keyword
 * DÃ¹ng cho POST vÃ  PUT trá»±c tiáº¿p vÃ o báº£ng Keyword
 */
export const validateKeywordBody = (req, res, next) => {
  const display_name = req.body.display_name?.trim();

  if (!display_name) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "TÃªn keyword khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng",
    });
  }
  if (display_name.length < 2) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "TÃªn keyword pháº£i cÃ³ Ã­t nháº¥t 2 kÃ½ tá»±",
    });
  }
  if (display_name.length > 255) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "TÃªn keyword khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 255 kÃ½ tá»±",
    });
  }
  if (/[!@#$%^&*()_+={}\[\]|\\:;"'<>,?\/~`]/.test(display_name)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "TÃªn keyword khÃ´ng Ä‘Æ°á»£c chá»©a kÃ½ tá»± Ä‘áº·c biá»‡t",
    });
  }
  if (/<[^>]*>/.test(display_name)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "TÃªn keyword khÃ´ng Ä‘Æ°á»£c chá»©a HTML hoáº·c script",
    });
  }

  req.body.display_name = display_name;
  return;
};

/**
 * Validate ID cá»§a báº£ng Keyword chÃ­nh
 */
export const validateKeywordId = (req, res, next) => {
  const idParam = req.params.id;

  // CHÃˆN FIX: Kiá»ƒm tra náº¿u ID chá»©a báº¥t ká»³ kÃ½ tá»± chá»¯ hoáº·c kÃ½ tá»± Ä‘áº·c biá»‡t nÃ o (vÃ­ dá»¥: "2dsaf", "abc")
  if (!/^\d+$/.test(idParam)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_ID,
      message: "ID tá»« Ä‘Æ°á»ng dáº«n khÃ´ng há»£p lá»‡, pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng",
    });
  }

  const id = parseInt(idParam, 10);
  if (id <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_ID,
      message: "ID pháº£i lá»›n hÆ¡n 0",
    });
  }

  req.keywordId = id;
  return;
};

/**
 * Middleware validate cÃ¡c tham sá»‘ vÃ  quyá»n cho viá»‡c xÃ³a tá»« khÃ³a theo dÃµi.
 */
export const validateDeleteWatchedKeyword = async (req, res) => {
  const projectId = parseInt(req.params.id);
  const keywordId = parseInt(req.params.keywordId);

  if (isNaN(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.PROJECT_INVALID_ID,
      message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡",
    });
  }

  if (isNaN(keywordId) || keywordId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_ID,
      message: "ID tá»« khÃ³a khÃ´ng há»£p lá»‡",
    });
  }

  const userId = req.user.user_id;
  try {
    const isOwner = await checkProjectOwnership(projectId, userId);

    if (!isOwner) {
      return res.status(404).json({
        success: false,
        code: KEYWORD_CODES.PROJECT_NOT_FOUND,
        message:
          "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y",
      });
    }

    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_SERVER_ERROR,
      message: "Lá»—i há»‡ thá»‘ng khi xÃ¡c thá»±c quyá»n truy cáº­p dá»± Ã¡n",
    });
  }
};

/**
 * Middleware validate cÃ¡c tham sá»‘ vÃ  quyá»n cho viá»‡c ghi Ä‘Ã¨ (thay tháº¿) danh sÃ¡ch tá»« khÃ³a theo dÃµi.
 */
export const validateUpdateWatchedKeywords = async (req, res) => {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.PROJECT_INVALID_ID,
      message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡",
    });
  }

  const { keyword_ids } = req.body || {};

  if (!Array.isArray(keyword_ids)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "keyword_ids pháº£i lÃ  má»™t máº£ng",
    });
  }

  if (keyword_ids.length > 0) {
    const isValid = keyword_ids.every((id) => Number.isInteger(id) && id > 0);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
        message: "CÃ¡c pháº§n tá»­ trong keyword_ids pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng",
      });
    }
  }

  const userId = req.user.user_id;
  try {
    const isOwner = await checkProjectOwnership(projectId, userId);

    if (!isOwner) {
      return res.status(404).json({
        success: false,
        code: KEYWORD_CODES.PROJECT_NOT_FOUND,
        message:
          "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y",
      });
    }

    if (keyword_ids.length > 0) {
      const allExist = await validateKeywordIds(keyword_ids);
      if (!allExist) {
        return res.status(400).json({
          success: false,
          code: KEYWORD_CODES.KEYWORD_NOT_FOUND,
          message: "Má»™t hoáº·c nhiá»u ID tá»« khÃ³a khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng",
        });
      }
    }

    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_SERVER_ERROR,
      message: "Lá»—i há»‡ thá»‘ng khi xÃ¡c thá»±c quyá»n truy cáº­p dá»± Ã¡n",
    });
  }
};

/**
 * Middleware validate cÃ¡c tham sá»‘ vÃ  quyá»n cho viá»‡c táº¡o má»›i (thÃªm nhiá»u) tá»« khÃ³a theo dÃµi.
 */
export const validateCreateWatchedKeyword = async (req, res) => {
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.PROJECT_INVALID_ID,
      message: "ID dá»± Ã¡n khÃ´ng há»£p lá»‡",
    });
  }

  const { keyword_ids } = req.body || {};

  if (!Array.isArray(keyword_ids)) {
    return res.status(400).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
      message: "keyword_ids pháº£i lÃ  má»™t máº£ng",
    });
  }

  if (keyword_ids.length > 0) {
    const isValid = keyword_ids.every((id) => Number.isInteger(id) && id > 0);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        code: KEYWORD_CODES.KEYWORD_INVALID_BODY,
        message: "CÃ¡c pháº§n tá»­ trong keyword_ids pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng",
      });
    }
  }

  const userId = req.user.user_id;
  try {
    const isOwner = await checkProjectOwnership(projectId, userId);

    if (!isOwner) {
      return res.status(404).json({
        success: false,
        code: KEYWORD_CODES.PROJECT_NOT_FOUND,
        message:
          "KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n hoáº·c báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n nÃ y",
      });
    }

    if (keyword_ids.length > 0) {
      const allExist = await validateKeywordIds(keyword_ids);
      if (!allExist) {
        return res.status(400).json({
          success: false,
          code: KEYWORD_CODES.KEYWORD_NOT_FOUND,
          message: "Má»™t hoáº·c nhiá»u ID tá»« khÃ³a khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng",
        });
      }
    }

    return;
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: KEYWORD_CODES.KEYWORD_SERVER_ERROR,
      message: "Lá»—i há»‡ thá»‘ng khi xÃ¡c thá»±c quyá»n truy cáº­p dá»± Ã¡n",
    });
  }
};

