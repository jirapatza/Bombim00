/* Bombim00 Web Push service worker — no polling and no user data stored here. */
self.addEventListener('push', event => {
  let data = {};
  try { if (event.data) data = event.data.json(); } catch { data = {}; }
  const title = typeof data.title === 'string' ? data.title.slice(0, 100) : 'ผลหวย Bombim00';
  const body = typeof data.body === 'string' ? data.body.slice(0, 2000) : 'มีผลหวยหรือกำหนดการแจ้งเตือนใหม่';
  const tag = typeof data.tag === 'string' ? data.tag.slice(0, 100) : 'bombim00-lottery';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    renotify: true,
    silent: false,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        return;
      }
    }
    await clients.openWindow('/');
  })());
});
