const nodemailer = require('nodemailer');
const { User } = require('../models');
const { getConfiguredSiteUrl } = require('./site-url');

const GMAIL_USER = process.env.GMAIL_USER || 'lamminhnhut09022011@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'bfvdynzpmuwlynht';
const SITE_URL = getConfiguredSiteUrl();

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_USER,
                pass: GMAIL_APP_PASSWORD
            }
        });
    }
    return transporter;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- Reusable email wrapper ---
function wrapEmail(title, bodyHtml) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#FAF8EE;">
<div style="max-width:520px;margin:40px auto;background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(169,72,200,0.1);">
<div style="background:linear-gradient(135deg,#A948C8,#4B61B5);padding:32px 24px;text-align:center;">
<h1 style="color:white;margin:0;font-size:20px;letter-spacing:3px;font-weight:900;text-transform:uppercase;font-style:italic;">Giày dép Hương Nhớ</h1>
<p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:9px;letter-spacing:4px;text-transform:uppercase;">Chạm vào sự êm ái</p>
</div>
<div style="padding:32px 24px;">${bodyHtml}</div>
<div style="border-top:1px solid #f0f0f0;padding:16px 24px;text-align:center;">
<p style="color:#ccc;font-size:9px;margin:0;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Viết mã bởi <span style="color:#A948C8;">Nhutcoder</span></p>
</div></div></body></html>`;
}

async function sendMail(to, subject, html) {
    try {
        const activeTransporter = getTransporter();
        await activeTransporter.sendMail({
            from: `"Giày dép Hương Nhớ" <${GMAIL_USER}>`,
            to, subject, html
        });
    } catch (err) {
        console.error('Email send error:', err.message);
    }
}

// --- Send to all verified customers ---
async function sendToAllCustomerEmails(subject, bodyHtml) {
    try {
        const users = await User.findAll({
            where: { emailVerified: true, role: 'customer' },
            attributes: ['email']
        });
        if (users.length === 0) return;
        const emails = users.map(u => u.email).join(',');
        await sendMail(emails, subject, wrapEmail(subject, bodyHtml));
    } catch (err) {
        console.error('Bulk email error:', err.message);
    }
}

// --- OTP Email ---
async function sendOTPEmail(toEmail, otpCode, userName) {
    const body = `
<h2 style="color:#1A1135;margin:0 0 8px;font-size:20px;text-align:center;">Xác thực tài khoản</h2>
<p style="color:#888;margin:0 0 24px;font-size:14px;text-align:center;">Xin chào <strong>${userName || 'bạn'}</strong>, đây là mã OTP của bạn:</p>
<div style="background:#FAF8EE;border-radius:16px;padding:24px;text-align:center;margin:0 auto 20px;">
<span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#1A1135;font-family:monospace;">${otpCode}</span>
</div>
<p style="color:#aaa;font-size:12px;text-align:center;">Mã có hiệu lực trong <strong style="color:#A948C8;">10 phút</strong>.</p>`;
    await sendMail(toEmail, `🔐 Mã OTP: ${otpCode} — Giày dép Hương Nhớ`, wrapEmail('Xác thực OTP', body));
}

// --- Order Status Email ---
async function sendOrderStatusEmail(toEmail, userName, orderId, status, total) {
    const statusMap = {
        'pending': { icon: '🕐', text: 'Đang chờ xử lý', color: '#f59e0b' },
        'processing': { icon: '⚙️', text: 'Đang xử lý', color: '#3b82f6' },
        'shipped': { icon: '🚚', text: 'Đang giao hàng', color: '#8b5cf6' },
        'delivered': { icon: '✅', text: 'Đã giao thành công', color: '#22c55e' },
        'cancelled': { icon: '❌', text: 'Đã hủy', color: '#ef4444' }
    };
    const s = statusMap[status] || { icon: '📦', text: status, color: '#888' };
    const body = `
