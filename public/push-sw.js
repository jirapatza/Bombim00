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

// The app is live data, so nothing is served from a cache while online. The one
// cached page is a fallback: a lost signal should say so in Thai instead of
// showing the browser's error page.
const OFFLINE_URL = '/offline.html';
const OFFLINE_CACHE = 'bombim00-offline-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(cache => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== OFFLINE_CACHE).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});

async function postReceipt(receipt, event) {
  if (!receipt || typeof receipt.deliveryId !== 'string' || typeof receipt.token !== 'string') return;
  try {
    await fetch('/api/push/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId: receipt.deliveryId, token: receipt.token, event }) });
  } catch { /* Delivery remains accepted-but-unconfirmed and is visible in health. */ }
}
