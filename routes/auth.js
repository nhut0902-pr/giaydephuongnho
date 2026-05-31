const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { generateOTP, sendOTPEmail } = require('../utils/mailer');

const router = express.Router();

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '1x0000000000000000000000000000000AA';

// Verify Cloudflare Turnstile token server-side
async function verifyTurnstile(token) {
    if (!token) return false;
    try {
        const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${TURNSTILE_SECRET}&response=${token}`
        });
        const data = await resp.json();
        return data.success === true;
    } catch (err) {
        console.error('Turnstile verification error:', err.message);
        return false;
    }
}

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, address, recaptchaToken } = req.body;

        // Verify Turnstile
        const isHuman = await verifyTurnstile(recaptchaToken);
        if (!isHuman) {
            return res.status(400).json({ error: 'Xác minh Turnstile thất bại. Vui lòng thử lại.' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = generateOTP();
        const hashedOTP = await bcrypt.hash(otp, 10);

        // Create user with emailVerified = false
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            address,
            role: 'customer',
            emailVerified: false,
            otpCode: hashedOTP,
            otpExpiry: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        // Send OTP email
        try {
            await sendOTPEmail(email, otp, name);
        } catch (emailErr) {
            console.error('Failed to send OTP email:', emailErr.message);
        }

        res.status(201).json({
            message: 'Đăng ký thành công! Vui lòng xác thực email.',
            requireOTP: true,
            email: user.email
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password, recaptchaToken } = req.body;

        // Verify Turnstile
        const isHuman = await verifyTurnstile(recaptchaToken);
        if (!isHuman) {
            return res.status(400).json({ error: 'Xác minh Turnstile thất bại. Vui lòng thử lại.' });
        }

        // Find user
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }

        // If email not verified, send new OTP and require verification
        if (!user.emailVerified) {
            const otp = generateOTP();
            const hashedOTP = await bcrypt.hash(otp, 10);
            await user.update({
                otpCode: hashedOTP,
                otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
            });

            try {
                await sendOTPEmail(email, otp, user.name);
            } catch (emailErr) {
                console.error('Failed to send OTP email:', emailErr.message);
            }

            return res.json({
                message: 'Vui lòng xác thực email trước khi đăng nhập.',
                requireOTP: true,
                email: user.email
            });
        }

        // Generate token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Đăng nhập thành công',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                role: user.role
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: 'Email và mã OTP là bắt buộc' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email đã được xác thực' });
        }

        // Check OTP expiry
        if (!user.otpExpiry || new Date() > new Date(user.otpExpiry)) {
            return res.status(400).json({ error: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.' });
        }

        // Verify OTP
        const isValid = await bcrypt.compare(otp, user.otpCode);
        if (!isValid) {
            return res.status(400).json({ error: 'Mã OTP không đúng' });
        }

        // Mark as verified and clear OTP
        await user.update({
            emailVerified: true,
            otpCode: null,
            otpExpiry: null
        });

        // Generate token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Xác thực thành công!',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                role: user.role
            },
            token
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email là bắt buộc' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email đã được xác thực' });
        }

        // Generate new OTP
        const otp = generateOTP();
        const hashedOTP = await bcrypt.hash(otp, 10);
        await user.update({
            otpCode: hashedOTP,
            otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
        });

        try {
            await sendOTPEmail(email, otp, user.name);
        } catch (emailErr) {
            console.error('Failed to send OTP email:', emailErr.message);
            return res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại.' });
        }

        res.json({ message: 'Đã gửi lại mã OTP. Vui lòng kiểm tra email.' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// Get profile
router.get('/profile', authenticateToken, async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            address: req.user.address,
            role: req.user.role
        }
    });
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        await req.user.update({ name, phone, address });

        res.json({
            message: 'Cập nhật thành công',
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                phone: req.user.phone,
                address: req.user.address,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

module.exports = router;
