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
  event.waitUntil(Promise.all([
    event.notification.data?.receipt ? postReceipt(event.notification.data.receipt, 'opened') : Promise.resolve(),
    self.clients.openWindow('/'),
  ]));
});

async function postReceipt(receipt, event) {
  if (!receipt || typeof receipt.deliveryId !== 'string' || typeof receipt.token !== 'string') return;
  try {
    await fetch('/api/push/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId: receipt.deliveryId, token: receipt.token, event }) });
  } catch { /* Delivery remains accepted-but-unconfirmed and is visible in health. */ }
}
