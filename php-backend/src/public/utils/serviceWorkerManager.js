/**
 * Service Worker Manager
 * Handles registration and updates for the service worker
 */

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW Manager] Service workers not supported');
    return null;
  }

  try {
    // Unregister old service workers first
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('[SW Manager] Unregistered old service worker');
    }

    // Register new service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none' // Always fetch fresh service worker
    });

    console.log('[SW Manager] Service Worker registered successfully');

    // Check for updates immediately
    registration.update();

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[SW Manager] New service worker found, installing...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW Manager] New service worker installed, reloading page...');
          // New service worker available, reload the page
          window.location.reload();
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[SW Manager] Service Worker registration failed:', error);
    return null;
  }
}

export async function clearAllCaches() {
  if (!('caches' in window)) {
    console.log('[SW Manager] Cache API not supported');
    return;
  }

  try {
    const cacheNames = await caches.keys();
    console.log('[SW Manager] Clearing all caches:', cacheNames);
    
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    
    console.log('[SW Manager] All caches cleared successfully');
  } catch (error) {
    console.error('[SW Manager] Failed to clear caches:', error);
  }
}

export async function getCacheStats() {
  if (!('caches' in window)) {
    return { supported: false };
  }

  try {
    const cacheNames = await caches.keys();
    const stats = {
      supported: true,
      cacheCount: cacheNames.length,
      caches: []
    };

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      stats.caches.push({
        name: cacheName,
        entryCount: keys.length
      });
    }

    return stats;
  } catch (error) {
    console.error('[SW Manager] Failed to get cache stats:', error);
    return { supported: true, error: error.message };
  }
}

// Auto-register on import (for pushNotification.js compatibility)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Don't auto-register, let components do it explicitly
}
