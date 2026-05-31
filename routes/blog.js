const express = require('express');
const { BlogPost, User } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');
const { sendNewBlogEmail } = require('../utils/mailer');
const pushRoutes = require('./push');

const router = express.Router();

// Generate slug from title
function generateSlug(title) {
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now().toString(36);
}

// GET /api/blog — public list (published only)
router.get('/', async (req, res) => {
    try {
        const { category, search, page = 1, limit = 12 } = req.query;
        const where = { published: true };

        if (category) where.category = category;
        if (search) where.title = { [Op.iLike]: `%${search}%` };

        const offset = (page - 1) * limit;
        const { rows: posts, count: total } = await BlogPost.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, attributes: ['id', 'name'] }],
            limit: Number(limit),
            offset
        });

        res.json({
            posts: posts.map(p => ({
                ...p.toJSON(),
                authorName: p.User?.name || 'Admin'
            })),
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error('Get blogs error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// GET /api/blog/categories — list categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await BlogPost.findAll({
            attributes: ['category'],
            where: { published: true },
            group: ['category']
        });
        res.json(categories.map(c => c.category).filter(Boolean));
    } catch (error) {
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// GET /api/blog/admin/all — admin list (all posts)
router.get('/admin/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const posts = await BlogPost.findAll({
            order: [['createdAt', 'DESC']],
            include: [{ model: User, attributes: ['id', 'name'] }]
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// GET /api/blog/:slug — single post by slug (public)
router.get('/:slug', async (req, res) => {
    try {
        const post = await BlogPost.findOne({
            where: { slug: req.params.slug },
            include: [{ model: User, attributes: ['id', 'name'] }]
        });

        if (!post) {
            return res.status(404).json({ error: 'Bài viết không tồn tại' });
        }

        // Increment views
        await post.increment('views');

        const result = post.toJSON();
        result.authorName = result.User?.name || 'Admin';

        res.json(result);
    } catch (error) {
        console.error('Get blog error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// POST /api/blog — create post (admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { title, content, excerpt, thumbnail, category, published } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
        }

        const slug = generateSlug(title);

        const post = await BlogPost.create({
            title, slug, content,
            excerpt: excerpt || content.substring(0, 200).replace(/<[^>]*>/g, ''),
            thumbnail, category: category || 'Tin tức',
            published: published || false,
            UserId: req.user.id
        });

        if (post.published) {
            // Send push notification
            try {
                await pushRoutes.sendToAll({
                    title: '📰 Bài viết mới: ' + post.title,
                    body: post.excerpt || 'Nhấn vào để xem chi tiết bài viết.',
                    icon: post.thumbnail || '/images/logo.jpg',
                    data: { url: `/blog-detail.html?slug=${post.slug}` }
                });
            } catch (e) { console.error('Push blog error:', e); }

            // Send email
            try {
                await sendNewBlogEmail(post.title, post.excerpt, post.slug, post.thumbnail);
            } catch (e) { console.error('Email blog error:', e); }
        }

        res.status(201).json(post);
    } catch (error) {
        console.error('Create blog error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// PUT /api/blog/:id — update post (admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const post = await BlogPost.findByPk(req.params.id);
        if (!post) return res.status(404).json({ error: 'Bài viết không tồn tại' });

        const { title, content, excerpt, thumbnail, category, published } = req.body;
        const wasPublished = post.published;
        const isNowPublished = published !== undefined ? published : post.published;

        await post.update({
            title: title || post.title,
            content: content || post.content,
            excerpt: excerpt || post.excerpt,
            thumbnail: thumbnail !== undefined ? thumbnail : post.thumbnail,
            category: category || post.category,
            published: isNowPublished
        });

        if (!wasPublished && isNowPublished) {
            // Transitioned from draft to published -> Send notifications
            try {
                await pushRoutes.sendToAll({
                    title: '📰 Bài viết mới: ' + post.title,
                    body: post.excerpt || 'Nhấn vào để xem chi tiết bài viết.',
                    icon: post.thumbnail || '/images/logo.jpg',
                    data: { url: `/blog-detail.html?slug=${post.slug}` }
                });
            } catch (e) { console.error('Push blog error:', e); }

            try {
                await sendNewBlogEmail(post.title, post.excerpt, post.slug, post.thumbnail);
            } catch (e) { console.error('Email blog error:', e); }
        }

        res.json(post);
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// DELETE /api/blog/:id — delete post (admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const post = await BlogPost.findByPk(req.params.id);
        if (!post) return res.status(404).json({ error: 'Bài viết không tồn tại' });

        await post.destroy();
        res.json({ message: 'Xóa bài viết thành công' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

module.exports = router;
