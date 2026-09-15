// Keep the frontend pointed at the currently deployed API worker.
// Public Worker: lightweight (no multer/imagekit/pdfkit) — fast cold-start
const API_URL = window.API_URL || 'https://giaydephuongnho-api.lamminhnhut09022011.workers.dev/api';
window.API_URL = API_URL;

// Admin Worker: heavy deps (multer/imagekit/pdfkit) — slower cold-start but rarely hit
const ADMIN_API_URL = window.ADMIN_API_URL || 'https://giaydephuongnho-admin-api.lamminhnhut09022011.workers.dev/api';
window.ADMIN_API_URL = ADMIN_API_URL;

// Routes that belong to admin Worker (heavy: image upload, PDF, admin stats)
function isAdminEndpoint(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    // Pure admin path prefixes
    if (/^\/admin(\/|$)/.test(endpoint)) return true;
    if (/^\/invoice(\/|$)/.test(endpoint)) return true;
    if (/^\/init-db/.test(endpoint)) return true;
    if (/^\/blog\/admin(\/|$)/.test(endpoint)) return true;
    if (/^\/orders\/admin(\/|$)/.test(endpoint)) return true;
    if (/^\/marketing\/admin/.test(endpoint)) return true;
    if (/^\/flash-sale\/admin(\/|$)/.test(endpoint)) return true;

    // Write operations (POST/PUT/DELETE) on resources that require admin
    if (method !== 'GET' && method !== 'HEAD') {
        // products POST/PUT/DELETE = admin (admin creates/edits products)
        if (/^\/products(\/|$)/.test(endpoint)) return true;
        // blog POST/PUT/DELETE = admin (admin writes blog posts)
        if (/^\/blog(\/|$)/.test(endpoint)) return true;
        // discounts POST/PUT/DELETE = admin
        if (/^\/discounts(\/|$)/.test(endpoint)) return true;
        // flash-sale POST/PUT/DELETE = admin (only admin manages sales)
        if (/^\/flash-sale(\/|$)/.test(endpoint)) return true;
        // marketing PUT = admin
        if (/^\/marketing(\/|$)/.test(endpoint)) return true;
        // push admin broadcast
        if (/^\/push\/admin(\/|$)/.test(endpoint)) return true;
        // reviews DELETE = admin (moderation)
        if (/^\/reviews(\/|$)/.test(endpoint) && method === 'DELETE') return true;
    }

    return false;
}

function resolveApiBase(endpoint, options) {
    return isAdminEndpoint(endpoint, options) ? ADMIN_API_URL : API_URL;
}

// API Helper Functions
// Có retry 1 lần nếu gặp lỗi 5xx hoặc network error (Worker cold-start)
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const hasBody = options.body !== undefined && options.body !== null;

    const config = {
        headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };

    if (hasBody) {
        config.headers['Content-Type'] = 'application/json';
    }

    const baseUrl = resolveApiBase(endpoint, options);

    const doFetch = async () => {
        const response = await fetch(`${baseUrl}${endpoint}`, config);
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

        return { response, data, rawText };
    };

    let result;
    try {
        result = await doFetch();
    } catch (networkErr) {
        // Network error (Failed to fetch) → retry 1 lần sau 1s
        await new Promise(r => setTimeout(r, 1000));
        try {
            result = await doFetch();
        } catch (retryErr) {
            throw new Error('Không kết nối được tới server. Vui lòng kiểm tra mạng và thử lại.');
        }
    }

    const { response, data, rawText } = result;

    // Lỗi 5xx → retry 1 lần (Worker cold-start có thể trả 500 tạm thời)
    if (response.status >= 500) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const retry = await doFetch();
            if (retry.response.ok) {
                return retry.data !== null ? retry.data : (retry.rawText.trim() ? JSON.parse(retry.rawText) : {});
            }
            // Vẫn lỗi → throw với thông báo thân thiện
            throw new Error('Server đang tải lại, vui lòng thử lại sau giây lát.');
        } catch (retryErr) {
            if (retryErr.message) throw retryErr;
            throw new Error('Server đang tải lại, vui lòng thử lại sau giây lát.');
        }
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
