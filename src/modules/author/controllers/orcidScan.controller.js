import logger from '../../../utils/logger.js';
import { extractOrcidId, normalizeOrcid } from '../../../utils/orcid.js';
import { createOrReuseOrcidScanJob, getOrcidScanJobById, getOrcidScanJobPublications, updateOrcidScanJob } from '../repositories/orcidScanJob.repository.js';
import { enqueueOrcidScanJob } from '../services/orcidScanQueue.service.js';

export const ORCID_SCAN_CODES = {
  INVALID: "ORCID_INVALID",
  COMPLETED: "ORCID_SCAN_COMPLETED",
  PARTIAL: "ORCID_SCAN_PARTIAL",
  SOURCES_UNAVAILABLE: "EXTERNAL_SOURCES_UNAVAILABLE",
  AUTHOR_DELETED: "ORCID_AUTHOR_DELETED",
  QUEUED: "ORCID_SCAN_QUEUED",
  ALREADY_RUNNING: "ORCID_SCAN_ALREADY_RUNNING",
  JOB_INVALID: "ORCID_SCAN_JOB_INVALID",
  JOB_NOT_FOUND: "ORCID_SCAN_JOB_NOT_FOUND",
  SERVER_ERROR: "ORCID_SCAN_SERVER_ERROR",
};

export const validateOrcidScan = async (request, reply) => {
  const normalizedOrcid = normalizeOrcid(request.body?.orcid);
  if (!normalizedOrcid) return reply.status(400).send({ success: false, code: ORCID_SCAN_CODES.INVALID, message: "ORCID khÃ´ng há»£p lá»‡" });

  request.orcid = normalizedOrcid;
  request.orcidId = extractOrcidId(normalizedOrcid);
};

const DEFAULT_POLL_INTERVAL_MS = 1500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const orcidScanJobServiceRef = { createOrReuseOrcidScanJob, getOrcidScanJobById, getOrcidScanJobPublications, updateOrcidScanJob, enqueueOrcidScanJob };

const pollInterval = () => Math.max(500, Number(process.env.ORCID_SCAN_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS);

const sumSourceField = (sourceProgress, field) => Object.values(sourceProgress || {}).reduce((sum, source) => sum + (Number(source?.[field]) || 0), 0);

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
      processed: Number(summary.created || 0) + Number(summary.filled_missing || 0) + Number(summary.already_existed || 0) + Number(summary.failed_to_persist || 0),
      created: Number(summary.created || 0),
      filled_missing: Number(summary.filled_missing || 0),
      already_existed: Number(summary.already_existed || 0),
      failed: Number(summary.failed_to_persist || 0),
      available_publications: Number(summary.available_publications || 0),
    },
    summary,
    source_status: job.source_status || {},
    author_id: authorId,
    articles_url: authorId ? `/api/v1/author/${authorId}/articles?page=1&limit=20` : null,
    publications_url: `/api/v1/orcid/scan/${job.job_id}/publications?cursor=0&limit=20`,
    error: job.error_code || job.error_message ? { code: job.error_code || "ORCID_SCAN_JOB_FAILED", message: job.error_message || "KhÃ´ng thá»ƒ hoÃ n táº¥t tÃ¬m cÃ´ng trÃ¬nh" } : null,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };
};

