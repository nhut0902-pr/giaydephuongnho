const express = require('express');
const router = express.Router();
const multer = require('multer');
const ImageKit = require('imagekit');
const { Product, DiscountCode, Order, OrderItem, User } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Configure ImageKit
const imagekit = new ImageKit({
    publicKey: 'public_LXWv4J6OCUgZ3npvwtjSFmPgM5c=',
    privateKey: 'private_kRGeaG2Wp+JbbFRPKlNl+7Gk1bk=',
    urlEndpoint: 'https://ik.imagekit.io/8ayshIqxa'
});

// Upload image to ImageKit
router.post('/upload', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const result = await imagekit.upload({
            file: req.file.buffer.toString('base64'),
            fileName: `product_${Date.now()}_${req.file.originalname}`,
            folder: '/products'
        });

        res.json({
            success: true,
            url: result.url,
            thumbnailUrl: result.thumbnailUrl,
            fileId: result.fileId
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Get dashboard stats
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalOrders = await Order.count();
        const totalProducts = await Product.count();
        const totalUsers = await User.count({ where: { role: 'customer' } });

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyOrders = await Order.findAll({
            where: {
                createdAt: { [require('sequelize').Op.gte]: startOfMonth },
                status: { [require('sequelize').Op.ne]: 'cancelled' }
            }
        });

        const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.total, 0);

        const recentOrders = await Order.findAll({
            include: [{ model: User, attributes: ['name', 'email'] }],
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        res.json({
            totalOrders,
            totalProducts,
            totalUsers,
            monthlyRevenue,
            recentOrders
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get new order notifications
router.get('/notifications', authenticateToken, isAdmin, async (req, res) => {
    try {
        const unreadOrders = await Order.findAll({
            where: { isRead: false },
            include: [{ model: User, attributes: ['name'] }],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            count: unreadOrders.length,
            orders: unreadOrders
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark order as read
router.put('/orders/:id/read', authenticateToken, isAdmin, async (req, res) => {
    try {
        await Order.update({ isRead: true }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark all as read
router.put('/notifications/read-all', authenticateToken, isAdmin, async (req, res) => {
    try {
        await Order.update({ isRead: true }, { where: { isRead: false } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all orders with filters
router.get('/orders', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const where = status ? { status } : {};

        const orders = await Order.findAll({
            where,
            include: [
                { model: User, attributes: ['name', 'email', 'phone'] },
                { model: OrderItem }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'email', 'phone', 'role', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
