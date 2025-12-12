const express = require('express');
const PDFDocument = require('pdfkit');
const { Order, OrderItem, User } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to handle token from query string (for PDF download)
const authFromQuery = async (req, res, next) => {
    const token = req.query.token || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token required' });
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'giaydephuongnho_secret_key_2024';
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Generate and download invoice PDF
router.get('/:orderId', authFromQuery, async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Get order with items
        const order = await Order.findByPk(orderId, {
            include: [
                { model: OrderItem },
                { model: User, attributes: ['name', 'email', 'phone'] }
            ]
        });

        if (!order) {
            return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
        }

        // Check authorization (user can only see their own orders, admin can see all)
        if (req.user.role !== 'admin' && order.UserId !== req.user.id) {
            return res.status(403).json({ error: 'Không có quyền truy cập' });
        }

        // Create PDF
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=hoadon-${orderId}.pdf`);

        // Pipe to response
        doc.pipe(res);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('HOA DON BAN HANG', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('GIAY DEP HUONG NHO', { align: 'center' });
        doc.moveDown();

        // Invoice info
        doc.fontSize(10);
        doc.text(`So hoa don: #${orderId}`, 50);
        doc.text(`Ngay: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`, 50);
        doc.text(`Trang thai: ${getStatusText(order.status)}`, 50);
        doc.moveDown();

        // Customer info
        doc.fontSize(12).font('Helvetica-Bold').text('THONG TIN KHACH HANG');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Ten: ${removeVietnamese(order.shippingName)}`);
        doc.text(`SDT: ${order.shippingPhone}`);
        doc.text(`Dia chi: ${removeVietnamese(order.shippingAddress)}`);
        if (order.notes) doc.text(`Ghi chu: ${removeVietnamese(order.notes)}`);
        doc.moveDown();

        // Items table header
        doc.fontSize(12).font('Helvetica-Bold').text('CHI TIET DON HANG');
        doc.moveDown(0.5);

        // Table
        const tableTop = doc.y;
        const colWidths = [250, 60, 100, 100];
        const headers = ['San pham', 'SL', 'Don gia', 'Thanh tien'];

        // Draw header
        doc.fontSize(10).font('Helvetica-Bold');
        let xPos = 50;
        headers.forEach((header, i) => {
            doc.text(header, xPos, tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
            xPos += colWidths[i];
        });

        // Draw line
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Items
        doc.font('Helvetica');
        let yPos = tableTop + 25;
        let subtotal = 0;

        order.OrderItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            xPos = 50;
            doc.text(removeVietnamese(item.productName), xPos, yPos, { width: colWidths[0] });
            xPos += colWidths[0];
            doc.text(item.quantity.toString(), xPos, yPos, { width: colWidths[1], align: 'right' });
            xPos += colWidths[1];
            doc.text(formatPrice(item.price), xPos, yPos, { width: colWidths[2], align: 'right' });
            xPos += colWidths[2];
            doc.text(formatPrice(itemTotal), xPos, yPos, { width: colWidths[3], align: 'right' });

            yPos += 20;
        });

        // Draw line
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
        yPos += 15;

        // Subtotal
        doc.text('Tam tinh:', 360, yPos, { width: 100, align: 'right' });
        doc.text(formatPrice(subtotal), 460, yPos, { width: 100, align: 'right' });
        yPos += 15;

        // Discount
        if (order.discount > 0) {
            doc.text('Giam gia:', 360, yPos, { width: 100, align: 'right' });
            doc.text(`-${formatPrice(order.discount)}`, 460, yPos, { width: 100, align: 'right' });
            yPos += 15;
        }

        // Shipping
        doc.text('Phi van chuyen:', 360, yPos, { width: 100, align: 'right' });
        doc.text('Mien phi', 460, yPos, { width: 100, align: 'right' });
        yPos += 20;

        // Total
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text('TONG CONG:', 360, yPos, { width: 100, align: 'right' });
        doc.text(formatPrice(order.total), 460, yPos, { width: 100, align: 'right' });

        // Footer
        doc.fontSize(10).font('Helvetica');
        doc.text('Cam on quy khach da mua hang!', 50, 700, { align: 'center', width: 500 });
        doc.text('Giay Dep Huong Nho - Hotline: 0123.456.789', 50, 715, { align: 'center', width: 500 });

        // Finalize
        doc.end();

    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).json({ error: 'Không thể tạo hóa đơn' });
    }
});

function formatPrice(price) {
    return price.toLocaleString('vi-VN') + 'd';
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Cho xac nhan',
        'processing': 'Dang xu ly',
        'shipped': 'Dang giao',
        'delivered': 'Da giao',
        'cancelled': 'Da huy'
    };
    return statusMap[status] || status;
}

// Remove Vietnamese diacritics for PDF compatibility
function removeVietnamese(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
    str = str.replace(/Đ/g, 'D');
    return str;
}

module.exports = router;
