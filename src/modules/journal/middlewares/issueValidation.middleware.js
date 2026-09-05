import pool from "../../../config/database.js";
import { checkDuplicateIssue } from '../../journal/services/issue.service.js';

const isValidPositiveInt = (val) => {
  if (val === undefined || val === null || val === "") return false;
  const strVal = String(val);
  return /^\d+$/.test(strVal) && Number(strVal) > 0;
};

export const validateIssueId = async (request, reply) => {
  const { id } = request.params;
  if (!isValidPositiveInt(id)) return reply.status(400).send({ success: false, code: "INVALID_ISSUE_ID", message: "Id khÃ´ng há»£p lá»‡, pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
};

export const validateCreateIssue = async (request, reply) => {
  try {
    const { volume_id, issue_number, publication_year } = request.body;
    if (!isValidPositiveInt(volume_id)) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_ID", message: "volume_id khÃ´ng há»£p lá»‡" });

    const volumeRes = await prisma.$queryRawUnsafe(`SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = false`, [BigInt(volume_id)]);
    if (volumeRes.length === 0) return reply.status(400).send({ success: false, code: "VOLUME_NOT_FOUND", message: "volume_id khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ xÃ³a má»m" });

    if (!isValidPositiveInt(issue_number)) return reply.status(400).send({ success: false, code: "INVALID_ISSUE_NUMBER", message: "issue_number pháº£i lÃ  sá»‘ nguyÃªn lá»›n hÆ¡n 0" });
    if (!isValidPositiveInt(publication_year)) return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "NÄƒm xuáº¥t báº£n khÃ´ng há»£p lá»‡" });

    const isDuplicate = await checkDuplicateIssue(volume_id, issue_number);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_ISSUE", message: "Sá»‘ issue Ä‘Ã£ tá»“n táº¡i trong cÃ¹ng volume nÃ y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u táº¡o Issue" });
  }
};

export const validateUpdateIssue = async (request, reply) => {
  try {
    const { id } = request.params;
    const { issue_number, publication_year } = request.body;

    const issueRes = await prisma.$queryRawUnsafe(`SELECT issue_id, volume_id, issue_number, publication_year, is_deleted FROM "Issue" WHERE issue_id = $1`, [BigInt(id)]);
    if (issueRes.length === 0) return reply.status(404).send({ success: false, code: "ISSUE_NOT_FOUND", message: "Issue khÃ´ng tá»“n táº¡i" });

    const issue = issueRes[0];
    if (issue.is_deleted) return reply.status(400).send({ success: false, code: "ISSUE_ALREADY_DELETED", message: "Issue Ä‘Ã£ bá»‹ xÃ³a má»m, khÃ´ng thá»ƒ cáº­p nháº­t" });

    if (issue_number !== undefined) {
      if (!isValidPositiveInt(issue_number)) return reply.status(400).send({ success: false, code: "INVALID_ISSUE_NUMBER", message: "issue_number pháº£i lÃ  sá»‘ nguyÃªn lá»›n hÆ¡n 0" });
    }
    if (publication_year !== undefined) {
      if (!isValidPositiveInt(publication_year)) return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "NÄƒm xuáº¥t báº£n khÃ´ng há»£p lá»‡" });
    }

    const finalIssueNum = issue_number !== undefined ? Number(issue_number) : issue.issue_number;
    const isDuplicate = await checkDuplicateIssue(issue.volume_id, finalIssueNum, id);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_ISSUE", message: "Sá»‘ issue Ä‘Ã£ tá»“n táº¡i trong cÃ¹ng volume nÃ y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u cáº­p nháº­t Issue" });
  }
};

export const validatePagination = async (request, reply) => {
  const { page, limit } = request.query;
  if (page !== undefined && !isValidPositiveInt(page)) return reply.status(400).send({ success: false, code: "INVALID_PAGINATION", message: "page pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
  if (limit !== undefined && !isValidPositiveInt(limit)) return reply.status(400).send({ success: false, code: "INVALID_PAGINATION", message: "limit pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
};

export const validateVolumeFilter = async (request, reply) => {
  const { volume_id } = request.query;
  if (volume_id !== undefined && volume_id !== null && volume_id !== "") {
    if (!isValidPositiveInt(volume_id)) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_ID", message: "volume_id khÃ´ng há»£p lá»‡" });
    try {
      const volRes = await prisma.$queryRawUnsafe(`SELECT 1 FROM "Volume" WHERE volume_id = $1 AND is_deleted = false`, [BigInt(volume_id)]);
      if (volRes.length === 0) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "volume_id khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ xÃ³a má»m" });
    } catch (error) {
      return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra volume_id" });
    }
  }
};



