import prisma from '../../../config/prisma.js';
import pool from "../../../config/database.js";
import { checkDuplicateVolume } from '../../journal/services/volume.service.js';

export const validateVolumeId = async (request, reply) => {
  const { id } = request.params;
  const idNumber = Number(id);
  if (!Number.isInteger(idNumber) || idNumber <= 0) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_ID", message: "Id không hợp lệ, phải l�  số nguyên dương" });
};

export const validateCreateVolume = async (request, reply) => {
  try {
    const { journal_id, volume_number, publication_year } = request.body;

    const journalIdNum = Number(journal_id);
    if (journal_id === undefined || journal_id === null || !Number.isInteger(journalIdNum) || journalIdNum <= 0) {
      return reply.status(400).send({ success: false, code: "INVALID_JOURNAL_ID", message: "journal_id không hợp lệ" });
    }

    const journalRes = await prisma.$queryRawUnsafe(`SELECT 1 FROM "Journal" WHERE journal_id = $1 AND is_deleted = false`, [BigInt(journal_id)]);
    if (journalRes.length === 0) return reply.status(400).send({ success: false, code: "JOURNAL_NOT_FOUND", message: "journal_id không tồn tại hoặc đã bị xóa mềm trong hệ thống" });

    const volNum = Number(volume_number);
    if (volume_number === undefined || volume_number === null || !Number.isInteger(volNum) || volNum <= 0) {
      return reply.status(400).send({ success: false, code: "INVALID_VOLUME_NUMBER", message: "volume_number phải l�  số nguyên lớn hơn 0" });
    }

    const yearNum = Number(publication_year);
    if (publication_year === undefined || publication_year === null || !Number.isInteger(yearNum) || yearNum <= 0) {
      return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "Năm xuất bản không hợp lệ" });
    }

    const isDuplicate = await checkDuplicateVolume(journal_id, volume_number);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_VOLUME", message: "Số volume đã tồn tại trong cùng journal n� y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu tạo Volume" });
  }
};

export const validateUpdateVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const { volume_number, publication_year } = request.body;

    const volumeRes = await prisma.$queryRawUnsafe(`SELECT volume_id, journal_id, volume_number, publication_year, is_deleted FROM "Volume" WHERE volume_id = $1`, [BigInt(id)]);
    if (volumeRes.length === 0) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "Volume không tồn tại" });

    const volume = volumeRes[0];
    if (volume.is_deleted) return reply.status(400).send({ success: false, code: "VOLUME_ALREADY_DELETED", message: "Volume đã bị xóa mềm, không thể cập nhật" });

    if (volume_number !== undefined) {
      const volNum = Number(volume_number);
      if (!Number.isInteger(volNum) || volNum <= 0) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_NUMBER", message: "volume_number phải l�  số nguyên lớn hơn 0" });
    }

    if (publication_year !== undefined) {
      const yearNum = Number(publication_year);
      if (!Number.isInteger(yearNum) || yearNum <= 0) return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "Năm xuất bản không hợp lệ" });
    }

    const finalVolNum = volume_number !== undefined ? Number(volume_number) : volume.volume_number;
    const isDuplicate = await checkDuplicateVolume(volume.journal_id, finalVolNum, id);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_VOLUME", message: "Số volume đã tồn tại trong cùng journal n� y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu cập nhật Volume" });
  }
};



