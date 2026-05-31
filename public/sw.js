// Service Worker for Push Notifications only.
// Keep fetch handling out to avoid network interception regressions.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Allow immediate activation from the page.
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Push event - receive notification
self.addEventListener('push', (event) => {
    console.log('Push received:', event);

    let data = {
        title: 'Giay Dep Huong Nho',
        body: 'Ban co thong bao moi!',
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
            { action: 'close', title: 'Dong' }
        ],
        requireInteraction: true,
        tag: data.tag || 'notification-' + Date.now()
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';
    if (event.action === 'close') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                if (clients.openWindow) return clients.openWindow(urlToOpen);
            })
    );
});

self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event);
});
