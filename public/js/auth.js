// Auth State Management
let currentUser = null;

// Initialize Auth
function initAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        try {
            currentUser = JSON.parse(user);
            updateAuthUI();
        } catch (e) {
            logout();
        }
    } else {
        updateAuthUI();
    }
}

// Update Auth UI
function updateAuthUI() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;

    if (currentUser) {
        authSection.innerHTML = `
      <div class="user-menu">
        <button class="user-btn" onclick="toggleUserMenu()">
          <i class="fas fa-user-circle"></i>
          <span>${currentUser.name}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div class="user-dropdown" id="user-dropdown">
          <a href="/orders.html"><i class="fas fa-box"></i> Đơn Hàng</a>
          <a href="/profile.html"><i class="fas fa-user"></i> Tài Khoản</a>
          ${currentUser.role === 'admin' ? '<a href="/admin/"><i class="fas fa-cog"></i> Quản Trị</a>' : ''}
          <button onclick="logout()"><i class="fas fa-sign-out-alt"></i> Đăng Xuất</button>
        </div>
      </div>
    `;
    } else {
        authSection.innerHTML = `
      <a href="/login.html" class="auth-btn">Đăng Nhập</a>
    `;
    }
}

// Toggle User Menu
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown');
    const userBtn = e.target.closest('.user-btn');

    if (dropdown && !userBtn) {
        dropdown.classList.remove('active');
    }
});

// Login
async function login(email, password) {
    try {
        const data = await authAPI.login(email, password);

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;

        // Sync local cart to server
        await syncLocalCartToServer();

        showToast('Đăng nhập thành công!', 'success');
        updateAuthUI();

        // Redirect to home or previous page
        const redirect = sessionStorage.getItem('redirectAfterLogin');
        if (redirect) {
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirect;
        } else if (currentUser.role === 'admin') {
            window.location.href = '/admin/';
        } else {
            window.location.href = '/';
        }

        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// Register
async function register(data) {
    try {
        const result = await authAPI.register(data);

        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        currentUser = result.user;

        // Sync local cart to server
        await syncLocalCartToServer();

        showToast('Đăng ký thành công!', 'success');
        updateAuthUI();

        window.location.href = '/';

        return result;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    updateAuthUI();
    updateCartUI();
    showToast('Đã đăng xuất', 'success');

    // Redirect to home if on protected page
    if (window.location.pathname.includes('/admin') ||
        window.location.pathname.includes('/orders') ||
        window.location.pathname.includes('/profile')) {
        window.location.href = '/';
    }
}

// Check if logged in
function isLoggedIn() {
    return !!currentUser;
}

// Check if admin
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

// Require login
function requireLogin(redirectPath = null) {
    if (!isLoggedIn()) {
        if (redirectPath) {
            sessionStorage.setItem('redirectAfterLogin', redirectPath);
        }
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Require admin
function requireAdmin() {
    if (!isAdmin()) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Sync local cart to server after login
async function syncLocalCartToServer() {
    const localCart = getLocalCart();

    if (localCart.length > 0 && isLoggedIn()) {
        try {
            for (const item of localCart) {
                await cartAPI.add(item.productId, item.quantity);
            }
            clearLocalCart();
        } catch (error) {
            console.error('Error syncing cart:', error);
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAuth);
