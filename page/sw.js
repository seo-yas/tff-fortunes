// Offline once loaded: precache the page, engine and deck; then stale-while-revalidate for same-origin GETs.
const VERSION = 'fff-v1';
const CORE = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'menu.js', 'engine/fortune.mjs',
  'fonts/fraunces.woff2', 'fonts/fraunces-italic.woff2', 'fonts/instrument-sans.woff2',
  'img/logo-ff-white.png', 'cards/back.webp',
  'cards/dish/brodo.webp', 'cards/dish/beetlejuice.webp', 'cards/dish/ichabod.webp',
  'cards/dish/hex.webp', 'cards/dish/aloo.webp', 'cards/dish/ghosted.webp',
  'cards/cats/index.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    // Engine side files (lines.json, menu.json) and cat art: best effort, never blocks install.
    const extra = ['engine/lines.json', 'engine/menu.json'];
    try {
      const ids = await (await fetch('cards/cats/index.json')).json();
      ids.forEach((id) => extra.push(`cards/cats/${id}.avif`));
    } catch {}
    await Promise.all(extra.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });
    const net = fetch(request).then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || (request.mode === 'navigate' ? cache.match('index.html') : Response.error());
  })());
});
