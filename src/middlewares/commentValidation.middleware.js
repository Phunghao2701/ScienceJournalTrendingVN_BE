/**
 * Middleware validate nội dung comment khi tạo mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateCreateComment = (req, res, next) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({
      success: false,
      code: 'CONTENT_REQUIRED',
      message: 'Nội dung comment không được để trống',
    });
  }

  next();
};

/**
 * Middleware validate ID comment trên URL param
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateCommentId = (req, res, next) => {
  const { commentId } = req.params;

  if (!/^\d+$/.test(commentId) || Number(commentId) <= 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_COMMENT_ID',
      message: 'ID comment không hợp lệ',
    });
  }

  next();
};

/**
 * Middleware validate cho việc cập nhật comment (ID param + content trong body)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateUpdateComment = (req, res, next) => {
  validateCommentId(req, res, () => validateCreateComment(req, res, next));
};
