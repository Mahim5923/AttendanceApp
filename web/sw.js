const CACHE_NAME = 'attendpro-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './icons/logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy to ensure latest UI updates are always loaded immediately
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firestore.googleapis.com') || 
      e.request.url.includes('firebase') || 
      e.request.url.includes('googleapis.com') ||
      e.request.url.includes('app.js') ||
      e.request.url.includes('firebase-config.js')) {
    return; // Always fetch fresh over network
  }
  e.respondWith(
    fetch(e.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => caches.match(e.request))
  );
});
