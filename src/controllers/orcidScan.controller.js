import logger from "../utils/logger.js";
import { ORCID_SCAN_CODES } from "../middlewares/orcidScanValidation.middleware.js";
import {
  createOrReuseOrcidScanJob,
  getOrcidScanJobById,
  getOrcidScanJobPublications,
  updateOrcidScanJob,
} from "../services/orcidScanJob.repository.js";
import { enqueueOrcidScanJob } from "../services/orcidScanQueue.service.js";

const DEFAULT_POLL_INTERVAL_MS = 1500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const orcidScanJobServiceRef = {
  createOrReuseOrcidScanJob,
  getOrcidScanJobById,
  getOrcidScanJobPublications,
  updateOrcidScanJob,
  enqueueOrcidScanJob,
};

const pollInterval = () =>
  Math.max(
    500,
    Number(process.env.ORCID_SCAN_POLL_INTERVAL_MS) ||
      DEFAULT_POLL_INTERVAL_MS,
  );

const sumSourceField = (sourceProgress, field) =>
  Object.values(sourceProgress || {}).reduce(
    (sum, source) => sum + (Number(source?.[field]) || 0),
    0,
  );

const serializeJob = (job, { reused } = {}) => {
  const sourceProgress = job.source_progress || {};
  const summary = job.summary || {};
  const authorId = job.author_id == null ? null : String(job.author_id);

  return {
    job_id: job.job_id,
    orcid: job.orcid,
    status: job.status,
    stage: job.stage,
    progress: Number(job.progress || 0),
    ...(typeof reused === "boolean" ? { reused } : {}),
    poll_after_ms: pollInterval(),
    status_url: `/api/v1/orcid/scan/${job.job_id}`,
    counts: {
      estimated_source_records: sumSourceField(sourceProgress, "total"),
      fetched: sumSourceField(sourceProgress, "fetched"),
      journal_articles_discovered: Number(summary.discovered || 0),
      processed:
        Number(summary.created || 0) +
        Number(summary.filled_missing || 0) +
        Number(summary.already_existed || 0) +
        Number(summary.failed_to_persist || 0),
      created: Number(summary.created || 0),
      filled_missing: Number(summary.filled_missing || 0),
      already_existed: Number(summary.already_existed || 0),
      failed: Number(summary.failed_to_persist || 0),
      available_publications: Number(summary.available_publications || 0),
    },
    summary,
    source_status: job.source_status || {},
    author_id: authorId,
    articles_url: authorId
      ? `/api/v1/author/${authorId}/articles?page=1&limit=20`
      : null,
    publications_url:
      `/api/v1/orcid/scan/${job.job_id}/publications?cursor=0&limit=20`,
    error:
      job.error_code || job.error_message
        ? {
            code: job.error_code || "ORCID_SCAN_JOB_FAILED",
            message: job.error_message || "Không thể hoàn tất tìm công trình",
          }
        : null,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };
};

export const scanAuthorWorksByOrcid = async (req, res) => {
  try {
    const { job, reused } =
      await orcidScanJobServiceRef.createOrReuseOrcidScanJob({
        orcid: req.orcidId,
        requestedBy: req.user.user_id,
      });

    if (!reused) {
      try {
        await orcidScanJobServiceRef.enqueueOrcidScanJob({
          jobId: job.job_id,
          orcid: req.orcid,
          requestedBy: req.user.user_id,
        });
      } catch (error) {
        await orcidScanJobServiceRef.updateOrcidScanJob(job.job_id, {
          status: "failed",
          stage: "completed",
          errorCode: "ORCID_SCAN_QUEUE_UNAVAILABLE",
          errorMessage: "Không thể xếp lượt tìm công trình vào hàng đợi",
          completedAt: new Date(),
        });
        throw Object.assign(error, {
          statusCode: 503,
          code: "ORCID_SCAN_QUEUE_UNAVAILABLE",
        });
      }
    }

    return res.status(202).json({
      success: true,
      code: reused
        ? ORCID_SCAN_CODES.ALREADY_RUNNING
        : ORCID_SCAN_CODES.QUEUED,
      message: reused
        ? "Lượt tìm công trình cho ORCID này đang được xử lý"
        : "Đã xếp lượt tìm công trình vào hàng đợi",
      data: serializeJob(job, { reused }),
    });
  } catch (error) {
    if (error.statusCode && error.code) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
        ...(error.job ? { data: serializeJob(error.job, { reused: true }) } : {}),
      });
    }

    logger.error("[ORCID Scan Controller] Lỗi khi tạo scan job:", error);
    return res.status(500).json({
      success: false,
      code: ORCID_SCAN_CODES.SERVER_ERROR,
      message: "Có lỗi xảy ra khi tạo lượt tìm công trình theo ORCID",
    });
  }
};

export const getOrcidScanJobStatus = async (req, res) => {
  if (!UUID_PATTERN.test(req.params.jobId || "")) {
    return res.status(400).json({
      success: false,
      code: ORCID_SCAN_CODES.JOB_INVALID,
      message: "Job ID không hợp lệ",
    });
  }

  try {
    const job = await orcidScanJobServiceRef.getOrcidScanJobById(
      req.params.jobId,
    );
    if (!job) {
      return res.status(404).json({
        success: false,
        code: ORCID_SCAN_CODES.JOB_NOT_FOUND,
        message: "Không tìm thấy lượt tìm công trình",
      });
    }

    return res.status(200).json({
      success: true,
      code: `ORCID_SCAN_${String(job.status).toUpperCase()}`,
      data: serializeJob(job),
    });
  } catch (error) {
    logger.error("[ORCID Scan Controller] Lỗi khi đọc scan job:", error);
    return res.status(500).json({
      success: false,
      code: ORCID_SCAN_CODES.SERVER_ERROR,
      message: "Có lỗi xảy ra khi đọc trạng thái tìm công trình",
    });
  }
};

export const getOrcidScanJobPublicationPage = async (req, res) => {
  if (!UUID_PATTERN.test(req.params.jobId || "")) {
    return res.status(400).json({
      success: false,
      code: ORCID_SCAN_CODES.JOB_INVALID,
      message: "Job ID không hợp lệ",
    });
  }

  const cursor = String(req.query.cursor ?? "0");
  const limit = Number(req.query.limit ?? 20);
  if (
    !/^\d+$/.test(cursor) ||
    BigInt(cursor) > 9223372036854775807n ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    return res.status(400).json({
      success: false,
      code: "ORCID_SCAN_PAGINATION_INVALID",
      message: "Cursor hoặc limit không hợp lệ",
    });
  }

  try {
    const job = await orcidScanJobServiceRef.getOrcidScanJobById(
      req.params.jobId,
    );
    if (!job) {
      return res.status(404).json({
        success: false,
        code: ORCID_SCAN_CODES.JOB_NOT_FOUND,
        message: "Không tìm thấy lượt tìm công trình",
      });
    }

    const result =
      await orcidScanJobServiceRef.getOrcidScanJobPublications(
        req.params.jobId,
        { cursor, limit },
      );
    return res.status(200).json({
      success: true,
      code: "ORCID_SCAN_PUBLICATIONS",
      data: result,
    });
  } catch (error) {
    logger.error(
      "[ORCID Scan Controller] Lỗi khi đọc publications của scan job:",
      error,
    );
    return res.status(500).json({
      success: false,
      code: ORCID_SCAN_CODES.SERVER_ERROR,
      message: "Có lỗi xảy ra khi đọc danh sách công trình",
    });
  }
};
