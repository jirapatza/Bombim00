self.addEventListener('push', event => {
  let message;
  try { message = event.data?.json(); } catch { return; }
  if (typeof message?.title !== 'string' || typeof message?.body !== 'string') return;
  event.waitUntil((async () => {
    await self.registration.showNotification(message.title, { body: message.body, data: { receipt: message.receipt || null } });
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
