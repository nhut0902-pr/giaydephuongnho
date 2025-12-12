const express = require('express');
const router = express.Router();
const { FlashSale, FlashSaleItem, Product } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/flash-sale/current (Public)
router.get('/current', async (req, res) => {
    try {
        const now = new Date();
        const flashSale = await FlashSale.findOne({
            where: {
                isActive: true,
                startTime: { [Op.lte]: now },
                endTime: { [Op.gte]: now }
            },
            include: [{
                model: FlashSaleItem,
                include: [Product]
            }]
        });

        if (!flashSale) {
            return res.json({ active: false });
        }

        res.json({ active: true, data: flashSale });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// --- Admin Routes ---

// GET /api/flash-sale/admin/all
router.get('/admin/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const flashSales = await FlashSale.findAll({
            order: [['createdAt', 'DESC']],
            include: [{
                model: FlashSaleItem,
                include: [Product]
            }]
        });
        res.json(flashSales);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/flash-sale/admin (Create/Update Settings)
router.post('/admin', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name, startTime, endTime, isActive } = req.body;

        // Check if there's already an active flash sale overlapping? 
        // For simplicity, let's just create a new one.

        const flashSale = await FlashSale.create({
            name,
            startTime,
            endTime,
            isActive
        });

        res.json(flashSale);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/flash-sale/admin/:id (Update)
router.put('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name, startTime, endTime, isActive } = req.body;
        const flashSale = await FlashSale.findByPk(req.params.id);

        if (!flashSale) return res.status(404).json({ message: 'Không tìm thấy' });

        // If activating, deactivate others? Optional but good practice.
        if (isActive) {
            await FlashSale.update({ isActive: false }, { where: { id: { [Op.ne]: req.params.id } } });
        }

        await flashSale.update({ name, startTime, endTime, isActive });
        res.json(flashSale);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/flash-sale/admin/:id/items (Add Items)
router.post('/admin/:id/items', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { productId, discountPrice, quantity } = req.body;
        const flashSaleId = req.params.id;

        const item = await FlashSaleItem.create({
            FlashSaleId: flashSaleId,
            ProductId: productId,
            discountPrice,
            quantity
        });

        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE /api/flash-sale/admin/items/:itemId (Remove Item)
router.delete('/admin/items/:itemId', authenticateToken, isAdmin, async (req, res) => {
    try {
        await FlashSaleItem.destroy({ where: { id: req.params.itemId } });
        res.json({ message: 'Đã xóa sản phẩm khỏi Flash Sale' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
