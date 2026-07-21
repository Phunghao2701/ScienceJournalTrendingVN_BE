# System Test Cases — User-Facing Workflows

> Phạm vi: Auth, Article (khám phá + authoring), Comment, Bookmark, Search, Trending VN.
> Không bao gồm: Admin Dashboard (`/api/v1/admin/*`).
> Base URL giả định: `{{BASE_URL}}/api/v1`
> Mức ưu tiên: **P0** (chặn release), **P1** (quan trọng), **P2** (phụ)

## Quy ước chung

- "Token hợp lệ" = access token JWT lấy được từ `POST /auth/login` hoặc `POST /auth/google`, gửi qua header `Authorization: Bearer <token>` (route dùng `verifyToken`/`requireAuth`).
- Một số route (`checkAuth`, `refreshToken`, `login` với `remember=true`) làm việc qua **cookie** (`access_token`, `refresh_token`), không phải header — cần phân biệt khi viết test tự động (giữ cookie jar riêng).
- "Tài khoản LOCAL" = tài khoản đăng ký bằng email/password (`type = LOCAL`). "Tài khoản GOOGLE" = tài khoản tạo qua `POST /auth/google`.

---

## 0. Kịch bản liên-module (End-to-End)

| ID | Mục tiêu | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| E2E-01 | Hành trình người dùng mới hoàn chỉnh: đăng ký → kích hoạt → đăng nhập → tìm bài báo → xem chi tiết → bookmark → bình luận → đăng xuất | DB sạch với email test chưa tồn tại | 1) `POST /auth/register` với email/password hợp lệ 2) Lấy token kích hoạt từ email/log 3) `GET /auth/verify?token=...` 4) `POST /auth/login` bằng email/password vừa tạo 5) `GET /articles?search=<keyword có dữ liệu>` 6) `GET /articles/{id}` với id từ bước 5 7) `POST /bookmarks` với `article_id` đó 8) `POST /articles/{id}/comments` với nội dung hợp lệ 9) `POST /auth/logout` | Mỗi bước trả đúng status (201/200) tương ứng; tài khoản chuyển INACTIVE → ACTIVE; bookmark và comment xuất hiện đúng ở `GET /bookmarks` và `GET /articles/{id}/comments`; sau logout cookie access/refresh bị xoá | P0 |
| E2E-02 | Khôi phục truy cập bằng luồng quên mật khẩu | Tài khoản LOCAL đã ACTIVE tồn tại | 1) `POST /auth/forgot-password` với email tài khoản 2) Lấy token reset từ email/log 3) `POST /auth/reset-password` với token + mật khẩu mới 4) `POST /auth/login` bằng mật khẩu mới 5) `POST /auth/login` bằng mật khẩu cũ | Bước 3 trả 200; bước 4 đăng nhập thành công; bước 5 đăng nhập thất bại (401) vì mật khẩu cũ đã bị vô hiệu | P0 |
| E2E-03 | Người dùng mới qua Google đăng nhập lần đầu rồi tương tác Trending VN | idToken Google hợp lệ của email chưa từng đăng ký | 1) `POST /auth/google` với idToken 2) `GET /trending-vn/trending/articles` 3) `POST /bookmarks` với `article_id` lấy từ bước 2 4) `GET /bookmarks` | Bước 1 tạo tài khoản mới (status ACTIVE, type GOOGLE) và trả token; bước 3 thành công (201); bookmark xuất hiện ở bước 4 | P1 |
| E2E-04 | Phiên đăng nhập hết hạn được khôi phục qua refresh token khi đang thao tác | Đăng nhập với `remember=true` để có `refresh_token` cookie; access token đã hết hạn/gần hết hạn | 1) Gọi API cần auth (vd `GET /bookmarks`) với access_token hết hạn → nhận 401 2) `GET /auth/refresh` (dùng cookie) 3) Lặp lại `GET /bookmarks` với access_token mới | Bước 1 trả 401; bước 2 trả 200 kèm access_token mới và set lại cookie; bước 3 thành công với token mới | P1 |

