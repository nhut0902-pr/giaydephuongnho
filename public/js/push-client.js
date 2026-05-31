// Push Notification Client
// Giày Dép Hương Nhớ

const PushClient = {
    vapidPublicKey: null,
    swRegistration: null,
    swUrl: '/sw.js?v=20260220-3',

    async cleanupLegacyServiceWorkers() {
        if (!('serviceWorker' in navigator)) return;
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(async (reg) => {
            const scriptURL = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
            if (!scriptURL.includes(this.swUrl)) {
                await reg.unregister();
            }
        }));
    },

    async init() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return false;
        }

        try {
            await this.cleanupLegacyServiceWorkers();

            this.swRegistration = await navigator.serviceWorker.register(this.swUrl, {
                scope: '/',
                updateViaCache: 'none'
            });
            console.log('Service Worker registered');

            if (this.swRegistration.waiting) {
                this.swRegistration.waiting.postMessage('SKIP_WAITING');
            }
            await this.swRegistration.update().catch(() => { });

            const response = await fetch(`${API_URL}/push/vapid-public-key`);
            const data = await response.json();
            this.vapidPublicKey = data.publicKey;

            return true;
        } catch (error) {
            console.error('Push init error:', error);
            return false;
        }
    },

    async isSubscribed() {
        if (!this.swRegistration) return false;
        const subscription = await this.swRegistration.pushManager.getSubscription();
        return !!subscription;
    },

    async requestPermission() {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    },

    async subscribe(role = 'customer') {
        try {
            const permission = await this.requestPermission();
            if (!permission) {
                console.log('Notification permission denied');
                return null;
            }

            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/push/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    role
                })
            });

            if (!response.ok) {
                throw new Error('Subscription failed');
            }

            console.log('Push subscription successful');
            return subscription;
        } catch (error) {
            console.error('Subscribe error:', error);
            return null;
        }
    },

    async unsubscribe() {
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();

                await fetch(`${API_URL}/push/unsubscribe`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });

                console.log('Unsubscribed successfully');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Unsubscribe error:', error);
            return false;
        }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // Mandatory permission popup — no dismiss, must accept
    showPermissionPopup() {
        // If already showing, don't duplicate
        if (document.getElementById('push-permission-popup')) return;

        const popup = document.createElement('div');
        popup.id = 'push-permission-popup';
        popup.innerHTML = `
            <div class="push-popup-overlay">
                <div class="push-popup">
                    <div class="push-popup-icon">🔔</div>
                    <h3>Bật thông báo để cập nhật!</h3>
                    <p>Bạn cần bật thông báo để nhận cập nhật đơn hàng, sản phẩm mới và khuyến mãi hấp dẫn.</p>
                    <div class="push-popup-badge">⚠️ Bắt buộc</div>
                    <div class="push-popup-actions">
                        <button id="push-accept-btn" class="btn btn-primary" onclick="PushClient.acceptPush()">🔔 Đồng ý bật thông báo</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        const style = document.createElement('style');
        style.id = 'push-popup-style';
        style.textContent = `
            .push-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            }
            .push-popup {
                background: white;
                padding: 2rem;
                border-radius: 1.2rem;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.35);
                animation: slideUp 0.3s ease;
            }
            .push-popup-icon {
                font-size: 3.5rem;
                margin-bottom: 0.75rem;
            }
            .push-popup h3 {
                margin: 0 0 0.5rem;
                color: #1A1135;
                font-size: 1.2rem;
            }
            .push-popup p {
                color: #666;
                margin-bottom: 1rem;
                font-size: 0.92rem;
                line-height: 1.5;
            }
            .push-popup-badge {
                display: inline-block;
                background: #FEF3C7;
                color: #92400E;
                padding: 0.35rem 1rem;
                border-radius: 2rem;
                font-size: 0.82rem;
                font-weight: 700;
                margin-bottom: 1.2rem;
            }
            .push-popup-actions {
                display: flex;
                justify-content: center;
            }
            .push-popup-actions .btn {
                padding: 0.85rem 2rem;
                border-radius: 0.75rem;
                cursor: pointer;
                font-weight: 700;
                font-size: 0.95rem;
                border: none;
                background: linear-gradient(135deg, #A948C8, #4B61B5);
                color: white;
                transition: transform 0.15s;
            }
            .push-popup-actions .btn:hover {
                transform: scale(1.03);
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        if (!document.getElementById('push-popup-style')) {
            document.head.appendChild(style);
        }
    },

    async acceptPush() {
        const btn = document.getElementById('push-accept-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⌛ Đang xử lý...';
            btn.style.opacity = '0.7';
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const role = user.role === 'admin' ? 'admin' : 'customer';

        const result = await this.subscribe(role);
        if (result) {
            this.dismissPopup();
            if (typeof showToast === 'function') {
                showToast('Đã bật thông báo thành công!', 'success');
            }
        } else {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔔 Đồng ý bật thông báo';
                btn.style.opacity = '1';
            }
            // Permission denied by browser — show a help message
            if (Notification.permission === 'denied') {
                if (typeof showToast === 'function') {
                    showToast('Trình duyệt đã chặn thông báo. Vui lòng bật lại trong cài đặt.', 'warning', { duration: 6000 });
                }
                this.dismissPopup(); // Can't do anything if browser blocked
            }
        }
    },

    dismissPopup() {
        const popup = document.getElementById('push-permission-popup');
        if (popup) popup.remove();
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Push] Starting initialization...');

    const initialized = await PushClient.init();
    console.log('[Push] Initialized:', initialized);

    if (initialized) {
        const isSubscribed = await PushClient.isSubscribed();
        console.log('[Push] Is subscribed:', isSubscribed);

        if (!isSubscribed && Notification.permission !== 'denied') {
            // Show mandatory popup after 2 seconds
            setTimeout(() => {
                PushClient.showPermissionPopup();
            }, 2000);
        }
    }
});
