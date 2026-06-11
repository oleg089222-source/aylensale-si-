/**
 * Load storefront scripts and styles on demand (PDP, auction hub, loyalty, admin).
 */
(function(global) {
  'use strict';

  function readBuildVersion() {
    try {
      var meta = document.querySelector('meta[name="aylen-build"]');
      if (meta && meta.content) return String(meta.content).trim();
    } catch (e) {}
    return '202606110100';
  }

  var VERSION = readBuildVersion();
  var cache = Object.create(null);

  function loadShellStyles() {
    if (global._aylenShellCssLoaded) {
      return Promise.resolve();
    }
    var hasCritical = document.querySelector('link[href*="storefront-shell-critical.bundle.css"]');
    var hasDeferred = document.querySelector('link[href*="storefront-shell-deferred.bundle.css"]');
    var hasLegacy = document.querySelector('link[href*="storefront-shell.bundle.css"]');
    function isBlockingSheet(link) {
      if (!link) return false;
      var media = (link.getAttribute('media') || 'all').toLowerCase();
      return media === 'all' || media === 'screen' || media === '';
    }
    if ((hasCritical && isBlockingSheet(hasCritical)) ||
        (hasCritical && document.documentElement.classList.contains('shell-css-ready')) ||
        (hasDeferred && document.documentElement.classList.contains('shell-css-ready'))) {
      global._aylenShellCssLoaded = true;
      return Promise.resolve();
    }
    if (hasLegacy) {
      global._aylenShellCssLoaded = true;
      return Promise.resolve();
    }
    global._aylenShellCssLoaded = true;
    return Promise.all([
      loadStyle('css/storefront-shell-critical.bundle.css'),
      loadStyle('css/storefront-shell-deferred.bundle.css')
    ]);
  }

  function withVersion(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + VERSION;
  }

  function loadStyle(href) {
    var key = 'style:' + href;
    if (cache[key]) return cache[key];
    cache[key] = new Promise(function(resolve) {
      if (document.querySelector('link[data-aylen-lazy-css="' + href + '"]')) {
        resolve();
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = withVersion(href);
      link.setAttribute('data-aylen-lazy-css', href);
      link.onload = function() { resolve(); };
      link.onerror = function() { resolve(); };
      document.head.appendChild(link);
    });
    return cache[key];
  }

  function loadScript(src) {
    var key = 'script:' + src;
    if (cache[key]) return cache[key];
    cache[key] = new Promise(function(resolve, reject) {
      if (document.querySelector('script[data-aylen-lazy-js="' + src + '"]')) {
        resolve();
        return;
      }
      var el = document.createElement('script');
      el.src = withVersion(src);
      el.defer = true;
      el.setAttribute('data-aylen-lazy-js', src);
      el.onload = function() { resolve(); };
      el.onerror = function() { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(el);
    });
    return cache[key];
  }

  function loadFeature(name, opts) {
    var key = 'feature:' + name;
    if (cache[key]) return cache[key];
    var styles = (opts && opts.styles) || [];
    var scripts = (opts && opts.scripts) || [];
    cache[key] = Promise.all(styles.map(loadStyle))
      .then(function() {
        return scripts.reduce(function(chain, src) {
          return chain.then(function() { return loadScript(src); });
        }, Promise.resolve());
      });
    return cache[key];
  }

  global.AYLEN_LAZY = {
    VERSION: VERSION,
    loadStyle: loadStyle,
    loadScript: loadScript,
    loadFeature: loadFeature,
    loadShellStyles: loadShellStyles,
    ensurePdpModal: function() {
      if (global.AYLEN_PDP) return Promise.resolve(global.AYLEN_PDP);
      return loadFeature('pdp', {
        styles: ['css/pdp-modal.css'],
        scripts: ['js/pdp-modal.js']
      }).then(function() { return global.AYLEN_PDP; });
    },
    ensureAuctionHub: function() {
      if (global.AYLEN_AUCTION_HUB) return Promise.resolve(global.AYLEN_AUCTION_HUB);
      return loadFeature('auction-hub', {
        styles: ['css/auction-hub.css'],
        scripts: ['js/auction-hub.js']
      }).then(function() { return global.AYLEN_AUCTION_HUB; });
    },
    ensureLoyaltyPortal: function() {
      if (global.AYLEN_LOYALTY_PORTAL) return Promise.resolve(global.AYLEN_LOYALTY_PORTAL);
      return loadFeature('loyalty-portal', {
        styles: ['css/loyalty-portal.css'],
        scripts: ['js/loyalty-tiers.js', 'js/loyalty-portal.js']
      }).then(function() {
        if (global.AYLEN_LOYALTY_PORTAL && global.AYLEN_LOYALTY_PORTAL.init) {
          global.AYLEN_LOYALTY_PORTAL.init();
        }
        return global.AYLEN_LOYALTY_PORTAL;
      });
    },
    runInteractionInits: function() {
      if (global._aylenInteractionInited) return;
      global._aylenInteractionInited = true;
      if (global.AYLEN_SEO && global.AYLEN_SEO.init) global.AYLEN_SEO.init();
      if (global.AYLEN_COMPLIANCE && global.AYLEN_COMPLIANCE.init) global.AYLEN_COMPLIANCE.init();
    },
    ensureStorefrontInteraction: function() {
      if (global.AYLEN_MODAL) {
        global.AYLEN_LAZY.runInteractionInits();
        return Promise.resolve(true);
      }
      var key = 'script:js/storefront-interaction.bundle.js';
      if (cache[key]) {
        return cache[key].then(function() {
          global.AYLEN_LAZY.runInteractionInits();
          return true;
        });
      }
      return loadScript('js/storefront-interaction.bundle.js').then(function() {
        global.AYLEN_LAZY.runInteractionInits();
        return true;
      });
    },
    scheduleDeferredStorefront: function() {
      if (global._aylenDeferredStorefrontScheduled) return;
      global._aylenDeferredStorefrontScheduled = true;
      function onLoad() {
        global.setTimeout(function() {
          global.AYLEN_LAZY.ensureStorefrontInteraction().catch(function() {});
        }, 1200);
        global.setTimeout(function() {
          loadScript('js/storefront-features.bundle.js').catch(function() {});
        }, 2500);
        function loadAdminBootstrap() {
          if (global._aylenAdminBootstrapInit || global._aylenAdminBootstrapRequested) return;
          if (document.querySelector('script[data-aylen-lazy-js="js/admin-bootstrap.js"]') ||
              document.querySelector('script[src*="admin-bootstrap.js"]')) {
            global._aylenAdminBootstrapRequested = true;
            return;
          }
          global._aylenAdminBootstrapRequested = true;
          loadScript('js/admin-bootstrap.js').catch(function() {});
        }
        if ('requestIdleCallback' in global) {
          global.requestIdleCallback(loadAdminBootstrap, { timeout: 5000 });
        } else {
          global.setTimeout(loadAdminBootstrap, 5000);
        }
        document.addEventListener('pointerdown', loadAdminBootstrap, { capture: true, passive: true, once: true });
      }
      if (document.readyState === 'complete') onLoad();
      else global.addEventListener('load', onLoad, { once: true });
      function prefetchInteraction() {
        global.AYLEN_LAZY.ensureStorefrontInteraction().catch(function() {});
        document.removeEventListener('pointerdown', prefetchInteraction, true);
        document.removeEventListener('touchstart', prefetchInteraction, true);
      }
      document.addEventListener('pointerdown', prefetchInteraction, { capture: true, passive: true });
      document.addEventListener('touchstart', prefetchInteraction, { capture: true, passive: true });
    }
  };

  global.AYLEN_LAZY.scheduleDeferredStorefront();

  function deferManifestLink() {
    var link = document.getElementById('aylenManifestLink');
    if (!link || link.getAttribute('data-aylen-deferred') === '1') return;
    var href = link.getAttribute('href');
    if (!href) return;
    link.remove();
    var deferred = document.createElement('link');
    deferred.rel = 'manifest';
    deferred.href = href;
    deferred.id = 'aylenManifestLink';
    deferred.setAttribute('data-aylen-deferred', '1');
    document.head.appendChild(deferred);
  }
  if (document.readyState === 'complete') {
    deferManifestLink();
  } else {
    global.addEventListener('load', deferManifestLink, { once: true });
  }

  if (typeof global.requestAnimationFrame === 'function') {
    global.requestAnimationFrame(function() {
      loadShellStyles().catch(function() {});
    });
  } else {
    loadShellStyles().catch(function() {});
  }
})(typeof window !== 'undefined' ? window : globalThis);
