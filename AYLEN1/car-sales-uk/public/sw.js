/**
 * AYLENSALE PWA service worker — network-first HTML/bundles, cache-first other static.
 */
var CACHE_VERSION = 'aylen-pwa-v21';
var STATIC_CACHE = CACHE_VERSION + '-static';
var RUNTIME_CACHE = CACHE_VERSION + '-runtime';

var PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/install-app-icon.jpeg',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-192.png',
  '/maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-32x32.png'
];

var STATIC_RESOURCES = /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|gif|webmanifest)(\?.*)?$/i;
var API_ENDPOINTS = /^\/api\//;

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function isStaticAsset(pathname) {
  return STATIC_RESOURCES.test(pathname) ||
    pathname === '/manifest.json' ||
    pathname === '/site.webmanifest' ||
    pathname.indexOf('/data/') === 0;
}

function isVersionedOrBundle(url) {
  if (url.search && url.search.indexOf('v=') !== -1) return true;
  return url.pathname.indexOf('.bundle.') !== -1;
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var network = fetch(request).then(function(response) {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function() {
        return cached;
      });
      return cached || network;
    });
  });
}

function networkFirst(request, cacheName, fallbackUrl) {
  return fetch(request).then(function(response) {
    if (response && response.status === 200) {
      caches.open(cacheName).then(function(cache) {
        cache.put(request, response.clone());
      });
    }
    return response;
  }).catch(function() {
    return caches.match(request).then(function(cached) {
      if (cached) return cached;
      if (fallbackUrl) return caches.match(fallbackUrl);
      return cached;
    });
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('[AYLEN SW] precache partial fail', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key.indexOf('aylen-pwa-') === 0 && key !== STATIC_CACHE && key !== RUNTIME_CACHE;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function(event) {
  if (!event.data || event.data.type !== 'AYLEN_PURGE_CACHES') return;
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    })
  );
});

self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  if (!isSameOrigin(request.url)) return;

  if (API_ENDPOINTS.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, '/offline.html'));
    return;
  }

  if (url.pathname === '/api/manifest') return;

  if (!isStaticAsset(url.pathname)) return;

  if (isVersionedOrBundle(url)) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(cacheFirst(request, STATIC_CACHE));
});
