const CACHE_NAME = 'attendpro-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/firebase-config.js',
  './js/app.js',
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Network first for Firestore / APIs, Cache first for assets
  if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('firebase')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request);
    })
  );
});
