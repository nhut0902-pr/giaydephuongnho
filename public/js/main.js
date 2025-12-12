// Utility Functions
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
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

    grid.innerHTML = products.map(p => `
      <div class="product-card">
        <a href="/product-detail.html?id=${p.id}" class="product-image">
          <img src="${p.image || 'https://via.placeholder.com/400'}" alt="${p.name}">
          ${p.discountPercentage ? `<span class="product-badge">-${p.discountPercentage}%</span>` : ''}
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
    `).join('');
  } catch (error) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Lỗi tải sản phẩm</h3></div>';
  }
}

// Flash Sale Logic
// Flash Sale Logic
async function initFlashSale() {
  const container = document.getElementById('flash-sale-products');
  const section = document.getElementById('flash-sale');
  if (!container || !section) return;

  try {
    const response = await fetch('/api/flash-sale/current');
    const data = await response.json();

    if (!data.active || !data.data) {
      section.style.display = 'none';
      return;
    }

    const flashSale = data.data;
    const targetDate = new Date(flashSale.endTime);

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

// Category Filter & Init
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadProducts(btn.dataset.category);
    });
  });

  if (document.getElementById('products-grid')) loadProducts();
  if (document.getElementById('flash-sale')) initFlashSale();
});

function showAbout() { showToast('Giày Dép Hương Nhớ - Chất lượng & Phong cách!', 'success'); }
function showContact() { showToast('Liên hệ: 0123 456 789', 'success'); }
function toggleMobileMenu() { document.querySelector('.nav')?.classList.toggle('active'); }
