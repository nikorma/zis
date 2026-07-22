/* Zaino in Spalla
 * Service Worker: shell offline + cache runtime per tile mappa e font.
 * Strategia:
 *  - precache dell'app shell alla install;
 *  - navigazioni: network-first con fallback alla shell in cache;
 *  - asset build (js/css/icone): cache-first;
 *  - tile OpenStreetMap: cache-first con limite (mappa semplificata offline
 *    delle zone già visitate/scaricate);
 *  - le chiamate alle API IA/TTS NON vengono mai messe in cache qui.
 */
const VERSION = 'zaino-v2';
const SHELL_CACHE = VERSION + '-shell';
const TILE_CACHE = VERSION + '-tiles';
const RUNTIME_CACHE = VERSION + '-runtime';
const MAX_TILES = 600;

const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await cache.delete(keys[0]);
    return trimCache(name, max);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mai cache per endpoint IA/TTS/serverless
  if (url.pathname.startsWith('/api/')) return;

  // Tile OpenStreetMap e foto Wikimedia: cache-first (restano offline)
  if (url.hostname.endsWith('tile.openstreetmap.org') || url.hostname === 'upload.wikimedia.org' || url.hostname === 'commons.wikimedia.org') {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) {
            cache.put(req, res.clone());
            trimCache(TILE_CACHE, MAX_TILES);
          }
          return res;
        } catch (e) {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // Navigazioni: network-first, fallback shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Tutto il resto (asset build, font, css leaflet): cache-first
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.origin === location.origin || url.hostname.includes('fonts.') || url.hostname === 'unpkg.com')) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => hit)
    )
  );
});
