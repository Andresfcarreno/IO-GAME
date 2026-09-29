/* IO — service worker: la app funciona sin conexión. */
const VERSION = 'io-v11.2.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'store.js', 'world.js', 'habits.js', 'engine.js', 'focus.js', 'onboarding.js', 'avatar.js', 'ui.js', 'lower.js', 'ranking.js', 'config.js', 'scenes.js', 'radio.js', 'remind.js', 'share.js', 'pet.js', 'social.js', 'coach.js', 'weather.js',
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
// tocar una notificación abre IO (o la trae al frente) y arranca el hábito
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(w => w.url.includes('/io/'));
    if (c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return clients.openWindow(url);
  }));
});
