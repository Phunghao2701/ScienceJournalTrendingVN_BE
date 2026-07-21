-- 0002_add_article_journal_performance_indexes.sql
-- Thêm các index còn thiếu cho luồng query Article/Journal (list, detail, filter, analytics).
-- Chạy thủ công qua psql khi rảnh, ví dụ:
--   psql "$POSTGRES_URL" -f deploy/sql/0002_add_article_journal_performance_indexes.sql
-- Dùng CONCURRENTLY để không khóa bảng trong lúc build index trên DB đang chạy production.
-- LƯU Ý: CREATE INDEX CONCURRENTLY không được chạy trong transaction block, nên KHÔNG bọc
-- file này trong BEGIN/COMMIT và nên chạy từng câu lệnh (không qua một số GUI chạy multi-statement
-- trong 1 transaction ngầm).

-- ============================================================================
-- 1. Author_Article / Keyword_Article: PK hiện tại là (author_id, article_id)
--    và (keyword_id, article_id) — sai thứ tự cột so với cách các query đang lọc
--    ("WHERE article_id = ..."), khiến Postgres phải quét toàn bộ index thay vì
--    seek trực tiếp. Đo thực tế trên DB production: lấy authors của 1 bài báo
--    mất ~373ms, lấy keywords mất ~774ms (chỉ để trả về vài dòng). Đây là index
--    quan trọng nhất vì Keyword_Article đang có ~151K dòng (bảng lớn nhất) và
--    được JOIN theo article_id ở rất nhiều nơi: getArticleById, buildArticleFilter,
--    getArticleAnalysis (entityQuery keywords/authors).
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_author_article_article_id"
  ON "Author_Article" ("article_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_keyword_article_article_id"
  ON "Keyword_Article" ("article_id");

-- ============================================================================
-- 2. Article: chưa có index trên các cột dùng để sort trong getAllArticles
--    (ARTICLE_SORT_COLUMNS trong articleFilter.service.js), nên mỗi lần phân
--    trang đều phải Seq Scan + Sort toàn bộ bảng. Cũng thiếu index cho issue_id
--    và primary_topic dùng trong buildArticleFilter.
-- ============================================================================
-- Các cột này cho phép NULL (attnotnull = false) dù hiện tại chưa có dòng nào NULL,
-- và code luôn ORDER BY "<col>" DESC NULLS LAST (xem normalizeArticleSort trong
-- articleFilter.service.js). Index DESC mặc định của Postgres dùng NULLS FIRST, sai
-- với NULLS LAST mà query yêu cầu, nên phải khai báo rõ NULLS LAST để planner có thể
-- dùng index thay vì Seq Scan + Sort toàn bảng. Đã verify: listing mặc định giảm từ
-- ~1.3s xuống ~2ms sau khi sửa đúng NULLS LAST.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_article_created_at"
  ON "Article" ("created_at" DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_article_publication_year"
  ON "Article" ("publication_year" DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_article_citation_count"
  ON "Article" ("citation_count" DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_article_reference_count"
  ON "Article" ("reference_count" DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_article_issue_id"
  ON "Article" ("issue_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_article_primary_topic"
  ON "Article" ("primary_topic");

-- ============================================================================
-- 3. Volume/Issue: chưa có index cho chiều "con -> cha" (journal_id, volume_id)
--    dùng trong getJournalRepositorySummary và các JOIN Issue->Volume->Journal.
--    Bảng còn nhỏ nên chưa gây đau ngay, nhưng nên có sẵn trước khi data tăng.
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_volume_journal_id"
  ON "Volume" ("journal_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_issue_volume_id"
  ON "Issue" ("volume_id");

-- ============================================================================
-- 4. Trigram search: buildArticleFilter (search) và getJournals (search) đều
--    dùng ILIKE '%term%' trên title/abstract/display_name/issn/author name/
--    keyword name — không có btree index nào hỗ trợ được pattern này. pg_trgm
--    đã có sẵn trong danh sách extension khả dụng của Supabase nhưng chưa cài.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_article_title_trgm"
  ON "Article" USING gin ("title" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_journal_display_name_trgm"
  ON "Journal" USING gin ("display_name" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_author_display_name_trgm"
  ON "Author" USING gin ("display_name" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_keyword_display_name_trgm"
  ON "Keyword" USING gin ("display_name" gin_trgm_ops);
