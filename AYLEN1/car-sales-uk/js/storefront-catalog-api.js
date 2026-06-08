/**
 * Fetch storefront catalog from Vercel API (no client Firestore on first paint).
 */
(function(global) {
  var DEFAULT_LIMIT = 36;
  var prefetchPromise = null;

  function isHomeStorefront() {
    var path = (global.location && global.location.pathname) || '/';
    if (path !== '/' && path !== '/index.html') return false;
    if (document.body && document.body.classList.contains('product-page')) return false;
    return true;
  }

  function isLocalPreviewHost() {
    try {
      var host = global.location && global.location.hostname ? global.location.hostname : '';
      return host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
      return false;
    }
  }

  function preloadCatalogLcpThumb(payload) {
    try {
      var items = payload && payload.products && payload.products.items;
      if (!items || !items.length || !items[0].images || !items[0].images[0]) return;
      var raw = String(items[0].images[0]);
      if (!raw || raw.indexOf('data:') === 0) return;
      if (document.querySelector('link[data-aylen-lcp-preload="1"]')) return;
      var href;
      if (global.AYLEN_IMAGES && global.AYLEN_IMAGES.productCardImageUrl) {
        href = global.AYLEN_IMAGES.productCardImageUrl(raw);
      } else if (isLocalPreviewHost()) {
        var media = /[?&]alt=media(?:&|$)/.test(raw)
          ? raw
          : raw + (raw.indexOf('?') === -1 ? '?' : '&') + 'alt=media';
        href = media;
      } else {
        var mediaUrl = /[?&]alt=media(?:&|$)/.test(raw)
          ? raw
          : raw + (raw.indexOf('?') === -1 ? '?' : '&') + 'alt=media';
        href = '/api/image-thumb?w=320&h=220&url=' + encodeURIComponent(mediaUrl);
      }
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = href;
      link.setAttribute('data-aylen-lcp-preload', '1');
      link.setAttribute('fetchpriority', 'high');
      document.head.appendChild(link);
      var img = new Image();
      img.decoding = 'async';
      img.src = href;
    } catch (e) {}
  }

  function fetchCatalog(opts) {
    opts = opts || {};
    var limit = opts.limit || DEFAULT_LIMIT;
    var url = '/api/storefront-catalog?limit=' + encodeURIComponent(String(limit));
    if (opts.after) {
      url += '&after=' + encodeURIComponent(String(opts.after));
    }
    return fetch(url, { credentials: 'same-origin' }).then(function(res) {
      if (!res.ok) throw new Error('Catalog API HTTP ' + res.status);
      return res.json();
    }).then(function(payload) {
      if (!payload || payload.ok !== true) throw new Error('Catalog API invalid response');
      if (!opts.after) preloadCatalogLcpThumb(payload);
      return payload;
    });
  }

  function startPrefetch() {
    if (!isHomeStorefront()) return null;
    if (!prefetchPromise) {
      prefetchPromise = fetchCatalog({ limit: DEFAULT_LIMIT }).catch(function() {
        prefetchPromise = null;
        return null;
      });
    }
    return prefetchPromise;
  }

  function getPrefetch() {
    return prefetchPromise || startPrefetch();
  }

  global.AYLEN_STOREFRONT_CATALOG_API = {
    DEFAULT_LIMIT: DEFAULT_LIMIT,
    isEnabled: isHomeStorefront,
    fetchCatalog: fetchCatalog,
    getPrefetch: getPrefetch,
    startPrefetch: startPrefetch
  };

  startPrefetch();
})(window);
