const express = require('express');
const { MarketingConfig } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_MARKETING_CONFIG = {
    campaignsEnabled: true,
    campaigns: [],
    luckySpinEnabled: true,
    luckySpinPopupEnabled: true,
    luckySpinPopupDelay: 2200,
    luckySpinTitle: 'Vong Quay May Man 2026',
    luckySpinDescription: 'Moi khach hang duoc quay 1 lan moi ngay de nhan voucher.',
    luckySpinRewards: [],
    popupAdsEnabled: false,
    popupAdsDelay: 1800,
    popupAds: []
};

function str(value, fallback = '') {
    if (typeof value !== 'string') return fallback;
    return value.trim();
}

function bool(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    if (typeof value === 'number') return value === 1;
    return fallback;
}

function intVal(value, fallback, min = 0, max = 20000) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function positiveInt(value, fallback = null) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function extractProductIdFromHref(href) {
    const text = str(href);
    if (!text.includes('product-detail')) return null;
    const match = text.match(/[?&]id=(\d+)/);
    if (!match) return null;
    return positiveInt(match[1], null);
}

function resolveCtaHref(rawHref, productId, fallback = '/products.html') {
    if (productId) return `/product-detail.html?id=${productId}`;
    const href = str(rawHref);
    return href || fallback;
}

function normalizeBenefits(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map(item => ({
            label: str(item?.label),
            value: str(item?.value)
        }))
        .filter(item => item.label && item.value)
        .slice(0, 6);
}

function normalizeCampaigns(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((item, index) => {
            const productId = positiveInt(item?.productId, extractProductIdFromHref(item?.ctaHref));
            return {
                id: str(item?.id) || `campaign-${Date.now()}-${index}`,
                active: bool(item?.active, true),
                theme: str(item?.theme, 'love') === 'lunar' ? 'lunar' : 'love',
                tag: str(item?.tag),
                title: str(item?.title),
                subtitle: str(item?.subtitle),
                ctaText: str(item?.ctaText, 'Xem ngay'),
                ctaHref: resolveCtaHref(item?.ctaHref, productId, '/products.html'),
                productId,
                backgroundImage: str(item?.backgroundImage),
                imageLeft: str(item?.imageLeft),
                imageRight: str(item?.imageRight),
                benefits: normalizeBenefits(item?.benefits)
            };
        })
        .filter(item => item.title && item.imageLeft && item.imageRight)
        .slice(0, 12);
}

function normalizeRewards(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map(item => ({
            label: str(item?.label),
            text: str(item?.text),
            code: item?.code ? str(item.code) : null
        }))
        .filter(item => item.label && item.text)
        .slice(0, 20);
}

function normalizePopupAds(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((item, index) => {
            const productId = positiveInt(item?.productId, extractProductIdFromHref(item?.ctaHref));
            return {
                id: str(item?.id) || `popup-${Date.now()}-${index}`,
                active: bool(item?.active, true),
                title: str(item?.title),
                subtitle: str(item?.subtitle),
                imageUrl: str(item?.imageUrl),
                ctaText: str(item?.ctaText, 'Xem ngay'),
                ctaHref: resolveCtaHref(item?.ctaHref, productId, '/products.html'),
                productId
            };
        })
        .filter(item => item.title && item.imageUrl)
        .slice(0, 20);
}

function normalizePayload(payload = {}, fallback = DEFAULT_MARKETING_CONFIG) {
    const campaigns = normalizeCampaigns(payload.campaigns);
    const rewards = normalizeRewards(payload.luckySpinRewards);
    const popupAds = normalizePopupAds(payload.popupAds);

    return {
        campaignsEnabled: bool(payload.campaignsEnabled, fallback.campaignsEnabled),
        campaigns: payload.campaigns !== undefined ? campaigns : fallback.campaigns,
        luckySpinEnabled: bool(payload.luckySpinEnabled, fallback.luckySpinEnabled),
        luckySpinPopupEnabled: bool(payload.luckySpinPopupEnabled, fallback.luckySpinPopupEnabled),
        luckySpinPopupDelay: intVal(payload.luckySpinPopupDelay, fallback.luckySpinPopupDelay, 0, 15000),
        luckySpinTitle: str(payload.luckySpinTitle, fallback.luckySpinTitle),
        luckySpinDescription: str(payload.luckySpinDescription, fallback.luckySpinDescription),
        luckySpinRewards: payload.luckySpinRewards !== undefined ? rewards : fallback.luckySpinRewards,
        popupAdsEnabled: bool(payload.popupAdsEnabled, fallback.popupAdsEnabled),
        popupAdsDelay: intVal(payload.popupAdsDelay, fallback.popupAdsDelay, 0, 15000),
        popupAds: popupAds
    };
}

async function getOrCreateConfig() {
    const config = await MarketingConfig.findOne({ where: { key: 'homepage' } });
    if (config) return config;
    return MarketingConfig.create({
        key: 'homepage',
        ...DEFAULT_MARKETING_CONFIG
    });
}

// Public config for storefront
router.get('/public', async (req, res) => {
    try {
        const config = await getOrCreateConfig();
        const normalized = normalizePayload(config.toJSON(), DEFAULT_MARKETING_CONFIG);
        res.json({
            campaignsEnabled: normalized.campaignsEnabled,
            campaigns: normalized.campaigns.filter(item => item.active),
            luckySpinEnabled: normalized.luckySpinEnabled,
            luckySpinPopupEnabled: normalized.luckySpinPopupEnabled,
            luckySpinPopupDelay: normalized.luckySpinPopupDelay,
            luckySpinTitle: normalized.luckySpinTitle,
            luckySpinDescription: normalized.luckySpinDescription,
            luckySpinRewards: normalized.luckySpinRewards,
            popupAdsEnabled: normalized.popupAdsEnabled,
            popupAdsDelay: normalized.popupAdsDelay,
            popupAds: normalized.popupAds.filter(item => item.active)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin read full config
router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
    try {
        const config = await getOrCreateConfig();
        const normalized = normalizePayload(config.toJSON(), DEFAULT_MARKETING_CONFIG);
        res.json(normalized);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin update config
router.put('/admin', authenticateToken, isAdmin, async (req, res) => {
    try {
        const config = await getOrCreateConfig();
        const next = normalizePayload(req.body || {}, DEFAULT_MARKETING_CONFIG);
        await config.update(next);
        res.json({ success: true, config: next });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
