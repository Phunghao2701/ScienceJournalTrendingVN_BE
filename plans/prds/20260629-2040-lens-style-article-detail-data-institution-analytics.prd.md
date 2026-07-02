---
title: "Lens-Style Article Detail Data and Institution Analytics"
kind: "prd"
created_at: "2026-06-29T13:40:36.925Z"
source: "repo-harness-mcp"
---
# Lens-Style Article Detail Data and Institution Analytics

> **Status**: Draft

## Idea

Hoàn thiện backend cho Paper VN Article Discovery/Detail để cung cấp dữ liệu đủ và đúng nghĩa cho giao diện Lens-style: filter chip resolve tên theo ID, author kèm affiliation tại năm xuất bản, institution list, metadata publication có điều kiện, identifier/source links có dữ liệu thật, Citation Count/Reference Count tách biệt với số citing works/references đang lưu cục bộ, biểu đồ citing works theo năm, institution_id filter và Top Vietnamese Institutions analytics cho sidebar trang list.

## Problem

Frontend hiện phải hiển thị Publisher #ID/Author #ID vì thiếu resolver tập trung; article detail chưa trả affiliations theo từng author; volume/issue/publication metadata có thể null và sidebar bị lặp; citation_count/reference_count đang bị trộn với số record Article_Citing_Work/Article_Reference; detail sidebar chưa có citing works year chart; list sidebar chưa có institution ranking phù hợp Paper VN.

## Users

- Người dùng khám phá Paper VN của các trường đại học Việt Nam
- Frontend Paper VN Discovery/Detail
- Nhóm kiểm thử và phát triển backend

## Goals

- Cung cấp endpoint hoặc contract tập trung để resolve journal/publisher/author/topic/keyword/institution ID thành display name cho filter chips
- Mở rộng article detail trả author affiliations đúng publication_year và danh sách institutions không trùng
- Tách rõ citation_count, reference_count, available_citing_works_count và available_references_count
- Cung cấp citing works year distribution cho detail sidebar
- Chuẩn hóa publication metadata, identifiers và external links chỉ từ dữ liệu thật
- Bổ sung institution_id vào reusable article filter và topInstitutions vào article analytics
- Đảm bảo list/count/stats/analytics cùng áp dụng institution filter và scope vn_universities
- Bổ sung tests và API contract cho toàn bộ detail/sidebar data

## Non-goals

- Không sao chép dữ liệu giả từ Lens
- Không tạo WorldCat/LibKey/OpenAlex ID nếu database không có
- Không triển khai Collections, Notes hoặc Tags backend
- Không thay đổi core Trending VN
- Không tạo migration trừ khi schema hiện có hoàn toàn không thể đáp ứng và phải dừng để báo cáo

## Acceptance Criteria

- [ ] Article detail trả authors với institutions tại đúng publication_year và institution numbering có thể dựng ổn định
- [ ] Detail response phân biệt metric counts và available relation counts
- [ ] Citing works analytics trả year/count đầy đủ, không dựa trên riêng page hiện tại
- [ ] GET /articles và /articles/analytics hỗ trợ institution_id với total khớp nhau
- [ ] Analytics trả topInstitutions gồm institution_id, display_name, image_url/logo_url và article_count khi dữ liệu có
- [ ] Filter-label resolver trả tên thật cho tất cả entity ID hợp lệ và null rõ ràng cho ID không tồn tại
- [ ] Không có metadata giả hoặc field lặp; tests pass và core Trending VN không đổi

## Workflow Contract

- PRD is the source of product intent.
- Sprint must be generated as ordered checklist task cards.
- Codex execution must happen through a host-native `/goal` prompt or local Codex session, not through remote MCP execution.

## Handoff Notes

Ưu tiên dùng schema hiện có: Article, Author_Article, Institution_Author, Institution. Affiliation phải match publication_year. Nếu publication_date/pages/external identifiers không tồn tại trong schema, không fabricate; document field unavailable và FE phải ẩn.
