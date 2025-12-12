const CACHE_NAME = 'nimonspedia-react-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo-192.png'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[Service Worker] Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  // Don't cache JavaScript files or API calls
  const url = new URL(event.request.url);
  const shouldNotCache =
    url.pathname.endsWith('.js') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/assets/');

  if (shouldNotCache) {
    // Always fetch fresh for JS files and API calls
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        return caches.match('/index.html');
      })
  );
});

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received:', event);

  let notificationData = {
    title: 'Nimonspedia',
    body: 'You have a new notification',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: 'default',
    data: {},
    type: 'general'
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      console.log('[Service Worker] Parsed notification data:', payload);

      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        data: payload.data || {},
        type: payload.data?.type || payload.notificationType || 'general',
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || []
      };
    }
  } catch (error) {
    console.error('[Service Worker] Error parsing push notification:', error);
  }

  console.log('[Service Worker] Showing notification:', notificationData.title);

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: {
        ...notificationData.data,
        type: notificationData.type
      },
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      vibrate: [200, 100, 200]
    }
  ).then(() => {
    console.log('[Service Worker] Notification displayed successfully');
  }).catch((error) => {
    console.error('[Service Worker] Error displaying notification:', error);
  });

  event.waitUntil(promiseChain);
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification);
  console.log('[Service Worker] Notification data:', event.notification.data);

  event.notification.close();

  const notificationData = event.notification.data || {};
  let urlToOpen = '/';

  // Determine URL based on notification type
  if (notificationData.type === 'chat' && notificationData.storeId && notificationData.buyerId) {
    urlToOpen = `/chat/${notificationData.storeId}/${notificationData.buyerId}`;
  } else if (notificationData.type === 'auction' && notificationData.auctionId) {
    urlToOpen = `/auction/${notificationData.auctionId}`;
  } else if (notificationData.type === 'order' && notificationData.orderId) {
    urlToOpen = `/orders?id=${notificationData.orderId}`;
  } else if (notificationData.url) {
    urlToOpen = notificationData.url;
  }

  console.log('[Service Worker] Opening URL:', urlToOpen);

  // Open or focus the client window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(client => {
              if ('navigate' in client) {
                return client.navigate(urlToOpen);
              }
            });
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          console.log('[Service Worker] Opening new window:', urlToOpen);
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('[Service Worker] Error handling notification click:', error);
      })
  );
});