// Cache configuration
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `nimonspedia-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `nimonspedia-dynamic-${CACHE_VERSION}`;
const MAX_STATIC_CACHE_SIZE = 50;
const MAX_DYNAMIC_CACHE_SIZE = 30;
const DYNAMIC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Essential static assets to cache on install
const urlsToCache = [
  '/uploads/logo-192.png'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching essential static assets');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Helper: Check if cached response is still fresh
function isCacheFresh(response, ttl) {
  if (!response) return false;
  
  const cachedTime = response.headers.get('sw-cached-time');
  if (!cachedTime) return false;
  
  const age = Date.now() - parseInt(cachedTime, 10);
  return age < ttl;
}

// Helper: Add cache timestamp to response
function addCacheTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// Helper: Limit cache size (delete oldest entries)
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    console.log(`[SW] Cache limit exceeded (${keys.length}/${maxSize}), cleaning up...`);
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Determine caching strategy for URL
function getCacheStrategy(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  
  // STRATEGY 1: Network Only - Critical/fresh data
  const networkOnly = [
    '/api/me',
    '/api/auth/',
    '/api/login',
    '/api/logout',
    '/api/register',
    '/api/cart/count',
    '/api/balance',
  ];
  
  if (networkOnly.some(path => pathname.includes(path))) {
    return 'network-only';
  }
  
  // STRATEGY 2: Stale-While-Revalidate - Dynamic content with short TTL
  const staleWhileRevalidate = [
    '/api/products',
    '/api/categories',
    '/api/stores',
    '/api/orders',
  ];
  
  // Only apply to API calls without query params (except pagination/filters)
  if (staleWhileRevalidate.some(path => pathname.startsWith(path))) {
    // Allow basic query params like page, limit, but not cacheBuster
    if (!urlObj.searchParams.has('_')) {
      return 'stale-while-revalidate';
    }
  }
  
  // STRATEGY 3: Cache First - Static assets
  const staticExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', 
    '.css', '.woff', '.woff2', '.ttf', '.eot'
  ];
  
  if (staticExtensions.some(ext => pathname.endsWith(ext))) {
    return 'cache-first';
  }
  
  // STRATEGY 4: Network Only for cacheBuster and dynamic content
  if (urlObj.search.includes('_=') || 
      pathname.startsWith('/pages/') || 
      pathname.startsWith('/script/') ||
      pathname.endsWith('.html') ||
      pathname.endsWith('.js')) {
    return 'network-only';
  }
  
  // Default: network-only
  return 'network-only';
}

// Fetch event with smart hybrid caching
self.addEventListener('fetch', (event) => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  const strategy = getCacheStrategy(event.request.url);
  
  // STRATEGY 1: Network Only
  if (strategy === 'network-only') {
    event.respondWith(
      fetch(event.request)
        .catch((error) => {
          console.error('[SW] Network error:', error);
          // Return error response
          return new Response(
            JSON.stringify({ error: 'Network unavailable', authenticated: false }),
            { 
              status: 503, 
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        })
    );
    return;
  }
  
  // STRATEGY 2: Cache First (static assets)
  if (strategy === 'cache-first') {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(event.request).then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(event.request, networkResponse.clone());
              limitCacheSize(STATIC_CACHE, MAX_STATIC_CACHE_SIZE);
            }
            return networkResponse;
          }).catch(() => {
            return new Response('Asset unavailable offline', { status: 503 });
          });
        });
      })
    );
    return;
  }
  
  // STRATEGY 3: Stale-While-Revalidate (dynamic content)
  if (strategy === 'stale-while-revalidate') {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Check if cached response is fresh
          const isFresh = cachedResponse && isCacheFresh(cachedResponse, DYNAMIC_CACHE_TTL);
          
          // Always fetch in background to update cache
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              // Add timestamp and cache
              const responseWithTimestamp = addCacheTimestamp(networkResponse.clone());
              cache.put(event.request, responseWithTimestamp);
              limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
            }
            return networkResponse;
          }).catch((error) => {
            console.warn('[SW] Network failed, using cached response:', error);
            return cachedResponse || new Response(
              JSON.stringify({ error: 'Network unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
          
          // If cache is fresh, return it immediately (but still update in background)
          if (isFresh) {
            console.log('[SW] Serving fresh cache:', event.request.url);
            return cachedResponse;
          }
          
          // If cache is stale or missing, wait for network
          console.log('[SW] Cache stale/missing, fetching:', event.request.url);
          return fetchPromise;
        });
      })
    );
    return;
  }
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
