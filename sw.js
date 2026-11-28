// Service worker: caches the whole study app so it works offline after the first visit.
const CACHE = 'la-lh-study-v4';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './assets/icon.png',
  './data/lessons.js',
  './data/content.js',
  './data/games.js',
  './js/core/store.js',
  './js/core/learning.js',
  './js/core/content-index.js',
  './js/core/planner.js',
  './js/ui/components.js',
  './js/ui/screens-core.js',
  './js/ui/screens-study.js',
  './js/ui/screens-games.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so content corrections show up right away; the cache is the offline fallback.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok && sameOrigin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
