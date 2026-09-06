import prisma from '../../../config/prisma.js';
import redis from '../../../config/redis.js';

const ACTIVE_STATUSES = ["queued", "running"];
const TERMINAL_STATUSES = ["completed", "partial", "failed"];

const JOB_CACHE_PREFIX = "orcid:job:";
const TERMINAL_CACHE_TTL = 3600; // 1 hour
const ACTIVE_CACHE_TTL = 5; // 5 seconds

const getCachedJob = async (jobId) => {
  try {
    const data = await redis.get(`${JOB_CACHE_PREFIX}${jobId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const setCachedJob = async (job) => {
  if (!job?.job_id) return;
  try {
    const isTerminal = TERMINAL_STATUSES.includes(job.status);
    const ttl = isTerminal ? TERMINAL_CACHE_TTL : ACTIVE_CACHE_TTL;
    await redis.set(`${JOB_CACHE_PREFIX}${job.job_id}`, JSON.stringify(job), "EX", ttl);
  } catch {}
};

const activeJobQuery = `
  SELECT *
  FROM public."Orcid_Scan_Job"
  WHERE status = ANY($1::varchar[])
    AND (
      requested_by = $2::uuid
      OR orcid = $3
    )
  ORDER BY
    CASE WHEN requested_by = $2::uuid THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1
`;

const busyError = (job) => {
  const error = new Error("Bạn đang có một lượt tìm công trình khác đang chạy");
  error.statusCode = 409;
  error.code = "ORCID_SCAN_USER_BUSY";
  error.job = job;
  return error;
};

const resolveExistingJob = (job, userId, orcid) => {
  if (!job) return null;
  if (job.orcid === orcid) return { job, reused: true };
  if (String(job.requested_by) === String(userId)) throw busyError(job);
  return null;
};

export const createOrReuseOrcidScanJob = async (
  { orcid, requestedBy },
  { databasePool = null } = {},
) => {
  const existing = await prisma.$queryRawUnsafe(
    activeJobQuery,
    ACTIVE_STATUSES,
    requestedBy,
    orcid,
  );
  const resolved = resolveExistingJob(existing[0], requestedBy, orcid);
  if (resolved) return resolved;

  try {
    const inserted = await prisma.$queryRawUnsafe(
      `
        INSERT INTO public."Orcid_Scan_Job" (
          orcid,
          requested_by
        )
        VALUES ($1, $2::uuid)
        RETURNING *
      `,
      orcid,
      requestedBy,
    );
    return { job: inserted[0], reused: false };
  } catch (error) {
    if (error.code !== "23505") throw error;

    const raced = await prisma.$queryRawUnsafe(
      activeJobQuery,
      ACTIVE_STATUSES,
      requestedBy,
      orcid,
    );
    const racedResolved = resolveExistingJob(
      raced[0],
      requestedBy,
      orcid,
    );
    if (racedResolved) return racedResolved;
    throw error;
  }
};

export const getOrcidScanJobById = async (
  jobId,
  { databasePool = null } = {},
) => {
  const cached = await getCachedJob(jobId);
  if (cached) return cached;

  const result = await prisma.$queryRawUnsafe(
    'SELECT * FROM public."Orcid_Scan_Job" WHERE job_id = $1::uuid',
    jobId,
  );
  const job = result[0] || null;
  if (job) await setCachedJob(job);
  return job;
};

export const getOrcidScanJobPublications = async (
  jobId,
  { cursor = 0, limit = 20 } = {},
  { databasePool = null } = {},
) => {
  const safeCursor = /^\d+$/.test(String(cursor))
    ? String(cursor)
    : "0";
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const cacheKey = `orcid:job-pubs:${jobId}:${safeCursor}:${safeLimit}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const result = await prisma.$queryRawUnsafe(
    `
      WITH page_items AS MATERIALIZED (
        SELECT item_id, article_id
        FROM public."Orcid_Scan_Job_Item"
        WHERE job_id = $1::uuid
          AND item_id > $2::bigint
        ORDER BY item_id
        LIMIT $3
      ),
      page_rows AS (
        SELECT
          item.item_id,
          article.article_id,
          article.title,
          article.abstract,
          article.publication_year,
          article.doi,
          COALESCE(article.citation_count, 0) AS cited_by_count,
          COALESCE(article.citation_count, 0) AS citation_count,
          article.primary_topic,
          article.created_at,
          journal.journal_id::text AS journal_id,
          journal.display_name AS journal_name,
          journal.issn AS journal_issn
        FROM page_items item
        JOIN public."Article" article
          ON article.article_id = item.article_id
         AND COALESCE(article.is_deleted, false) = false
        LEFT JOIN public."Issue" issue
          ON issue.issue_id = article.issue_id
         AND COALESCE(issue.is_deleted, false) = false
        LEFT JOIN public."Volume" volume
          ON volume.volume_id = issue.volume_id
         AND COALESCE(volume.is_deleted, false) = false
        LEFT JOIN public."Journal" journal
          ON journal.journal_id = volume.journal_id
         AND COALESCE(journal.is_deleted, false) = false
      )
      SELECT page_rows.*, totals.total_available
      FROM (
        SELECT COUNT(*)::integer AS total_available
        FROM public."Orcid_Scan_Job_Item"
        WHERE job_id = $1::uuid
      ) totals
      LEFT JOIN page_rows ON true
      ORDER BY page_rows.item_id
    `,
    jobId,
    safeCursor,
    safeLimit + 1,
  );

  const totalAvailable = Number(result[0]?.total_available || 0);
  const rows = result.filter((row) => row.item_id != null);
  const hasNext = rows.length > safeLimit;
  const articles = rows
    .slice(0, safeLimit)
    .map(({ total_available: _totalAvailable, ...article }) => article);
  const nextCursor = articles.length
    ? String(articles.at(-1).item_id)
    : safeCursor;

  const response = {
    articles,
    pagination: {
      cursor: safeCursor,
      next_cursor: nextCursor,
      limit: safeLimit,
      total_available: totalAvailable,
      has_next: hasNext,
    },
  };
  try {
    await redis.set(cacheKey, JSON.stringify(response), "EX", 1800);
  } catch {}

  return response;
};

const UPDATE_COLUMNS = new Map([
  ["status", "status"],
  ["stage", "stage"],
  ["progress", "progress"],
  ["sourceProgress", "source_progress"],
  ["sourceStatus", "source_status"],
  ["summary", "summary"],
  ["authorId", "author_id"],
  ["errorCode", "error_code"],
  ["errorMessage", "error_message"],
  ["attemptCount", "attempt_count"],
  ["startedAt", "started_at"],
  ["heartbeatAt", "heartbeat_at"],
  ["completedAt", "completed_at"],
]);

export const updateOrcidScanJob = async (
  jobId,
  patch,
  { databasePool = null } = {},
) => {
  const assignments = [];
  const values = [jobId];

  for (const [key, column] of UPDATE_COLUMNS) {
    if (!Object.hasOwn(patch, key)) continue;
    const isJson = ["sourceProgress", "sourceStatus", "summary"].includes(key);
    values.push(
      isJson
        ? JSON.stringify(patch[key] ?? {})
        : patch[key],
    );
    if (isJson) {
      assignments.push(`"${column}" = $${values.length}::jsonb`);
    } else if (key === "authorId") {
      assignments.push(`"${column}" = $${values.length}::bigint`);
    } else {
      assignments.push(`"${column}" = $${values.length}`);
    }
  }

  if (!assignments.length) return getOrcidScanJobById(jobId, { databasePool });

  assignments.push('"updated_at" = now()');
  const result = await prisma.$queryRawUnsafe(
    `
      UPDATE public."Orcid_Scan_Job"
      SET ${assignments.join(", ")}
      WHERE job_id = $1::uuid
      RETURNING *
    `,
    ...values,
  );
  const updated = result[0] || null;
  if (updated) await setCachedJob(updated);
  return updated;
};

export const deleteExpiredOrcidScanJobs = async (
  { retentionDays = 7 } = {},
  { databasePool = null } = {},
) => {
  const safeDays = Math.max(1, Number(retentionDays) || 7);
  const result = await prisma.$queryRawUnsafe(
    `
      DELETE FROM public."Orcid_Scan_Job"
      WHERE status = ANY($1::varchar[])
        AND completed_at < now() - ($2::text || ' days')::interval
    `,
    TERMINAL_STATUSES,
    safeDays,
  );
  return result.rowCount;
};

export const orcidScanJobStatuses = {
  active: ACTIVE_STATUSES,
  terminal: TERMINAL_STATUSES,
};



