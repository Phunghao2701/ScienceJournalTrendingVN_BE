/**
 * Middleware validate article_id trong body khi thêm bookmark
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateAddBookmark = (req, res, next) => {
  const { article_id } = req.body;

  if (article_id === undefined || article_id === null || !/^\d+$/.test(String(article_id)) || Number(article_id) <= 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ARTICLE_ID',
      message: 'article_id không hợp lệ',
    });
  }

  next();
};

/**
 * Middleware validate article_id trên URL param khi bỏ bookmark
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
export const validateArticleIdParam = (req, res, next) => {
  const { articleId } = req.params;

  if (!/^\d+$/.test(articleId) || Number(articleId) <= 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ARTICLE_ID',
      message: 'article_id không hợp lệ',
    });
  }

  next();
};
