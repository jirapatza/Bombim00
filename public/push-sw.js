self.addEventListener('push', event => {
  let message;
  try { message = event.data?.json(); } catch { return; }
  if (typeof message?.title !== 'string' || typeof message?.body !== 'string') return;
  event.waitUntil((async () => {
    // A closed tab cannot speak, so the notification itself must be audible:
    // silent:false keeps the system sound, vibrate covers phones, and the tag
    // makes a newer result replace the previous one instead of stacking.
    await self.registration.showNotification(message.title, {
      body: message.body,
      silent: false,
      vibrate: [220, 120, 220],
      tag: 'bombim00-lottery',
      renotify: true,
      timestamp: Date.now(),
      data: { receipt: message.receipt || null },
    });
    if (message.receipt) await postReceipt(message.receipt, 'received');
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    if (event.notification.data?.receipt) await postReceipt(event.notification.data.receipt, 'opened');
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(client => new URL(client.url).origin === self.location.origin);
    return open ? open.focus() : self.clients.openWindow('/');
  })());
});

// Online, everything is fetched from the network so results are never stale.
// The cache only answers when the network fails: the last app shell, the last
// runtime JSON, and a Thai "no connection" page when nothing was ever stored.
const OFFLINE_URL = '/offline.html';
const SHELL_CACHE = 'bombim00-shell-v1';
const DATA_CACHE = 'bombim00-data-v1';
const CACHES = [SHELL_CACHE, DATA_CACHE];
const SHELL_KEY = '/';

// The app appends a ?v= cache-buster, so a cached data entry is stored and read
// without the query or every poll would add another copy.
const DATA_PATHS = ['/status/status.json', '/all_lotteries.json', '/lottery_previous_results.json'];
const isRuntimeData = url => DATA_PATHS.some(path => url.pathname.endsWith(path));
const isCacheableAsset = (request, url) => url.origin === self.location.origin
  ? url.pathname.startsWith('/assets/') || ['script', 'style', 'font', 'image'].includes(request.destination)
  : url.hostname === 'fonts.gstatic.com';

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await (await caches.open(SHELL_CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(key)) || (await caches.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll([OFFLINE_URL, '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => !CACHES.includes(name)).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Never intercept the API: a cached receipt POST or health read would lie.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;
  if (isRuntimeData(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE, url.origin + url.pathname));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, SHELL_KEY)
      .catch(async () => (await caches.match(SHELL_KEY)) || caches.match(OFFLINE_URL)));
    return;
  }
  if (isCacheableAsset(request, url)) event.respondWith(cacheFirst(request));
});

async function postReceipt(receipt, event) {
  if (!receipt || typeof receipt.deliveryId !== 'string' || typeof receipt.token !== 'string') return;
  try {
    await fetch('/api/push/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId: receipt.deliveryId, token: receipt.token, event }) });
  } catch { /* Delivery remains accepted-but-unconfirmed and is visible in health. */ }
}