---

## 1. Auth — Đăng ký & Kích hoạt tài khoản

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| AUTH-01 | Đăng ký thành công với dữ liệu hợp lệ | Email chưa tồn tại trong hệ thống | `POST /auth/register` body: email hợp lệ, password ≥ 6 ký tự, role hợp lệ (hoặc bỏ trống) | 201, `code=REGISTER_SUCCESS`, trả `user_id`, `status=INACTIVE`, `type=LOCAL`; email kích hoạt được gửi | P0 |
| AUTH-02 | Đăng ký với email đã tồn tại | Email đã đăng ký trước đó | `POST /auth/register` với email trùng | 409, thông báo "Email đã tồn tại" | P0 |
| AUTH-03 | Đăng ký thiếu email | — | body không có `email` | 400, `code=EMAIL_REQUIRED` | P1 |
| AUTH-04 | Đăng ký email sai định dạng | — | `email="abc@"`, `email="not-an-email"` | 400, `code=EMAIL_INVALID` | P1 |
| AUTH-05 | Đăng ký password quá ngắn | — | `password="123"` (< 6 ký tự) | 400, `code=PASSWORD_TOO_SHORT` | P1 |
| AUTH-06 | Đăng ký thiếu password | — | body không có `password` | 400, `code=PASSWORD_REQUIRED` | P1 |
| AUTH-07 | Đăng ký với role không hợp lệ | — | `role="SUPERADMIN"` | 400, `code=ROLE_INVALID` | P2 |
| AUTH-08 | Kích hoạt tài khoản bằng token hợp lệ | Vừa đăng ký, có token kích hoạt còn hạn | `GET /auth/verify?token=<valid>` | 200, `code=ACCOUNT_ACTIVATION_SUCCESS`; user chuyển `status=ACTIVE` | P0 |
| AUTH-09 | Kích hoạt lại tài khoản đã active | Tài khoản đã ACTIVE, dùng lại token cũ (còn hợp lệ) | `GET /auth/verify?token=<valid nhưng đã dùng>` | 200, `code=ACCOUNT_ALREADY_ACTIVE`, không lỗi | P2 |
| AUTH-10 | Kích hoạt bằng token hết hạn/sai | — | `GET /auth/verify?token=<expired hoặc random string>` | 400, thông báo "Token kích hoạt không hợp lệ hoặc đã hết hạn" | P0 |
| AUTH-11 | Kích hoạt thiếu token | — | `GET /auth/verify` (không có query `token`) | 400, `code=ACTIVATION_TOKEN_REQUIRED` | P2 |
| AUTH-12 | Kích hoạt tài khoản đã bị khóa (BANNED) | Admin đã set status=BANNED cho tài khoản | `GET /auth/verify?token=<valid>` | 403, không kích hoạt được | P2 |

