---
title: "Paper VN Discovery Scope and API Contract"
kind: "prd"
created_at: "2026-06-29T05:46:30.496Z"
source: "repo-harness-mcp"
---
# Paper VN Discovery Scope and API Contract

> **Status**: Draft

## Idea

Hoàn thiện backend cho trang Paper VN Article Discovery/Search để mặc định chỉ trả các bài báo có ít nhất một tác giả thuộc cơ sở giáo dục đại học Việt Nam tại đúng năm công bố, dựa trên Article -> Author_Article -> Institution_Author -> Institution. Thêm scope=vn_universities cho article list, count, stats, keyword/topic article endpoints và analytics; chuẩn hóa Open Access; bổ sung metadata list để loại bỏ N+1; sửa ISSN search; thêm tests. Không triển khai core Trending VN.

## Problem

API /articles hiện lấy toàn bộ database, filter country đang dựa trên quốc gia journal thay vì affiliation của tác giả, stats không cùng scope/filter, list thiếu metadata khiến FE gọi detail N+1, Open Access contract không ổn định, ISSN search chưa hỗ trợ, keyword/topic fallback không giữ cùng scope.

## Users

- Người dùng tra cứu bài báo của các trường đại học Việt Nam
- Frontend Paper VN Article Discovery
- Nhóm phát triển và kiểm thử backend

## Goals

- Định nghĩa và thực thi chính xác scope vn_universities bằng Institution_Author và Institution
- Đồng nhất scope/filter giữa list, count, stats, keyword/topic endpoints và analytics
- Loại bỏ N+1 bằng cách trả đủ metadata trong article list
- Chuẩn hóa access=oa|closed và hỗ trợ search journal bằng ISSN
- Bổ sung unit/integration tests cho scope, filter, pagination và analytics

## Non-goals

- Không triển khai các endpoint core Trending VN
- Không tạo lại schema Institution hoặc Institution_Author
- Không dùng Journal.country để xác định Paper VN
- Không triển khai bookmark backend trong sprint này trừ khi được phê duyệt riêng

## Acceptance Criteria

- [ ] GET /articles?scope=vn_universities chỉ trả bài có ít nhất một affiliation trường đại học Việt Nam đúng publication_year
- [ ] Pagination total và stats dùng cùng scope và tất cả filter của list
- [ ] Article list trả đủ journal, publisher, volume, issue, citation, reference và authors để FE không gọi detail cho từng card
- [ ] access=oa và access=closed hoạt động; giá trị sai trả 400
- [ ] Journal search tìm được theo ISSN
- [ ] Keyword/topic article endpoints giữ scope và sort
- [ ] Automated tests pass và không thay đổi core Trending VN

## Workflow Contract

- PRD is the source of product intent.
- Sprint must be generated as ordered checklist task cards.
- Codex execution must happen through a host-native `/goal` prompt or local Codex session, not through remote MCP execution.

## Handoff Notes

Trước khi hard-code country_code hoặc Institution.type, phải query dữ liệu thật. Ưu tiên strict affiliation year = publication_year. Whitelist sort fields và tái sử dụng filter builder/predicate.
