// APEX Mobile Service Worker for Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push events (if Web Push server is configured)
self.addEventListener('push', (event) => {
  let data = {
    title: '🚨 APEX Incident Alert',
    body: 'A critical service incident was detected.',
    tag: 'apex-incident',
    url: '/',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [300, 100, 300, 100, 400],
    tag: data.tag || 'apex-incident',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'investigate', title: '🔍 Investigate' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle tap on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus if already open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