## 2. Auth — Đăng nhập / Phiên làm việc

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| AUTH-13 | Đăng nhập thành công (không remember) | Tài khoản LOCAL đã ACTIVE | `POST /auth/login` email/password đúng, `remember` không truyền hoặc `false` | 200, `code=LOGIN_SUCCESS`, trả `data.token`; cookie `access_token` được set; cookie `refresh_token` KHÔNG được set (hoặc bị clear) | P0 |
| AUTH-14 | Đăng nhập thành công với remember=true | Tài khoản LOCAL đã ACTIVE | `POST /auth/login` kèm `remember: true` | 200; cookie `access_token` VÀ `refresh_token` đều được set với `maxAge` tương ứng | P0 |
| AUTH-15 | Đăng nhập sai mật khẩu | Tài khoản tồn tại | password sai | 401, thông báo "Email hoặc mật khẩu không đúng" | P0 |
| AUTH-16 | Đăng nhập email không tồn tại | — | email chưa từng đăng ký | 401 | P0 |
| AUTH-17 | Đăng nhập tài khoản chưa kích hoạt (INACTIVE) | Đăng ký nhưng chưa verify | email/password đúng | 403, không cho đăng nhập | P0 |
| AUTH-18 | Đăng nhập tài khoản bị khóa (BANNED) | Admin set BANNED | email/password đúng | 403 | P1 |
| AUTH-19 | Đăng nhập thiếu email/password | — | body rỗng hoặc thiếu 1 field | 400 với code tương ứng (`EMAIL_REQUIRED`/`PASSWORD_REQUIRED`) | P1 |
| AUTH-20 | Đăng nhập email sai định dạng | — | `email="abc"` | 400, `code=EMAIL_INVALID` | P2 |
| AUTH-21 | Refresh token thành công | Đã đăng nhập với `remember=true`, có cookie `refresh_token` hợp lệ | `GET /auth/refresh` (gửi cookie) | 200, `code=REFRESH_TOKEN_SUCCESS`, trả `access_token` mới, cookie `access_token` được cập nhật | P0 |
| AUTH-22 | Refresh token khi thiếu cookie refresh_token | Không có cookie `refresh_token` | `GET /auth/refresh` | 401, `code=REFRESH_TOKEN_REQUIRED` | P1 |
| AUTH-23 | Refresh token với refresh_token giả mạo | — | cookie `refresh_token` là chuỗi ngẫu nhiên/ký sai secret | 401, `code=INVALID_ACCESS_TOKEN` | P1 |
| AUTH-24 | Check-auth khi có access_token hợp lệ | Đã đăng nhập, cookie access_token còn hiệu lực | `GET /auth/check-auth` | 200, `authenticated=true` | P1 |
| AUTH-25 | Check-auth khi không có cookie | Chưa đăng nhập / đã logout | `GET /auth/check-auth` | 401, `authenticated=false`, `code=ACCESS_TOKEN_MISSING` | P1 |
| AUTH-26 | Đăng xuất | Đã đăng nhập | `POST /auth/logout` | 200, `code=LOGOUT_SUCCESS`; cookie `access_token` và `refresh_token` bị xoá; các API cần auth sau đó trả 401 | P0 |

## 3. Auth — Quên mật khẩu / Đặt lại mật khẩu

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| AUTH-27 | Yêu cầu quên mật khẩu với email tồn tại (LOCAL) | Tài khoản LOCAL đã ACTIVE | `POST /auth/forgot-password` email hợp lệ | 200, thông báo chung "Nếu email tồn tại...", email chứa link reset được gửi | P0 |
| AUTH-28 | Yêu cầu quên mật khẩu với email KHÔNG tồn tại | — | email lạ | 200 với thông báo chung giống hệt AUTH-27 (không lộ thông tin tồn tại tài khoản) | P0 |
| AUTH-29 | Quên mật khẩu cho tài khoản GOOGLE | Tài khoản đăng ký qua Google (type=GOOGLE) | email của tài khoản Google | 403, `code=RESET_PASSWORD_NOT_SUPPORTED` | P1 |
| AUTH-30 | Quên mật khẩu với email rỗng/sai định dạng | — | `email=""` hoặc không hợp lệ | 400, `code=INVALID_EMAIL` | P2 |
| AUTH-31 | Đặt lại mật khẩu với token hợp lệ | Đã gọi forgot-password, có token còn hạn | `POST /auth/reset-password` token hợp lệ + `new_password` ≥ 6 ký tự | 200, đổi mật khẩu thành công; đăng nhập lại bằng mật khẩu mới thành công | P0 |
| AUTH-32 | Đặt lại mật khẩu với token hết hạn/không hợp lệ | — | token sai/hết hạn | 400, `code=INVALID_OR_EXPIRED_TOKEN` | P0 |
| AUTH-33 | Đặt lại mật khẩu với new_password quá ngắn | token hợp lệ | `new_password="123"` | 400, `code=INVALID_PASSWORD` | P1 |
| AUTH-34 | Đặt lại mật khẩu thiếu token hoặc thiếu new_password | — | body thiếu field | 400, `code=INVALID_TOKEN` hoặc `INVALID_PASSWORD` tương ứng | P2 |
| AUTH-35 | Dùng lại token reset đã sử dụng | Token đã dùng ở AUTH-31 | `POST /auth/reset-password` với token cũ | 400 (token đã invalid sau khi dùng 1 lần) | P1 |

