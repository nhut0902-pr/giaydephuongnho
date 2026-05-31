// Utility Functions
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Keep legacy toast as default to preserve all existing flows.
// Set window.__ENABLE_SILEO__ = true before scripts load if you want to try Sileo again.
const ENABLE_SILEO = Boolean(window.__ENABLE_SILEO__);
let sileoReady = null;
async function loadSileo() {
  if (!ENABLE_SILEO) return Promise.reject(new Error('Sileo disabled'));
  if (window.__sileo) return window.__sileo;
  if (!sileoReady) {
    sileoReady = (async () => {
      const [React, ReactDOM, sileoMod] = await Promise.all([
        import('https://esm.sh/react@18.3.1?dev=false'),
        import('https://esm.sh/react-dom@18.3.1/client?dev=false'),
        import('https://esm.sh/sileo@0.1.4?dev=false&deps=react@18.3.1,react-dom@18.3.1')
      ]);

      // inject Sileo styles once
      if (!document.getElementById('sileo-styles')) {
        const link = document.createElement('link');
        link.id = 'sileo-styles';
        link.rel = 'stylesheet';
        link.href = 'https://esm.sh/sileo@0.1.4/dist/styles.css';
        document.head.appendChild(link);
      }

      // mount toaster host
      let host = document.getElementById('sileo-toaster-root');
      if (!host) {
        host = document.createElement('div');
        host.id = 'sileo-toaster-root';
        document.body.appendChild(host);
      }
      const { createElement } = React;
      const { createRoot } = ReactDOM;
      const root = createRoot(host);
      try {
        root.render(createElement(sileoMod.Toaster, { position: 'top-center', options: { duration: 3000 } }));
      } catch (err) {
        console.error('Sileo Toaster render failed', err);
        throw err;
      }

      window.__sileo = sileoMod.sileo;
      return sileoMod.sileo;
    })().catch(err => {
      console.error('Load Sileo failed, falling back to native toast', err);
      sileoReady = null;
      throw err;
    });
  }
  return sileoReady;
}

function getToastMeta(type) {
  if (type === 'success') return { label: 'Thanh cong', icon: 'check' };
  if (type === 'error') return { label: 'Loi', icon: 'xmark' };
  if (type === 'warning') return { label: 'Canh bao', icon: 'exclamation' };
  return { label: 'Thong tin', icon: 'info' };
}

