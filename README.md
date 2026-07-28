# 📢 HƯỚNG DẪN BẮT ĐẦU & CHẠY DỰ ÁN BACKEND (DÀNH CHO TEAM)

Chào mừng các thành viên trong dự án **ScientificJournalSystem**!  
Tài liệu này hướng dẫn từng bước để mọi người (Backend, Frontend, Mobile) có thể **thiết lập môi trường và chạy Backend trên máy cá nhân** một cách nhanh chóng.

---

## 🛠️ BƯỚC 1: CHUẨN BỊ MÔI TRƯỜNG (PREREQUISITES)

Trước khi bắt đầu, hãy đảm bảo máy của bạn đã cài đặt:

1. **Node.js**  
   - Phiên bản **LTS v20** trở lên (khuyên dùng **v22+**)
2. **Git**  
   - Dùng để quản lý source code và làm việc nhóm

Kiểm tra nhanh:
```bash
node -v
npm -v
git --version
```

---

## 📥 BƯỚC 2: CLONE SOURCE CODE

```bash
# Clone project (thay bằng link repo GitHub của nhóm)
git clone <GITHUB_REPOSITORY_URL>

# Di chuyển vào thư mục backend
cd ScientificJournalSystem_BE
```

---

## 📦 BƯỚC 3: CÀI ĐẶT DEPENDENCIES

```bash
npm install
```

---

## 🔑 BƯỚC 4: CẤU HÌNH BIẾN MÔI TRƯỜNG (.env)

Tạo file `.env` ở thư mục gốc:

```env
PORT=8080
```

---

## 🚀 BƯỚC 5: CHẠY DỰ ÁN

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Cấu hình tính năng quét ORCID

Endpoint `POST /api/v1/orcid/scan` yêu cầu người dùng đăng nhập. Backend
tự lấy ORCID `/read-public` access token bằng client credentials, cache token
trong Redis và dùng memory cache khi Redis không khả dụng.

```env
ORCID_CLIENT_ID=
ORCID_CLIENT_SECRET=
ORCID_TOKEN_URL=https://orcid.org/oauth/token
ORCID_API_BASE_URL=https://pub.orcid.org/v3.0
CROSSREF_MAILTO=team@example.com
OPENALEX_API_KEY=
```

`CROSSREF_MAILTO` nên là email vận hành thật. `OPENALEX_API_KEY` không bắt buộc
nhưng được khuyến nghị để có quota ổn định hơn. Không commit credentials hoặc
access token vào repository.

Mỗi lần scan lấy và persist tối đa 100 bài `journal-article`. Ba nguồn ban đầu
được gọi song song. Phần bổ sung Crossref theo DOI chỉ xử lý tối đa 10 DOI,
concurrency 3 và có budget tổng 5 giây; lỗi hoặc hết budget vẫn giữ kết quả từ
các nguồn còn lại.

`summary` chỉ mô tả kết quả của lần scan hiện tại. Sau khi persist xong,
`data.articles` và `data.pagination` được đọc lại từ DB và đại diện cho toàn bộ
bài chưa bị xóa đang liên kết với tác giả đã resolve, không chỉ những bài vừa
scan. Trang đầu có tối đa 20 bài và dùng cùng thứ tự với endpoint bài tác giả:
`publication_year DESC, article_id DESC`.

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3,
    "has_next": true,
    "next_url": "/api/v1/author/123/articles?page=2&limit=20"
  }
}
```

`pagination.total` là tổng số bài chưa bị xóa hiện có trong DB của tác giả.
Từ trang 2 hoặc khi reload, FE dùng URL trong `next_url` hay
`GET /api/v1/author/:id/articles`; thao tác phân trang này chỉ đọc DB và không
chạy scan lại. Các article trong response scan dùng cùng tập field an toàn với
endpoint GET: `article_id`, `title`, `abstract`, `publication_year`, `doi`,
`cited_by_count`, `citation_count`, `primary_topic`, `created_at`, `journal_id`,
`journal_name`, `journal_issn`.
Envelope của hai endpoint khác nhau: scan trả
`data.{author,articles,pagination,summary,source_status}`, còn GET trả mảng bài
ở `data` và `pagination` ở cấp response; các field của từng article tương thích
trực tiếp để FE ghép trang.

Metadata tạp chí được định danh theo OpenAlex Source ID, sau đó theo ISSN/ISSN-L
đã chuẩn hóa. Backend chỉ bổ sung các cột Journal còn `NULL`. Article tiếp tục
dùng quan hệ chuẩn `Article.issue_id -> Issue.volume_id -> Volume.journal_id`;
không có khóa ngoại Journal trực tiếp trên Article. Volume và Issue chỉ được tạo
khi nguồn cung cấp đầy đủ journal ổn định, volume là số nguyên dương và issue là
mã văn bản không rỗng hợp lệ (ví dụ `S1`, `12A`, `Supplement 2`). Thiếu hoặc sai
volume/issue thì Journal vẫn có thể được upsert, nhưng Article
không được gắn vào một Volume/Issue giả.

Trước khi deploy phiên bản này, cần review và áp dụng thủ công
`deploy/sql/0004_add_orcid_scan_journal_identity.sql`. Migration tạo bảng ánh xạ
ISSN cùng các unique index cho Journal, Volume và Issue. Backend không tự chạy
migration; quy trình deploy phải kiểm tra trạng thái áp dụng trước khi bật code.

ORCID scan chỉ lấy Institution có cấu trúc từ
`OpenAlex.authorships[].institutions[]` và OpenAlex I-ID hợp lệ. Affiliation text
từ Crossref không được dùng để tạo Institution. Quan hệ
`Institution_Author(author_id, institution_id, year)` được ghi theo từng bài và
năm xuất bản, idempotent; Institution đã xóa mềm không được tự khôi phục.

Metadata chi tiết của references được hydrate theo nhu cầu:

```text
POST /api/v1/articles/:id/references/hydrate  # authenticated
GET  /api/v1/articles/:id/references          # public, read-only
```

POST ưu tiên Article có sẵn trong DB theo OpenAlex ID, sau đó mới gọi OpenAlex
theo batch cho ID còn thiếu metadata. Response POST trả
`data.summary.{requested,resolved,inserted,already_available,failed}`; FE gọi lại
GET để lấy danh sách/phân trang hiện hữu. Partial provider failure vẫn trả 200
nếu hydrate được một phần; 502 chỉ khi provider thất bại hoàn toàn và không có
reference nào resolve được.

---

## 📡 BƯỚC 6: KIỂM TRA API

```text
http://localhost:8080/api/v1/users/profile
```

---

## ⚠️ QUY TẮC LÀM VIỆC NHÓM TRÊN GIT

- Không code trực tiếp trên `main`
- Tạo nhánh mới:
```bash
git checkout -b feature/ten-tinh-nang
```
- Khi cài thư viện mới, commit:
  - package.json
  - package-lock.json

---

🎯 Happy Coding!