## 4. Auth — Đăng nhập Google

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| AUTH-36 | Đăng nhập Google lần đầu (tự động tạo tài khoản) | idToken hợp lệ của email chưa tồn tại trong hệ thống | `POST /auth/google` với `idToken` hợp lệ | 200, tự tạo user mới `type=GOOGLE`, `status=ACTIVE`, trả token | P0 |
| AUTH-37 | Đăng nhập Google với tài khoản đã tồn tại | idToken hợp lệ của email đã từng đăng nhập Google trước đó | `POST /auth/google` | 200, không tạo trùng user, trả token cho user hiện có | P0 |
| AUTH-38 | Đăng nhập Google thiếu idToken | — | body rỗng | 400, thông báo "idToken không được để trống" | P1 |
| AUTH-39 | Đăng nhập Google với idToken không hợp lệ/hết hạn | — | idToken giả/hết hạn | 400/401 lỗi xác thực Google | P1 |
| AUTH-40 | Đăng nhập Google với tài khoản đã bị BANNED | idToken hợp lệ nhưng email tương ứng đã bị khóa | `POST /auth/google` | 403, thông báo "Tài khoản đã bị khóa" | P1 |
| AUTH-41 | Đăng nhập Google trùng email đã đăng ký LOCAL trước đó | Email đã tồn tại với `type=LOCAL` | `POST /auth/google` cùng email | Xác định hành vi thực tế: liên kết tài khoản hay từ chối — verify với business rule hiện tại và assert đúng theo đó | P2 |

## 5. Article — Khám phá & Tìm kiếm (Public)

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| ART-01 | Lấy danh sách bài báo công khai không cần token | — | `GET /articles` (không kèm `keywords`, không có header Authorization) | 200, trả danh sách bài báo phân trang mặc định (page=1, limit=10) | P0 |
| ART-02 | Tìm kiếm bài báo theo tiêu đề | DB có bài báo chứa từ khóa "cancer" | `GET /articles?search=cancer` | 200, chỉ trả bài báo có tiêu đề khớp | P1 |
| ART-03 | Phân trang danh sách bài báo | DB có > 10 bài báo | `GET /articles?page=2&limit=5` | 200, trả đúng 5 bài thuộc trang 2, metadata phân trang chính xác | P1 |
| ART-04 | Sắp xếp danh sách theo publication_year desc | — | `GET /articles?sortBy=publication_year&sortOrder=desc` | 200, danh sách sắp xếp giảm dần theo năm | P2 |
| ART-05 | Tìm kiếm nâng cao theo keywords có token hợp lệ | Có token hợp lệ | `GET /articles?keywords=Machine Learning,Deep Learning` + header Authorization | 200, trả kết quả theo chế độ tìm kiếm chuyên biệt keyword | P1 |
| ART-06 | Tìm kiếm nâng cao theo keywords KHÔNG có token | Không gửi Authorization | `GET /articles?keywords=Machine Learning` | 401, không cho truy cập chế độ keyword | P0 |
| ART-07 | Xem chi tiết bài báo hợp lệ | article_id tồn tại | `GET /articles/{id}` | 200, trả đầy đủ thông tin chi tiết bài báo | P0 |
| ART-08 | Xem chi tiết bài báo không tồn tại | article_id không tồn tại trong DB | `GET /articles/999999` | 404, `code=ARTICLE_NOT_FOUND` | P0 |
| ART-09 | Xem chi tiết bài báo với ID không phải số | — | `GET /articles/abc` | 400, `code=ID_INVALID` | P1 |
| ART-10 | Lấy danh sách citing works | article_id tồn tại và có bài trích dẫn | `GET /articles/{id}/citing-works?page=1&limit=20` | 200, trả danh sách bài báo trích dẫn article hiện tại | P1 |
| ART-11 | Lấy citing-works analytics | article_id tồn tại | `GET /articles/{id}/citing-works/analytics` | 200, trả số liệu tổng hợp về citing works | P2 |
| ART-12 | Lấy danh sách references | article_id tồn tại và có tài liệu tham khảo | `GET /articles/{id}/references?page=1&limit=50` | 200, trả danh sách reference | P1 |
| ART-13 | Citing-works/references với article_id không tồn tại | — | `GET /articles/999999/references` | 404 hoặc danh sách rỗng tuỳ hành vi hiện tại — verify nhất quán với ART-08 | P2 |
| ART-14 | Lấy Article Analytics tổng hợp (trending score, kiểm tra tạp chí VN) | DB có dữ liệu bài báo thuộc journal VN và không phải VN | `GET /articles/analytics` | 200, trả số liệu thống kê phản ánh đúng phân loại VN-journal và điểm trending | P1 |
| ART-15 | Lấy Article Analysis với bộ lọc | — | `GET /articles/analysis` (kèm query filter tương ứng nếu có) | 200, dữ liệu phân tích khớp bộ lọc | P1 |

