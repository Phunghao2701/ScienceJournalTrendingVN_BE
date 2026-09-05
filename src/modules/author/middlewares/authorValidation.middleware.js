export const AUTHOR_CODES = {
  AUTHOR_LIST_FETCHED: "AUTHOR_LIST_FETCHED",
  AUTHOR_FETCHED: "AUTHOR_FETCHED",
  AUTHOR_CREATED: "AUTHOR_CREATED",
  AUTHOR_UPDATED: "AUTHOR_UPDATED",
  AUTHOR_DELETED: "AUTHOR_DELETED",
  AUTHOR_RESTORED: "AUTHOR_RESTORED",
  AUTHOR_INVALID_LIMIT: "AUTHOR_INVALID_LIMIT",
  AUTHOR_ARTICLES_FETCHED: "AUTHOR_ARTICLES_FETCHED",
  AUTHOR_LEADERBOARD_FETCHED: "AUTHOR_LEADERBOARD_FETCHED",
  AREA_BREAKDOWN_FETCHED: "AREA_BREAKDOWN_FETCHED",
  AUTHOR_INVALID_ID: "AUTHOR_INVALID_ID",
  AUTHOR_INVALID_BODY: "AUTHOR_INVALID_BODY",
  AUTHOR_NOT_FOUND: "AUTHOR_NOT_FOUND",
  AUTHOR_ALREADY_DELETED: "AUTHOR_ALREADY_DELETED",
  AUTHOR_ALREADY_ACTIVE: "AUTHOR_ALREADY_ACTIVE",
  AUTHOR_INVALID_PAGINATION: "AUTHOR_INVALID_PAGINATION",
  AUTHOR_SERVER_ERROR: "AUTHOR_SERVER_ERROR",
};

const VALID_NAME_REGEX = /^[\p{L}]+(?:[\s'-][\p{L}]+)*$/u;

export const validateAuthorId = async (request, reply) => {
  const idParam = request.params.id;
  if (!/^\d+$/.test(idParam)) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_ID, message: "ID tác giả không hợp lệ, phải là số nguyên dương" });

  const id = parseInt(idParam, 10);
  if (id <= 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_ID, message: "ID tác giả không hợp lệ, phải lớn hơn 0" });

  request.authorId = id;
};

export const validatePagination = async (request, reply) => {
  const page = parseInt(request.query.page) || 1;
  const limit = parseInt(request.query.limit) || 10;

  if (page < 1) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION, message: "Giá trị page không hợp lệ, phải >= 1" });
  if (limit < 1 || limit > 100) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_PAGINATION, message: "Giá trị limit không hợp lệ, phải từ 1 đến 100" });

  request.pagination = { page, limit };
};

export const validateCreateAuthor = async (request, reply) => {
  const { display_name } = request.body;
  if (!display_name || display_name.trim() === "") return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name không được để trống" });

  const trimmedName = display_name.trim();
  if (trimmedName.length < 2) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name phải có ít nhất 2 ký tự" });
  if (trimmedName.length > 255) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name không được vượt quá 255 ký tự" });
  if (/<[^>]*>/.test(trimmedName)) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name không được chứa HTML hoặc script" });
  if (!VALID_NAME_REGEX.test(trimmedName)) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name không được chứa ký tự đặc biệt" });

  request.body.display_name = trimmedName;
};

export const validateUpdateAuthor = async (request, reply) => {
  const allowedFields = ["display_name", "orcid", "url_image", "homepage_url", "works_count", "cited_by_count", "h_index", "i10_index", "last_known_institution", "last_known_institution_id"];
  const body = request.body;
  const hasValidField = allowedFields.some((f) => body[f] !== undefined);

  if (!hasValidField) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "Cần có ít nhất một field hợp lệ để cập nhật" });

  if (body.display_name !== undefined) {
    const trimmedName = body.display_name.trim();
    if (trimmedName === "") return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name không được để trống" });
    if (trimmedName.length < 2) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name phải có ít nhất 2 ký tự" });
    if (/<[^>]*>/.test(trimmedName)) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name không được chứa HTML hoặc script" });
    if (!VALID_NAME_REGEX.test(trimmedName)) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: "display_name không được chứa ký tự đặc biệt" });

    request.body.display_name = trimmedName;
  }

  const intFields = ["works_count", "cited_by_count", "h_index", "i10_index"];
  for (const field of intFields) {
    if (body[field] !== undefined) {
      const val = parseInt(body[field]);
      if (isNaN(val) || val < 0) return reply.status(400).send({ success: false, code: AUTHOR_CODES.AUTHOR_INVALID_BODY, message: `${field} phải là số nguyên không âm` });
    }
  }
};
