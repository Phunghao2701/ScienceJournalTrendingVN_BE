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
