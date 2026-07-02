---
title: "Paper VN Analysis Aggregation Corrective"
kind: "prd"
created_at: "2026-06-30T05:56:47.312Z"
source: "repo-harness-mcp"
---
# Paper VN Analysis Aggregation Corrective

> **Status**: Draft

## Idea

Sửa các lỗi tính toán còn lại trong GET /api/v1/articles/analysis sau sprint Trending API: summary đang bị fan-out do join đồng thời citing works, references, authors và institutions trước khi SUM; available relation counts chưa đếm đúng composite relation rows; top và growth đang trả cùng một danh sách; citation coverage bị zero-fill sai; trending coverage không dùng cùng eligible cohort; public analysis window chưa có giới hạn an toàn; author summary vẫn có thể đếm soft-deleted author.

## Problem

Endpoint đã có contract và focused tests pass nhưng SQL hiện có thể nhân total_citations/total_references theo tích số relation rows của mỗi article. available_citing_works/reference counts dùng DISTINCT trên một cột thay vì relation key. top và growth cùng dùng entityResults. total_articles_with_history trở về 0 tại năm không có citation rows. trending_article_coverage chỉ đếm bài xuất bản trong current window trong khi trending list có thể gồm bài cũ nhận citation trong window. from_year/to_year có thể tạo mảng cực lớn. Summary đếm aa.author_id thay vì au.author_id nên soft-deleted author vẫn có thể bị tính.

## Users

- Frontend ResearchPulse
- Người dùng Paper VN Analysis/Trending
- Nhóm backend và dữ liệu ScienceJournalTrendingVN

## Goals

- Loại bỏ fan-out khỏi summary bằng pre-aggregation độc lập theo cohort
- Đếm available citing/reference relation rows bằng đúng composite key hoặc CTE pre-aggregated
- Tách top ranking và growth ranking với thứ tự riêng
- Giữ citation coverage denominator ổn định cho mọi năm zero-filled
- Dùng cùng eligible cohort cho trending list và trending coverage
- Giới hạn năm và độ dài analysis window cho public endpoint
- Không đếm soft-deleted author/institution trong summary
- Bổ sung regression tests cho SQL shape và các edge case
- Thực hiện read-only smoke test trên Supabase sau khi focused tests pass
- Cập nhật contract, handoff và checks với kết quả thật

## Non-goals

- Không sửa frontend
- Không thay đổi schema hoặc tạo migration/index
- Không thay đổi crawler/importer
- Không sửa sâu legacy /trending-vn endpoints
- Không tạo dữ liệu giả cho citations_by_year thiếu
- Không commit hoặc push

## Acceptance Criteria

- [ ] total_citations và total_references bằng tổng Article metrics đúng một lần mỗi article bất kể số authors/references/citing works/institutions
- [ ] available_citing_works bằng số distinct (article_id, openalex_work_id) relation rows và available_references bằng số distinct (article_id, reference_key) relation rows hoặc COUNT(*) trên CTE đã dedupe đúng khóa
- [ ] top entities sort theo current_count desc; growth entities sort theo absolute_growth desc rồi current_count desc
- [ ] top và growth không còn cùng object reference/danh sách
- [ ] Mọi citations_over_time row giữ cùng total_articles_with_history của cohort ngay cả khi citations=0
- [ ] trending_article_coverage dùng cùng eligibility/filter/window semantics với trending_articles
- [ ] Window giới hạn trong khoảng hợp lệ và độ dài tối đa được tài liệu hóa; input quá dài trả INVALID_ANALYSIS_WINDOW
- [ ] Summary authors đếm au.author_id đã lọc soft-delete; institutions chỉ tính từ author hợp lệ
- [ ] Focused tests và syntax checks pass; live read-only smoke trả totals hợp lý và không vượt baseline audit bất thường
- [ ] Không migration, production write, commit hoặc push

## Workflow Contract

- PRD is the source of product intent.
- Sprint must be generated as ordered checklist task cards.
- Codex execution must happen through a host-native `/goal` prompt or local Codex session, not through remote MCP execution.

## Handoff Notes

Target existing backend branch hao/refactor/BE. Preserve unrelated dirty/staged changes. Current implementation lives in src/services/articleAnalysis.service.js. Keep the endpoint contract stable where possible. growth_rate currently behaves as a decimal ratio (1.0 = 100%); document this clearly rather than changing silently. Data is sufficient; this sprint is about SQL correctness and operational safety.
