const cacheName = 'path-calendar-rehearsal-BUILD_HASH';
const files = PRECACHE_FILES;
const paths = new Set(files.map(f => new URL(f, self.registration.scope).pathname));
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // Keep the loopback / Wi-Fi server's connection queue small on first install.
    for (let i = 0; i < files.length; i += 4) await cache.addAll(files.slice(i, i + 4));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith('path-calendar-rehearsal-') && name !== cacheName) await caches.delete(name);
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  if (paths.has(path)) event.respondWith(caches.open(cacheName).then(cache => cache.match(path)).then(hit => hit || fetch(event.request)));
});
