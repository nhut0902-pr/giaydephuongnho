const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
require('dotenv').config();

const serverless = require('serverless-http');
const { sequelize, User } = require('../models');

const authRoutes = require('../routes/auth');
const productRoutes = require('../routes/products');
const cartRoutes = require('../routes/cart');
const orderRoutes = require('../routes/orders');
const discountRoutes = require('../routes/discounts');
const adminRoutes = require('../routes/admin');
const pushRoutes = require('../routes/push');
const invoiceRoutes = require('../routes/invoice');
const flashSaleRoutes = require('../routes/flash-sale');

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'giaydephuongnho_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Static public
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/flash-sale', flashSaleRoutes);

// Ping test
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Export for Vercel
module.exports = serverless(app);