<h2 style="color:#1A1135;margin:0 0 16px;font-size:18px;">Cập nhật đơn hàng #${orderId}</h2>
<p style="color:#666;font-size:14px;">Xin chào <strong>${userName || 'bạn'}</strong>,</p>
<div style="background:#FAF8EE;border-radius:16px;padding:20px;margin:16px 0;text-align:center;">
<span style="font-size:32px;">${s.icon}</span>
<p style="font-size:18px;font-weight:900;color:${s.color};margin:8px 0 0;">${s.text}</p>
</div>
${total ? `<p style="color:#888;font-size:13px;">Tổng đơn: <strong style="color:#1A1135;">${Number(total).toLocaleString('vi-VN')}đ</strong></p>` : ''}
<a href="${SITE_URL}/orders.html" style="display:inline-block;margin-top:16px;padding:12px 28px;background:linear-gradient(135deg,#A948C8,#4B61B5);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:13px;">Xem đơn hàng</a>`;
    await sendMail(toEmail, `${s.icon} Đơn hàng #${orderId} — ${s.text}`, wrapEmail('Cập nhật đơn hàng', body));
}

// --- New Product Email (to all customers) ---
async function sendNewProductEmail(productName, productImage, productId) {
    const body = `
<h2 style="color:#1A1135;margin:0 0 12px;font-size:18px;text-align:center;">✨ Sản phẩm mới!</h2>
${productImage ? `<img src="${productImage}" alt="${productName}" style="width:100%;max-height:280px;object-fit:cover;border-radius:16px;margin:0 0 16px;">` : ''}
<p style="font-size:16px;font-weight:700;color:#1A1135;text-align:center;margin:0 0 8px;">${productName}</p>
<div style="text-align:center;margin-top:16px;">
<a href="${SITE_URL}/product-detail.html?id=${productId}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#A948C8,#4B61B5);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:13px;">Xem ngay</a>
</div>`;
    await sendToAllCustomerEmails(`✨ Sản phẩm mới: ${productName}`, body);
}

// --- Discount / Voucher Email (to all customers) ---
async function sendNewDiscountEmail(code, percentage, validTo) {
    const expiryText = validTo ? new Date(validTo).toLocaleDateString('vi-VN') : '';
    const body = `
<h2 style="color:#1A1135;margin:0 0 12px;font-size:18px;text-align:center;">🎉 Mã giảm giá mới!</h2>
<div style="background:#FAF8EE;border-radius:16px;padding:24px;text-align:center;margin:16px 0;">
<p style="font-size:14px;color:#888;margin:0 0 8px;">Sử dụng mã:</p>
<span style="font-size:28px;font-weight:900;letter-spacing:6px;color:#A948C8;font-family:monospace;">${code}</span>
<p style="font-size:24px;font-weight:900;color:#1A1135;margin:12px 0 0;">Giảm ${percentage}%</p>
${expiryText ? `<p style="font-size:12px;color:#aaa;margin:8px 0 0;">HSD: ${expiryText}</p>` : ''}
</div>
<div style="text-align:center;">
<a href="${SITE_URL}/products.html" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#A948C8,#4B61B5);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:13px;">Mua sắm ngay</a>
</div>`;
    await sendToAllCustomerEmails(`🎉 Giảm ${percentage}% với mã ${code}`, body);
}

// --- Flash Sale Email (to all customers) ---
async function sendFlashSaleEmail(saleName, endTime) {
    const endText = endTime ? new Date(endTime).toLocaleString('vi-VN') : '';
    const body = `
<h2 style="color:#1A1135;margin:0 0 12px;font-size:18px;text-align:center;">⚡ Flash Sale!</h2>
<div style="background:#FAF8EE;border-radius:16px;padding:24px;text-align:center;margin:16px 0;">
<p style="font-size:20px;font-weight:900;color:#ef4444;margin:0;">${saleName || 'Flash Sale'}</p>
${endText ? `<p style="font-size:12px;color:#888;margin:8px 0 0;">Kết thúc: ${endText}</p>` : ''}
</div>
<div style="text-align:center;">
<a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ef4444,#f59e0b);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:13px;">Mua ngay kẻo lỡ!</a>
</div>`;
    await sendToAllCustomerEmails(`⚡ ${saleName || 'Flash Sale'} — Giày dép Hương Nhớ`, body);
}

