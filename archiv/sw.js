self.addEventListener('install', e => {
    e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', e => {
    e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e => { /* Hier kann eine Offline-Strategie implementiert werden */ });