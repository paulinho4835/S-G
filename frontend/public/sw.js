const CACHE_NAME = 'felipillo-shell-v1';
const APP_SHELL = [
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(APP_SHELL.map(async (asset) => {
            const response = await fetch(asset, { cache: 'reload' });
            if (response.ok) await cache.put(asset, response);
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter((name) => name.startsWith('felipillo-shell-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put('/index.html', response.clone());
                }
                return response;
            } catch {
                return await caches.match('/index.html')
                    || await caches.match('/')
                    || Response.error();
            }
        })());
        return;
    }

    if (!['script', 'style', 'image', 'font'].includes(request.destination)
        || !url.pathname.startsWith('/assets/')) return;

    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
            const response = await fetch(request);
            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            }
            return response;
        } catch {
            return Response.error();
        }
    })());
});
