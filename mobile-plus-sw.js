// The Mobile+ root PWA was retired: the installable PWA now lives
// under /mobileplus/ (the workbench). This stub replaces the old root
// service worker so existing clients drop the old shell caches and
// unregister cleanly on their next visit.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith('mobile-plus-')).map((key) => caches.delete(key))
    );
    await self.clients.claim();
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => {})));
  })());
});
