// Keep the frontend pointed at the currently deployed API worker.
// This value must match the backend deployment in wrangler.toml.
const API_URL = window.API_URL || 'https://giaydephuongnho-api.lamminhnhut09022011.workers.dev/api';
window.API_URL = API_URL;

// API Helper Functions
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    let data = null;
    let rawText = '';

    if (contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch (e) {
            data = null;
        }
    } else {
        rawText = await response.text();
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Token invalid or expired
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.authAPI && window.updateAuthUI) {
                window.updateAuthUI();
            }
            throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        }

        const textError = rawText && !rawText.trim().startsWith('<') ? rawText.trim() : '';
        throw new Error((data && data.error) || textError || `Yêu cầu thất bại (${response.status})`);
    }

    if (data !== null) return data;

    // Backend should return JSON for API endpoints. If HTML is returned,
    // it's usually an old server process or missing route after deploy.
    if (rawText.trim().startsWith('<')) {
        throw new Error('API trả về HTML thay vì JSON. Vui lòng khởi động lại server để nạp route mới.');
    }

    if (!rawText.trim()) return {};

    try {
        return JSON.parse(rawText);
    } catch (e) {
        return { message: rawText };
    }
}

// Auth API
const authAPI = {
    login: (email, password, recaptchaToken) => api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, recaptchaToken })
    }),

    register: (data) => api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    getProfile: () => api('/auth/profile'),

    updateProfile: (data) => api('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
    })
};

// Products API
const productsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api(`/products${query ? '?' + query : ''}`);
    },

    getById: (id) => api(`/products/${id}`),

    getCategories: () => api('/products/categories'),

    create: (data) => api('/products', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    update: (id, data) => api(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    delete: (id) => api(`/products/${id}`, {
        method: 'DELETE'
    })
};

// Cart API
const cartAPI = {
    get: () => api('/cart'),

    add: (productId, quantity = 1, size = null, color = null) => api('/cart', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity, size, color })
    }),

    update: (id, quantity) => api(`/cart/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity })
    }),

    remove: (id) => api(`/cart/${id}`, {
        method: 'DELETE'
    }),

    clear: () => api('/cart', {
        method: 'DELETE'
    })
};

// Orders API
const ordersAPI = {
    getAll: () => api('/orders'),

    getById: (id) => api(`/orders/${id}`),

    create: (data) => api('/orders', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    // Customer return request
    requestReturn: (id, reason) => api(`/orders/${id}/return`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    }),

    // Admin approve/reject return
    adminReturnAction: (id, action, zaloLink) => api(`/orders/admin/${id}/return-action`, {
        method: 'POST',
        body: JSON.stringify({ action, zaloLink })
    }),

    updateStatus: (id, status) => api(`/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    }),

    cancel: (id) => api(`/orders/${id}`, {
        method: 'DELETE'
    })
};

// Discounts API
const discountsAPI = {
    validate: (code, total) => api('/discounts/validate', {
        method: 'POST',
        body: JSON.stringify({ code, total })
    }),

    getAll: () => api('/discounts'),

    create: (data) => api('/discounts', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    update: (id, data) => api(`/discounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    delete: (id) => api(`/discounts/${id}`, {
        method: 'DELETE'
    })
};

// Admin API
const adminAPI = {
    getStats: () => api('/admin/stats'),

    getNotifications: () => api('/admin/notifications'),

    markAsRead: (id) => api(`/admin/notifications/${id}/read`, {
        method: 'PUT'
    }),

    markAllAsRead: () => api('/admin/notifications/read-all', {
        method: 'PUT'
    }),

    getOrders: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api(`/admin/orders${query ? '?' + query : ''}`);
    },

    getMarketingConfig: () => api('/marketing/admin'),

    saveMarketingConfig: (data) => api('/marketing/admin', {
        method: 'PUT',
        body: JSON.stringify(data)
    })
};

const reviewsAPI = {
    getByProduct: (productId) => api(`/reviews/${productId}`),
    create: (data) => api('/reviews', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    vote: (reviewId, vote) => api(`/reviews/${reviewId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote })
    })
};

const blogAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api(`/blog${query ? '?' + query : ''}`);
    },
    getBySlug: (slug) => api(`/blog/${slug}`),
    getCategories: () => api('/blog/categories'),
    adminGetAll: () => api('/blog/admin/all'),
    create: (data) => api('/blog', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    update: (id, data) => api(`/blog/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    delete: (id) => api(`/blog/${id}`, {
        method: 'DELETE'
    })
};
