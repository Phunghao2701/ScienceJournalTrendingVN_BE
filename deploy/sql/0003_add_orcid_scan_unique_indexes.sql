-- 0003_add_orcid_scan_unique_indexes.sql
-- Bảo đảm các lần quét ORCID đồng thời không tạo bản ghi trùng sau chuẩn hóa.
--
-- QUAN TRỌNG:
-- - Chỉ chạy file sau khi các truy vấn audit bên dưới không trả về dòng nào.
-- - Script không tự xóa hoặc gộp dữ liệu trùng.
-- - CREATE INDEX CONCURRENTLY không được chạy trong transaction block.
--
-- Audit DOI Article:
-- SELECT lower(regexp_replace(trim(doi), '^(https?://(dx\.)?doi\.org/|doi:\s*)', '', 'i')) normalized_id,
--        array_agg(article_id), count(*)
-- FROM "Article"
-- WHERE doi IS NOT NULL AND trim(doi) <> ''
-- GROUP BY 1 HAVING count(*) > 1;
--
-- Audit OpenAlex Article / Author và ORCID Author tương tự bằng đúng biểu thức
-- của từng index bên dưới.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uq_article_normalized_doi"
  ON "Article" (
    lower(regexp_replace(trim(doi), '^(https?://(dx\.)?doi\.org/|doi:\s*)', '', 'i'))
  )
  WHERE doi IS NOT NULL AND trim(doi) <> '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uq_article_normalized_openalex_id"
  ON "Article" (
    upper(regexp_replace(trim(openalex_id), '^https?://openalex\.org/', '', 'i'))
  )
  WHERE openalex_id IS NOT NULL AND trim(openalex_id) <> '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uq_author_normalized_orcid"
  ON "Author" (
    upper(regexp_replace(trim(orcid), '^https?://(www\.)?orcid\.org/', '', 'i'))
  )
  WHERE orcid IS NOT NULL AND trim(orcid) <> '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uq_author_normalized_openalex_id"
  ON "Author" (
    upper(regexp_replace(trim(openalex_id), '^https?://openalex\.org/', '', 'i'))
  )
  WHERE openalex_id IS NOT NULL AND trim(openalex_id) <> '';
