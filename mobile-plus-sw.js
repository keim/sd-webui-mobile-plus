const CACHE_VERSION = new URL(self.location.href).searchParams.get('v') || '1';
const SHELL_CACHE = `mobile-plus-shell-${CACHE_VERSION}`;
const OFFLINE_URL = '/mobile-plus-offline';
const EXTENSION_ASSET_BASE = '/file=extensions/sd-webui-mobile-plus';
const PRECACHE_URLS = [
  '/mobile-plus.webmanifest',
  '/mobile-plus-offline',
  '/mobile-plus-icon-192.png',
  '/mobile-plus-icon-512.png',
  `${EXTENSION_ASSET_BASE}/style.css`,
  `${EXTENSION_ASSET_BASE}/responsive.css`,
  `${EXTENSION_ASSET_BASE}/javascript/responsive_design.js`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('mobile-plus-') && key !== SHELL_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function shouldBypass(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith('/api/mobile-plus/')) return true;
  if (url.pathname.startsWith('/sdapi/')) return true;
  if (url.pathname.startsWith('/internal/')) return true;
  if (url.pathname.startsWith('/file=')) {
    return !url.pathname.startsWith(EXTENSION_ASSET_BASE);
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (shouldBypass(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(request)) || (await caches.match(OFFLINE_URL));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok && request.url.startsWith(self.location.origin)) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});
