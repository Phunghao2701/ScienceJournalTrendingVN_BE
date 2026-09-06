import pool from "../../../config/database.js";

/**
 * Helper kiểm tra một giá trị có phải l�  chuỗi/số chỉ chứa các chữ số v�  lớn hơn 0 hay không.
 */
export const isValidPositiveInt = (val) => {
  if (val === undefined || val === null || val === "") return false;
  const strVal = String(val);
  return /^\d+$/.test(strVal) && Number(strVal) > 0;
};

/**
 * Middleware kiểm tra URL parameter id phải l�  số nguyên dương hợp lệ.
 */
export const validateTopicId = (req, res, next) => {
  const { id } = req.params;

  if (!isValidPositiveInt(id)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_TOPIC_ID",
      message: "Id không hợp lệ, phải l�  số nguyên dương (không chứa chữ hoặc ký tự đặc biệt)"
    });
  }

  next();
};

