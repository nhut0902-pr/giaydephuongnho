const express = require('express');
const { Cart, Product } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get cart items
router.get('/', authenticateToken, async (req, res) => {
    try {
        const cartItems = await Cart.findAll({
            where: { UserId: req.user.id },
            include: [{ model: Product }]
        });

        res.json(cartItems);
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Add to cart
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;

        // Check if product exists
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
        }

        // Check if already in cart
        let cartItem = await Cart.findOne({
            where: { UserId: req.user.id, ProductId: productId }
        });

        if (cartItem) {
            // Update quantity
            await cartItem.update({ quantity: cartItem.quantity + quantity });
        } else {
            // Add new item
            cartItem = await Cart.create({
                UserId: req.user.id,
                ProductId: productId,
                quantity
            });
        }

        // Get updated cart item with product
        cartItem = await Cart.findByPk(cartItem.id, {
            include: [{ model: Product }]
        });

        res.status(201).json(cartItem);
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Update cart item quantity
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;

        const cartItem = await Cart.findOne({
            where: { id: req.params.id, UserId: req.user.id }
        });

        if (!cartItem) {
            return res.status(404).json({ error: 'Sản phẩm không có trong giỏ hàng' });
        }

        if (quantity <= 0) {
            await cartItem.destroy();
            return res.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng' });
        }

        await cartItem.update({ quantity });

        const updatedItem = await Cart.findByPk(cartItem.id, {
            include: [{ model: Product }]
        });

        res.json(updatedItem);
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Remove from cart
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const cartItem = await Cart.findOne({
            where: { id: req.params.id, UserId: req.user.id }
        });

        if (!cartItem) {
            return res.status(404).json({ error: 'Sản phẩm không có trong giỏ hàng' });
        }

        await cartItem.destroy();

        res.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng' });
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Clear cart
router.delete('/', authenticateToken, async (req, res) => {
    try {
        await Cart.destroy({
            where: { UserId: req.user.id }
        });

        res.json({ message: 'Đã xóa tất cả sản phẩm khỏi giỏ hàng' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

module.exports = router;
