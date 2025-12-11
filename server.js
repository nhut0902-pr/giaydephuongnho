const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sequelize, User } = require('./models');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const discountRoutes = require('./routes/discounts');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Google OAuth Config
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// ImageKit Config
const IMAGEKIT_URL = process.env.IMAGEKIT_URL;
const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ where: { email: profile.emails[0].value } });
    if (!user) {
      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        password: 'google_oauth_' + Date.now(),
        googleId: profile.id,
        role: 'customer'
      });
    }
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findByPk(id);
  done(null, user);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/admin', adminRoutes);

// Dynamic Sitemap.xml for SEO
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { Product } = require('./models');
    const products = await Product.findAll({ attributes: ['id', 'updatedAt'] });
    const baseUrl = 'https://giaydephuongnho.com';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/login.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;

    products.forEach(p => {
      xml += `
  <url>
    <loc>${baseUrl}/product-detail.html?id=${p.id}</loc>
    <lastmod>${p.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    xml += '\n</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

// Google Auth Routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login.html' }), (req, res) => {
  const token = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.redirect(`/auth-success.html?token=${token}&user=${encodeURIComponent(JSON.stringify({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  }))}`);
});

// Custom static file handler with 404 for missing HTML files
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const filePath = path.join(__dirname, 'public', req.path);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
  }
  next();
});

// Define valid routes for SPA
const validRoutes = ['/', '/products', '/cart', '/checkout', '/orders', '/login', '/profile', '/admin'];

// Route handler - serve index.html for valid routes, 404 for invalid
app.get('*', (req, res) => {
  // Check if it's a valid SPA route
  const isValidRoute = validRoutes.some(route => req.path === route || req.path.startsWith('/admin'));

  // If path has extension (like .jpg, .css) and wasn't found by static, it's 404
  if (req.path.includes('.') && !req.path.endsWith('.html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }

  // For clean URLs, check if valid route
  if (isValidRoute) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Unknown route - show 404
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Initialize database and start server
sequelize.sync({ alter: true }).then(async () => {
  console.log('Database synchronized');

  // Create default admin user if not exists
  const { User } = require('./models');
  const bcrypt = require('bcryptjs');

  const adminExists = await User.findOne({ where: { email: 'lamminhnhut09022011@gmail.com' } });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'Admin',
      email: 'lamminhnhut09022011@gmail.com',
      password: hashedPassword,
      phone: '0916813067',
      role: 'admin'
    });
    console.log('Default admin user created');
  }

  // Create sample products if none exist
  const { Product } = require('./models');
  const productCount = await Product.count();
  if (productCount === 0) {
    await Product.bulkCreate([
      {
        name: 'Giày Sneaker Trắng Classic',
        description: 'Giày sneaker trắng phong cách cổ điển, phù hợp với mọi trang phục.',
        price: 850000,
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400',
        category: 'sneaker',
        stock: 50
      },
      {
        name: 'Dép Sandal Nữ Thời Trang',
        description: 'Dép sandal nữ cao cấp, thiết kế thanh lịch và thoải mái.',
        price: 450000,
        image: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400',
        category: 'sandal',
        stock: 30
      },
      {
        name: 'Giày Thể Thao Running Pro',
        description: 'Giày chạy bộ chuyên nghiệp với đệm êm và nhẹ.',
        price: 1250000,
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
        category: 'sport',
        stock: 25
      },
      {
        name: 'Giày Cao Gót Đen Sang Trọng',
        description: 'Giày cao gót đen thanh lịch cho các buổi tiệc và sự kiện.',
        price: 680000,
        image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400',
        category: 'heels',
        stock: 20
      },
      {
        name: 'Giày Lười Nam Công Sở',
        description: 'Giày lười nam da thật, phù hợp đi làm và dự tiệc.',
        price: 920000,
        image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=400',
        category: 'loafer',
        stock: 35
      },
      {
        name: 'Dép Quai Ngang Unisex',
        description: 'Dép quai ngang thoải mái, phù hợp cho cả nam và nữ.',
        price: 280000,
        image: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400',
        category: 'sandal',
        stock: 60
      }
    ]);
    console.log('Sample products created');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Unable to connect to the database:', err);
});

module.exports = app;
