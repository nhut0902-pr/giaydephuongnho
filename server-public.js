// server-public.js
// Lightweight server — only mounts PUBLIC/customer-facing routes.
// Skips: routes/admin.js (multer, imagekit), routes/invoice.js (pdfkit),
//        Google OAuth (passport, passport-google-oauth20)
// Result: Worker bundle drops from ~9.6MB to ~4MB → much faster cold-start

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sequelize } = require('./models');
const { authenticateToken } = require('./middleware/auth');
const { getConfiguredSiteUrl } = require('./utils/site-url');

// Public routes only
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const discountRoutes = require('./routes/discounts');
const pushRoutes = require('./routes/push');
const flashSaleRoutes = require('./routes/flash-sale');
const marketingRoutes = require('./routes/marketing');
const reviewRoutes = require('./routes/reviews');
const blogRoutes = require('./routes/blog');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'giaydephuongnho_secret_key_2024';
const SITE_URL = getConfiguredSiteUrl();

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Debug Route - Ping
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Public API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/flash-sale', flashSaleRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/blog', blogRoutes);

// 404 for /admin/* and /invoice/* — tell client to use ADMIN_API_URL
app.use('/api/admin', (req, res) => {
  res.status(404).json({
    error: 'Admin endpoint không khả dụng trên Worker public. Vui lòng dùng ADMIN_API_URL.',
    code: 'USE_ADMIN_WORKER'
  });
});
app.use('/api/invoice', (req, res) => {
  res.status(404).json({
    error: 'Invoice endpoint không khả dụng trên Worker public.',
    code: 'USE_ADMIN_WORKER'
  });
});

// Dynamic Sitemap.xml for SEO
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { Product } = require('./models');
    const products = await Product.findAll({ attributes: ['id', 'updatedAt'] });
    const baseUrl = SITE_URL;

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

// Google Merchant Center Product Feed
app.get('/product-feed.xml', async (req, res) => {
  try {
    const { Product } = require('./models');
    const products = await Product.findAll({ where: { stock: { [require('sequelize').Op.gt]: 0 } } });
    const baseUrl = SITE_URL;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Giày Dép Hương Nhớ</title>
<link>${baseUrl}</link>
<description>Cửa hàng giày dép thời trang uy tín chất lượng</description>`;

    products.forEach(p => {
      const price = p.discountedPrice || p.price;
      const salePrice = p.discountedPrice ? p.discountedPrice : null;
      xml += `
<item>
  <g:id>${p.id}</g:id>
  <g:title><![CDATA[${p.name}]]></g:title>
  <g:description><![CDATA[${p.description || p.name}]]></g:description>
  <g:link>${baseUrl}/product-detail.html?id=${p.id}</g:link>
  <g:image_link>${p.image}</g:image_link>
  <g:price>${p.price} VND</g:price>${salePrice ? `
  <g:sale_price>${salePrice} VND</g:sale_price>` : ''}
  <g:availability>${p.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
  <g:condition>new</g:condition>
  <g:brand>Giày Dép Hương Nhớ</g:brand>
  <g:product_type><![CDATA[${p.category || 'Giày dép'}]]></g:product_type>
  <g:google_product_category>187</g:google_product_category>
</item>`;
    });

    xml += `
</channel>
</rss>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating product feed');
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

let bootstrapPromise = null;

async function bootstrapApp() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await sequelize.sync({ alter: true });
      console.log('[public] Database synchronized');
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
      console.log(`[public] Server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[public] Unhandled Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV !== 'production' ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
  });
});

module.exports = app;
module.exports.bootstrapApp = bootstrapApp;
module.exports.startServer = startServer;
