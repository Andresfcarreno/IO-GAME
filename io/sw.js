/* IO — service worker: app shell offline + share target (pantallazos/recibos desde Android) */
const VERSION = 'io-v6.0.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'ai.js', 'store.js', 'importer.js', 'game.js', 'onboarding.js', 'avatar.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];
const SHARE_CACHE = 'io-share';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Share target: Android "Compartir → IO" con un pantallazo, PDF, CSV o texto
  if (e.request.method === 'POST' && url.pathname.endsWith('/io/share')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const cache = await caches.open(SHARE_CACHE);
      const text = [form.get('title'), form.get('text'), form.get('url')].filter(Boolean).join('\n');
      await cache.put('shared-text', new Response(text));
      const file = form.get('file');
      if (file && typeof file !== 'string') {
        await cache.put('shared-file', new Response(file, {
          headers: { 'content-type': file.type || 'application/octet-stream', 'x-name': encodeURIComponent(file.name || 'archivo') }
        }));
      } else {
        await cache.delete('shared-file');
      }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;
  // Solo el shell propio; nunca cachear Supabase, Anthropic, Sheets ni CDNs de datos
  if (url.origin !== self.location.origin || !url.pathname.includes('/io/')) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdn.jsdelivr.net') {
      e.respondWith(caches.open(VERSION).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }));
    }
    return;
  }

  // Network-first para que las actualizaciones lleguen rápido; caché si no hay red
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(VERSION)).put(e.request, res.clone());
      return res;
    } catch {
      const hit = await caches.match(e.request, { ignoreSearch: true });
      return hit || caches.match('index.html');
    }
  })());
});
