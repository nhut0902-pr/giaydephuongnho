const express = require('express');
const { DiscountCode, Product, ProductDiscount, User } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');
const pushRoutes = require('./push');
const { sendNewDiscountEmail } = require('../utils/mailer');

const router = express.Router();

// Get all discount codes (admin only)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const discounts = await DiscountCode.findAll({
            include: [{ model: Product, attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']]
        });

        res.json(discounts);
    } catch (error) {
        console.error('Get discounts error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Validate discount code
router.post('/validate', async (req, res) => {
    try {
        const { code, total } = req.body;

        const discount = await DiscountCode.findOne({
            where: {
                code,
                active: true,
                validFrom: { [Op.lte]: new Date() },
                validTo: { [Op.gte]: new Date() }
            }
        });

        if (!discount) {
            return res.status(400).json({ error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
        }

        if (discount.minOrderValue && total < discount.minOrderValue) {
            return res.status(400).json({
                error: `Đơn hàng tối thiểu ${discount.minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã này`
            });
        }

        if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
            return res.status(400).json({ error: 'Mã giảm giá đã hết lượt sử dụng' });
        }

        let discountAmount = total * (discount.percentage / 100);
        if (discount.maxDiscount && discountAmount > discount.maxDiscount) {
            discountAmount = discount.maxDiscount;
        }

        res.json({
            valid: true,
            code: discount.code,
            percentage: discount.percentage,
            discountAmount,
            maxDiscount: discount.maxDiscount
        });
    } catch (error) {
        console.error('Validate discount error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Create discount code (admin only)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { code, percentage, validFrom, validTo, minOrderValue, maxDiscount, usageLimit, productIds, type, assignedUserId, displayOnHomepage, notifyUsers } = req.body;

        // Check if code already exists
        const existingCode = await DiscountCode.findOne({ where: { code } });
        if (existingCode) {
            return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
        }

        const discount = await DiscountCode.create({
            code: code.toUpperCase(),
            percentage,
            validFrom: validFrom || new Date(),
            validTo: validTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            minOrderValue: minOrderValue || 0,
            maxDiscount,
            usageLimit,
            active: true,
            type: type || 'public',
            assignedUserId: type === 'user_specific' ? assignedUserId : null,
            displayOnHomepage: displayOnHomepage || false,
            notifyUsers: notifyUsers || false
        });

        // Associate with products if specified
        if (productIds && productIds.length > 0) {
            const products = await Product.findAll({ where: { id: productIds } });
            await discount.setProducts(products);
        }

        // Send push notification if requested
        if (notifyUsers) {
            try {
                const payload = {
                    title: '🎉 Mã Giảm Giá Mới!',
                    body: `Giảm ${percentage}% với mã ${code.toUpperCase()}`,
                    icon: '/images/logo.jpg',
                    data: { url: '/products.html', code: code.toUpperCase() }
                };

                if (type === 'user_specific' && assignedUserId) {
                    await pushRoutes.sendToUser(assignedUserId, payload);
                } else {
                    await pushRoutes.sendToAllCustomers(payload);
                }
            } catch (e) { console.log('Push notification failed:', e); }

            // Send email to all customers
            try {
                await sendNewDiscountEmail(code.toUpperCase(), percentage, validTo);
            } catch (e) { console.log('Discount email failed:', e); }
        }

        const createdDiscount = await DiscountCode.findByPk(discount.id, {
            include: [
                { model: Product, attributes: ['id', 'name'] },
                { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] }
            ]
        });

        res.status(201).json(createdDiscount);
    } catch (error) {
        console.error('Create discount error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Update discount code (admin only)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const discount = await DiscountCode.findByPk(req.params.id);

        if (!discount) {
            return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
        }

        const { code, percentage, validFrom, validTo, minOrderValue, maxDiscount, usageLimit, active, productIds, type, assignedUserId, displayOnHomepage, notifyUsers } = req.body;

        await discount.update({
            code: code ? code.toUpperCase() : discount.code,
            percentage: percentage !== undefined ? percentage : discount.percentage,
            validFrom: validFrom || discount.validFrom,
            validTo: validTo || discount.validTo,
            minOrderValue: minOrderValue !== undefined ? minOrderValue : discount.minOrderValue,
            maxDiscount: maxDiscount !== undefined ? maxDiscount : discount.maxDiscount,
            usageLimit: usageLimit !== undefined ? usageLimit : discount.usageLimit,
            active: active !== undefined ? active : discount.active,
            type: type !== undefined ? type : discount.type,
            assignedUserId: type === 'public' ? null : (assignedUserId !== undefined ? assignedUserId : discount.assignedUserId),
            displayOnHomepage: displayOnHomepage !== undefined ? displayOnHomepage : discount.displayOnHomepage,
            notifyUsers: notifyUsers !== undefined ? notifyUsers : discount.notifyUsers
        });

        // Update product associations if specified
        if (productIds !== undefined) {
            const products = await Product.findAll({ where: { id: productIds } });
            await discount.setProducts(products);
        }

        const updatedDiscount = await DiscountCode.findByPk(discount.id, {
            include: [{ model: Product, attributes: ['id', 'name'] }]
        });

        res.json(updatedDiscount);
    } catch (error) {
        console.error('Update discount error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Delete discount code (admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const discount = await DiscountCode.findByPk(req.params.id);

        if (!discount) {
            return res.status(404).json({ error: 'Mã giảm giá không tồn tại' });
        }

        await discount.destroy();

        res.json({ message: 'Xóa mã giảm giá thành công' });
    } catch (error) {
        console.error('Delete discount error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

module.exports = router;
