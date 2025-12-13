# Hướng dẫn sử dụng tính năng Tải nhiều ảnh sản phẩm

## 🎯 Tổng quan
Tính năng mới cho phép admin tải và quản lý nhiều ảnh cho mỗi sản phẩm, giúp khách hàng xem sản phẩm từ nhiều góc độ khác nhau.

## 🚀 Tính năng chính

### 1. **Tải nhiều ảnh cùng lúc**
- Hỗ trợ tải tối đa 10 ảnh/lần
- Tự động upload lên ImageKit CDN
- Hiển thị preview ngay lập tức

### 2. **Quản lý ảnh linh hoạt**
- Xóa từng ảnh riêng lẻ
- Sắp xếp thứ tự hiển thị
- Giữ nguyên ảnh chính (backward compatibility)

### 3. **Hiển thị chuyên nghiệp**
- Gallery với thumbnail navigation
- Ảnh chính có thể zoom
- Badge hiển thị số lượng ảnh
- Responsive trên mọi thiết bị

## 📋 Cách sử dụng

### **Cho Admin:**

1. **Thêm sản phẩm mới:**
   ```
   Admin Panel → Sản Phẩm → Thêm Sản Phẩm
   → Điền thông tin cơ bản
   → Tải ảnh chính (trường "Hình ảnh sản phẩm")
   → Nhấn "Tải nhiều ảnh" để thêm gallery
   → Chọn nhiều file ảnh (Ctrl/Cmd + Click)
   → Nhấn "Lưu"
   ```

2. **Sửa sản phẩm có sẵn:**
   ```
   Admin Panel → Sản Phẩm → Nhấn nút Edit
   → Thêm/xóa ảnh trong phần "Thư viện ảnh sản phẩm"
   → Nhấn "Lưu"
   ```

3. **Xóa ảnh:**
   ```
   Trong form sửa sản phẩm
   → Nhấn nút X trên góc ảnh cần xóa
   → Ảnh sẽ bị xóa khỏi CDN và database
   ```

### **Trải nghiệm khách hàng:**

1. **Trang danh sách sản phẩm:**
   - Hiển thị ảnh chính
   - Badge "X ảnh" nếu có nhiều ảnh

2. **Trang chi tiết sản phẩm:**
   - Ảnh chính lớn ở trên
   - Thumbnails ở dưới để chuyển đổi
   - Click thumbnail để xem ảnh khác
   - Hover effect mượt mà

## 🛠 Cấu trúc kỹ thuật

### **Database Schema:**
```javascript
Product {
  image: String,        // Ảnh chính (backward compatibility)
  images: JSON Array    // Mảng các ảnh phụ
}

// Ví dụ images array:
[
  { url: "https://ik.imagekit.io/...", fileId: "abc123" },
  { url: "https://ik.imagekit.io/...", fileId: "def456" }
]
```

### **API Endpoints:**
```
POST /api/admin/upload-multiple     // Tải nhiều ảnh
DELETE /api/admin/delete-image/:id  // Xóa ảnh
```

### **File Structure:**
```
routes/admin.js           // API upload/delete
models/index.js          // Database schema
public/admin/products.html // Admin interface
public/product-detail.html // Customer gallery
public/css/style.css     // Gallery styling
```

## 🔧 Migration

Nếu bạn có sản phẩm cũ, chạy migration để chuyển ảnh đơn thành array:

```bash
npm run migrate-images
```

## 📱 Responsive Design

- **Desktop**: Gallery đầy đủ với thumbnails
- **Tablet**: Thumbnails nhỏ hơn, vẫn đầy đủ tính năng  
- **Mobile**: Swipe để xem ảnh, thumbnails scroll ngang

## 🎨 Customization

### **Thay đổi số lượng ảnh tối đa:**
```javascript
// routes/admin.js, line ~45
upload.array('images', 10) // Đổi 10 thành số khác
```

### **Thay đổi kích thước thumbnail:**
```css
/* public/css/style.css */
.image-thumbnails .thumbnail {
  width: 80px;  /* Đổi kích thước */
  height: 80px;
}
```

## 🐛 Troubleshooting

### **Lỗi upload:**
- Kiểm tra ImageKit credentials
- Đảm bảo file < 5MB
- Chỉ chấp nhận file ảnh (jpg, png, gif, webp)

### **Ảnh không hiển thị:**
- Kiểm tra URL trong database
- Verify ImageKit CDN hoạt động
- Clear browser cache

### **Performance:**
- Ảnh tự động optimize qua ImageKit
- Lazy loading cho gallery lớn
- Thumbnail được cache

## 🔒 Security

- ✅ Admin authentication required
- ✅ File type validation
- ✅ File size limits
- ✅ CDN security headers
- ✅ SQL injection protection

## 📈 Benefits

1. **Tăng conversion rate**: Khách hàng xem được nhiều góc độ
2. **Trải nghiệm tốt hơn**: Gallery chuyên nghiệp
3. **SEO friendly**: Structured data cho images
4. **Mobile optimized**: Responsive design
5. **Fast loading**: CDN optimization

---

🎉 **Tính năng đã sẵn sàng sử dụng!** 

Hãy thử tải nhiều ảnh cho sản phẩm và trải nghiệm gallery mới nhé!