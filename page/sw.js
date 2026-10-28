// Offline once loaded. One cache per release (the build stamps VERSION), so a phone never mixes old HTML with new code.
// Required files are precached together: if any fails, this worker does not install and the previous release keeps serving.
// Card art is optional: cached in the background after activation, and on first view.
const VERSION = 'fff-v1';
const PREFIX = 'fff-';
const ENGINE_FILES = []; // the build lists the real engine's data files (lines.json, menu.json) here
const CORE = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'menu.js', 'engine/fortune.mjs', ...ENGINE_FILES,
  'fonts/fraunces.woff2', 'fonts/fraunces-italic.woff2', 'fonts/instrument-sans.woff2',
  'img/logo-ff-white.png', 'cards/back.webp',
  'cards/dish/brodo.webp', 'cards/dish/beetlejuice.webp', 'cards/dish/ichabod.webp',
  'cards/dish/hex.webp', 'cards/dish/aloo.webp', 'cards/dish/ghosted.webp',
  'cards/cats/index.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

async function cacheArt() {
  const cache = await caches.open(VERSION);
  const ids = await (await cache.match('cards/cats/index.json'))?.json().catch(() => []) || [];
  for (const id of ids) {
    const u = `cards/cats/${id}.avif`;
    if (!(await cache.match(u))) await cache.add(u).catch(() => {});
  }
}

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
  cacheArt(); // best effort, never holds up activation
});

// Cache first within the release; the network only for what the release has not cached yet (art, mostly).
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (res.ok) e.waitUntil(cache.put(request, res.clone()).catch(() => {}));
      return res;
    } catch {
      return (request.mode === 'navigate' && (await cache.match('index.html'))) || Response.error();
    }
  })());
});