function renderFallbackToast(message, type, options = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const { description, duration = 3000, actionLabel, action } = options;
  const meta = getToastMeta(type);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-pill">
      <span class="toast-pill-icon"><i class="fas fa-${meta.icon}"></i></span>
      <span class="toast-pill-label">${meta.label}</span>
    </div>
    <button class="toast-close" aria-label="Dong thong bao">&times;</button>
    <div class="toast-content">
      <div class="toast-title">${message}</div>
      ${description ? `<div class="toast-description">${description}</div>` : ''}
      ${actionLabel ? `<button class="toast-action-btn" aria-label="${actionLabel}" data-action="true">${actionLabel}</button>` : ''}
    </div>
    <div class="toast-progress"></div>
  `;
  container.appendChild(toast);

  const remove = () => toast.remove();
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) closeBtn.addEventListener('click', remove);
  const actionBtn = toast.querySelector('.toast-action-btn');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if (typeof action === 'function') action();
      remove();
    });
  }
  toast.querySelector('.toast-progress').style.animationDuration = `${Math.max(duration, 600)}ms`;
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(remove, 300);
  }, duration);
}

async function cleanupBrokenServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let removed = false;
    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
      if (!scriptURL) continue;
      // Keep only our newest push SW, remove stale workbox or legacy workers.
      if (scriptURL.includes('workbox') || !scriptURL.includes('/sw.js?v=20260220-3')) {
        await reg.unregister();
        removed = true;
      }
    }
    if (removed) {
      const refreshed = sessionStorage.getItem('sw_cleanup_reloaded') === '1';
      if (!refreshed) {
        sessionStorage.setItem('sw_cleanup_reloaded', '1');
        location.reload();
      }
    }
  } catch (err) {
    console.warn('SW cleanup failed:', err);
  }
}

/**
 * Rich toast helper.
 * - Basic: showToast('OK', 'success')
 * - With action: showToast('Đã thêm', 'success', { actionLabel: 'Xem giỏ', action: () => window.location='/cart.html' })
 * - Promise helper: use showToastPromise(promiseOrFn, { loading, success, error })
 */
function showToast(message, type = 'success', options = {}) {
  const { description, duration = 3000, actionLabel, action, icon } = options;
  const fallback = () => renderFallbackToast(message, type, { description, duration, actionLabel, action });

  // Default stable behavior: always show toast with legacy renderer.
  if (!ENABLE_SILEO) {
    fallback();
    return;
  }

  try {
    loadSileo()
      .then(api => {
        try {
          const fn = api[type] || api.show;
          fn({
            title: message,
            description,
            duration,
            position: 'top-center',
            icon: icon || null,
            button: actionLabel && action ? { title: actionLabel, onClick: action } : undefined
          });
        } catch (err) {
          console.error('Sileo render failed, using fallback', err);
          fallback();
        }
      })
      .catch(err => {
        console.error('Sileo load failed, using fallback', err);
        fallback();
      });
  } catch (err) {
    console.error('Toast error, using fallback', err);
    fallback();
  }
}

if (ENABLE_SILEO) {
  // Preload only when explicitly enabled.
  document.addEventListener('DOMContentLoaded', () => {
    loadSileo().catch(() => { /* silent fallback */ });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cleanupBrokenServiceWorkers();
});

/**
 * Promise-aware toast helper.
 * Usage: showToastPromise(fetchFn(), { loading: 'Đang gửi...', success: 'Thành công', error: 'Thất bại' })
 */
function showToastPromise(promiseOrFn, opts = {}) {
  const { loading = 'Đang xử lý...', success = 'Thành công', error = 'Có lỗi xảy ra' } = opts;
  const actionLabel = opts.actionLabel;
  const action = opts.action;

  if (!ENABLE_SILEO) {
    const p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
    showToast(loading, 'info', { duration: 4000 });
    p.then((res) => {
      showToast(typeof success === 'function' ? success(res) : success, 'success', { actionLabel, action });
    }).catch((err) => {
      showToast(typeof error === 'function' ? error(err) : error, 'error');
    });
    return;
  }

  loadSileo()
    .then(api => api.promise(
      typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn,
      {
        loading: { title: loading },
        success: (data) => ({ title: typeof success === 'function' ? success(data) : success, button: actionLabel && action ? { title: actionLabel, onClick: action } : undefined }),
        error: (err) => ({ title: typeof error === 'function' ? error(err) : error })
      }
    ))
    .catch(() => {
      // Fallback: simple loading then resolve/reject
      const p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
      showToast(loading, 'info', { duration: 4000 });
      p.then((res) => {
        showToast(typeof success === 'function' ? success(res) : success, 'success', { actionLabel, action });
      }).catch((err) => {
        showToast(typeof error === 'function' ? error(err) : error, 'error');
      });
    });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Load Products
async function loadProducts(category = '') {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const products = await productsAPI.getAll({ category });

    if (products.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h3>Không có sản phẩm</h3></div>';
      return;
    }

    grid.innerHTML = products.map(p => {
      const allImages = [p.image, ...(p.images || []).map(img => img.url)].filter(Boolean);

      return `
      <div class="product-card">
        <a href="/product-detail.html?id=${p.id}" class="product-image">
          <img loading="lazy" decoding="async" src="${allImages[0] || 'https://via.placeholder.com/400'}" alt="${p.name}">
          ${p.discountPercentage ? `<span class="product-badge">-${p.discountPercentage}%</span>` : ''}
          ${allImages.length > 1 ? `<span class="image-count-badge">${allImages.length} ảnh</span>` : ''}
        </a>
        <div class="product-info">
          <div class="product-category">${p.category || 'Giày dép'}</div>
          <h3 class="product-name"><a href="/product-detail.html?id=${p.id}">${p.name}</a></h3>
          <div class="product-meta" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;font-size:0.85rem;color:var(--gray)">
             <span>Đã bán: ${p.sold || 0}</span>
             <span class="product-category">${p.category || 'Giày dép'}</span>
          </div>
          <div class="product-price">
            <span class="price-current">${formatPrice(p.discountedPrice || p.price)}</span>
            ${p.discountedPrice ? `<span class="price-old">${formatPrice(p.price)}</span>` : ''}
          </div>
          <button class="add-to-cart" onclick="addToCart(${p.id}, 1, ${JSON.stringify(p).replace(/"/g, '&quot;')})">
            <i class="fas fa-shopping-cart"></i> Thêm vào giỏ
          </button>
        </div>
      </div>
    `}).join('');
  } catch (error) {
    console.error('Error in loadProducts:', error);
    if (grid) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Lỗi tải sản phẩm</h3><p style="font-size:0.8rem;color:gray">Vui lòng tải lại trang hoặc liên hệ hỗ trợ.</p></div>';
    }
  }
}

// Flash Sale Logic
// Flash Sale Logic
async function initFlashSale() {
  const container = document.getElementById('flash-sale-products');
  const section = document.getElementById('flash-sale');
  if (!container || !section) return;

  try {
    const response = await fetch(`${API_URL}/flash-sale/current`);
    const data = await response.json();
    console.log('Flash Sale Data:', data);

    if (!data.active || !data.data) {
      console.log('Flash Sale inactive or no data');
      section.style.display = 'none';
      return;
    }

    const flashSale = data.data;
    const targetDate = new Date(flashSale.endTime);
    console.log('Target Date:', targetDate);
    console.log('Current Time:', new Date());

    // Update countdown
    const timerInterval = setInterval(() => {
      const currentTime = new Date().getTime();
      const distance = targetDate.getTime() - currentTime;

      if (distance < 0) {
        clearInterval(timerInterval);
        section.style.display = 'none'; // Hide when expired
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const hEl = document.getElementById('hours');
      const mEl = document.getElementById('minutes');
      const sEl = document.getElementById('seconds');

      if (hEl) hEl.innerText = hours.toString().padStart(2, '0');
      if (mEl) mEl.innerText = minutes.toString().padStart(2, '0');
      if (sEl) sEl.innerText = seconds.toString().padStart(2, '0');
    }, 1000);

    // Render Products
    if (flashSale.FlashSaleItems && flashSale.FlashSaleItems.length > 0) {
      container.innerHTML = flashSale.FlashSaleItems.map(item => {
        const p = item.Product;
        if (!p) return '';

        const discountPercent = Math.round(((p.price - item.discountPrice) / p.price) * 100);

        return `
        <div class="product-card">
          <a href="/product-detail.html?id=${p.id}" class="product-image">
            <img src="${p.image || 'https://via.placeholder.com/400'}" alt="${p.name}">
            <span class="product-badge" style="background:var(--danger)">⚡ -${discountPercent}%</span>
          </a>
          <div class="product-info">
            <div class="product-category">Flash Sale</div>
            <h3 class="product-name"><a href="/product-detail.html?id=${p.id}">${p.name}</a></h3>
            <div class="product-price">
              <span class="price-current" style="color:var(--danger)">${formatPrice(item.discountPrice)}</span>
              <span class="price-old">${formatPrice(p.price)}</span>
            </div>
            <div class="product-meta" style="margin-bottom:0.5rem">
              <div style="width:100%;height:6px;background:#eee;border-radius:3px;overflow:hidden">
                <div style="width:${(item.sold / item.quantity) * 100}%;height:100%;background:var(--danger)"></div>
              </div>
              <div style="font-size:0.75rem;color:var(--danger);margin-top:4px">Đã bán ${item.sold}/${item.quantity}</div>
            </div>
            <button class="add-to-cart" onclick="addToCart(${p.id}, 1)">
              <i class="fas fa-bolt"></i> Mua Ngay
            </button>
          </div>
        </div>
      `}).join('');
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }

  } catch (error) {
    console.error('Error loading flash sale:', error);
    section.style.display = 'none';
  }
}

const DEFAULT_EVENT_CAMPAIGNS = [
  {
    id: 'love-1',
    active: true,
    theme: 'love',
    tag: 'Step Of Love',
    title: 'Giay doi tinh tham',
    subtitle: 'Mua theo cap voi uu dai dac biet cho ban than va nguoi thuong.',
    ctaText: 'Mua ngay',
    ctaHref: '/products.html',
    productId: null,
    backgroundImage: '',
    imageLeft: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=700',
    imageRight: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=700',
    benefits: [
      { label: 'Tang voucher', value: '100K' },
      { label: 'Mua 2 doi', value: '-20%' },
      { label: 'Dich vu qua', value: 'FREE' }
    ]
  },
  {
    id: 'lunar-1',
    active: true,
    theme: 'lunar',
    tag: 'Tet Phu Quy',
    title: 'San qua Tet - Don loc xuan',
    subtitle: 'Deal don nam, freeshop va ma giam gia cho toan bo san pham moi.',
    ctaText: 'San deal Tet',
    ctaHref: '/products.html',
    productId: null,
    backgroundImage: '',
    imageLeft: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=700',
    imageRight: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=700',
    benefits: [
      { label: 'Voucher', value: '39K-159K' },
      { label: 'Goi qua Tet', value: 'MIEN PHI' },
      { label: 'Freeship', value: '2 CHIEU' }
    ]
  }
];

const DEFAULT_LUCKY_SPIN_REWARDS = [
  { label: '39K', text: 'Voucher 39.000d', code: 'HN39K' },
  { label: '59K', text: 'Voucher 59.000d', code: 'HN59K' },
  { label: '79K', text: 'Voucher 79.000d', code: 'HN79K' },
  { label: '99K', text: 'Voucher 99.000d', code: 'HN99K' },
  { label: '129K', text: 'Voucher 129.000d', code: 'HN129K' },
  { label: '159K', text: 'Voucher 159.000d', code: 'HN159K' },
  { label: '10%', text: 'Giam 10% toan bo don', code: 'HN10PT' },
  { label: 'LUCK', text: 'Chuc ban may man lan sau', code: null }
];

const DEFAULT_MARKETING_CONFIG = {
  campaignsEnabled: true,
  campaigns: DEFAULT_EVENT_CAMPAIGNS,
  luckySpinEnabled: true,
  luckySpinPopupEnabled: true,
  luckySpinPopupDelay: 2200,
  luckySpinTitle: 'Vong Quay May Man 2026',
  luckySpinDescription: 'Moi khach hang duoc quay 1 lan moi ngay de nhan voucher.',
  luckySpinRewards: DEFAULT_LUCKY_SPIN_REWARDS,
  popupAdsEnabled: false,
  popupAdsDelay: 1800,
  popupAds: []
};

let marketingConfigPromise = null;

const EVENT_THEME_OVERLAY = {
  love: 'linear-gradient(120deg, rgba(255, 77, 109, 0.82) 0%, rgba(255, 117, 143, 0.78) 45%, rgba(255, 164, 182, 0.72) 100%)',
  lunar: 'linear-gradient(125deg, rgba(157, 2, 8, 0.88) 0%, rgba(208, 0, 0, 0.84) 45%, rgba(247, 127, 0, 0.8) 100%)'
};

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

function extractProductIdFromHref(href) {
  if (typeof href !== 'string') return null;
  if (!href.includes('product-detail')) return null;
  const match = href.match(/[?&]id=(\d+)/);
  return match ? parsePositiveInt(match[1]) : null;
}

function resolveMarketingTarget(item = {}, fallbackHref = '/products.html') {
  const productId = parsePositiveInt(item.productId) || extractProductIdFromHref(item.ctaHref);
  return {
    productId,
    ctaHref: productId ? `/product-detail.html?id=${productId}` : (item.ctaHref || fallbackHref)
  };
}

function applyCampaignBackground(section, theme, backgroundImage) {
  if (!section) return;
  const cleanUrl = typeof backgroundImage === 'string' ? backgroundImage.trim() : '';
  if (!cleanUrl) {
    section.style.removeProperty('background-image');
    section.style.removeProperty('background-size');
    section.style.removeProperty('background-position');
    return;
  }

  const safeUrl = cleanUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const overlay = theme === 'lunar' ? EVENT_THEME_OVERLAY.lunar : EVENT_THEME_OVERLAY.love;
  section.style.backgroundImage = `${overlay}, url("${safeUrl}")`;
  section.style.backgroundSize = 'cover, cover';
  section.style.backgroundPosition = 'center, center';
}

function normalizeMarketingConfig(raw = {}) {
  const campaigns = Array.isArray(raw.campaigns) ? raw.campaigns : DEFAULT_EVENT_CAMPAIGNS;
  const rewards = Array.isArray(raw.luckySpinRewards) ? raw.luckySpinRewards : DEFAULT_LUCKY_SPIN_REWARDS;
  const popupAds = Array.isArray(raw.popupAds) ? raw.popupAds : [];
  return {
    campaignsEnabled: raw.campaignsEnabled !== false,
    campaigns: campaigns
      .filter(item => item && item.imageLeft && item.imageRight)
      .map(item => {
        const target = resolveMarketingTarget(item, '/products.html');
        return {
          ...item,
          ...target,
          backgroundImage: typeof item.backgroundImage === 'string' ? item.backgroundImage : ''
        };
      }),
    luckySpinEnabled: raw.luckySpinEnabled !== false,
    luckySpinPopupEnabled: raw.luckySpinPopupEnabled !== false,
    luckySpinPopupDelay: Number.isFinite(Number(raw.luckySpinPopupDelay)) ? Number(raw.luckySpinPopupDelay) : 2200,
    luckySpinTitle: raw.luckySpinTitle || DEFAULT_MARKETING_CONFIG.luckySpinTitle,
    luckySpinDescription: raw.luckySpinDescription || DEFAULT_MARKETING_CONFIG.luckySpinDescription,
    luckySpinRewards: rewards.filter(item => item && item.label && item.text),
    popupAdsEnabled: raw.popupAdsEnabled === true,
    popupAdsDelay: Number.isFinite(Number(raw.popupAdsDelay)) ? Number(raw.popupAdsDelay) : 1800,
    popupAds: popupAds
      .filter(item => item && item.imageUrl && item.title && item.active !== false)
      .map(item => {
        const target = resolveMarketingTarget(item, '/products.html');
        return {
          ...item,
          ...target
        };
      })
  };
}

async function fetchMarketingConfig() {
  if (!marketingConfigPromise) {
    marketingConfigPromise = fetch(`${API_URL}/marketing/public`)
      .then(async response => {
        if (!response.ok) throw new Error('Cannot fetch marketing config');
        return response.json();
      })
      .then(data => normalizeMarketingConfig(data))
      .catch(() => normalizeMarketingConfig(DEFAULT_MARKETING_CONFIG));
  }
  return marketingConfigPromise;
}

function renderCampaignSlide(index, campaigns) {
  const section = document.getElementById('event-campaign');
  if (!section || !Array.isArray(campaigns) || campaigns.length === 0) return;
  const campaign = campaigns[index];
  if (!campaign) return;

  section.dataset.theme = campaign.theme === 'lunar' ? 'lunar' : 'love';
  applyCampaignBackground(section, section.dataset.theme, campaign.backgroundImage);
  const tagEl = document.getElementById('event-tag');
  const titleEl = document.getElementById('event-title');
  const subtitleEl = document.getElementById('event-subtitle');
  const ctaEl = document.getElementById('event-cta');
  const benefitsEl = document.getElementById('event-benefits');
  const leftImg = document.getElementById('event-img-left');
  const rightImg = document.getElementById('event-img-right');
  const dots = document.querySelectorAll('.event-campaign-dot');

  if (tagEl) tagEl.textContent = campaign.tag || '';
  if (titleEl) titleEl.textContent = campaign.title || '';
  if (subtitleEl) subtitleEl.textContent = campaign.subtitle || '';
  if (ctaEl) {
    ctaEl.textContent = campaign.ctaText || 'Xem ngay';
    ctaEl.setAttribute('href', resolveMarketingTarget(campaign, '/products.html').ctaHref);
  }
  if (leftImg) leftImg.setAttribute('src', campaign.imageLeft || '');
  if (rightImg) rightImg.setAttribute('src', campaign.imageRight || '');

  if (benefitsEl) {
    const benefits = Array.isArray(campaign.benefits) ? campaign.benefits : [];
    benefitsEl.innerHTML = benefits.map(item => `
      <div class="event-campaign-benefit">
        <span>${item.label || ''}</span>
        <strong>${item.value || ''}</strong>
      </div>
    `).join('');
  }

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex === index);
  });
}

function initCampaignSection(config) {
  const section = document.getElementById('event-campaign');
  const dotsWrap = document.getElementById('event-dots');
  if (!section || !dotsWrap) return;

  const campaigns = config.campaignsEnabled ? config.campaigns : [];
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    section.style.display = 'none';
    return;
  }

  let currentIndex = 0;
  let rotationTimer = null;

  section.style.display = 'block';
  dotsWrap.innerHTML = campaigns.map((_, index) =>
    `<button class="event-campaign-dot ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="Chon su kien ${index + 1}"></button>`
  ).join('');

  const setSlide = (index) => {
    currentIndex = index;
    renderCampaignSlide(currentIndex, campaigns);
  };

  const resetRotation = () => {
    if (rotationTimer) clearInterval(rotationTimer);
    rotationTimer = setInterval(() => {
      const next = (currentIndex + 1) % campaigns.length;
      setSlide(next);
    }, 6000);
  };

  dotsWrap.querySelectorAll('.event-campaign-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const index = Number(dot.dataset.index);
      if (Number.isNaN(index)) return;
      setSlide(index);
      resetRotation();
    });
  });

  setSlide(0);
  if (campaigns.length > 1) resetRotation();
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function initPromoPopup(config) {
  const overlay = document.getElementById('promo-popup-overlay');
  const closeBtn = document.getElementById('promo-popup-close');
  const imageEl = document.getElementById('promo-popup-image');
  const titleEl = document.getElementById('promo-popup-title');
  const subtitleEl = document.getElementById('promo-popup-subtitle');
  const ctaEl = document.getElementById('promo-popup-cta');

  if (!overlay || !closeBtn || !imageEl || !titleEl || !subtitleEl || !ctaEl) return;
  if (!config.popupAdsEnabled || !Array.isArray(config.popupAds) || config.popupAds.length === 0) return;

  const banner = config.popupAds[Math.floor(Math.random() * config.popupAds.length)];
  if (!banner) return;

  const storageKey = `promoPopupShown:${banner.id || banner.title}:${getTodayKey()}`;
  if (localStorage.getItem(storageKey) === '1') return;

  const openModal = () => {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    localStorage.setItem(storageKey, '1');
  };

  imageEl.setAttribute('src', banner.imageUrl || '');
  imageEl.setAttribute('alt', banner.title || 'Popup banner');
  titleEl.textContent = banner.title || '';
  subtitleEl.textContent = banner.subtitle || '';
  ctaEl.textContent = banner.ctaText || 'Xem ngay';
  ctaEl.setAttribute('href', resolveMarketingTarget(banner, '/products.html').ctaHref);

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('active')) closeModal();
  });

  setTimeout(openModal, Math.max(0, config.popupAdsDelay || 1800));
}

