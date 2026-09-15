// server-admin.js
// Heavy server — mounts ALL routes including admin/invoice/image-upload.
// Used only by admin pages. Bundle stays large (~9MB) but cold-start is rare
// because admin traffic is much lower than public traffic.

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sequelize, User } = require('./models');
const bcrypt = require('bcryptjs');
const { authenticateToken, isAdmin } = require('./middleware/auth');
const { getConfiguredSiteUrl } = require('./utils/site-url');

// All routes (including admin/invoice with heavy deps)
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const discountRoutes = require('./routes/discounts');
const adminRoutes = require('./routes/admin');
const pushRoutes = require('./routes/push');
const invoiceRoutes = require('./routes/invoice');
const flashSaleRoutes = require('./routes/flash-sale');
const marketingRoutes = require('./routes/marketing');
const reviewRoutes = require('./routes/reviews');
const blogRoutes = require('./routes/blog');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'giaydephuongnho_secret_key_2024';
const SITE_URL = getConfiguredSiteUrl();

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Ping
app.get('/ping', (req, res) => {
  res.send('pong (admin)');
});

// Init DB Route (Admin Only)
app.get('/init-db', authenticateToken, isAdmin, async (req, res) => {
  try {
    await sequelize.authenticate();
    try {
      await sequelize.sync({ alter: true });
    } catch (alterError) {
      await sequelize.sync();
    }
    res.json({ message: 'Database synced successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database sync failed', details: error.message });
  }
});

// API Routes (all)
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/flash-sale', flashSaleRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/blog', blogRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

let bootstrapPromise = null;

async function bootstrapApp() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await sequelize.sync({ alter: true });
      console.log('[admin] Database synchronized');

      // Ensure default admin exists
      const adminExists = await User.findOne({ where: { email: 'lamminhnhut09022011@gmail.com' } });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
          name: 'Admin',
          email: 'lamminhnhut09022011@gmail.com',
          password: hashedPassword,
          phone: '0916813067',
          role: 'admin',
          emailVerified: true
        });
        console.log('[admin] Default admin user created');
      } else if (!adminExists.emailVerified) {
        await adminExists.update({ emailVerified: true });
      }
    })().catch(err => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

async function startServer() {
  await bootstrapApp();
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`[admin] Server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[admin] Unhandled Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV !== 'production' ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
  });
});

module.exports = app;
module.exports.bootstrapApp = bootstrapApp;
module.exports.startServer = startServer;
