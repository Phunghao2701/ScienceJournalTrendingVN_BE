---
title: "Paper VN Entity Filters and Unified Search"
kind: "prd"
created_at: "2026-06-29T07:16:41.098Z"
source: "repo-harness-mcp"
---
# Paper VN Entity Filters and Unified Search

> **Status**: Draft

## Idea

Hoàn thiện backend cho Paper VN Article Discovery để mọi tương tác drill-down theo journal, publisher, author, topic và keyword đều dùng filter ID ổn định; đồng thời mở rộng /articles?search= để tìm xuyên title, abstract, DOI, journal, ISSN, publisher, author, keyword và topic, qua đó loại bỏ phụ thuộc vào fallback keyword/topic riêng ở frontend. Chuẩn hóa response analytics để FE không còn Unknown hoặc access distribution rỗng. Giữ nguyên scope=vn_universities và strict exact-year affiliation.

## Problem

Sau sprint trước, danh sách chính đã có scope VN nhưng search fallback vẫn làm list và analytics lệch nhau; keyword/topic endpoints trả thiếu metadata; backend chưa có publisher_id, author_id, keyword_id filter dùng chung; analytics trả field không nhất quán như author_name/total và accessDistribution dạng object; scope predicate chưa loại author soft-deleted.

## Users

- Người dùng khám phá bài báo của các trường đại học Việt Nam
- Frontend Paper VN Discovery
- Nhóm kiểm thử và phát triển backend

## Goals

- Bổ sung publisher_id, author_id và keyword_id vào reusable article filter để áp dụng cho list, count, stats và analytics
- Mở rộng /articles?search= qua journal, ISSN, publisher, author, keyword và topic bằng EXISTS hoặc subquery tránh duplicate
- Chuẩn hóa analytics response với field ổn định: display_name/article_count và accessDistribution dạng array
- Loại author soft-deleted khỏi scope vn_universities
- Đảm bảo article list/search luôn trả full metadata và không cần keyword/topic fallback riêng
- Cập nhật API docs và tests cho entity filters, unified search, analytics contract và strict scope

## Non-goals

- Không triển khai core Trending VN
- Không thay đổi schema hoặc tạo migration
- Không dùng text search thay cho ID filter khi client đã có entity ID
- Không triển khai bookmark persistence

## Acceptance Criteria

- [ ] GET /articles và /articles/analytics nhận publisher_id, author_id, keyword_id cùng các filter cũ
- [ ] Click/filter theo entity ID cho list và analytics trả cùng total
- [ ] Search keyword/topic/author/journal/publisher trực tiếp qua /articles?search= và trả full card metadata
- [ ] Không còn article được tính vào vn_universities chỉ nhờ author đã soft-delete
- [ ] Analytics topAuthors/topPublishers/topTopics dùng display_name và article_count nhất quán; accessDistribution là array
- [ ] Automated tests pass và core Trending VN không thay đổi

## Workflow Contract

- PRD is the source of product intent.
- Sprint must be generated as ordered checklist task cards.
- Codex execution must happen through a host-native `/goal` prompt or local Codex session, not through remote MCP execution.

## Handoff Notes

Dùng chung filter builder; ưu tiên EXISTS để tránh duplicate. Giữ exact-year affiliation. Whitelist/validate numeric IDs. Chuẩn hóa response thay vì buộc FE đoán nhiều alias.
