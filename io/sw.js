/* IO — service worker: la app funciona sin conexión. */
const VERSION = 'io-v7.0.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'store.js', 'world.js', 'habits.js', 'engine.js', 'focus.js', 'onboarding.js', 'avatar.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.includes('/io/')) return;
  // red primero para que las actualizaciones lleguen; caché si no hay conexión
  e.respondWith(fetch(e.request).then(async r => { if (r.ok) (await caches.open(VERSION)).put(e.request, r.clone()); return r; })
    .catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || caches.match('index.html')));
});
