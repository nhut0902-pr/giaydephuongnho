const express = require('express');
const webpush = require('web-push');
const { PushSubscription, User } = require('../models');
const { authenticateToken, isAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Configure VAPID
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@giaydephuongnho.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Get VAPID public key (for client)
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
router.post('/subscribe', optionalAuth, async (req, res) => {
    try {
        const { subscription, role } = req.body;
        const userId = req.user?.id || null;

        // Check if subscription already exists
        const existing = await PushSubscription.findOne({
            where: { endpoint: subscription.endpoint }
        });

        if (existing) {
            // Update existing subscription
            await existing.update({
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userId,
                role: role || 'customer',
                userAgent: req.headers['user-agent']
            });
            return res.json({ message: 'Subscription updated', id: existing.id });
        }

        // Create new subscription
        const newSub = await PushSubscription.create({
            userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            role: role || 'customer',
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ message: 'Subscribed successfully', id: newSub.id });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Subscription failed' });
    }
});

// Unsubscribe from push notifications
router.delete('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        await PushSubscription.destroy({ where: { endpoint } });
        res.json({ message: 'Unsubscribed successfully' });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ error: 'Unsubscribe failed' });
    }
});

// Helper function to send push notification
async function sendPushNotification(subscription, payload) {
    const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
        }
    };

    try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        return { success: true };
    } catch (error) {
        console.error('Push error:', error);
        // Remove invalid subscription
        if (error.statusCode === 404 || error.statusCode === 410) {
            await PushSubscription.destroy({ where: { id: subscription.id } });
        }
        return { success: false, error: error.message };
    }
}

// Notify admins about new order
router.post('/notify/new-order', authenticateToken, async (req, res) => {
    try {
        const { orderId, customerName, total } = req.body;

        const adminSubs = await PushSubscription.findAll({
            where: { role: 'admin' }
        });

        const payload = {
            title: '🛒 Đơn Hàng Mới!',
            body: `${customerName} đã đặt đơn ${total.toLocaleString('vi-VN')}đ`,
            icon: '/images/logo.jpg',
            badge: '/images/badge.png',
            data: {
                url: `/admin/orders.html?id=${orderId}`,
                orderId
            }
        };

        const results = await Promise.all(
            adminSubs.map(sub => sendPushNotification(sub, payload))
        );

        res.json({ sent: results.filter(r => r.success).length, total: adminSubs.length });
    } catch (error) {
        console.error('Notify new order error:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Notify user about order status change
router.post('/notify/order-status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, orderId, status, statusText } = req.body;

        const userSubs = await PushSubscription.findAll({
            where: { userId }
        });

        const payload = {
            title: '📦 Cập Nhật Đơn Hàng',
            body: `Đơn hàng #${orderId} ${statusText}`,
            icon: '/images/logo.jpg',
            data: {
                url: `/orders.html?id=${orderId}`,
                orderId,
                status
            }
        };

        const results = await Promise.all(
            userSubs.map(sub => sendPushNotification(sub, payload))
        );

        res.json({ sent: results.filter(r => r.success).length, total: userSubs.length });
    } catch (error) {
        console.error('Notify order status error:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Notify all users about new product
router.post('/notify/new-product', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { productId, productName, productImage } = req.body;

        const customerSubs = await PushSubscription.findAll({
            where: { role: 'customer' }
        });

        const payload = {
            title: '✨ Sản Phẩm Mới!',
            body: productName,
            icon: productImage || '/images/logo.jpg',
            image: productImage,
            data: {
                url: `/product-detail.html?id=${productId}`,
                productId
            }
        };

        const results = await Promise.all(
            customerSubs.map(sub => sendPushNotification(sub, payload))
        );

        res.json({ sent: results.filter(r => r.success).length, total: customerSubs.length });
    } catch (error) {
        console.error('Notify new product error:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Notify users about new voucher
router.post('/notify/new-voucher', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { code, percentage, userId, validTo } = req.body;

        let subs;
        if (userId) {
            // User-specific voucher
            subs = await PushSubscription.findAll({ where: { userId } });
        } else {
            // Public voucher - notify all customers
            subs = await PushSubscription.findAll({ where: { role: 'customer' } });
        }

        const expiryText = validTo ? ` - HSD: ${new Date(validTo).toLocaleDateString('vi-VN')}` : '';
        const payload = {
            title: '🎉 Mã Giảm Giá Mới!',
            body: `Giảm ${percentage}% với mã ${code}${expiryText}`,
            icon: '/images/logo.jpg',
            data: {
                url: '/products.html',
                code
            }
        };

        const results = await Promise.all(
            subs.map(sub => sendPushNotification(sub, payload))
        );

        res.json({ sent: results.filter(r => r.success).length, total: subs.length });
    } catch (error) {
        console.error('Notify new voucher error:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Export helper for use in other routes
router.sendPushNotification = sendPushNotification;
router.sendToAdmins = async (payload) => {
    const adminSubs = await PushSubscription.findAll({ where: { role: 'admin' } });
    return Promise.all(adminSubs.map(sub => sendPushNotification(sub, payload)));
};
router.sendToUser = async (userId, payload) => {
    const userSubs = await PushSubscription.findAll({ where: { userId } });
    return Promise.all(userSubs.map(sub => sendPushNotification(sub, payload)));
};
router.sendToAllCustomers = async (payload) => {
    const customerSubs = await PushSubscription.findAll({ where: { role: 'customer' } });
    return Promise.all(customerSubs.map(sub => sendPushNotification(sub, payload)));
};

module.exports = router;
