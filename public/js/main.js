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

// Category Filter
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadProducts(btn.dataset.category);
    });
  });

  if (document.getElementById('products-grid')) loadProducts();
});

function showAbout() { showToast('Giày Dép Hương Nhớ - Chất lượng & Phong cách!', 'success'); }
function showContact() { showToast('Liên hệ: 0123 456 789', 'success'); }
function toggleMobileMenu() { document.querySelector('.nav')?.classList.toggle('active'); }
