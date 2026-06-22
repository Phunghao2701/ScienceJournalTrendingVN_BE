import pool from "../config/database.js";

/**
 * Helper kiểm tra một giá trị có phải là chuỗi/số chỉ chứa các chữ số và lớn hơn 0 hay không.
 */
export const isValidPositiveInt = (val) => {
  if (val === undefined || val === null || val === "") return false;
  const strVal = String(val);
  return /^\d+$/.test(strVal) && Number(strVal) > 0;
};

/**
 * Middleware kiểm tra URL parameter id phải là số nguyên dương hợp lệ.
 */
export const validateTopicId = (req, res, next) => {
  const { id } = req.params;

  if (!isValidPositiveInt(id)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_TOPIC_ID",
      message: "Id không hợp lệ, phải là số nguyên dương (không chứa chữ hoặc ký tự đặc biệt)"
    });
  }

  next();
};
