const express = require('express');
const { Order, OrderItem, Cart, Product, DiscountCode, PushSubscription, User } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');
const pushRoutes = require('./push');
const { sendOrderStatusEmail, sendNewOrderEmailToAdmin, sendReturnActionEmail } = require('../utils/mailer');

const router = express.Router();

// Get user orders
router.get('/', authenticateToken, async (req, res) => {
    try {
        const where = req.user.role === 'admin' ? {} : { UserId: req.user.id };

        const orders = await Order.findAll({
            where,
            include: [{ model: OrderItem }],
            order: [['createdAt', 'DESC']]
        });

        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const where = { id: req.params.id };
        if (req.user.role !== 'admin') {
            where.UserId = req.user.id;
        }

        const order = await Order.findOne({
            where,
            include: [{ model: OrderItem }]
        });

        if (!order) {
            return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
        }

        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Create order from cart
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { shippingAddress, shippingName, shippingPhone, notes, discountCode } = req.body;

        // Get cart items
        const cartItems = await Cart.findAll({
            where: { UserId: req.user.id },
            include: [{ model: Product }]
        });

        if (cartItems.length === 0) {
            return res.status(400).json({ error: 'Giỏ hàng trống' });
        }

        // Calculate total
        let total = cartItems.reduce((sum, item) => {
            return sum + (item.Product.price * item.quantity);
        }, 0);

        let discount = 0;
        let appliedDiscountCode = null;

        // Apply discount code if provided
        if (discountCode) {
            const code = await DiscountCode.findOne({
                where: {
                    code: discountCode,
                    active: true,
                    validFrom: { [Op.lte]: new Date() },
                    validTo: { [Op.gte]: new Date() }
                }
            });

            if (code) {
                if (code.minOrderValue && total < code.minOrderValue) {
                    return res.status(400).json({
                        error: `Đơn hàng tối thiểu ${code.minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã này`
                    });
                }

                if (code.usageLimit && code.usedCount >= code.usageLimit) {
                    return res.status(400).json({ error: 'Mã giảm giá đã hết lượt sử dụng' });
                }

                discount = total * (code.percentage / 100);
                if (code.maxDiscount && discount > code.maxDiscount) {
                    discount = code.maxDiscount;
                }

                appliedDiscountCode = discountCode;

                // Update usage count
                await code.update({ usedCount: code.usedCount + 1 });
            }
        }

        // Create order
        const order = await Order.create({
            UserId: req.user.id,
            status: 'pending',
            total: total - discount,
            discount,
            shippingAddress,
            shippingName,
            shippingPhone,
            notes,
            discountCode: appliedDiscountCode,
            isRead: false
        });

        // Create order items
        for (const item of cartItems) {
            await OrderItem.create({
                OrderId: order.id,
                ProductId: item.Product.id,
                quantity: item.quantity,
                price: item.Product.price,
                productName: item.Product.name,
                productImage: item.Product.image,
                size: item.size,
                color: item.color
            });

            // Update stock and sold count
            await item.Product.update({
                stock: item.Product.stock - item.quantity,
                sold: (item.Product.sold || 0) + item.quantity
            });
        }

        // Clear cart
        await Cart.destroy({ where: { UserId: req.user.id } });

        // Get complete order
        const completeOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem }]
        });

        // Send push notification to admins
        try {
            await pushRoutes.sendToAdmins({
                title: '🛒 Đơn Hàng Mới!',
                body: `${shippingName} đã đặt đơn ${(total - discount).toLocaleString('vi-VN')}đ`,
                icon: '/images/logo.jpg',
                data: { url: `/admin/orders.html`, orderId: order.id }
            });
        } catch (e) { console.log('Push notification failed:', e); }

        // Send email notification to admin
        try {
            const items = completeOrder.OrderItems || [];
            await sendNewOrderEmailToAdmin(order.id, shippingName, total - discount, items);
        } catch (e) { console.log('Admin email failed:', e); }

        res.status(201).json(completeOrder);
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Update order status (admin only)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        const order = await Order.findByPk(req.params.id);

        if (!order) {
            return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
        }

        await order.update({ status });

        const updatedOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem }]
        });

        // Send push notification to user about status change
        const statusTexts = {
            'processing': 'đang được xử lý',
            'shipped': 'đang được giao',
            'delivered': 'đã giao thành công',
            'cancelled': 'đã bị hủy'
        };
        try {
            await pushRoutes.sendToUser(order.UserId, {
                title: '📦 Cập Nhật Đơn Hàng',
                body: `Đơn hàng #${order.id} ${statusTexts[status] || status}`,
                icon: '/images/logo.jpg',
                data: { url: `/orders.html`, orderId: order.id }
            });
        } catch (e) { console.log('Push notification failed:', e); }

        // Send email notification to customer
        try {
            const user = await User.findByPk(order.UserId);
            if (user && user.email) {
                await sendOrderStatusEmail(user.email, user.name, order.id, status, order.total);
            }
        } catch (e) { console.log('Order status email failed:', e); }

        res.json(updatedOrder);
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Cancel order
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const where = { id: req.params.id };
        if (req.user.role !== 'admin') {
            where.UserId = req.user.id;
        }

        const order = await Order.findOne({
            where,
            include: [{ model: OrderItem }]
        });

        if (!order) {
            return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ error: 'Chỉ có thể hủy đơn hàng đang chờ xử lý' });
        }

        // Restore stock
        for (const item of order.OrderItems) {
            const product = await Product.findByPk(item.ProductId);
            if (product) {
                await product.update({ stock: product.stock + item.quantity });
            }
        }

        await order.update({ status: 'cancelled' });

        res.json({ message: 'Đã hủy đơn hàng' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Customer Request Return
router.post('/:id/return', authenticateToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { id: req.params.id, UserId: req.user.id }
        });

        if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });

        if (order.status !== 'delivered') {
            return res.status(400).json({ error: 'Chỉ có thể yêu cầu đổi trả cho đơn hàng đã giao thành công' });
        }

        if (order.returnStatus !== 'none') {
            return res.status(400).json({ error: 'Đơn hàng này đã được yêu cầu đổi trả' });
        }

        const deliveredAt = new Date(order.updatedAt);
        const daysSinceDelivered = (new Date() - deliveredAt) / (1000 * 60 * 60 * 24);

        if (daysSinceDelivered > 7) {
            return res.status(400).json({ error: 'Đã quá 7 ngày kể từ khi nhận hàng, không thể yêu cầu đổi trả' });
        }

        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'Vui lòng cung cấp lý do đổi trả' });

        await order.update({
            returnStatus: 'requested',
            returnReason: reason
        });

        res.json({ message: 'Đã gửi yêu cầu đổi trả thành công', order });
    } catch (error) {
        console.error('Request return error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Admin Approve/Reject Return
router.post('/admin/:id/return-action', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { action, zaloLink } = req.body; // 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Hành động không hợp lệ' });
        }

        const order = await Order.findByPk(req.params.id, {
            include: [{ model: User }]
        });

        if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });

        if (order.returnStatus !== 'requested') {
            return res.status(400).json({ error: 'Đơn hàng này không có yêu cầu đổi trả đang chờ duyệt' });
        }

        const newReturnStatus = action === 'approve' ? 'approved' : 'rejected';
        await order.update({ returnStatus: newReturnStatus });

        // Send push notification
        const isApproved = action === 'approve';
        const pushTitle = isApproved ? '✅ Yêu cầu đổi trả được chấp nhận' : '❌ Yêu cầu đổi trả bị từ chối';
        const pushBody = isApproved ? `Yêu cầu đổi trả đơn #${order.id} đã được duyệt. Vui lòng nhắn Zalo shop để được hỗ trợ.` : `Yêu cầu đổi trả đơn #${order.id} không đủ điều kiện.`;

        try {
            await pushRoutes.sendToUser(order.UserId, {
                title: pushTitle,
                body: pushBody,
                icon: '/images/logo.jpg',
                data: { url: `/orders.html`, orderId: order.id }
            });
        } catch (e) { console.log('Push notification failed:', e); }

        // Send email
        try {
            if (order.User && order.User.email) {
                await sendReturnActionEmail(order.User.email, order.User.name, order.id, newReturnStatus, zaloLink);
            }
        } catch (e) { console.log('Return email failed:', e); }

        res.json({ message: 'Đã cập nhật trạng thái đổi trả', order });
    } catch (error) {
        console.error('Admin return action error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

module.exports = router;
