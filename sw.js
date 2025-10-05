const APP_CACHE_NAME = 'portfolio-tracker-v4';
const API_CACHE_NAME = 'api-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE_NAME);
      await cache.addAll(urlsToCache);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [APP_CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return undefined;
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // HTML/Navigations-Anfragen immer netzwerk-first beantworten, damit neue Builds sofort sichtbar werden.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(handleDocumentRequest(request));
    return;
  }

  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(handleAssetRequest(request));
    return;
  }

  if (
    url.href.includes('api.coingecko.com') ||
    url.href.includes('docs.google.com') ||
    url.href.includes('alphavantage.co')
  ) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(response => response || fetch(request))
  );
});

async function handleDocumentRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(APP_CACHE_NAME);
    await cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.warn('SW: Fallback auf Cache fuer Dokument:', error);
    const cachedResponse = await caches.match(request) || await caches.match('./index.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function handleAssetRequest(request) {
  const cache = await caches.open(APP_CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    await cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.warn('SW: Fallback auf Cache fuer Asset:', error);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const maxAgeSeconds = 6 * 60 * 60;
  const isCachedFresh = (() => {
    if (!cachedResponse) return false;
    const dateHeader = cachedResponse.headers.get('date');
    if (!dateHeader) return false;
    const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
    return age < maxAgeSeconds;
  })();

  if (cachedResponse && isCachedFresh) {
    return cachedResponse;
  }

  const fetchPromise = fetch(request)
    .then(async networkResponse => {
      if (networkResponse && networkResponse.ok) {
        const inspectionClone = networkResponse.clone();
        let shouldCache = true;
        try {
          const text = await inspectionClone.text();
          const lower = text.toLowerCase();
          if (lower.includes('wird geladen') || lower.includes('loading')) {
            shouldCache = false;
            console.log('SW: Loading-Placeholder von Google Sheets wird nicht gecached.');
          }
        } catch (error) {
          console.warn('SW: Konnte API-Antwort nicht inspizieren:', error);
        }

        if (shouldCache) {
          await cache.put(request, networkResponse.clone());
        }
      }
      return networkResponse;
    })
    .catch(error => {
      console.error('SW: Netzwerkfehler bei API-Request:', error);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    });

  if (cachedResponse) {
    return cachedResponse;
  }

  return fetchPromise;
}

self.addEventListener('message', event => {
  if (event.data && event.data.action === 'clearApiCache') {
    console.log('SW: API-Cache wird geleert...');
    caches.delete(API_CACHE_NAME).then(() => {
      console.log('SW: API-Cache erfolgreich geloescht.');
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ status: 'apiCacheCleared' }));
      });
    });
  }
});
