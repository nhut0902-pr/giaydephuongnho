const API_URL = '/api';

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

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Đã xảy ra lỗi');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

// Auth API
const authAPI = {
    login: (email, password) => api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
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

    add: (productId, quantity = 1) => api('/cart', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity })
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
    }
};
