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

// No respondWith: every request stays on the network. The listener exists so the
// browser treats this as the app's service worker and offers "install app".
self.addEventListener('fetch', () => {});

async function postReceipt(receipt, event) {
  if (!receipt || typeof receipt.deliveryId !== 'string' || typeof receipt.token !== 'string') return;
  try {
    await fetch('/api/push/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId: receipt.deliveryId, token: receipt.token, event }) });
  } catch { /* Delivery remains accepted-but-unconfirmed and is visible in health. */ }
}
