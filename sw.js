// sw.js — Service Worker для офлайн-режима

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `tower-cache-${CACHE_VERSION}`;

const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './utils.js',
    './constants.js',
    './combo-system.js',
    './transitions.js',
    './missions.js',
    './prestige.js',
    './performance.js',
    './accessibility.js',
    './environment-particles.js',
    './postprocessing.js',
    './minigames.js',
    './optimization.js',
    './seasonal-events.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
];

const CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&display=swap',
    'https://telegram.org/js/telegram-web-app.js',
    'https://unpkg.com/three@0.160.0/build/three.module.js',
];

const ALL_ASSETS = [...CORE_ASSETS, ...CDN_ASSETS];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching core assets');
                return Promise.allSettled(
                    ALL_ASSETS.map((url) =>
                        cache.add(url).catch((err) => {
                            console.warn(`[SW] Failed to cache: ${url}`, err);
                        })
                    )
                );
            })
            .then(() => {
                console.log('[SW] Installation complete');
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('tower-cache-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete');
                return self.clients.claim();
            })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (request.method !== 'GET') return;
    
    if (url.hostname.includes('telegram.org') && url.pathname.includes('/js/telegram-web-app.js')) {
        return;
    }
    
    if (request.destination === 'document' || url.pathname.endsWith('.html')) {
        event.respondWith(networkFirst(request));
    } else if (url.hostname.includes('unpkg.com') || url.hostname.includes('googleapis.com')) {
        event.respondWith(cacheFirst(request));
    } else {
        event.respondWith(staleWhileRevalidate(request));
    }
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        console.warn('[SW] Cache First failed:', request.url, err);
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (err) {
        console.warn('[SW] Network First failed, using cache:', request.url);
        const cached = await caches.match(request);
        if (cached) return cached;
        const fallback = await caches.match('./index.html');
        return fallback || new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    const networkPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);
    
    return cached || (await networkPromise) || new Response('Offline', { status: 503 });
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('tower-cache-'))
                        .map((name) => caches.delete(name))
                );
            }).then(() => {
                return self.clients.matchAll().then((clients) => {
                    clients.forEach((client) => client.postMessage({ type: 'CACHE_CLEARED' }));
                });
            })
        );
    }
    if (event.data && event.data.type === 'GET_VERSION') {
        event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
    }
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-scores') {
        console.log('[SW] Background sync: scores');
    }
});

self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'Башня хайпа', {
            body: data.body || 'Новое событие в игре!',
            icon: './icon-192.png',
            badge: './icon-192.png',
            vibrate: [200, 100, 200],
            data: data.url || './',
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === event.notification.data && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data);
            }
        })
    );
});
