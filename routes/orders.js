const express = require('express');
const { Order, OrderItem, Cart, Product, DiscountCode } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

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
                productImage: item.Product.image
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

module.exports = router;
