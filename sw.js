/**
 * PFFP Service Worker - Offline Cache
 * Cache Strategy:
 *   - Static assets (HTML, CSS, JS, CDN): Cache-First
 *   - Supabase API calls: Network-First (fallback to IndexedDB in app code)
 */

var CACHE_NAME = 'pffp-cache-v9';

var PRECACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './db.js',
    './manifest.json',
    // CDN Libraries
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/datatables.net-bs5/1.13.4/dataTables.bootstrap5.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.0/jquery.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/datatables.net/1.13.4/jquery.dataTables.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/datatables.net-bs5/1.13.4/dataTables.bootstrap5.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.3.0/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-datalabels/2.2.0/chartjs-plugin-datalabels.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    // Logos
    'https://raw.githubusercontent.com/impactslowforest/Logo/refs/heads/main/logo.png',
    'https://cdn.freebiesupply.com/logos/large/2x/wwf-4-logo-black-and-white.png',
    'https://www.deli-news.dk/wp-content/uploads/2024/11/Master-SLOW-Logo-1-1024x1024.png',
    'https://flagcdn.com/w40/gb.png'
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

// Fetch: Cache-First for static, Network-First for API
self.addEventListener('fetch', function (event) {
    var url = event.request.url;

    // Skip Supabase API calls (handled by app's IndexedDB logic)
    if (url.includes('supabase.co/rest/') || url.includes('supabase.co/auth/')) {
        return;
    }

    // For everything else: Cache-First with network fallback
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) {
                fetchAndCache(event.request);
                return cached;
            }
            return fetchAndCache(event.request);
        }).catch(function () {
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
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
