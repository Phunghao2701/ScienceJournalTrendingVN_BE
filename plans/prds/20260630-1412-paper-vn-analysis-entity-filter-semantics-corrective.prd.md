---
title: "Paper VN Analysis Entity Filter Semantics Corrective"
kind: "prd"
created_at: "2026-06-30T07:12:42.834Z"
source: "repo-harness-mcp"
---
# Paper VN Analysis Entity Filter Semantics Corrective

> **Status**: Draft

## Idea

Sửa lệch contract giữa Analysis ranking và discovery filters: thêm `institution_id` vào shared article filter/controller/service để click Institution từ FE lọc thật theo exact-year affiliation; sửa `topic_id` filter để khớp cách Analysis xếp hạng topic, tức nhận cả Article.primary_topic và Sub_Topic. Giữ nguyên scope Paper VN, OA semantics và các endpoint hiện có.

## Problem

FE Analysis đã gửi `institution_id` nhưng BE hiện bỏ qua hoàn toàn tham số này. Topic ranking trong Analysis đếm cả primary topic và sub-topic, trong khi shared topic filter chỉ lọc `Article.primary_topic`, khiến số đếm trước khi click và cohort sau khi click không nhất quán.

## Users

- Người dùng Analysis/Trending Paper VN
- Frontend ResearchPulse
- Nhóm backend ScienceJournalTrendingVN

## Goals

- Thêm institutionId vào controller params của list, analytics và analysis nếu các endpoint dùng shared filter
- Thêm exact-year institution predicate vào buildArticleFilter
- Institution filter chỉ tính Author chưa soft-delete, Institution chưa soft-delete và Institution_Author.year = Article.publication_year
- Giữ vn_universities scope semantics độc lập với institution filter
- Sửa topic filter thành primary_topic OR matching Sub_Topic
- Dedupe article khi topic xuất hiện cả primary và sub-topic
- Bổ sung focused tests cho institution filter, topic filter và parameter ordering
- Cập nhật API contract docs
- Chạy read-only smoke so sánh institution/topic clicks với SQL độc lập

## Non-goals

- Không sửa frontend trong sprint BE
- Không thay đổi schema hoặc migration
- Không dùng last_known_institution
- Không thay đổi ranking SQL ngoài phần cần để giữ semantics
- Không commit hoặc push

## Acceptance Criteria

- [ ] `GET /api/v1/articles/analysis?institution_id=:id` thay đổi cohort đúng theo exact-year affiliation
- [ ] List và lightweight analytics cũng chấp nhận institution_id nếu dùng cùng shared filter
- [ ] Institution filter không lọc theo last_known_institution
- [ ] Topic filter trả article khi topic là primary hoặc có trong Sub_Topic
- [ ] Một article có cùng topic ở cả primary và Sub_Topic chỉ được tính một lần
- [ ] Invalid institution_id trả INVALID_ENTITY_ID
- [ ] Focused articleFilter/articleAnalysis tests pass
- [ ] Read-only smoke xác nhận response count khớp SQL độc lập

## Workflow Contract

- PRD is the source of product intent.
- Sprint must be generated as ordered checklist task cards.
- Codex execution must happen through a host-native `/goal` prompt or local Codex session, not through remote MCP execution.

## Handoff Notes

Target branch hao/refactor/BE. Preserve unrelated dirty/staged changes. Existing FE branch ngoc/feature/trending-lens-style already emits institution_id. Keep this sprint narrow and contract-compatible.
