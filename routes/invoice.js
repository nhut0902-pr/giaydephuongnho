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
        doc.fontSize(20).font('Helvetica-Bold').text('HÓA ĐƠN BÁN HÀNG', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('GIÀY DÉP HƯƠNG NHỚ', { align: 'center' });
        doc.moveDown();

        // Invoice info
        doc.fontSize(10);
        doc.text(`Số hóa đơn: #${orderId}`, 50);
        doc.text(`Ngày: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`, 50);
        doc.text(`Trạng thái: ${getStatusText(order.status)}`, 50);
        doc.moveDown();

        // Customer info
        doc.fontSize(12).font('Helvetica-Bold').text('THÔNG TIN KHÁCH HÀNG');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Tên: ${order.shippingName}`);
        doc.text(`SĐT: ${order.shippingPhone}`);
        doc.text(`Địa chỉ: ${order.shippingAddress}`);
        if (order.notes) doc.text(`Ghi chú: ${order.notes}`);
        doc.moveDown();

        // Items table header
        doc.fontSize(12).font('Helvetica-Bold').text('CHI TIẾT ĐƠN HÀNG');
        doc.moveDown(0.5);

        // Table
        const tableTop = doc.y;
        const colWidths = [250, 60, 100, 100];
        const headers = ['Sản phẩm', 'SL', 'Đơn giá', 'Thành tiền'];

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
            doc.text(item.productName, xPos, yPos, { width: colWidths[0] });
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
        doc.text('Tạm tính:', 360, yPos, { width: 100, align: 'right' });
        doc.text(formatPrice(subtotal), 460, yPos, { width: 100, align: 'right' });
        yPos += 15;

        // Discount
        if (order.discount > 0) {
            doc.text('Giảm giá:', 360, yPos, { width: 100, align: 'right' });
            doc.text(`-${formatPrice(order.discount)}`, 460, yPos, { width: 100, align: 'right' });
            yPos += 15;
        }

        // Shipping
        doc.text('Phí vận chuyển:', 360, yPos, { width: 100, align: 'right' });
        doc.text('Miễn phí', 460, yPos, { width: 100, align: 'right' });
        yPos += 20;

        // Total
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text('TỔNG CỘNG:', 360, yPos, { width: 100, align: 'right' });
        doc.text(formatPrice(order.total), 460, yPos, { width: 100, align: 'right' });

        // Footer
        doc.fontSize(10).font('Helvetica');
        doc.text('Cảm ơn quý khách đã mua hàng!', 50, 700, { align: 'center', width: 500 });
        doc.text('Giày Dép Hương Nhớ - Hotline: 0123.456.789', 50, 715, { align: 'center', width: 500 });

        // Finalize
        doc.end();

    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).json({ error: 'Không thể tạo hóa đơn' });
    }
});

function formatPrice(price) {
    return price.toLocaleString('vi-VN') + 'đ';
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Chờ xác nhận',
        'processing': 'Đang xử lý',
        'shipped': 'Đang giao',
        'delivered': 'Đã giao',
        'cancelled': 'Đã hủy'
    };
    return statusMap[status] || status;
}

module.exports = router;
