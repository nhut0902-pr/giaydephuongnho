const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sequelize, User } = require('./models');
const bcrypt = require('bcryptjs');
const { generateOTP, sendOTPEmail } = require('./utils/mailer');
const { authenticateToken, isAdmin } = require('./middleware/auth');
const { getConfiguredSiteUrl } = require('./utils/site-url');


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
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'giaydephuongnho_secret_key_2024';
const SITE_URL = getConfiguredSiteUrl();

// Google OAuth Config
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// ImageKit Config
const IMAGEKIT_URL = process.env.IMAGEKIT_URL;
const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'giaydephuongnho_session_secret_2024',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Debug Route - Ping
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Init DB Route (Moved to top)
// Init DB Route (Admin Only)
app.get('/init-db', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('Init DB requested');
    await sequelize.authenticate();
    console.log('DB Authenticated');

    // Try alter first, if it fails, just sync without alter
    try {
      await sequelize.sync({ alter: true });
      console.log('DB Synced with alter');
    } catch (alterError) {
      console.log('Alter failed, trying normal sync:', alterError.message);
      await sequelize.sync();
      console.log('DB Synced without alter');
    }

    res.json({ message: 'Database synced successfully' });
  } catch (error) {
    console.error('Init DB Error:', error);
    res.status(500).json({ error: 'Database sync failed', details: error.message });
  }
});

// Static files are served by Cloudflare Pages automatically

// Passport Google Strategy
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || `${SITE_URL}/api/auth/google/callback`;

// Validate Google OAuth credentials at startup
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('[Google OAuth] WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing!');
} else {
  console.log('[Google OAuth] Credentials loaded. Client ID:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');
}

passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID || 'missing',
  clientSecret: GOOGLE_CLIENT_SECRET || 'missing',
  callbackURL: CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ where: { email: profile.emails[0].value } });
    let isNewUser = false;
    if (!user) {
      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        password: 'google_oauth_' + Date.now(),
        googleId: profile.id,
        role: 'customer',
        emailVerified: false
      });
      isNewUser = true;
    }
    user._isNewGoogleUser = isNewUser;
    return done(null, user);
  } catch (error) {
    console.error('[GoogleStrategy] Error:', error);
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
app.use('/api/push', pushRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/flash-sale', flashSaleRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/blog', blogRoutes);

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

// Google Auth Routes
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

app.get('/api/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect('/login.html?error=' + encodeURIComponent('Thiếu cấu hình Google OAuth.'));
  }

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', CALLBACK_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('[Google OAuth] Redirecting to Google auth URL');
  return res.redirect(authUrl.toString());
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) {
      console.error('[Google OAuth Callback] Google returned error:', error);
      return res.redirect('/login.html?error=' + encodeURIComponent('Google từ chối đăng nhập.'));
    }
    if (!code) {
      return res.redirect('/login.html?error=' + encodeURIComponent('Thiếu mã xác thực từ Google.'));
    }

    const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('[Google OAuth Callback] Token exchange failed:', tokenData);
      return res.redirect('/login.html?error=' + encodeURIComponent('Đăng nhập Google thất bại. Vui lòng thử lại.'));
    }

    const profileResp = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResp.json();
    if (!profileResp.ok || !profile.email) {
      console.error('[Google OAuth Callback] Failed to load Google profile:', profile);
      return res.redirect('/login.html?error=' + encodeURIComponent('Không lấy được thông tin tài khoản Google.'));
    }

    let user = await User.findOne({ where: { email: profile.email } });
    let isNewUser = false;
    if (!user) {
      user = await User.create({
        name: profile.name || profile.display_name || profile.email,
        email: profile.email,
        password: 'google_oauth_' + Date.now(),
        googleId: profile.id,
        role: 'customer',
        emailVerified: false
      });
      isNewUser = true;
    } else if (!user.googleId) {
      await user.update({ googleId: profile.id });
    }

    if (!user.emailVerified) {
      try {
        console.log('[GoogleCallback] Unverified user, sending OTP to:', user.email);
        const otp = generateOTP();
        const hashedOTP = await bcrypt.hash(otp, 10);
        await user.update({
          otpCode: hashedOTP,
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
        });
        await sendOTPEmail(user.email, otp, user.name);
        console.log('[GoogleCallback] OTP sent successfully');
      } catch (emailErr) {
        console.error('[GoogleCallback] Failed to send OTP:', emailErr);
      }
      return res.redirect(`/verify-otp.html?email=${encodeURIComponent(user.email)}`);
    }

    console.log('[GoogleCallback] Verified user, signing JWT for userId:', user.id, 'isNewUser:', isNewUser);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.redirect(`/auth-success.html?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }))}`);
  } catch (err) {
    console.error('[Google OAuth Callback] Processing error:', err);
    return res.redirect('/login.html?error=' + encodeURIComponent('Lỗi xử lý đăng nhập. Vui lòng thử lại.'));
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Static file serving and SPA routing handled by Cloudflare Pages

let bootstrapPromise = null;

async function bootstrapApp() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await sequelize.sync({ alter: true });
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
          role: 'admin',
          emailVerified: true
        });
        console.log('Default admin user created');
      } else if (!adminExists.emailVerified) {
        await adminExists.update({ emailVerified: true });
        console.log('Admin user auto-verified');
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
      console.log(`Server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
    ...(isDev && { stack: err.stack })
  });
});

module.exports = app;

module.exports.bootstrapApp = bootstrapApp;
module.exports.startServer = startServer;

if (require.main === module) {
  startServer().catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
}
