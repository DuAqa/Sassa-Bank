// Sassa Bank — Service Worker
// • App shell: cache-first (abre instantâneo e funciona offline).
// • Fontes do Google: stale-while-revalidate.
// • Chamadas ao Apps Script (POST) NUNCA passam pelo cache: os dados offline
//   ficam no localStorage + outbox, controlados pelo DataService.
// Ao publicar uma versão nova, aumente CACHE_VERSION.
const CACHE_VERSION = 'sassa-v1.0.0';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const FONT_CACHE = 'sassa-fonts';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './js/utils.js',
  './js/state.js',
  './js/finance.js',
  './js/data/localStore.js',
  './js/data/remoteApi.js',
  './js/data/auth.js',
  './js/data/dataService.js',
  './js/data/demo.js',
  './js/ui/components.js',
  './js/ui/charts.js',
  './js/ui/flows.js',
  './js/ui/views/shared.js',
  './js/ui/views/home.js',
  './js/ui/views/extrato.js',
  './js/ui/views/analise.js',
  './js/ui/views/metas.js',
  './js/ui/views/ajustes.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POSTs (sincronização) vão direto para a rede
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return; // Google Sign-In etc.

  if (req.mode === 'navigate') {
    // Navegação: tenta a rede (versão nova), cai no cache se offline.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html')),
    );
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
