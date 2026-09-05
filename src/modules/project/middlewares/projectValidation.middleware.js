export const validateProjectId = (req, res, next) => {
  const projectId = req.params.id;

  if (!/^\d+$/.test(projectId) || Number(projectId) <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PROJECT_ID",
      message: 'ID dự án không hợp lệ'
    });
  }

  next();
};

export const validateCreateProject = (req, res, next) => {
  const { title, subject_category_ids = [], journal_ids = [] } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({
      success: false,
      code: "INVALID_PROJECT_TITLE",
      message: 'Tiêu đề dự án không được để trống'
    });
  }

  if (!Array.isArray(subject_category_ids)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_SUBJECT_CATEGORY_IDS",
      message: 'subject_category_ids phải là một mảng các ID'
    });
  }

  if (!Array.isArray(journal_ids)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_JOURNAL_IDS",
      message: 'journal_ids phải là một mảng các ID'
    });
  }

  next();
};

export const validateUpdateProject = (req, res, next) => {
  const { title, subject_category_ids, journal_ids } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({
      success: false,
      code: "INVALID_PROJECT_TITLE",
      message: 'Tiêu đề dự án không được để trống'
    });
  }

  if (subject_category_ids !== undefined && !Array.isArray(subject_category_ids)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_SUBJECT_CATEGORY_IDS",
      message: 'subject_category_ids phải là một mảng các ID'
    });
  }

  if (journal_ids !== undefined && !Array.isArray(journal_ids)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_JOURNAL_IDS",
      message: 'journal_ids phải là một mảng các ID'
    });
  }

  next();
};

export const validateRelatedArticlesLimit = (req, res, next) => {
  if (req.query.limit !== undefined) {
    const limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LIMIT",
        message: 'Giá trị limit không hợp lệ'
      });
    }
  }
  next();
};
