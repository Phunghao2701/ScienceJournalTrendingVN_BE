export const keywordValidation = (req, res, next) => {
  const { keyword } = req.params;

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({
      success: false,
      code: "INVALID_KEYWORD",
      message: "Keyword không được để trống",
    });
  }

  next();
};