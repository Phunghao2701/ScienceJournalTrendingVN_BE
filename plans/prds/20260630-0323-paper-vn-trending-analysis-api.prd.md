---
title: "Paper VN Trending Analysis API"
kind: "prd"
created_at: "2026-06-29T20:23:04.977Z"
source: "repo-harness-mcp"
---
# Paper VN Trending Analysis API

> **Status**: Draft

## Idea

Triển khai backend contract riêng cho chế độ Analysis/Trending của Paper VN thay vì tái sử dụng các endpoint /trending-vn cũ. Endpoint mới phải dùng cùng bộ lọc với /articles, giữ scope exact-year affiliation, sửa OA sang Article.is_open_access, cung cấp summary, time series, top/growth entities và trending articles dựa trên dữ liệu thực có trong Supabase.

## Problem

GET /articles/analytics hiện chỉ đủ cho sidebar nhẹ, đang dùng Journal.is_open_access và coi null như closed, thiếu institutions/journals/keywords/citation metrics. Các endpoint /trending-vn cũ dùng last_known_institution, MIN(author_id), không dùng exact-year Paper VN scope và không cùng filter contract. FE hiện cần một contract nặng, ổn định cho view=analysis nhưng chưa có endpoint phù hợp.

## Users

- Người dùng khám phá xu hướng bài báo Việt Nam
- Nhóm frontend ResearchPulse
- Nhóm backend và dữ liệu ScienceJournalTrendingVN

## Goals

- Thêm GET /api/v1/articles/analysis dùng exact-year Paper VN scope và shared discovery filters
- Giữ /articles/analytics là endpoint nhẹ nhưng sửa contract OA và bổ sung các totals/sidebar entities cần thiết
- Sửa toàn bộ article discovery OA semantics sang Article.is_open_access; null là unavailable, không phải closed
- Hỗ trợ analysis windows rõ ràng và comparison window liền trước cùng độ dài
- Cung cấp summary gồm scholarly works, citations, references, available relation counts, authors, institutions, journals và OA coverage
- Cung cấp works_over_time và citations_over_time với coverage rõ ràng
- Cung cấp top/growth institutions, authors, journals, topics và keywords
- Cung cấp trending_articles chỉ dựa trên citation history có thật; không tạo opaque score cho bài thiếu citations_by_year
- Bảo toàn filter/search/entity semantics hiện có và không dùng last_known_institution
- Thêm unit tests, API contract docs và handoff cho FE

## Non-goals

- Không sửa frontend trong sprint này
- Không dùng lại hoặc sửa sâu các endpoint /trending-vn cũ
- Không tạo schema migration hoặc index tự động
- Không giả lập institution logo, patent metrics hoặc dữ liệu không có trong DB
- Không coi số row Article_Citing_Work là tổng citation
- Không coi số row Article_Reference là tổng reference
- Không commit hoặc push

## Acceptance Criteria

- [ ] GET /articles/analysis tồn tại trước route /:id và trả contract ổn định
- [ ] scope=vn_universities dùng Article→Author_Article→Institution_Author(year=publication_year)→Institution(country_code=VN,type=education)
- [ ] Access filter dùng a.is_open_access IS TRUE hoặc IS FALSE; null được đếm riêng
- [ ] Nếu không truyền window, endpoint lấy max publication year trong cohort, dùng current window 2 năm và comparison 2 năm liền trước
- [ ] Nếu truyền publication_year mà không truyền window, endpoint dùng single-year current window và previous year comparison
- [ ] Các query entity dùng cùng search/entity/scope filters và không double-count article
- [ ] Top institutions dùng exact-year affiliation; với vn_universities chỉ tính Institution VN education
- [ ] Topics bao gồm primary topic và Sub_Topic, dedupe theo article/topic
- [ ] Citation time series aggregate citations_by_year hợp lệ và trả coverage; missing history không bị coi là 0
- [ ] Trending articles chỉ gồm bài có citation history khả dụng và trả current/previous citation activity, absolute growth, growth rate nullable
- [ ] Focused article/filter tests pass; syntax checks pass; full-suite unrelated failures documented
- [ ] Docs mô tả exact response shape và FE integration examples

## Workflow Contract

- PRD is the source of product intent.
- Sprint must be generated as ordered checklist task cards.
- Codex execution must happen through a host-native `/goal` prompt or local Codex session, not through remote MCP execution.

## Handoff Notes

Target branch is hao/refactor/BE. Current repo has reusable buildArticleFilter and /articles/analytics. Existing /trending-vn service is semantically unsafe for Paper VN because it uses last_known_institution and other legacy assumptions. Current data audit showed 40 Paper VN works before the latest backfill, citation_count/reference_count available broadly, citations_by_year only partially covered, so the API must expose coverage and unavailable states honestly. No schema changes.