## 6. Article — Authoring (CRUD, yêu cầu xác thực)

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| ART-16 | Tạo bài báo mới hợp lệ | Có token hợp lệ; `issue_id` tồn tại | `POST /articles` với title, publication_year, issue_id, authors (ID tồn tại), keywords hợp lệ | 201, trả bài báo vừa tạo | P0 |
| ART-17 | Tạo bài báo thiếu title | Có token | body thiếu `title` | 400, `code=TITLE_REQUIRED` | P1 |
| ART-18 | Tạo bài báo thiếu publication_year | Có token | body thiếu `publication_year` | 400, `code=PUBLICATION_YEAR_REQUIRED` | P1 |
| ART-19 | Tạo bài báo với publication_year không phải số | Có token | `publication_year: "2026"` (string) | 400, `code=PUBLICATION_YEAR_INVALID` | P2 |
| ART-20 | Tạo bài báo với authors chứa ID không tồn tại | Có token | `authors: [999999]` | 400, `code=AUTHORS_NOT_FOUND` | P1 |
| ART-21 | Tạo bài báo với authors không phải mảng | Có token | `authors: "12"` | 400, `code=AUTHORS_INVALID` | P2 |
| ART-22 | Tạo bài báo với keywords sai cấu trúc | Có token | `keywords: ["abc", 123]` hoặc object có score không phải số | 400, `code=KEYWORDS_INVALID` | P2 |
| ART-23 | Tạo bài báo không có token | Không gửi Authorization | body hợp lệ | 401 | P0 |
| ART-24 | Cập nhật bài báo hợp lệ | Có token; article_id tồn tại | `PUT /articles/{id}` với field cần đổi | 200, dữ liệu cập nhật đúng | P0 |
| ART-25 | Cập nhật bài báo với article_id không tồn tại | Có token | `PUT /articles/999999` | 404 | P1 |
| ART-26 | Cập nhật bài báo với authors chứa ID không tồn tại | Có token | `authors: [999999]` | 400, `code=AUTHORS_NOT_FOUND` | P2 |
| ART-27 | Cập nhật bài báo không có token | — | `PUT /articles/{id}` không Authorization | 401 | P1 |
| ART-28 | Xóa mềm bài báo | Có token; article_id tồn tại chưa bị xóa | `DELETE /articles/{id}` | 200; bài báo có `is_deleted=true`; không còn xuất hiện ở `GET /articles` nhưng vẫn `GET /articles/{id}` được | P0 |
| ART-29 | Xóa bài báo không tồn tại | Có token | `DELETE /articles/999999` | 404 | P1 |
| ART-30 | Xóa bài báo không có token | — | `DELETE /articles/{id}` | 401 | P1 |
| ART-31 | Khôi phục bài báo đã xóa mềm | Bài báo đã bị xóa ở ART-28 | `PATCH /articles/{id}/restore` | 200; bài báo xuất hiện trở lại ở `GET /articles` | P1 |
| ART-32 | Khôi phục bài báo chưa bị xóa | article_id tồn tại và không bị xóa | `PATCH /articles/{id}/restore` | 404, không có gì để khôi phục | P2 |
| ART-33 | Khôi phục bài báo không tồn tại | — | `PATCH /articles/999999/restore` | 404 | P2 |

