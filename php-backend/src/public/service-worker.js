const CACHE_NAME = 'nimonspedia-v1';
const urlsToCache = [
  '/',
  '/styles/main.css',
  '/uploads/logo-192.png'
];

// Install event - cache assets
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
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
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
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response from cache
        if (response) {
          return response;
        }
        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Return a custom offline page if available
        return caches.match('/offline.html');
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');

  let notificationData = {
    title: 'Nimonspedia',
    body: 'Anda mendapat notifikasi baru',
    icon: '/uploads/logo-192.png',
    badge: '/uploads/badge-96.png',
    url: '/'
  };

  if (event.data) {
    try {
      let data;
      try {
        data = event.data.json();
      } catch (jsonError) {
        const text = event.data.text();
        console.log('[Service Worker] Received text payload:', text);
        notificationData.body = text;
        data = null;
      }

      if (data) {
        notificationData = {
          title: data.title || notificationData.title,
          body: data.body || notificationData.body,
          icon: data.icon || notificationData.icon,
          badge: data.badge || notificationData.badge,
          url: data.url || notificationData.url,
          data: {
            url: data.url || notificationData.url,
            timestamp: data.timestamp || Date.now(),
            notificationType: data.notificationType
          }
        };
      }
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [200, 100, 200],
    tag: 'nimonspedia-notification',
    requireInteraction: false,
    data: notificationData.data,
    actions: [
      {
        action: 'open',
        title: 'Buka',
        icon: '/uploads/open-icon.png'
      },
      {
        action: 'close',
        title: 'Tutup',
        icon: '/uploads/close-icon.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  
  // Handle action buttons
  if (event.action === 'close') {
    return;
  }

  // Open or focus the target URL
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Check if there's already a window open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        const clientUrl = new URL(client.url);
        const targetUrlObj = new URL(targetUrl, self.location.origin);
        
        if (clientUrl.pathname === targetUrlObj.pathname && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Notification close event - handle notification dismissal
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed');
  // You can track analytics here if needed
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
