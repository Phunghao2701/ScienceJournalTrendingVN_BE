import {
  persistOrcidScan,
  persistOrcidScanBatched,
} from "../repositories/orcidScan.repository.js";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_BATCH_ATTEMPTS = 2;

const emptySummary = () => ({
  created: 0,
  filled_missing: 0,
  already_existed: 0,
  skipped_deleted: 0,
  failed_to_persist: 0,
});

const addSummary = (target, source = {}) => {
  for (const key of Object.keys(target)) {
    target[key] += Number(source[key] || 0);
  }
};

const persistWithRetry = async (persistBatch, input, attempts) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await persistBatch(input);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

export const persistOrcidScanInBatches = async (
  { targetAuthor, articles },
  {
    batchSize = Number(process.env.ORCID_SCAN_DB_BATCH_SIZE) ||
      DEFAULT_BATCH_SIZE,
    batchAttempts = DEFAULT_BATCH_ATTEMPTS,
    persistBatch = persistOrcidScan,
    persistAll = persistOrcidScanBatched,
    onProgress,
    jobId,
  } = {},
) => {
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const items = Array.isArray(articles) ? articles : [];
  if (persistBatch === persistOrcidScan) {
    return persistAll(
      { targetAuthor, articles: items },
      {
        batchSize: safeBatchSize,
        batchAttempts,
        onProgress,
        jobId,
      },
    );
  }
  const chunks = items.length
    ? Array.from(
        { length: Math.ceil(items.length / safeBatchSize) },
        (_, index) =>
          items.slice(index * safeBatchSize, (index + 1) * safeBatchSize),
      )
    : [[]];
  const summary = emptySummary();
  let processed = 0;
  let lastResult = null;
  let lastError = null;

  for (const chunk of chunks) {
    try {
      const result = await persistWithRetry(
        persistBatch,
        { targetAuthor, articles: chunk },
        Math.max(1, batchAttempts),
      );
      lastResult = result;
      addSummary(summary, result.summary);
    } catch (error) {
      lastError = error;
      summary.failed_to_persist += chunk.length;
    }

    processed += chunk.length;
    await onProgress?.({
      processed,
      total: items.length,
      summary: { ...summary },
    });
  }

  if (!lastResult) throw lastError || new Error("KhÃ´ng thá»ƒ lÆ°u dá»¯ liá»‡u ORCID");

  return {
    ...lastResult,
    summary,
  };
};