## 7. Comment (gắn với Article)

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| CMT-01 | Xem danh sách comment của bài báo (public) | article_id tồn tại, có comment | `GET /articles/{id}/comments` (không cần token) | 200, trả danh sách comment kèm user/avatar/content/created_at | P1 |
| CMT-02 | Xem comment của bài báo không tồn tại | — | `GET /articles/999999/comments` | 404 | P2 |
| CMT-03 | Thêm comment khi đã đăng nhập | Có token; article_id tồn tại | `POST /articles/{id}/comments` `{content: "Nội dung hợp lệ"}` | 201, comment mới xuất hiện trong danh sách | P0 |
| CMT-04 | Thêm comment khi chưa đăng nhập | Không có token | `POST /articles/{id}/comments` | 401 | P0 |
| CMT-05 | Thêm comment với content rỗng | Có token | `{content: ""}` hoặc `{content: "   "}` | 400, `code=CONTENT_REQUIRED` | P1 |
| CMT-06 | Thêm comment cho bài báo không tồn tại | Có token | `POST /articles/999999/comments` | 404 | P2 |
| CMT-07 | Cập nhật comment của chính mình | Comment thuộc user hiện tại | `PUT /comments/{commentId}` `{content: "Đã sửa"}` | 200, nội dung cập nhật đúng | P0 |
| CMT-08 | Cập nhật comment của người khác | commentId thuộc user khác | `PUT /comments/{commentId}` với token của user A trên comment của user B | 404 (không có quyền chỉnh sửa, theo thiết kế ẩn thông tin quyền) | P0 |
| CMT-09 | Cập nhật comment với content rỗng | comment thuộc user hiện tại | `{content: ""}` | 400 | P2 |
| CMT-10 | Cập nhật comment với commentId không hợp lệ | — | `PUT /comments/abc` | 400, `code=INVALID_COMMENT_ID` | P2 |
| CMT-11 | Cập nhật comment không có token | — | `PUT /comments/{id}` không Authorization | 401 | P1 |
| CMT-12 | Xóa comment của chính mình | Comment thuộc user hiện tại | `DELETE /comments/{commentId}` | 200; comment không còn trong danh sách | P0 |
| CMT-13 | Xóa comment của người khác | commentId thuộc user khác | `DELETE /comments/{commentId}` với token user A | 404 | P0 |
| CMT-14 | Xóa comment với ID không hợp lệ | — | `DELETE /comments/-1` hoặc `/comments/abc` | 400, `code=INVALID_COMMENT_ID` | P2 |
| CMT-15 | Xóa comment không có token | — | `DELETE /comments/{id}` | 401 | P1 |