function initLuckySpin(config) {
  const overlay = document.getElementById('lucky-spin-overlay');
  const openBtn = document.getElementById('open-lucky-spin');
  const openInlineBtn = document.getElementById('open-lucky-spin-inline');
  const closeBtn = document.getElementById('lucky-spin-close');
  const spinBtn = document.getElementById('lucky-spin-btn');
  const wheel = document.getElementById('lucky-wheel');
  const labelsWrap = document.getElementById('lucky-wheel-labels');
  const wheelWrap = document.querySelector('.lucky-wheel-wrap');
  const noteEl = document.getElementById('lucky-spin-note');
  const resultEl = document.getElementById('lucky-spin-result');
  const titleEl = document.getElementById('lucky-spin-title');
  const descEl = document.querySelector('.lucky-spin-desc');

  if (!overlay || !openBtn || !closeBtn || !spinBtn || !wheel || !labelsWrap || !noteEl || !resultEl) return;
  if (!config.luckySpinEnabled) {
    openBtn.style.display = 'none';
    if (openInlineBtn) openInlineBtn.style.display = 'none';
    return;
  }

  if (titleEl) titleEl.textContent = config.luckySpinTitle || DEFAULT_MARKETING_CONFIG.luckySpinTitle;
  if (descEl) descEl.textContent = config.luckySpinDescription || DEFAULT_MARKETING_CONFIG.luckySpinDescription;

  const rewards = Array.isArray(config.luckySpinRewards)
    ? config.luckySpinRewards
    : DEFAULT_LUCKY_SPIN_REWARDS;

  let spinning = false;
  let rotation = 0;
  const segmentAngle = 360 / rewards.length;

  const renderWheelLabels = () => {
    const radius = Math.max(86, Math.round((wheelWrap?.clientWidth || 320) * 0.35));
    labelsWrap.innerHTML = rewards.map((reward, index) => {
      const rotate = index * segmentAngle;
      return `<span class="lucky-wheel-label" style="transform: translate(-50%, -50%) rotate(${rotate}deg) translateY(-${radius}px) rotate(90deg);">${reward.label}</span>`;
    }).join('');
  };
  renderWheelLabels();
  window.addEventListener('resize', renderWheelLabels);

  const openModal = () => {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  const hasSpunToday = () => localStorage.getItem('luckySpinDate') === getTodayKey();
  const markSpunToday = () => localStorage.setItem('luckySpinDate', getTodayKey());

  const renderResult = (reward) => {
    if (!reward) return;
    if (!reward.code) {
      resultEl.innerHTML = `<p>${reward.text}</p>`;
      return;
    }

    resultEl.innerHTML = `
      <p>Ban nhan duoc <strong>${reward.text}</strong></p>
      <button class="lucky-copy-code" data-code="${reward.code}">Sao chep ma: ${reward.code}</button>
    `;
    const copyBtn = resultEl.querySelector('.lucky-copy-code');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', async () => {
      const code = copyBtn.dataset.code;
      try {
        await navigator.clipboard.writeText(code);
        showToast('Da sao chep ma giam gia: ' + code, 'success');
      } catch (err) {
        showToast('Khong the sao chep tu dong. Ma cua ban: ' + code, 'warning');
      }
    });
  };

  openBtn.addEventListener('click', openModal);
  if (openInlineBtn) openInlineBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('active')) closeModal();
  });

  spinBtn.addEventListener('click', () => {
    if (spinning) return;
    if (hasSpunToday()) {
      showToast('Ban da quay hom nay. Vui long quay lai vao ngay mai.', 'warning');
      noteEl.textContent = 'Ban da su dung luot quay hom nay.';
      return;
    }

    const rewardIndex = Math.floor(Math.random() * rewards.length);
    const targetCenter = 360 - (rewardIndex * segmentAngle + segmentAngle / 2);
    const normalized = ((targetCenter - (rotation % 360)) + 360) % 360;
    const totalSpin = 360 * (6 + Math.floor(Math.random() * 3)) + normalized;

    spinning = true;
    spinBtn.disabled = true;
    noteEl.textContent = 'Dang quay...';
    resultEl.innerHTML = '';

    rotation += totalSpin;
    wheel.style.transform = `rotate(${rotation}deg)`;

    const onFinish = () => {
      wheel.removeEventListener('transitionend', onFinish);
      spinning = false;
      spinBtn.disabled = false;
      markSpunToday();
      const reward = rewards[rewardIndex];
      noteEl.textContent = `Ket qua: ${reward.text}`;
      renderResult(reward);
      showToast(reward.code ? `Chuc mung! Ban nhan duoc ${reward.text}` : reward.text, reward.code ? 'success' : 'info');
    };

    wheel.addEventListener('transitionend', onFinish);
  });

  const popupKey = 'luckySpinPopupDate';
  const hasShownPopup = localStorage.getItem(popupKey) === getTodayKey();
  if (config.luckySpinPopupEnabled && !hasShownPopup && !hasSpunToday()) {
    setTimeout(() => {
      const promoOverlay = document.getElementById('promo-popup-overlay');
      if (promoOverlay && promoOverlay.classList.contains('active')) return;
      openModal();
      localStorage.setItem(popupKey, getTodayKey());
    }, Math.max(0, config.luckySpinPopupDelay || 2200));
  }
}