export const scanAuthorWorksByOrcid = async (request, reply) => {
  try {
    const { job, reused } = await orcidScanJobServiceRef.createOrReuseOrcidScanJob({ orcid: request.orcidId, requestedBy: request.user.user_id });

    if (!reused) {
      try {
        await orcidScanJobServiceRef.enqueueOrcidScanJob({ jobId: job.job_id, orcid: request.orcid, requestedBy: request.user.user_id });
      } catch (error) {
        await orcidScanJobServiceRef.updateOrcidScanJob(job.job_id, { status: "failed", stage: "completed", errorCode: "ORCID_SCAN_QUEUE_UNAVAILABLE", errorMessage: "KhÃ´ng thá»ƒ xáº¿p lÆ°á»£t tÃ¬m cÃ´ng trÃ¬nh vÃ o hÃ ng Ä‘á»£i", completedAt: new Date() });
        throw Object.assign(error, { statusCode: 503, code: "ORCID_SCAN_QUEUE_UNAVAILABLE" });
      }
    }

    return reply.status(202).send({ success: true, code: reused ? ORCID_SCAN_CODES.ALREADY_RUNNING : ORCID_SCAN_CODES.QUEUED, message: reused ? "LÆ°á»£t tÃ¬m cÃ´ng trÃ¬nh cho ORCID nÃ y Ä‘ang Ä‘Æ°á»£c xá»­ lÃ½" : "ÄÃ£ xáº¿p lÆ°á»£t tÃ¬m cÃ´ng trÃ¬nh vÃ o hÃ ng Ä‘á»£i", data: serializeJob(job, { reused }) });
  } catch (error) {
    if (error.statusCode && error.code) return reply.status(error.statusCode).send({ success: false, code: error.code, message: error.message, ...(error.job ? { data: serializeJob(error.job, { reused: true }) } : {}) });
    logger.error("[ORCID Scan Controller] Lá»—i khi táº¡o scan job:", error);
    return reply.status(500).send({ success: false, code: ORCID_SCAN_CODES.SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra khi táº¡o lÆ°á»£t tÃ¬m cÃ´ng trÃ¬nh theo ORCID" });
  }
};

export const getOrcidScanJobStatus = async (request, reply) => {
  if (!UUID_PATTERN.test(request.params.jobId || "")) return reply.status(400).send({ success: false, code: ORCID_SCAN_CODES.JOB_INVALID, message: "Job ID khÃ´ng há»£p lá»‡" });

  try {
    const job = await orcidScanJobServiceRef.getOrcidScanJobById(request.params.jobId);
    if (!job) return reply.status(404).send({ success: false, code: ORCID_SCAN_CODES.JOB_NOT_FOUND, message: "KhÃ´ng tÃ¬m tháº¥y lÆ°á»£t tÃ¬m cÃ´ng trÃ¬nh" });
    return reply.status(200).send({ success: true, code: `ORCID_SCAN_${String(job.status).toUpperCase()}`, data: serializeJob(job) });
  } catch (error) {
    logger.error("[ORCID Scan Controller] Lá»—i khi Ä‘á»c scan job:", error);
    return reply.status(500).send({ success: false, code: ORCID_SCAN_CODES.SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra khi Ä‘á»c tráº¡ng thÃ¡i tÃ¬m cÃ´ng trÃ¬nh" });
  }
};

export const getOrcidScanJobPublicationPage = async (request, reply) => {
  if (!UUID_PATTERN.test(request.params.jobId || "")) return reply.status(400).send({ success: false, code: ORCID_SCAN_CODES.JOB_INVALID, message: "Job ID khÃ´ng há»£p lá»‡" });

  const cursor = String(request.query.cursor ?? "0");
  const limit = Number(request.query.limit ?? 20);
  if (!/^\d+$/.test(cursor) || BigInt(cursor) > 9223372036854775807n || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) return reply.status(400).send({ success: false, code: "ORCID_SCAN_PAGINATION_INVALID", message: "Cursor hoáº·c limit khÃ´ng há»£p lá»‡" });

  try {
    const job = await orcidScanJobServiceRef.getOrcidScanJobById(request.params.jobId);
    if (!job) return reply.status(404).send({ success: false, code: ORCID_SCAN_CODES.JOB_NOT_FOUND, message: "KhÃ´ng tÃ¬m tháº¥y lÆ°á»£t tÃ¬m cÃ´ng trÃ¬nh" });

    const result = await orcidScanJobServiceRef.getOrcidScanJobPublications(request.params.jobId, { cursor, limit });
    return reply.status(200).send({ success: true, code: "ORCID_SCAN_PUBLICATIONS", data: result });
  } catch (error) {
    logger.error("[ORCID Scan Controller] Lá»—i khi Ä‘á»c publications cá»§a scan job:", error);
    return reply.status(500).send({ success: false, code: ORCID_SCAN_CODES.SERVER_ERROR, message: "CÃ³ lá»—i xáº£y ra khi Ä‘á»c danh sÃ¡ch cÃ´ng trÃ¬nh" });
  }
};