## 8. Bookmark

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| BM-01 | Lấy danh sách bookmark của user | Có token; user đã bookmark ≥ 1 bài | `GET /bookmarks` | 200, trả đúng danh sách bookmark của user hiện tại (không lẫn của user khác) | P0 |
| BM-02 | Lấy danh sách bookmark khi chưa đăng nhập | Không có token | `GET /bookmarks` | 401 | P0 |
| BM-03 | Lấy danh sách bookmark khi chưa có bookmark nào | User mới, chưa bookmark gì | `GET /bookmarks` | 200, trả mảng rỗng | P2 |
| BM-04 | Thêm bookmark hợp lệ | Có token; article_id tồn tại và chưa bookmark | `POST /bookmarks` `{article_id: <id>}` | 201, bookmark xuất hiện ở `GET /bookmarks` | P0 |
| BM-05 | Thêm bookmark với article_id không hợp lệ | Có token | `{article_id: "abc"}` hoặc `{article_id: -1}` | 400, `code=INVALID_ARTICLE_ID` | P1 |
| BM-06 | Thêm bookmark cho bài báo không tồn tại | Có token | `{article_id: 999999}` | 404 | P1 |
| BM-07 | Thêm bookmark trùng lặp | article_id đã được user bookmark trước đó | `POST /bookmarks` cùng `article_id` | Xác nhận hành vi hệ thống hiện tại (từ chối trùng lặp hoặc idempotent) và assert nhất quán, không tạo 2 bản ghi trùng | P1 |
| BM-08 | Thêm bookmark không có token | — | `POST /bookmarks` | 401 | P0 |
| BM-09 | Bỏ bookmark thành công | Bài báo đã được bookmark trước đó | `DELETE /bookmarks/{articleId}` | 200; bookmark biến mất khỏi `GET /bookmarks` | P0 |
| BM-10 | Bỏ bookmark bài chưa từng bookmark | article_id tồn tại nhưng chưa bookmark | `DELETE /bookmarks/{articleId}` | 404 | P1 |
| BM-11 | Bỏ bookmark với articleId không hợp lệ | Có token | `DELETE /bookmarks/abc` | 400, `code=INVALID_ARTICLE_ID` | P2 |
| BM-12 | Bỏ bookmark không có token | — | `DELETE /bookmarks/{id}` | 401 | P1 |
| BM-13 | Bookmark của user A không bị user B thao tác | 2 user khác nhau, user A đã bookmark 1 bài | User B gọi `DELETE /bookmarks/{articleId đã bookmark bởi A}` | Không xóa được bookmark của A (404, vì không tìm thấy bookmark thuộc B); bookmark của A vẫn còn nguyên | P1 |

## 9. Search — Tìm kiếm tổng hợp

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| SRCH-01 | Tìm kiếm từ khóa hợp lệ trả kết quả đa loại | DB có dữ liệu khớp keyword ở nhiều loại (Journal, Author, Article...) | `GET /search/AI Technology` | 200, `success=true`, `data` là mảng gồm các item với `type` thuộc JOURNAL/AUTHOR/ARTICLE/KEYWORD/AREA/CATEGORY | P0 |
| SRCH-02 | Tìm kiếm với keyword rỗng | — | `GET /search/%20` hoặc keyword toàn khoảng trắng | 400, `code=INVALID_REQUEST` | P1 |
| SRCH-03 | Tìm kiếm giới hạn limit | DB có nhiều hơn `limit` kết quả khớp | `GET /search/AI?limit=5` | 200, số lượng item trả về ≤ 5 | P1 |
| SRCH-04 | Tìm kiếm với limit vượt max (100) | — | `GET /search/AI?limit=500` | 400 (nếu có validate cứng) hoặc tự động giới hạn về 100 — xác nhận theo hành vi thực tế | P2 |
| SRCH-05 | Tìm kiếm từ khóa không có kết quả | keyword không khớp bất kỳ dữ liệu nào | `GET /search/zzzzzz_no_match` | 200, `success=true`, `data=[]` | P1 |
| SRCH-06 | Tìm kiếm với ký tự đặc biệt/SQL injection | — | `GET /search/'; DROP TABLE Article;--` | 200/400 an toàn, không lỗi 500, không có tác động đến DB | P0 |

## 10. Trending VN

