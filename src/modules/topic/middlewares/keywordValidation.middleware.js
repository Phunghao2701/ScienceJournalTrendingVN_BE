import { checkProjectOwnership, validateKeywordIds } from '../services/keyword.service.js';

export const validateKeywordBody = async (request, reply) => {
  const display_name = request.body.display_name?.trim();
  if (!display_name) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_BODY", message: "Tên keyword không được để trống" });
  if (display_name.length < 2) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_BODY", message: "Tên keyword phải có ít nhất 2 ký tự" });
  if (display_name.length > 255) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_BODY", message: "Tên keyword không được vượt quá 255 ký tự" });
  if (/[!@#$%^&*()_+={}\[\]|\\:;"'<>,?\/~`]/.test(display_name)) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_BODY", message: "Tên keyword không được chứa ký tự đặc biệt" });
  if (/<[^>]*>/.test(display_name)) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_BODY", message: "Tên keyword không được chứa HTML hoặc script" });
  request.body.display_name = display_name;
};

export const validateKeywordId = async (request, reply) => {
  const idParam = request.params.id || request.params.keywordId;
  if (!/^\d+$/.test(idParam)) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_ID", message: "ID không hợp lệ, phải l�  số nguyên dương" });
  const id = parseInt(idParam, 10);
  if (id <= 0) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_ID", message: "ID phải lớn hơn 0" });
  request.keywordId = id;
};

export const validateDeleteWatchedKeyword = async (request, reply) => {
  const projectId = parseInt(request.params.id);
  const keywordId = parseInt(request.params.keywordId);
  if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, code: "PROJECT_INVALID_ID", message: "ID dự án không hợp lệ" });
  if (isNaN(keywordId) || keywordId <= 0) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_ID", message: "ID từ khóa không hợp lệ" });

  const userId = request.user.user_id;
  const isOwner = await checkProjectOwnership(projectId, userId);
  if (!isOwner) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND", message: "Không tìm thấy dự án hoặc bạn không có quyền truy cập dự án n� y" });
};

export const validateUpdateWatchedKeywords = async (request, reply) => {
  const projectId = parseInt(request.params.id);
  if (isNaN(projectId) || projectId <= 0) return reply.status(400).send({ success: false, code: "PROJECT_INVALID_ID", message: "ID dự án không hợp lệ" });

  const { keyword_ids } = request.body || {};
  if (!Array.isArray(keyword_ids)) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_BODY", message: "keyword_ids phải l�  một mảng" });

  if (keyword_ids.length > 0) {
    const isValid = keyword_ids.every((id) => Number.isInteger(id) && id > 0);
    if (!isValid) return reply.status(400).send({ success: false, code: "KEYWORD_INVALID_BODY", message: "Các phần tử trong keyword_ids phải l�  số nguyên dương" });
  }

  const userId = request.user.user_id;
  const isOwner = await checkProjectOwnership(projectId, userId);
  if (!isOwner) return reply.status(404).send({ success: false, code: "PROJECT_NOT_FOUND", message: "Không tìm thấy dự án hoặc bạn không có quyền" });

  if (keyword_ids.length > 0) {
    const allExist = await validateKeywordIds(keyword_ids);
    if (!allExist) return reply.status(400).send({ success: false, code: "KEYWORD_NOT_FOUND", message: "Một hoặc nhiều ID từ khóa không tồn tại trong hệ thống" });
  }
};

export const validateCreateWatchedKeyword = validateUpdateWatchedKeywords; // They share the same logic
