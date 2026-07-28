-- 0004_add_orcid_scan_journal_identity.sql
-- Stable identity support for ORCID-scanned publication hierarchies.
-- Articles keep the existing Article.issue_id -> Issue -> Volume -> Journal path.
--
-- IMPORTANT:
-- - Review and run the audits below before applying.
-- - The backend never applies this file automatically; verify deployment state.
-- - CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
--
-- Audit duplicate normalized OpenAlex source IDs:
-- SELECT upper(regexp_replace(trim(source_id), '^https?://openalex\.org/', '', 'i')),
--        array_agg(journal_id), count(*)
-- FROM "Journal"
-- WHERE source_id IS NOT NULL AND trim(source_id) <> ''
-- GROUP BY 1 HAVING count(*) > 1;
--
-- Audit ISSNs assigned to multiple journals:
-- WITH normalized AS (
--   SELECT
--     j.journal_id,
--     regexp_replace(upper(trim(token)), '[^0-9X]', '', 'g') AS issn
--   FROM "Journal" j
--   CROSS JOIN LATERAL regexp_split_to_table(j.issn, '[,;]') token
--   WHERE j.issn IS NOT NULL AND trim(j.issn) <> ''
-- )
-- SELECT issn, array_agg(DISTINCT journal_id), count(DISTINCT journal_id)
-- FROM normalized
-- WHERE issn ~ '^[0-9]{7}[0-9X]$'
-- GROUP BY issn
-- HAVING count(DISTINCT journal_id) > 1;
--
-- Audit duplicate Volume and Issue identities:
-- SELECT journal_id, volume_number, array_agg(volume_id), count(*)
-- FROM "Volume"
-- WHERE journal_id IS NOT NULL AND volume_number IS NOT NULL
-- GROUP BY journal_id, volume_number HAVING count(*) > 1;
--
-- SELECT volume_id, lower(trim(issue_number)),
--        array_agg(issue_id), count(*)
-- FROM "Issue"
-- WHERE volume_id IS NOT NULL
--   AND issue_number IS NOT NULL
--   AND trim(issue_number) <> ''
-- GROUP BY volume_id, lower(trim(issue_number)) HAVING count(*) > 1;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uq_journal_normalized_source_id"
  ON "Journal" (
    upper(regexp_replace(trim(source_id), '^https?://openalex\.org/', '', 'i'))
  )
  WHERE source_id IS NOT NULL AND trim(source_id) <> '';

CREATE TABLE IF NOT EXISTS "Journal_ISSN" (
  issn varchar(8) PRIMARY KEY,
  journal_id bigint NOT NULL
    REFERENCES "Journal" (journal_id)
    ON DELETE CASCADE,
  CONSTRAINT "Journal_ISSN_format_check"
    CHECK (issn ~ '^[0-9]{7}[0-9X]$')
);

CREATE INDEX IF NOT EXISTS "idx_journal_issn_journal_id"
  ON "Journal_ISSN" (journal_id);

-- Required by ON CONFLICT-based batch upserts. These include soft-deleted rows
-- intentionally: a deleted hierarchy must block creation of a duplicate.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uq_volume_journal_number"
  ON "Volume" (journal_id, volume_number)
  WHERE journal_id IS NOT NULL AND volume_number IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uq_issue_volume_normalized_number"
  ON "Issue" (volume_id, lower(trim(issue_number)))
  WHERE volume_id IS NOT NULL
    AND issue_number IS NOT NULL
    AND trim(issue_number) <> '';

DO $$
BEGIN
  IF EXISTS (
    WITH normalized AS (
      SELECT
        j.journal_id,
        regexp_replace(upper(trim(token)), '[^0-9X]', '', 'g') AS issn
      FROM "Journal" j
      CROSS JOIN LATERAL regexp_split_to_table(j.issn, '[,;]') token
      WHERE j.issn IS NOT NULL AND trim(j.issn) <> ''
    )
    SELECT 1
    FROM normalized
    WHERE issn ~ '^[0-9]{7}[0-9X]$'
    GROUP BY issn
    HAVING count(DISTINCT journal_id) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot backfill Journal_ISSN: one normalized ISSN maps to multiple journals';
  END IF;
END
$$;

INSERT INTO "Journal_ISSN" (issn, journal_id)
SELECT DISTINCT
  regexp_replace(upper(trim(token)), '[^0-9X]', '', 'g') AS issn,
  j.journal_id
FROM "Journal" j
CROSS JOIN LATERAL regexp_split_to_table(j.issn, '[,;]') token
WHERE j.issn IS NOT NULL
  AND trim(j.issn) <> ''
  AND regexp_replace(upper(trim(token)), '[^0-9X]', '', 'g')
      ~ '^[0-9]{7}[0-9X]$'
ON CONFLICT (issn) DO NOTHING;
