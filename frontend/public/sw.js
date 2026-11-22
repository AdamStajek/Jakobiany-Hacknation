/* Service worker „Pole Widzenia”: powłoka aplikacji offline, ostatnie dane pól i Web Push. */
const VERSION = 'v3';
const SHELL = `pw-shell-${VERSION}`;
const PUBLIC = `pw-public-${VERSION}`;
const PRIVATE = 'pw-private-v1';
const KEEP = new Set([SHELL, PUBLIC, PRIVATE]);
const PRIVATE_API = /^\/api\/(me|fields)(\/|$)/;
const PUBLIC_API = /^\/api\/(crops|recommendations\/catalog|passport\/questions)$/;
const MAX_ENTRIES = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (!KEEP.has(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
}

async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) { await cache.put(fallbackKey ?? request, response.clone()); void trim(cache); }
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey ?? request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    const type = response.headers.get('content-type') || '';
    if (response.ok && !type.includes('text/html')) void cache.put(request, response.clone()).then(() => trim(cache));
    return response;
  });
  if (cached) { refresh.catch(() => undefined); return cached; }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, '/'));
  } else if (PRIVATE_API.test(url.pathname)) {
    event.respondWith(networkFirst(request, PRIVATE));
  } else if (PUBLIC_API.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, PUBLIC));
  } else if (!url.pathname.startsWith('/api/') && /\.(js|css|woff2?|png|jpe?g|svg|webp|ico|webmanifest|mjs)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {body: event.data?.text()}; }
  event.waitUntil(self.registration.showNotification(data.title || 'Pole Widzenia', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'pole-widzenia',
    lang: 'pl',
    vibrate: data.urgent ? [300, 120, 300, 120, 500] : [200, 100, 200],
    requireInteraction: data.urgent === true,
    renotify: true,
    timestamp: Date.now(),
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
    data: {url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/pola'},
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'later') return;
  const target = new URL(event.notification.data?.url || '/pola', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const open = windows.find((client) => client.url.startsWith(self.location.origin));
    if (open) { await open.focus(); if ('navigate' in open) await open.navigate(target); return; }
    await self.clients.openWindow(target);
  })());
});
