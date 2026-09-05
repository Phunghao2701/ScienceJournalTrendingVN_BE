import prisma from '../../../config/prisma.js';
import pool from "../../../config/database.js";
import { checkDuplicateIssue } from '../../journal/services/issue.service.js';

const isValidPositiveInt = (val) => {
  if (val === undefined || val === null || val === "") return false;
  const strVal = String(val);
  return /^\d+$/.test(strVal) && Number(strVal) > 0;
};

export const validateIssueId = async (request, reply) => {
  const { id } = request.params;
  if (!isValidPositiveInt(id)) return reply.status(400).send({ success: false, code: "INVALID_ISSUE_ID", message: "Id không hợp lệ, phải l�  số nguyên dương" });
};

export const validateCreateIssue = async (request, reply) => {
  try {
    const { volume_id, issue_number, publication_year } = request.body;
    if (!isValidPositiveInt(volume_id)) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_ID", message: "volume_id không hợp lệ" });

    const volumeRes = await prisma.$queryRawUnsafe(`SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = false`, [BigInt(volume_id)]);
    if (volumeRes.length === 0) return reply.status(400).send({ success: false, code: "VOLUME_NOT_FOUND", message: "volume_id không tồn tại hoặc đã bị xóa mềm" });

    if (!isValidPositiveInt(issue_number)) return reply.status(400).send({ success: false, code: "INVALID_ISSUE_NUMBER", message: "issue_number phải l�  số nguyên lớn hơn 0" });
    if (!isValidPositiveInt(publication_year)) return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "Năm xuất bản không hợp lệ" });

    const isDuplicate = await checkDuplicateIssue(volume_id, issue_number);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_ISSUE", message: "Số issue đã tồn tại trong cùng volume n� y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu tạo Issue" });
  }
};

export const validateUpdateIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const { issue_number, publication_year } = request.body;

    const issueRes = await prisma.$queryRawUnsafe(`SELECT issue_id, volume_id, issue_number, publication_year, is_deleted FROM "Issue" WHERE issue_id = $1`, [BigInt(id)]);
    if (issueRes.length === 0) return reply.status(404).send({ success: false, code: "ISSUE_NOT_FOUND", message: "Issue không tồn tại" });

    const issue = issueRes[0];
    if (issue.is_deleted) return reply.status(400).send({ success: false, code: "ISSUE_ALREADY_DELETED", message: "Issue đã bị xóa mềm, không thể cập nhật" });

    if (issue_number !== undefined) {
      if (!isValidPositiveInt(issue_number)) return reply.status(400).send({ success: false, code: "INVALID_ISSUE_NUMBER", message: "issue_number phải l�  số nguyên lớn hơn 0" });
    }
    if (publication_year !== undefined) {
      if (!isValidPositiveInt(publication_year)) return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "Năm xuất bản không hợp lệ" });
    }

    const finalIssueNum = issue_number !== undefined ? Number(issue_number) : issue.issue_number;
    const isDuplicate = await checkDuplicateIssue(issue.volume_id, finalIssueNum, id);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_ISSUE", message: "Số issue đã tồn tại trong cùng volume n� y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu cập nhật Issue" });
  }
};

export const validatePagination = async (request, reply) => {
  const { page, limit } = request.query;
  if (page !== undefined && !isValidPositiveInt(page)) return reply.status(400).send({ success: false, code: "INVALID_PAGINATION", message: "page phải l�  số nguyên dương" });
  if (limit !== undefined && !isValidPositiveInt(limit)) return reply.status(400).send({ success: false, code: "INVALID_PAGINATION", message: "limit phải l�  số nguyên dương" });
};

export const validateVolumeFilter = async (request, reply) => {
  const { volume_id } = request.query;
  if (volume_id !== undefined && volume_id !== null && volume_id !== "") {
    if (!isValidPositiveInt(volume_id)) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_ID", message: "volume_id không hợp lệ" });
    try {
      const volRes = await prisma.$queryRawUnsafe(`SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = false`, [BigInt(volume_id)]);
      if (volRes.length === 0) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "volume_id không tồn tại hoặc đã bị xóa mềm" });
    } catch (error) {
      return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lỗi hệ thống trong quá trình kiểm tra volume_id" });
    }
  }
};



