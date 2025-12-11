// Cart State Management
const LOCAL_CART_KEY = 'giaydephuongnho_cart';
let cartItems = [];

async function initCart() {
    await loadCart();
    updateCartUI();
}

async function loadCart() {
    if (isLoggedIn()) {
        try {
            cartItems = await cartAPI.get();
        } catch (error) {
            cartItems = [];
        }
    } else {
        cartItems = getLocalCart();
    }
}

function getLocalCart() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_CART_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveLocalCart(items) {
    localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
}

function clearLocalCart() {
    localStorage.removeItem(LOCAL_CART_KEY);
}

async function addToCart(productId, quantity = 1, product = null) {
    try {
        if (isLoggedIn()) {
            await cartAPI.add(productId, quantity);
            await loadCart();
        } else {
            const localCart = getLocalCart();
            const existingIndex = localCart.findIndex(item => item.productId === productId);

            if (existingIndex >= 0) {
                localCart[existingIndex].quantity += quantity;
            } else {
                if (!product) product = await productsAPI.getById(productId);
                localCart.push({ id: Date.now(), productId, quantity, Product: product });
            }
            saveLocalCart(localCart);
            cartItems = localCart;
        }
        updateCartUI();
        showToast('Đã thêm vào giỏ hàng!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function updateCartItem(itemId, quantity) {
    try {
        if (isLoggedIn()) {
            if (quantity <= 0) await cartAPI.remove(itemId);
            else await cartAPI.update(itemId, quantity);
            await loadCart();
        } else {
            let localCart = getLocalCart();
            if (quantity <= 0) localCart = localCart.filter(item => item.id !== itemId);
            else {
                const index = localCart.findIndex(item => item.id === itemId);
                if (index >= 0) localCart[index].quantity = quantity;
            }
            saveLocalCart(localCart);
            cartItems = localCart;
        }
        updateCartUI();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function removeFromCart(itemId) {
    try {
        if (isLoggedIn()) {
            await cartAPI.remove(itemId);
            await loadCart();
        } else {
            let localCart = getLocalCart();
            localCart = localCart.filter(item => item.id !== itemId);
            saveLocalCart(localCart);
            cartItems = localCart;
        }
        updateCartUI();
        showToast('Đã xóa khỏi giỏ hàng', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function getCartTotal() {
    return cartItems.reduce((total, item) => total + ((item.Product?.price || 0) * item.quantity), 0);
}

function getCartCount() {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
}

function updateCartUI() {
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        const count = getCartCount();
        cartCountEl.textContent = count;
        cartCountEl.style.display = count > 0 ? 'block' : 'none';
    }

    const cartItemsEl = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');

    if (cartItemsEl) {
        if (cartItems.length === 0) {
            cartItemsEl.innerHTML = '<div class="cart-empty"><i class="fas fa-shopping-bag"></i><p>Giỏ hàng trống</p></div>';
        } else {
            cartItemsEl.innerHTML = cartItems.map(item => {
                const p = item.Product;
                if (!p) return '';
                return `<div class="cart-item"><div class="cart-item-image"><img src="${p.image || ''}" alt="${p.name}"></div><div class="cart-item-info"><div class="cart-item-name">${p.name}</div><div class="cart-item-price">${formatPrice(p.price)}</div><div class="cart-item-quantity"><button class="quantity-btn" onclick="updateCartItem(${item.id}, ${item.quantity - 1})">-</button><span>${item.quantity}</span><button class="quantity-btn" onclick="updateCartItem(${item.id}, ${item.quantity + 1})">+</button></div></div><button class="cart-item-remove" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button></div>`;
            }).join('');
        }
    }
    if (cartTotalEl) cartTotalEl.textContent = formatPrice(getCartTotal());
}

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

document.addEventListener('DOMContentLoaded', initCart);
