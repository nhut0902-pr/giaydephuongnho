const express = require('express');
const { Product, DiscountCode } = require('../models');
const { authenticateToken, isAdmin, optionalAuth } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
    try {
        const { category, search, sort } = req.query;

        let where = {};
        if (category) {
            where.category = category;
        }
        if (search) {
            where.name = { [Op.like]: `%${search}%` };
        }

        let order = [['createdAt', 'DESC']];
        if (sort === 'price_asc') {
            order = [['price', 'ASC']];
        } else if (sort === 'price_desc') {
            order = [['price', 'DESC']];
        } else if (sort === 'name') {
            order = [['name', 'ASC']];
        }

        const products = await Product.findAll({
            where,
            order,
            include: [{
                model: DiscountCode,
                where: {
                    active: true,
                    validFrom: { [Op.lte]: new Date() },
                    validTo: { [Op.gte]: new Date() }
                },
                required: false
            }]
        });

        // Calculate discounted prices
        const productsWithDiscount = products.map(p => {
            const product = p.toJSON();
            if (product.DiscountCodes && product.DiscountCodes.length > 0) {
                const bestDiscount = Math.max(...product.DiscountCodes.map(d => d.percentage));
                product.discountPercentage = bestDiscount;
                product.discountedPrice = product.price * (1 - bestDiscount / 100);
            }
            return product;
        });

        res.json(productsWithDiscount);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Get product categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Product.findAll({
            attributes: ['category'],
            group: ['category']
        });
        res.json(categories.map(c => c.category).filter(Boolean));
    } catch (error) {
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, {
            include: [{
                model: DiscountCode,
                where: {
                    active: true,
                    validFrom: { [Op.lte]: new Date() },
                    validTo: { [Op.gte]: new Date() }
                },
                required: false
            }]
        });

        if (!product) {
            return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
        }

        const productData = product.toJSON();
        if (productData.DiscountCodes && productData.DiscountCodes.length > 0) {
            const bestDiscount = Math.max(...productData.DiscountCodes.map(d => d.percentage));
            productData.discountPercentage = bestDiscount;
            productData.discountedPrice = productData.price * (1 - bestDiscount / 100);
        }

        res.json(productData);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Create product (admin only)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name, description, price, image, category, stock } = req.body;

        const product = await Product.create({
            name,
            description,
            price,
            image,
            category,
            stock
        });

        res.status(201).json(product);
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Update product (admin only)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);

        if (!product) {
            return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
        }

        const { name, description, price, image, category, stock } = req.body;

        await product.update({
            name,
            description,
            price,
            image,
            category,
            stock
        });

        res.json(product);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Delete product (admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);

        if (!product) {
            return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
        }

        await product.destroy();

        res.json({ message: 'Xóa sản phẩm thành công' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

module.exports = router;
