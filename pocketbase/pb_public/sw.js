/**
 * PFFP Service Worker - Offline Cache
 * Cache Strategy:
 *   - Static assets (HTML, CSS, JS, CDN): Cache-First
 *   - PocketBase API calls: Network-First (fallback to IndexedDB in app code)
 */

var CACHE_NAME = 'pffp-cache-v54';

// Only precache critical LOCAL files (fast, always available)
// CDN libraries will be cached on-demand when first requested
var PRECACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './db.js',
    './pb.js',
    './manifest.json'
];

// Install: Pre-cache static assets
self.addEventListener('install', function (event) {
    console.log('[SW] Install - Caching', PRECACHE_URLS.length, 'assets');
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(PRECACHE_URLS).catch(function (err) {
                console.warn('[SW] Some assets failed to cache:', err);
                return Promise.all(
                    PRECACHE_URLS.map(function (url) {
                        return cache.add(url).catch(function () {
                            console.warn('[SW] Failed to cache:', url);
                        });
                    })
                );
            });
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

// Activate: Clean old caches
self.addEventListener('activate', function (event) {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.filter(function (name) {
                    return name !== CACHE_NAME;
                }).map(function (name) {
                    console.log('[SW] Deleting old cache:', name);
                    return caches.delete(name);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// Fetch: Network-First for HTML navigation, Cache-First for static assets
self.addEventListener('fetch', function (event) {
    var url = event.request.url;

    // Skip PocketBase API calls (handled by app's IndexedDB logic)
    if (url.includes('/api/collections/') || url.includes('/api/health')) {
        return;
    }

    // Network-First for HTML navigation: always get fresh index.html from server
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then(function (response) {
                if (response && response.status === 200) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
                }
                return response;
            }).catch(function () {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // Cache-First for static assets (JS, CSS, images) with background update
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) {
                fetchAndCache(event.request);
                return cached;
            }
            return fetchAndCache(event.request);
        }).catch(function () {
            return caches.match('./index.html');
        })
    );
});

function fetchAndCache(request) {
    return fetch(request).then(function (response) {
        if (response && response.status === 200) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
                cache.put(request, responseClone);
            });
        }
        return response;
    });
}