| ID | Mục tiêu | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| TRD-01 | Lấy Top Journals VN mặc định | DB có bài báo trong 2 năm gần nhất | `GET /trending-vn/top-journals` | 200, `code=TRENDING_VN_TOP_JOURNALS_SUCCESS`; `data.window.years=2`; `data.items` sắp xếp theo `total_recent_citations` giảm dần, `rank` tăng dần từ 1 | P0 |
| TRD-02 | Lấy Top Journals VN với years/limit tùy chỉnh | — | `GET /trending-vn/top-journals?years=5&limit=3` | 200, `window.years=5`, tối đa 3 item | P1 |
| TRD-03 | Top Journals VN với years/limit ngoài khoảng cho phép | — | `GET /trending-vn/top-journals?years=0&limit=999` | 400 (nếu có validate) hoặc tự clamp về min/max hợp lệ — xác nhận theo hành vi thực tế và đảm bảo không lỗi 500 | P2 |
| TRD-04 | Lấy Top Universities VN mặc định | DB có tác giả chính gắn với trường ĐH | `GET /trending-vn/top-universities` | 200, `data.hot_basis` và `data.items` hợp lệ, mỗi item có `institution_name`, `total_recent_citations` | P0 |
| TRD-05 | Top Universities VN với hot_limit tùy chỉnh | — | `GET /trending-vn/top-universities?hot_limit=3` | 200, `hot_basis.keywords`/`topics` giới hạn theo `hot_limit` | P2 |
| TRD-06 | Lấy Ranking Journals (toàn DB, không giới hạn năm) | — | `GET /trending-vn/ranking/journals?limit=10` | 200, danh sách journal xếp hạng theo tổng citation toàn bộ | P1 |
| TRD-07 | Lấy Trending Journals theo N năm | — | `GET /trending-vn/trending/journals?years=3&limit=10` | 200, khác biệt rõ với ranking (chỉ tính trong window năm) | P1 |
| TRD-08 | Lấy Ranking Universities | — | `GET /trending-vn/ranking/universities?limit=10` | 200, xếp hạng theo toàn bộ bài của tác giả chính | P1 |
| TRD-09 | Lấy Trending Universities | — | `GET /trending-vn/trending/universities` | 200, dữ liệu nhất quán với top-universities (cùng thuật toán) | P1 |
| TRD-10 | Lấy Ranking Authors | — | `GET /trending-vn/ranking/authors?limit=10` | 200, xếp hạng theo h-index/citation/works | P1 |
| TRD-11 | Lấy Trending Authors | — | `GET /trending-vn/trending/authors` | 200, dựa trên hot keyword/topic + tác giả chính | P1 |
| TRD-12 | Lấy Trending Articles | — | `GET /trending-vn/trending/articles?years=2&limit=10` | 200, mỗi item có `trending_score` tính từ citation_count + hot keyword/topic + citing works + references | P0 |
| TRD-13 | Lấy Trending Keywords | — | `GET /trending-vn/trending/keywords` | 200, danh sách keyword xuất hiện nhiều trong topic hot, không giới hạn theo năm | P1 |
| TRD-14 | Trending VN khi DB trống dữ liệu năm gần nhất | Không có bài báo nào trong khoảng years yêu cầu | `GET /trending-vn/top-journals?years=1` | 200, `data.items=[]`, không lỗi 500, `window.from_year/to_year` có thể null | P2 |
| TRD-15 | Trending VN đảm bảo tính nhất quán rank | Bất kỳ endpoint ranking/trending nào có `rank` | So sánh thứ tự `rank` với giá trị metric sắp xếp (citations/score) trong response | `rank` tăng dần đúng theo thứ tự giảm dần của metric tương ứng, không có rank trùng/nhảy cóc | P1 |

---

## Ghi chú thực thi

- Các test case có ký hiệu "xác nhận hành vi thực tế" (BM-07, ART-13, AUTH-41, SRCH-04, TRD-03) là các vùng **chưa rõ đặc tả** — cần chạy thử trên môi trường thật/staging để chốt kết quả mong đợi trước khi đưa vào bộ test tự động, tránh test case sai theo giả định.
- Dữ liệu test nên dùng fixture riêng (email `*.qa@...`, article/journal gắn cờ test) để không lẫn với dữ liệu thật khi chạy trên môi trường có DB chia sẻ.
- Với các API dùng cookie (`login`, `refresh`, `check-auth`, `logout`), test tự động cần giữ cookie jar theo từng "phiên người dùng" độc lập để tránh nhiễu chéo giữa các test case chạy song song.
