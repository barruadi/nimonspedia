const CACHE_NAME = 'nimonspedia-react-v1';
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

// Push Notification Event Handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received:', event);

  let notificationData = {
    title: 'Nimons Notification',
    body: 'You have a new notification',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: 'nimons-notification',
    requireInteraction: false,
  };

  // Parse notification data if available
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[Service Worker] Push data:', data);

      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.data || {},
        requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : false,
      };

      // Add action buttons if provided
      if (data.actions && Array.isArray(data.actions)) {
        notificationData.actions = data.actions;
      }

      // Add image if provided
      if (data.image) {
        notificationData.image = data.image;
      }
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
    }
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    notificationData
  );

  event.waitUntil(promiseChain);
});

// Notification Click Event Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification.tag);

  event.notification.close();

  // Handle action button clicks
  if (event.action) {
    console.log('[Service Worker] Action clicked:', event.action);
    // Handle specific actions here
  }

  // Get the URL to open from notification data
  let urlToOpen = '/';

  if (event.notification.data && event.notification.data.url) {
    urlToOpen = event.notification.data.url;
  }

  // Open or focus the app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
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