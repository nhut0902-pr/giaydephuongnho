# 👟 Giày Dép Hương Nhớ - E-commerce Website

> Website thương mại điện tử chuyên bán giày dép thời trang cao cấp

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-blue.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue.svg)](https://neon.tech/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)

## 🌟 Tính năng chính

### 🛍️ **Cho khách hàng**
- **Xem sản phẩm**: Danh mục đa dạng (sneaker, sandal, thể thao, cao gót, giày lười)
- **🆕 Gallery ảnh**: Xem sản phẩm từ nhiều góc độ với thumbnail navigation
- **Tìm kiếm & lọc**: Theo danh mục, giá, tên sản phẩm
- **Giỏ hàng thông minh**: Sync giữa local storage và server
- **Đặt hàng dễ dàng**: Form checkout với thông tin giao hàng
- **Theo dõi đơn hàng**: Cập nhật trạng thái real-time
- **Mã giảm giá**: Hệ thống voucher linh hoạt
- **⚡ Flash Sale**: Khuyến mãi có thời hạn với đếm ngược
- **Đăng nhập đa dạng**: Email/password + Google OAuth
- **📱 Push notifications**: Thông báo đơn hàng, khuyến mãi
- **📄 Hóa đơn PDF**: Tự động tạo và tải xuống

### 👨‍💼 **Cho admin**
- **Dashboard**: Thống kê doanh thu, đơn hàng, sản phẩm
- **🆕 Quản lý ảnh**: Upload nhiều ảnh cho mỗi sản phẩm (tối đa 10 ảnh)
- **Quản lý sản phẩm**: CRUD với upload ảnh lên ImageKit CDN
- **Quản lý đơn hàng**: Cập nhật trạng thái, xem chi tiết
- **Quản lý mã giảm giá**: Tạo voucher theo user hoặc công khai
- **⚡ Quản lý Flash Sale**: Thiết lập khuyến mãi có thời hạn
- **Quản lý người dùng**: Xem danh sách khách hàng
- **🔔 Thông báo real-time**: Đơn hàng mới, cập nhật trạng thái

## 🚀 Công nghệ sử dụng

### **Backend**
- **Node.js + Express.js**: Server framework
- **PostgreSQL (Neon)**: Cloud database
- **Sequelize ORM**: Database modeling
- **JWT + Passport**: Authentication
- **ImageKit**: CDN & image optimization
- **PDFKit**: PDF generation
- **Web Push API**: Push notifications

### **Frontend**
- **Vanilla JavaScript**: No framework dependencies
- **Responsive CSS**: Mobile-first design
- **Service Worker**: PWA features
- **Local Storage**: Offline cart support

### **Deployment**
- **Vercel**: Serverless deployment
- **GitHub**: Version control
- **ImageKit CDN**: Global image delivery

## 📦 Cài đặt

### **1. Clone repository**
```bash
git clone https://github.com/nhut0902-pr/giaydephuongnho.git
cd giaydephuongnho
```

### **2. Cài đặt dependencies**
```bash
npm install
```

### **3. Cấu hình environment**
```bash
cp .env.example .env
```

Cập nhật file `.env` với thông tin của bạn:
```env
PORT=3000
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
IMAGEKIT_URL=your_imagekit_url
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
APP_URL=https://your-site.netlify.app
GOOGLE_CALLBACK_URL=https://your-site.netlify.app/api/auth/google/callback
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
```

### **4. Khởi tạo database**
```bash
npm start
```

Schema sẽ được bootstrap tự động khi app khởi động lần đầu trên Turso. Prisma client cũng được generate tự động ở bước `npm install` thông qua script `postinstall`.
Các bảng của ứng dụng được tạo với prefix `GDN` để tránh va chạm nếu Turso database đang được dùng chung với schema khác.

### **5. Migration (nếu có dữ liệu cũ)**
```bash
npm run migrate-images
```

## 🧪 Testing

```bash
# Test tính năng multiple images
npm run test-images

# Khởi động development server
npm run dev
```

## 📱 Demo

- **Website**: [https://giaydephuongnho.netlify.app](https://giaydephuongnho.netlify.app)
- **Admin Panel**: `/admin/` (cần đăng nhập admin)
- **Test Product**: `/product-detail.html?id=16`

### **Demo Accounts**
```
Admin:
Email: lamminhnhut09022011@gmail.com
Password: admin123

Customer: Đăng ký mới hoặc Google OAuth
```

## 🆕 Tính năng mới: Multiple Product Images

### **✨ Highlights**
- Upload tối đa 10 ảnh cho mỗi sản phẩm
- Gallery với thumbnail navigation
- Responsive design cho mobile
- ImageKit CDN optimization
- Backward compatibility

### **📖 Documentation**
- [Hướng dẫn chi tiết](MULTIPLE_IMAGES_GUIDE.md)
- [Tóm tắt tính năng](FEATURE_SUMMARY.md)

### **🎯 Usage**
```javascript
// Admin: Upload multiple images
POST /api/admin/upload-multiple

// Customer: View gallery
<div class="product-gallery">
  <div class="main-image">...</div>
  <div class="image-thumbnails">...</div>
</div>
```

## 📁 Cấu trúc dự án

```
giaydephuongnho/
├── 📁 models/           # Database models (Sequelize)
├── 📁 routes/           # API routes
├── 📁 middleware/       # Authentication middleware
├── 📁 public/           # Frontend files
│   ├── 📁 admin/        # Admin panel
│   ├── 📁 css/          # Stylesheets
│   ├── 📁 js/           # JavaScript files
│   └── 📁 images/       # Static images
├── 📄 server.js         # Main server file
├── 📄 vercel.json       # Vercel deployment config
└── 📄 package.json      # Dependencies
```

## 🔒 Bảo mật

- ✅ JWT Authentication
- ✅ Password hashing (bcrypt)
- ✅ Input validation
- ✅ CORS protection
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ File upload validation
- ✅ Admin role-based access

## 📈 SEO & Performance

- ✅ Meta tags optimization
- ✅ Structured data (JSON-LD)
- ✅ Dynamic sitemap.xml
- ✅ Image optimization (ImageKit)
- ✅ Responsive design
- ✅ PWA features
- ✅ CDN delivery

## 🛠️ Scripts

```bash
npm start              # Production server
npm run dev            # Development server
npm run migrate-images # Migrate existing images
npm run test-images    # Test multiple images feature
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Lâm Minh Nhựt**
- GitHub: [@nhut0902-pr](https://github.com/nhut0902-pr)
- Email: lamminhnhut09022011@gmail.com
- Phone: 0916 813 067

## 🙏 Acknowledgments

- [ImageKit](https://imagekit.io/) - Image CDN & optimization
- [Neon](https://neon.tech/) - Serverless PostgreSQL
- [Vercel](https://vercel.com/) - Deployment platform
- [Unsplash](https://unsplash.com/) - Demo images

---

⭐ **Star this repo if you find it helpful!**

🚀 **Ready for production deployment!**
