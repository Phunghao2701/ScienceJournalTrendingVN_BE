export const validateCreateComment = async (request, reply) => {
  const { content } = request.body;
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return reply.status(400).send({ success: false, code: 'CONTENT_REQUIRED', message: 'Nội dung comment không được để trống' });
  }
};

export const validateCommentId = async (request, reply) => {
  const { commentId } = request.params;
  if (!/^\d+$/.test(commentId) || Number(commentId) <= 0) {
    return reply.status(400).send({ success: false, code: 'INVALID_COMMENT_ID', message: 'ID comment không hợp lệ' });
  }
};

export const validateUpdateComment = async (request, reply) => {
  const resId = await validateCommentId(request, reply);
  if (resId) return resId;
  const resContent = await validateCreateComment(request, reply);
  if (resContent) return resContent;
};
