const APP_CACHE_NAME = 'portfolio-tracker-v2'; // Updated version for the app shell
const API_CACHE_NAME = 'api-cache-v1';       // New cache for API data
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg'
];

// Install: Cache the app shell and activate immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active one.
  );
});

// Activate: Clean up old caches and take control
self.addEventListener('activate', event => {
  const cacheWhitelist = [APP_CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all clients
  );
});

// Fetch: Intercept network requests
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API Caching Strategy: Stale-while-revalidate
  if (url.href.includes('api.coingecko.com')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          const fetchPromise = fetch(request).then(networkResponse => {
            if (networkResponse.ok) cache.put(request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // App Shell Caching Strategy: Cache-first
  event.respondWith(caches.match(request).then(response => response || fetch(request)));
});