import Redis from "ioredis";
import { Queue } from "bullmq";

const QUEUE_NAME = "orcid-full-scan";
const DEFAULT_RETENTION_DAYS = 7;

let queue;
let queueConnection;

export const createOrcidQueueRedisConnection = () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL chưa được cấu hình cho ORCID scan queue");
  }
  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

export const getOrcidScanQueue = () => {
  if (queue) return queue;
  queueConnection = createOrcidQueueRedisConnection();
  queue = new Queue(QUEUE_NAME, { connection: queueConnection });
  return queue;
};

export const enqueueOrcidScanJob = async ({ jobId, orcid, requestedBy }) => {
  const retentionDays =
    Math.max(1, Number(process.env.ORCID_SCAN_JOB_RETENTION_DAYS)) ||
    DEFAULT_RETENTION_DAYS;

  return getOrcidScanQueue().add(
    "scan",
    { jobId, orcid, requestedBy },
    {
      jobId,
      attempts: 2,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: retentionDays * 24 * 60 * 60 },
      removeOnFail: { age: retentionDays * 24 * 60 * 60 },
    },
  );
};

export const closeOrcidScanQueue = async () => {
  await queue?.close();
  queue = null;
  if (queueConnection?.status !== "end") queueConnection?.disconnect();
  queueConnection = null;
};

export const ORCID_SCAN_QUEUE_NAME = QUEUE_NAME;
