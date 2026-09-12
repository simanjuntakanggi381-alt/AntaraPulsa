const CACHE = 'antarapulsa-shell-v28';
const SHELL = ['/', '/manifest.webmanifest', '/assets/brand-mark.png', '/assets/provider-indosat.png', '/assets/provider-biznet-bmark-2026.png', '/assets/provider-iconnet-symbol.png', '/assets/provider-pln.png', '/assets/provider-brizzi.png', '/assets/provider-dana.png', '/assets/provider-emoney-mandiri.png', '/assets/provider-gopay.png', '/assets/provider-grab.png', '/assets/provider-isaku.png', '/assets/provider-kaspro.png', '/assets/provider-linkaja.png', '/assets/provider-maxim.png', '/assets/provider-ovo.png', '/assets/provider-sakuku.png', '/assets/provider-shopeepay.png', '/assets/provider-tapcash.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
