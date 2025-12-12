// Service Worker for Push Notifications
// Giày Dép Hương Nhớ

const CACHE_NAME = 'giaydephuongnho-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(clients.claim());
});

// Push event - receive notification
self.addEventListener('push', (event) => {
    console.log('Push received:', event);

    let data = {
        title: 'Giày Dép Hương Nhớ',
        body: 'Bạn có thông báo mới!',
        icon: '/images/logo.jpg',
        badge: '/images/badge.png',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/images/logo.jpg',
        badge: data.badge || '/images/badge.png',
        image: data.image,
        vibrate: [100, 50, 100],
        data: data.data || { url: '/' },
        actions: [
            { action: 'view', title: 'Xem ngay' },
            { action: 'close', title: 'Đóng' }
        ],
        requireInteraction: true,
        tag: data.tag || 'notification-' + Date.now()
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window open
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event);
});