// --- New Order Email to Admin ---
async function sendNewOrderEmailToAdmin(orderId, customerName, total, items) {
    const itemsHtml = (items || []).map(i =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">${i.productName}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;">x${i.quantity}</td></tr>`
    ).join('');
    const body = `
<h2 style="color:#1A1135;margin:0 0 12px;font-size:18px;">🛒 Đơn hàng mới #${orderId}</h2>
<p style="color:#666;font-size:14px;">Khách: <strong>${customerName}</strong></p>
<table style="width:100%;margin:12px 0;">${itemsHtml}</table>
<p style="font-size:16px;font-weight:900;color:#A948C8;">Tổng: ${Number(total).toLocaleString('vi-VN')}đ</p>
<a href="${SITE_URL}/admin/orders.html" style="display:inline-block;margin-top:12px;padding:12px 28px;background:linear-gradient(135deg,#A948C8,#4B61B5);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:13px;">Xem đơn hàng</a>`;
    // Send to admin email
    await sendMail(GMAIL_USER, `🛒 Đơn mới #${orderId} — ${customerName}`, wrapEmail('Đơn hàng mới', body));
}

// --- Return Action Email ---
async function sendReturnActionEmail(email, name, orderId, action, zaloLink = '0902') {
    const isApproved = action === 'approved';
    const title = isApproved ? '✅ Yêu cầu đổi trả được chấp nhận' : '❌ Yêu cầu đổi trả bị từ chối';

    let messageHtml = '';
    if (isApproved) {
        messageHtml = `
            <p style="color:#666;font-size:14px;line-height:1.6;">
                Yêu cầu đổi trả cho đơn hàng <strong>#${orderId}</strong> của bạn đã được chúng tôi <strong>chấp nhận</strong>.
            </p>
            <p style="color:#666;font-size:14px;line-height:1.6;">
                Vui lòng nhắn tin qua Zalo shop để chúng tôi tư vấn và hướng dẫn các bước tiếp theo nhé.
            </p>
            <div style="text-align:center;margin-top:20px;">
                <a href="https://zalo.me/${zaloLink}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0068ff,#00c6ff);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:13px;">Nhắn tin qua Zalo ngay</a>
            </div>
        `;
    } else {
        messageHtml = `
            <p style="color:#666;font-size:14px;line-height:1.6;">
                Chúng tôi rất tiếc phải thông báo rằng yêu cầu đổi trả cho đơn hàng <strong>#${orderId}</strong> của bạn đã <strong>bị từ chối</strong>.
            </p>
            <p style="color:#666;font-size:14px;line-height:1.6;">
                Sản phẩm không đáp ứng đủ điều kiện đổi trả của shop. Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua Zalo hoặc Hotline.
            </p>
        `;
    }

    const body = `
<h2 style="color:#1A1135;margin:0 0 12px;font-size:18px;">Xin chào ${name},</h2>
${messageHtml}`;

    await sendMail(email, `Cập nhật trạng thái đổi trả đơn hàng #${orderId}`, wrapEmail(title, body));
}

// --- New Blog Email (to all customers) ---
async function sendNewBlogEmail(title, excerpt, slug, thumbnail) {
    const body = `
<h2 style="color:#1A1135;margin:0 0 12px;font-size:18px;">📰 Bài viết mới: ${title}</h2>
${thumbnail ? `<img src="${thumbnail}" style="max-width:100%;border-radius:12px;margin-bottom:12px;" alt="${title}">` : ''}
<p style="color:#666;font-size:14px;line-height:1.6;">${excerpt || 'Nhấn để xem chi tiết bài viết mới.'}</p>
<div style="text-align:center;margin-top:20px;">
<a href="${SITE_URL}/blog-detail.html?slug=${slug}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#A948C8,#4B61B5);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:13px;">Đọc bài viết</a>
</div>`;
    await sendToAllCustomerEmails(`📰 Bài viết mới: ${title}`, body);
}

module.exports = {
    generateOTP,
    sendOTPEmail,
    sendOrderStatusEmail,
    sendNewProductEmail,
    sendNewDiscountEmail,
    sendFlashSaleEmail,
    sendNewOrderEmailToAdmin,
    sendReturnActionEmail,
    sendNewBlogEmail
};
