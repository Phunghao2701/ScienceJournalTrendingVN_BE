import { Worker } from "bullmq";
import logger from '../../../utils/logger.js';
import { scanAuthorByOrcid } from "./orcidScan.service.js";
import {
  deleteExpiredOrcidScanJobs,
  updateOrcidScanJob,
} from "../repositories/orcidScanJob.repository.js";
import {
  createOrcidQueueRedisConnection,
  isRedisAvailable,
  ORCID_SCAN_QUEUE_NAME,
} from "./orcidScanQueue.service.js";

let worker;
let workerConnection;

const progressForPersistence = ({ processed, total }) => {
  if (!total) return 99;
  return Math.min(99, 65 + Math.floor((processed / total) * 34));
};

const updateProgress = async (
  jobId,
  event,
  updateJob = updateOrcidScanJob,
) => {
  const patch = {
    heartbeatAt: new Date(),
  };
  if (event.stage) patch.stage = event.stage;
  if (Number.isFinite(event.progress)) patch.progress = event.progress;
  if (event.sourceProgress) patch.sourceProgress = event.sourceProgress;
  if (event.summary) {
    patch.summary = {
      ...event.summary,
      ...(Number.isFinite(event.available)
        ? { available_publications: event.available }
        : {}),
    };
  }
  if (event.authorId != null) patch.authorId = event.authorId;

  await updateJob(jobId, patch);
};

export const processOrcidScanQueueJob = async (
  job,
  {
    scan = scanAuthorByOrcid,
    updateJob = updateOrcidScanJob,
  } = {},
) => {
  const { jobId, orcid } = job.data;
  const attemptCount = Number(job.attemptsMade || 0) + 1;
  await updateJob(jobId, {
    status: "running",
    stage: "fetching",
    progress: 5,
    attemptCount,
    startedAt: new Date(),
    heartbeatAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });

  try {
    const result = await scan(orcid, {
      jobId,
      onProgress: async (event) => {
        if (event.stage === "persisting") {
          event.progress = progressForPersistence(event);
        }
        await updateProgress(jobId, event, updateJob);
        if (typeof job.updateProgress === "function") {
          await job.updateProgress(event.progress ?? 0);
        }
      },
    });
    const status = result.partial ? "partial" : "completed";

    await updateJob(jobId, {
      status,
      stage: "completed",
      progress: 100,
      sourceStatus: result.source_status,
      summary: result.summary,
      authorId: result.author?.author_id ?? null,
      heartbeatAt: new Date(),
      completedAt: new Date(),
    });
    return { status, authorId: result.author?.author_id ?? null };
  } catch (error) {
    const isFinalAttempt =
      attemptCount >= Number(job.opts?.attempts || 1);
    await updateJob(jobId, {
      status: isFinalAttempt ? "failed" : "queued",
      stage: isFinalAttempt ? "completed" : "queued",
      errorCode: error.code || "ORCID_SCAN_JOB_FAILED",
      errorMessage: error.message || "Khong the hoan tat tim cong trinh",
      heartbeatAt: new Date(),
      completedAt: isFinalAttempt ? new Date() : null,
    });
    throw error;
  }
};

export const startOrcidScanWorker = async () => {
  if (worker) return worker;

  const hasRedis = await isRedisAvailable();
  if (!hasRedis) {
    logger.warn("[ORCID Scan Worker] Redis khong kha dung; chay che do in-process background worker.");
    return null;
  }

  workerConnection = createOrcidQueueRedisConnection();
  const concurrency =
    Math.max(1, Number(process.env.ORCID_SCAN_WORKER_CONCURRENCY)) || 1;
  worker = new Worker(
    ORCID_SCAN_QUEUE_NAME,
    (job) => processOrcidScanQueueJob(job),
    { connection: workerConnection, concurrency },
  );
  worker.on("error", (error) => {
    logger.error("[ORCID Scan Worker] Worker error:", error);
  });
  worker.on("failed", (job, error) => {
    logger.error(`[ORCID Scan Worker] Job ${job?.id || "unknown"} failed:`, error);
  });

  const retentionDays =
    Math.max(1, Number(process.env.ORCID_SCAN_JOB_RETENTION_DAYS)) || 7;
  deleteExpiredOrcidScanJobs({ retentionDays }).catch((error) => {
    logger.warn("[ORCID Scan Worker] Khong the don job cu", {
      code: error.code || "JOB_CLEANUP_FAILED",
    });
  });

  return worker;
};

export const closeOrcidScanWorker = async () => {
  await worker?.close();
  worker = null;
  if (workerConnection?.status !== "end") workerConnection?.disconnect();
  workerConnection = null;
};
