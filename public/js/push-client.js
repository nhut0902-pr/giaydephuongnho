// Push Notification Client
// Giày Dép Hương Nhớ

const PushClient = {
    vapidPublicKey: null,
    swRegistration: null,

    // Initialize push notifications
    async init() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return false;
        }

        try {
            // Register service worker
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');

            // Get VAPID public key
            const response = await fetch('/api/push/vapid-public-key');
            const data = await response.json();
            this.vapidPublicKey = data.publicKey;

            return true;
        } catch (error) {
            console.error('Push init error:', error);
            return false;
        }
    },

    // Check if already subscribed
    async isSubscribed() {
        if (!this.swRegistration) return false;
        const subscription = await this.swRegistration.pushManager.getSubscription();
        return !!subscription;
    },

    // Request notification permission
    async requestPermission() {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    },

    // Subscribe to push notifications
    async subscribe(role = 'customer') {
        try {
            const permission = await this.requestPermission();
            if (!permission) {
                console.log('Notification permission denied');
                return null;
            }

            // Convert VAPID key
            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

            // Subscribe
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            // Send subscription to server
            const token = localStorage.getItem('token');
            const response = await fetch('/api/push/subscribe', {
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

    // Unsubscribe from push notifications
    async unsubscribe() {
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();

                await fetch('/api/push/unsubscribe', {
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

    // Helper: Convert VAPID key
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

    // Show permission popup
    showPermissionPopup() {
        // Check if already shown or subscribed
        if (localStorage.getItem('push_popup_shown') === 'true') {
            return;
        }

        // Create popup
        const popup = document.createElement('div');
        popup.id = 'push-permission-popup';
        popup.innerHTML = `
            <div class="push-popup-overlay">
                <div class="push-popup">
                    <div class="push-popup-icon">🔔</div>
                    <h3>Nhận thông báo?</h3>
                    <p>Bạn sẽ được thông báo khi có khuyến mãi mới, sản phẩm mới và cập nhật đơn hàng!</p>
                    <div class="push-popup-actions">
                        <button class="btn btn-secondary" onclick="PushClient.dismissPopup()">Để sau</button>
                        <button class="btn btn-primary" onclick="PushClient.acceptPush()">Đồng ý</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .push-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            }
            .push-popup {
                background: white;
                padding: 2rem;
                border-radius: 1rem;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            }
            .push-popup-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
            }
            .push-popup h3 {
                margin: 0 0 0.5rem;
                color: #333;
            }
            .push-popup p {
                color: #666;
                margin-bottom: 1.5rem;
                font-size: 0.95rem;
            }
            .push-popup-actions {
                display: flex;
                gap: 1rem;
                justify-content: center;
            }
            .push-popup-actions .btn {
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                cursor: pointer;
                font-weight: 600;
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
        document.head.appendChild(style);
    },

    // Accept push notifications
    async acceptPush() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const role = user.role === 'admin' ? 'admin' : 'customer';

        await this.subscribe(role);
        this.dismissPopup();
        localStorage.setItem('push_popup_shown', 'true');

        if (typeof showToast === 'function') {
            showToast('Đã bật thông báo!', 'success');
        }
    },

    // Dismiss popup
    dismissPopup() {
        const popup = document.getElementById('push-permission-popup');
        if (popup) popup.remove();
        localStorage.setItem('push_popup_shown', 'true');
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const initialized = await PushClient.init();
    if (initialized) {
        const isSubscribed = await PushClient.isSubscribed();
        if (!isSubscribed && Notification.permission !== 'denied') {
            // Show popup after 3 seconds
            setTimeout(() => {
                PushClient.showPermissionPopup();
            }, 3000);
        }
    }
});
