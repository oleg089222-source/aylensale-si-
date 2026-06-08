/**
 * Load storefront scripts and styles on demand (PDP, auction hub, loyalty, admin).
 */
(function(global) {
  'use strict';

  var VERSION = '202606083000';
  var cache = Object.create(null);

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
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
