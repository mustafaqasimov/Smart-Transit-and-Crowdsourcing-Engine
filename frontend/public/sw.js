// YolBaku service worker: installable app shell. Live API data is never cached.
const CACHE = 'yolbaku-shell-v1';
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/favicon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) return;
  if (event.request.mode === 'navigate') {
    // Network first so a new release shows up at once; the cached shell covers offline starts.
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put('/', copy));
      return response;
    }).catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    // Vite asset names are content-hashed, so a cached file never goes stale.
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
      return response;
    })));
  }
});
