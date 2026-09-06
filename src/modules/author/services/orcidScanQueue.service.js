import Redis from "ioredis";
import { Queue } from "bullmq";
import logger from '../../../utils/logger.js';
import { processOrcidScanQueueJob } from "./orcidScanWorker.service.js";

const QUEUE_NAME = "orcid-full-scan";
const DEFAULT_RETENTION_DAYS = 7;

let queue;
let queueConnection;
let redisAvailable = null;

export const isRedisAvailable = async () => {
  if (redisAvailable !== null) return redisAvailable;
  if (!process.env.REDIS_URL) {
    redisAvailable = false;
    return false;
  }
  try {
    const testRedis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 800,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    testRedis.on("error", () => {});
    await testRedis.connect();
    await testRedis.ping();
    await testRedis.disconnect();
    redisAvailable = true;
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
};

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
  const hasRedis = await isRedisAvailable();
  if (hasRedis) {
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
  }

  // Graceful in-process background runner when Redis is offline
  setImmediate(async () => {
    try {
      await processOrcidScanQueueJob({
        data: { jobId, orcid, requestedBy },
        opts: { attempts: 1 },
        attemptsMade: 0,
        updateProgress: async () => {},
      });
    } catch (err) {
      logger.error(`[ORCID Scan In-Process] Scan job ${jobId} failed:`, err);
    }
  });

  return { id: jobId };
};

export const closeOrcidScanQueue = async () => {
  await queue?.close();
  queue = null;
  if (queueConnection?.status !== "end") queueConnection?.disconnect();
  queueConnection = null;
};

export const ORCID_SCAN_QUEUE_NAME = QUEUE_NAME;