// Category Filter & Init
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadProducts(btn.dataset.category);
    });
  });

  const marketingConfig = await fetchMarketingConfig();
  if (document.getElementById('products-grid')) loadProducts();
  if (document.getElementById('flash-sale')) initFlashSale();
  if (document.getElementById('event-campaign')) initCampaignSection(marketingConfig);
  if (document.getElementById('promo-popup-overlay')) initPromoPopup(marketingConfig);
  if (document.getElementById('lucky-spin-overlay')) initLuckySpin(marketingConfig);
});

function showAbout() { showToast('Giày Dép Hương Nhớ - Chất lượng & Phong cách!', 'success'); }
function showContact() { showToast('Liên hệ: 0916 813 067', 'success'); }
function toggleMobileMenu() { document.querySelector('.nav')?.classList.toggle('active'); }

// Cookie & policy notice + quick access button
function initPolicyNotice() {
  // Floating button linking to return-policy
  const policyBtn = document.createElement('a');
  policyBtn.href = '/return-policy.html';
  policyBtn.className = 'policy-btn';
  policyBtn.textContent = 'Chính sách & Cookie';
  document.body.appendChild(policyBtn);

  // Consent banner
  if (localStorage.getItem('policyConsent')) return;

  const banner = document.createElement('div');
  banner.className = 'policy-banner';
  banner.innerHTML = `
    <div class="policy-text">
      <strong>Chính sách & Cookie:</strong> Chúng tôi dùng cookie để cá nhân hoá trải nghiệm và cải thiện hiệu suất tải trang. Xem chi tiết tại <a href="/return-policy.html" target="_blank" rel="noopener">trang chính sách</a>.
    </div>
    <div class="policy-actions">
      <button class="policy-link" onclick="window.open('/return-policy.html','_blank')">Xem chi tiết</button>
      <button class="policy-accept" id="policy-accept-btn">Đồng ý</button>
    </div>
  `;

  document.body.appendChild(banner);

  banner.querySelector('#policy-accept-btn').addEventListener('click', () => {
    localStorage.setItem('policyConsent', 'true');
    banner.remove();
  });
}
