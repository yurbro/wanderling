/*
 * Wanderling service worker: once the page has loaded once, it opens again
 * without a network. Hashed assets are cached for good, the page itself is
 * fetched fresh when possible and served from the cache when not. Weather
 * requests are never cached here (the app keeps its own forecast cache).
 *
 * The version placeholder is stamped at build time (tools/stamp-sw.cjs) so
 * every deploy gets a fresh cache and old ones are dropped.
 */
const VERSION = '__VERSION__';
const CACHE = `wanderling-${VERSION}`;
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wanderling-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The page: network first, so a new deploy shows up; cache when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }

  // Hashed build assets never change under the same name: cache first.
  const isAsset = url.pathname.includes('/assets/');
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && isAsset) return cached;
      const fetched = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      // Everything else: serve the cache at once and refresh it in the background.
      return cached ? Promise.resolve(cached).then((c) => (fetched.catch(() => {}), c)) : fetched;
    }),
  );
});
