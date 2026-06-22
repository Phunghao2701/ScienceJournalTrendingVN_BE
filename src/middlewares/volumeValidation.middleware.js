import pool from "../config/database.js";
import { checkDuplicateVolume } from "../services/volume.service.js";

/**
 * Middleware kiểm tra URL parameter id phải là số nguyên dương hợp lệ.
 */
export const validateVolumeId = (req, res, next) => {
  const { id } = req.params;
  const idNumber = Number(id);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    return res.status(400).json({
      success: false,
      code: "INVALID_VOLUME_ID",
      message: "Id không hợp lệ, phải là số nguyên dương"
    });
  }

  next();
};

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào khi tạo mới Volume.
 */
export const validateCreateVolume = async (req, res, next) => {
  try {
    const { journal_id, volume_number, publication_year } = req.body;

    // 1. Kiểm tra journal_id
    const journalIdNum = Number(journal_id);
    if (journal_id === undefined || journal_id === null || !Number.isInteger(journalIdNum) || journalIdNum <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_JOURNAL_ID",
        message: "journal_id không hợp lệ, phải là số nguyên dương"
      });
    }

    // Kiểm tra journal_id tồn tại và chưa bị xóa mềm trong DB
    const journalRes = await pool.query(
      `SELECT 1 FROM "Journal" WHERE journal_id = $1 AND is_deleted = false`,
      [BigInt(journal_id)]
    );
    if (journalRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        code: "JOURNAL_NOT_FOUND",
        message: "journal_id không tồn tại hoặc đã bị xóa mềm trong hệ thống"
      });
    }

    // 2. Kiểm tra volume_number
    const volNum = Number(volume_number);
    if (volume_number === undefined || volume_number === null || !Number.isInteger(volNum) || volNum <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VOLUME_NUMBER",
        message: "volume_number phải là số nguyên lớn hơn 0"
      });
    }

    // 3. Kiểm tra publication_year
    const yearNum = Number(publication_year);
    if (publication_year === undefined || publication_year === null || !Number.isInteger(yearNum) || yearNum <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PUBLICATION_YEAR",
        message: "Năm xuất bản không hợp lệ"
      });
    }

    // 4. Kiểm tra trùng lặp volume_number trong cùng một journal
    const isDuplicate = await checkDuplicateVolume(journal_id, volume_number);
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        code: "DUPLICATE_VOLUME",
        message: "Số volume đã tồn tại trong cùng journal này"
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "SERVER_VALIDATION_ERROR",
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu tạo Volume",
      error: error.message
    });
  }
};

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào khi cập nhật Volume.
 */
export const validateUpdateVolume = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { volume_number, publication_year } = req.body;

    // 1. Kiểm tra sự tồn tại của Volume
    const volumeRes = await pool.query(
      `SELECT volume_id, journal_id, volume_number, publication_year, is_deleted FROM "Volume" WHERE volume_id = $1`,
      [BigInt(id)]
    );
    if (volumeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "VOLUME_NOT_FOUND",
        message: "Volume không tồn tại"
      });
    }

    const volume = volumeRes.rows[0];

    // 2. Không cho phép cập nhật Volume đã bị xóa mềm
    if (volume.is_deleted) {
      return res.status(400).json({
        success: false,
        code: "VOLUME_ALREADY_DELETED",
        message: "Volume đã bị xóa mềm, không thể cập nhật"
      });
    }

    // 3. Kiểm tra volume_number nếu được truyền lên
    if (volume_number !== undefined) {
      const volNum = Number(volume_number);
      if (!Number.isInteger(volNum) || volNum <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_VOLUME_NUMBER",
          message: "volume_number phải là số nguyên lớn hơn 0"
        });
      }
    }

    // 4. Kiểm tra publication_year nếu được truyền lên
    if (publication_year !== undefined) {
      const yearNum = Number(publication_year);
      if (!Number.isInteger(yearNum) || yearNum <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PUBLICATION_YEAR",
          message: "Năm xuất bản không hợp lệ"
        });
      }
    }

    // 5. Kiểm tra trùng lặp volume_number mới trong cùng một journal
    const finalVolNum = volume_number !== undefined ? Number(volume_number) : volume.volume_number;
    const isDuplicate = await checkDuplicateVolume(volume.journal_id, finalVolNum, id);
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        code: "DUPLICATE_VOLUME",
        message: "Số volume đã tồn tại trong cùng journal này"
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "SERVER_VALIDATION_ERROR",
      message: "Lỗi hệ thống trong quá trình kiểm tra dữ liệu cập nhật Volume",
      error: error.message
    });
  }
};
