# 📚 BỘ GHI NHỚ & KIẾN THỨC TỔNG HỢP DỰ ÁN GIÀY DÉP PHƯƠNG NHỎ

Tài liệu này tổng hợp toàn bộ kiến thức, kiến trúc hệ thống, các lỗi kỹ thuật đã xử lý và hướng dẫn triển khai cho dự án **Giày Dép Phương Nhỏ**.

---

## 1. 🏗️ Tổng Quan Kiến Trúc Hệ Thống (Architecture)

- **Frontend**: HTML5, Vanilla CSS3 (Responsive, Glassmorphism design), Vanilla JavaScript. Các trang giao diện được lưu tại thư mục `public/`.
- **Backend**: Node.js + Express.js API được đóng gói chạy trên nền tảng **Cloudflare Workers** serverless.
- **Cơ sở dữ liệu (Database)**: SQLite / **Turso Database (libSQL)** kết nối thông qua **Prisma ORM** (`@prisma/adapter-libsql`).
- **Lưu trữ hình ảnh**: ImageKit.io API.
- **Xác thực captcha**: Cloudflare Turnstile (thay thế hoàn toàn Google reCAPTCHA).
- **Thông báo đẩy (Web Push)**: VAPID + Web Push Protocol (`web-push`).
- **OAuth Authentication**: Google OAuth2 (`passport-google-oauth20`).

---

## 2. ⚡ Các Kỹ Thuật Đã Triển Khai & Sửa Lỗi Chi Tiết

### A. Chuyển Đổi Sang Cloudflare Workers + Static Assets
1. **Kiến trúc hybrid**: 
   - Mã nguồn tĩnh (`public/`) được Cloudflare Assets Engine phân phối trực tiếp ở Edge Network (`[assets]` directory trong `wrangler.toml`).
   - Các tuyến API Express (`/api/...`) được xử lý bởi `worker.js`.
2. **Loại bỏ các API Node.js không tương thích**:
   - Đã loại bỏ `fs.existsSync`, `res.sendFile`, `__dirname` và `express.static` khỏi `server.js` vì môi trường Cloudflare Workers không có hệ thống file cục bộ (local filesystem).
3. **Cấu hình CORS chuẩn cho Worker**:
   - `worker.js` được bổ sung xử lý OPTIONS Preflight request (trả về HTTP status 204) cùng tập header `access-control-allow-*` chuẩn xác cho phép Frontend truy cập API không bị chặn trình duyệt.

### B. Kỹ Thuật "Lazy Database Initialization" (Dùng ES6 Proxy)
- **Vấn đề**: Trong bước validation/dry-run của Cloudflare, biến môi trường `TURSO_DATABASE_URL` chưa được inject. Khi ấy `@libsql/client/web` mặc định fallback về `file:./prisma/dev.db`, nhưng thư viện Web client không hỗ trợ giao thức `file:`, gây ra lỗi fatal: `LibsqlError: URL_SCHEME_NOT_SUPPORTED`.
- **Giải pháp**:
  - Trong `lib/db.js`, sử dụng **ES6 Proxy** để bọc lấy `prisma`, `libsqlClient` và `databaseConfig`.
  - Khởi tạo kết nối cơ sở dữ liệu chỉ xảy ra khi có request đầu tiên tới server (sau khi `injectEnv(env)` đã nạp đủ biến môi trường thực tế).
  - Nếu ở bước dry-run/validation của Cloudflare, hệ thống tự động fallback về URL mẫu dạng `libsql://dummy-db-validation.turso.io` để pass qua trình kiểm tra syntax mà không bị crash.

### C. Chuyển Đổi Sang ES Modules Tĩnh Cho Worker
- **Vấn đề**: Việc dùng `createRequire(import.meta.url)` động để require `server.js` khiến esbuild của Wrangler không thể phân tích và gom file (bundle) được.
- **Giải pháp**:
  - Chuyển `worker.js` sang định dạng ES Module chuẩn (`import app from './server.js'`).
  - Cho phép esbuild đóng gói toàn bộ `server.js` và các phụ thuộc vào thành 1 file JavaScript tối ưu duy nhất.

### D. Thay Thế Google reCAPTCHA Sang Cloudflare Turnstile
- **Frontend (`public/login.html`)**:
  - Thay script `https://www.google.com/recaptcha/api.js` bằng `https://challenges.cloudflare.com/turnstile/v0/api.js`.
  - Thay `<div class="g-recaptcha">` bằng `<div class="cf-turnstile" data-sitekey="...">`.
- **Backend (`routes/auth.js`)**:
  - Chuyển URL verify từ `https://www.google.com/recaptcha/api/siteverify` sang `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
  - Sử dụng secret key `TURNSTILE_SECRET`.

---

## 3. ⚙️ Cấu Hình Môi Trường (Environment Variables)

Các biến môi trường cần thiết được khai báo trong `wrangler.toml` (và `.env` khi chạy local):

| Biến môi trường | Mô tả |
| :--- | :--- |
| `PORT` | Cổng ứng dụng local (mặc định 3000) |
| `JWT_SECRET` | Khóa mã hóa JWT Token |
| `SESSION_SECRET` | Khóa mã hóa Session |
| `TURSO_DATABASE_URL` | Đường dẫn kết nối Turso SQL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Token xác thực Turso DB |
| `IMAGEKIT_URL` | Endpoint URL của ImageKit |
| `IMAGEKIT_PUBLIC_KEY` | Public Key ImageKit |
| `IMAGEKIT_PRIVATE_KEY` | Private Key ImageKit |
| `TURNSTILE_SECRET` | Secret Key xác thực Turnstile Captcha |
| `GOOGLE_CLIENT_ID` | OAuth Client ID của Google |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret của Google |
| `GMAIL_USER` | Email gửi thông báo/OTP |
| `GMAIL_APP_PASSWORD` | Mật khẩu ứng dụng Gmail (App Password) |
| `APP_URL` | URL công khai của trang web |

---

## 4. 🚀 Hướng Dẫn Vận Hành & Triển Khai (Deployment Guide)

### Chạy ứng dụng dưới local:
```bash
npm run dev
```

### Tạo lại Prisma Client:
```bash
npx prisma generate
```

### Triển khai lên Cloudflare Workers:
```bash
npx wrangler deploy
```

### Kiểm tra trạng thái deploy không thay đổi thực tế (Dry-run):
```bash
npx wrangler deploy --dry-run
```

### Đẩy mã nguồn lên GitHub:
```bash
git add .
git commit -m "Nội dung commit"
git push origin main
```

---

## 🔗 Các Liên Kết Dự Án Live
- **Production URL**: [https://giaydephuongnho-api.lamminhnhut09022011.workers.dev](https://giaydephuongnho-api.lamminhnhut09022011.workers.dev)
- **GitHub Repository**: [https://github.com/nhut0902-pr/giaydephuongnho](https://github.com/nhut0902-pr/giaydephuongnho)
