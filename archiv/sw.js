// Version erhöhen bei jedem Deploy
const APP_VERSION = 'v1.2.1';
const CACHE_NAME = `portfolio-cache-${APP_VERSION}`;
const API_CACHE_NAME = 'api-cache-v1';       // New cache for API data
const urlsToCache = [
  './',
  './index.html',
  `./style.css?v=${APP_VERSION}`,
  `./script.js?v=${APP_VERSION}`,
  './manifest.json',
  './icon.svg'
];

// Install: Cache the app shell and activate immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active one.
  );
});

// Activate: Clean up old caches and take control
self.addEventListener('activate', event => {
  event.waitUntil(
      caches.keys().then(cacheNames => {
          return Promise.all(
              cacheNames
                  .filter(cacheName => cacheName.startsWith('portfolio-cache-') && cacheName !== CACHE_NAME)
                  .map(cacheName => caches.delete(cacheName))
          );
      }).then(() => self.clients.claim())
  );
});

// Fetch: Intercept network requests
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API Caching Strategy: Stale-while-revalidate
  // Cache both CoinGecko and Google Sheets API calls
  if (url.href.includes('api.coingecko.com') || url.href.includes('docs.google.com') || url.href.includes('alphavantage.co')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(cache => {
        return cache.match(request).then(async (cachedResponse) => {
          // NEU: Cache-Gültigkeit prüfen, um unnötige Anfragen zu vermeiden
          if (cachedResponse) {
            const dateHeader = cachedResponse.headers.get('date');
            if (dateHeader) {
              const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
              const maxAgeSeconds = 6 * 60 * 60; // 6 Stunden

              // Cache ist frisch, direkt zurückgeben und keine neue Anfrage stellen.
              if (age < maxAgeSeconds) {
                return cachedResponse;
              }
            }
          }

          // Stale-While-Revalidate Logik (wie bisher)
          const fetchPromise = fetch(request).then(networkResponse => {
            if (networkResponse.ok) cache.put(request, networkResponse.clone());
            return networkResponse;
          });

          return cachedResponse || fetchPromise; // Gebe alte Daten zurück, während im Hintergrund neue geladen werden
        });
      })
    );
    return;
  }

  // App Shell Caching Strategy: Cache-first
  event.respondWith(caches.match(request).then(response => response || fetch(request)));
});

// NEU: Listener für Nachrichten von der Hauptanwendung
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'clearApiCache') {
    console.log('SW: API-Cache wird geleert...');
    caches.delete(API_CACHE_NAME).then(() => {
      console.log('SW: API-Cache erfolgreich gelöscht.');
      // Benachrichtige alle offenen Clients über den Erfolg
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ status: 'apiCacheCleared' }));
      });
    });
  }
});