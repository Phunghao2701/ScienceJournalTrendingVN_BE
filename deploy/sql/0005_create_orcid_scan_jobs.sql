-- 0005_create_orcid_scan_jobs.sql
CREATE TABLE IF NOT EXISTS public."Orcid_Scan_Job" (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcid varchar(50) NOT NULL,
  requested_by uuid NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'queued',
  stage varchar(64) NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  source_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  author_id bigint REFERENCES public."Author"(author_id) ON DELETE SET NULL,
  error_code varchar(64),
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_orcid_scan_job_active_lookup"
  ON public."Orcid_Scan_Job" (status, requested_by, orcid, created_at DESC);

CREATE INDEX IF NOT EXISTS "idx_orcid_scan_job_status_completed"
  ON public."Orcid_Scan_Job" (status, completed_at);
