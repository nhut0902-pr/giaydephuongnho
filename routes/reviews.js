const express = require('express');
const { Review, ReviewVote, User, Product } = require('../models');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/:productId — list reviews for a product
router.get('/:productId', optionalAuth, async (req, res) => {
    try {
        const reviews = await Review.findAll({
            where: { ProductId: req.params.productId },
            include: [{ model: User, attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']]
        });

        // If user is logged in, get their votes
        let userVotes = {};
        if (req.user) {
            const votes = await ReviewVote.findAll({
                where: { UserId: req.user.id },
                attributes: ['ReviewId', 'vote']
            });
            votes.forEach(v => { userVotes[v.ReviewId] = v.vote; });
        }

        const result = reviews.map(r => {
            const review = r.toJSON();
            review.userName = review.User?.name || 'Ẩn danh';
            review.userVote = userVotes[review.id] || null;
            delete review.User;
            return review;
        });

        // Calculate summary
        const total = result.length;
        const avgRating = total > 0 ? (result.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : 0;

        res.json({ reviews: result, total, avgRating: Number(avgRating) });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// POST /api/reviews — create a review
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { productId, rating, comment } = req.body;

        if (!productId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Vui lòng chọn số sao (1-5)' });
        }

        // Check product exists
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
        }

        // Check if user already reviewed this product
        const existing = await Review.findOne({
            where: { UserId: req.user.id, ProductId: productId }
        });
        if (existing) {
            return res.status(400).json({ error: 'Bạn đã đánh giá sản phẩm này rồi' });
        }

        const review = await Review.create({
            UserId: req.user.id,
            ProductId: productId,
            rating,
            comment: comment || ''
        });

        const created = await Review.findByPk(review.id, {
            include: [{ model: User, attributes: ['id', 'name'] }]
        });

        const result = created.toJSON();
        result.userName = result.User?.name || 'Ẩn danh';
        result.userVote = null;
        delete result.User;

        res.status(201).json(result);
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

// POST /api/reviews/:id/vote — like or dislike
router.post('/:id/vote', authenticateToken, async (req, res) => {
    try {
        const { vote } = req.body; // 'like' or 'dislike'
        if (!['like', 'dislike'].includes(vote)) {
            return res.status(400).json({ error: 'Vote phải là like hoặc dislike' });
        }

        const review = await Review.findByPk(req.params.id);
        if (!review) {
            return res.status(404).json({ error: 'Đánh giá không tồn tại' });
        }

        // Check if user is the review author
        if (review.UserId === req.user.id) {
            return res.status(400).json({ error: 'Không thể vote cho đánh giá của chính mình' });
        }

        // Find existing vote
        const existing = await ReviewVote.findOne({
            where: { UserId: req.user.id, ReviewId: review.id }
        });

        if (existing) {
            if (existing.vote === vote) {
                // Remove vote (toggle off)
                if (vote === 'like') review.likes = Math.max(0, review.likes - 1);
                else review.dislikes = Math.max(0, review.dislikes - 1);
                await existing.destroy();
                await review.save();
                return res.json({ likes: review.likes, dislikes: review.dislikes, userVote: null });
            } else {
                // Switch vote
                if (existing.vote === 'like') review.likes = Math.max(0, review.likes - 1);
                else review.dislikes = Math.max(0, review.dislikes - 1);
                if (vote === 'like') review.likes += 1;
                else review.dislikes += 1;
                existing.vote = vote;
                await existing.save();
                await review.save();
                return res.json({ likes: review.likes, dislikes: review.dislikes, userVote: vote });
            }
        }

        // New vote
        if (vote === 'like') review.likes += 1;
        else review.dislikes += 1;
        await ReviewVote.create({ UserId: req.user.id, ReviewId: review.id, vote });
        await review.save();

        res.json({ likes: review.likes, dislikes: review.dislikes, userVote: vote });
    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi' });
    }
});

module.exports = router;
