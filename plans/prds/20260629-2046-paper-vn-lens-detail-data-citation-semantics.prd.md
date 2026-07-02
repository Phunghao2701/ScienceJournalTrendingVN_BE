---
title: "Paper VN Lens Detail Data and Citation Semantics"
kind: "prd"
created_at: "2026-06-29T13:46:51.058Z"
source: "repo-harness-mcp"
---
# Paper VN Lens Detail Data and Citation Semantics

> **Status**: Draft

## Idea

Hoàn thiện backend cho trang Paper VN detail và sidebar theo hướng Lens: trả metadata bài báo sạch và đầy đủ, trả affiliation institution theo từng author tại đúng publication_year, chuẩn hóa citation/reference semantics, bổ sung citing-works year distribution cho sidebar detail, và hỗ trợ resolve tên entity theo ID cho filter chips. Không thay đổi core Trending VN.

## Problem

Trang detail hiện thiếu author affiliations và Institutions section; Volume/Issue/Pages/Published metadata chưa ổn định; Citation Count đang bị trộn với số record Article_Citing_Work, Reference Count bị trộn với số Article_Reference đã crawl; detail sidebar chưa có Citing Scholarly Works chart; filter chips FE đang hiện Publisher #ID, Author #ID do thiếu cơ chế resolve tên ổn định; một số identifiers/external links chưa có contract rõ ràng.

## Users

- Người dùng xem chi tiết bài báo Paper VN
- Frontend Paper VN Article Detail
- Nhóm kiểm thử dữ liệu và API

## Goals

- Mở rộng article detail response với metadata ổn định cho journal, volume, issue, pages, publication date/year, publisher, ISSN và identifiers khi dữ liệu tồn tại
- Trả authors kèm institutions/affiliations tại đúng năm công bố bằng Institution_Author và Institution
- Phân biệt rõ citation_count với citing_works_count, reference_count với available_references_count
- Bổ sung year distribution cho citing works để render chart bên phải
- Chuẩn hóa entity-by-id responses đủ display_name cho journal, publisher, author, topic và keyword
- Cập nhật tests và API contract cho detail, affiliation, counts và analytics

## Non-goals

- Không sao chép toàn bộ Lens
- Không tạo dữ liệu giả cho pages, publication_date, e-publication_date, license hoặc external identifiers
- Không triển khai Collections, Notes, Tags hoặc bookmark persistence
- Không thay đổi core /trending-vn endpoints
- Không tạo migration trừ khi được yêu cầu riêng

## Acceptance Criteria

- [ ] GET /articles/:id trả authors với institutions đúng publication_year khi dữ liệu tồn tại
- [ ] Response detail có citation_count và reference_count từ Article cùng citing_works_count và available_references_count từ relation tables
- [ ] Citing works analytics trả distribution theo publication_year và tổng count
- [ ] Không trả E-Published hoặc Pages giả khi DB không có dữ liệu
- [ ] Entity detail endpoints trả ID và display_name ổn định để FE resolve filter labels sau refresh
- [ ] Automated tests pass và tài liệu contract có ví dụ cụ thể

## Workflow Contract

- PRD is the source of product intent.
- Sprint must be generated as ordered checklist task cards.
- Codex execution must happen through a host-native `/goal` prompt or local Codex session, not through remote MCP execution.

## Handoff Notes

Giữ strict exact-year affiliation. Không dùng last_known_institution làm nguồn chính. Chỉ trả field tùy chọn khi có dữ liệu thật. Citing works/reference relation counts phải mang tên khác với imported metrics.
