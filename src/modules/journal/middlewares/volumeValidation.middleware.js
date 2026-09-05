import pool from "../../../config/database.js";
import { checkDuplicateVolume } from '../../journal/services/volume.service.js';

export const validateVolumeId = async (request, reply) => {
  const { id } = request.params;
  const idNumber = Number(id);
  if (!Number.isInteger(idNumber) || idNumber <= 0) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_ID", message: "Id khÃ´ng há»£p lá»‡, pháº£i lÃ  sá»‘ nguyÃªn dÆ°Æ¡ng" });
};

export const validateCreateVolume = async (request, reply) => {
  try {
    const { journal_id, volume_number, publication_year } = request.body;

    const journalIdNum = Number(journal_id);
    if (journal_id === undefined || journal_id === null || !Number.isInteger(journalIdNum) || journalIdNum <= 0) {
      return reply.status(400).send({ success: false, code: "INVALID_JOURNAL_ID", message: "journal_id khÃ´ng há»£p lá»‡" });
    }

    const journalRes = await prisma.$queryRawUnsafe(`SELECT 1 FROM "Journal" WHERE journal_id = $1 AND is_deleted = false`, [BigInt(journal_id)]);
    if (journalRes.length === 0) return reply.status(400).send({ success: false, code: "JOURNAL_NOT_FOUND", message: "journal_id khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ xÃ³a má»m trong há»‡ thá»‘ng" });

    const volNum = Number(volume_number);
    if (volume_number === undefined || volume_number === null || !Number.isInteger(volNum) || volNum <= 0) {
      return reply.status(400).send({ success: false, code: "INVALID_VOLUME_NUMBER", message: "volume_number pháº£i lÃ  sá»‘ nguyÃªn lá»›n hÆ¡n 0" });
    }

    const yearNum = Number(publication_year);
    if (publication_year === undefined || publication_year === null || !Number.isInteger(yearNum) || yearNum <= 0) {
      return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "NÄƒm xuáº¥t báº£n khÃ´ng há»£p lá»‡" });
    }

    const isDuplicate = await checkDuplicateVolume(journal_id, volume_number);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_VOLUME", message: "Sá»‘ volume Ä‘Ã£ tá»“n táº¡i trong cÃ¹ng journal nÃ y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u táº¡o Volume" });
  }
};

export const validateUpdateVolume = async (request, reply) => {
  try {
    const { id } = request.params;
    const { volume_number, publication_year } = request.body;

    const volumeRes = await prisma.$queryRawUnsafe(`SELECT volume_id, journal_id, volume_number, publication_year, is_deleted FROM "Volume" WHERE volume_id = $1`, [BigInt(id)]);
    if (volumeRes.length === 0) return reply.status(404).send({ success: false, code: "VOLUME_NOT_FOUND", message: "Volume khÃ´ng tá»“n táº¡i" });

    const volume = volumeRes[0];
    if (volume.is_deleted) return reply.status(400).send({ success: false, code: "VOLUME_ALREADY_DELETED", message: "Volume Ä‘Ã£ bá»‹ xÃ³a má»m, khÃ´ng thá»ƒ cáº­p nháº­t" });

    if (volume_number !== undefined) {
      const volNum = Number(volume_number);
      if (!Number.isInteger(volNum) || volNum <= 0) return reply.status(400).send({ success: false, code: "INVALID_VOLUME_NUMBER", message: "volume_number pháº£i lÃ  sá»‘ nguyÃªn lá»›n hÆ¡n 0" });
    }

    if (publication_year !== undefined) {
      const yearNum = Number(publication_year);
      if (!Number.isInteger(yearNum) || yearNum <= 0) return reply.status(400).send({ success: false, code: "INVALID_PUBLICATION_YEAR", message: "NÄƒm xuáº¥t báº£n khÃ´ng há»£p lá»‡" });
    }

    const finalVolNum = volume_number !== undefined ? Number(volume_number) : volume.volume_number;
    const isDuplicate = await checkDuplicateVolume(volume.journal_id, finalVolNum, id);
    if (isDuplicate) return reply.status(400).send({ success: false, code: "DUPLICATE_VOLUME", message: "Sá»‘ volume Ä‘Ã£ tá»“n táº¡i trong cÃ¹ng journal nÃ y" });
  } catch (error) {
    return reply.status(500).send({ success: false, code: "SERVER_VALIDATION_ERROR", message: "Lá»—i há»‡ thá»‘ng trong quÃ¡ trÃ¬nh kiá»ƒm tra dá»¯ liá»‡u cáº­p nháº­t Volume" });
  }
};



