/**
 * Lazy-load admin panel scripts and styles (not for public shoppers).
 */
(function(global) {
  var VERSION = '202606092300';
  var coreLoaded = false;
  var extrasLoaded = false;
  var coreLoading = null;
  var extrasLoading = null;

  var STYLES = [
    'css/admin-dashboard.css',
    'css/pickup-admin-form.css',
    'css/admin-modals.css',
    'css/admin-discount-cards.css',
    'css/admin-visit-cards.css',
    'css/admin-auction-command.css'
  ];

  var STYLES_AI = ['css/ai-assistant.css', 'css/warehouse-scan.css'];

  var SCRIPTS_CORE = [
    'js/cloudinary-config.js',
    'js/photo-upload.js',
    'js/pickup-admin-form.js',
    'js/modal-manager.js',
    'js/vip-carousel-defaults.js',
    'js/vip-seed-data.js',
    'js/admin-vip-panel.js',
    'js/admin-orders-panel.js',
    'js/admin-discount-cards-panel.js',
    'js/admin-visit-cards-panel.js',
    'js/admin-auction-command.js',
    'js/admin-storage-tools.js',
    'js/admin.js',
    'js/admin-password-panel.js',
    'js/admin-dashboard.js',
    'js/admin-site-settings.js'
  ];

  var SCRIPTS_EXTRAS = [
    'js/ai-settings.js',
    'js/ai-assistant-media.js',
    'js/admin-ai-assistant.js',
    'js/warehouse-scan.js'
  ];

  function withVersion(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + VERSION;
  }

  function loadStyle(href) {
    return new Promise(function(resolve) {
      if (document.querySelector('link[data-aylen-admin-css="' + href + '"]')) {
        resolve();
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = withVersion(href);
      link.setAttribute('data-aylen-admin-css', href);
      link.onload = function() { resolve(); };
      link.onerror = function() { resolve(); };
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      if (document.querySelector('script[data-aylen-admin-src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = withVersion(src);
      script.async = false;
      script.setAttribute('data-aylen-admin-src', src);
      script.onload = function() { resolve(); };
      script.onerror = function() {
        reject(new Error('Failed to load ' + src));
      };
      document.body.appendChild(script);
    });
  }

  function loadParallel(list) {
    return Promise.all(list.map(loadScript));
  }

  function loadCoreBundle() {
    if (coreLoaded) return Promise.resolve(true);
    if (coreLoading) return coreLoading;

    var storageReady = (global.AYLEN_FIREBASE && global.AYLEN_FIREBASE.ensureStorage)
      ? global.AYLEN_FIREBASE.ensureStorage()
      : Promise.resolve(true);

    coreLoading = Promise.all([storageReady].concat(STYLES.map(loadStyle)))
      .then(function() {
        return loadParallel(SCRIPTS_CORE.slice(0, 3))
          .then(function() { return loadScript('js/modal-manager.js'); })
          .then(function() {
            return loadParallel([
              'js/vip-seed-data.js',
              'js/admin-vip-panel.js'
            ]);
          })
          .then(function() { return loadScript('js/admin.js'); })
          .then(function() { return loadScript('js/admin-password-panel.js'); })
          .then(function() {
            return loadParallel([
              'js/admin-price-list-panel.js',
              'js/admin-discount-cards-panel.js',
              'js/admin-visit-cards-panel.js',
              'js/admin-orders-panel.js',
              'js/admin-auction-command.js',
              'js/admin-storage-tools.js'
            ]);
          })
          .then(function() {
            return loadParallel([
              'js/admin-dashboard.js',
              'js/admin-site-settings.js'
            ]);
          });
      })
      .then(function() {
        coreLoaded = true;
        if (global.AYLEN_ADMIN_GATE && typeof global.AYLEN_ADMIN_GATE.onBundleReady === 'function') {
          global.AYLEN_ADMIN_GATE.onBundleReady();
        }
        if ('requestIdleCallback' in global) {
          global.requestIdleCallback(function() {
            loadExtrasBundle().catch(function() {});
          }, { timeout: 4000 });
        } else {
          setTimeout(function() {
            loadExtrasBundle().catch(function() {});
          }, 2500);
        }
        return true;
      })
      .catch(function(err) {
        coreLoading = null;
        console.error('[AYLEN] Admin core bundle failed:', err);
        if (typeof notify === 'function') {
          notify('Could not load admin tools. Check your connection and try again.', 'error');
        }
        throw err;
      });

    return coreLoading;
  }

  function loadExtrasBundle() {
    if (extrasLoaded) return Promise.resolve(true);
    if (extrasLoading) return extrasLoading;

    extrasLoading = Promise.all(STYLES_AI.map(loadStyle))
      .then(function() {
        return loadParallel(SCRIPTS_EXTRAS);
      })
      .then(function() {
        extrasLoaded = true;
        return true;
      })
      .catch(function(err) {
        extrasLoading = null;
        console.warn('[AYLEN] Admin AI extras failed:', err.message);
        return false;
      });

    return extrasLoading;
  }

  function preloadStyles() {
    return Promise.all(STYLES.map(loadStyle));
  }

  global.AYLEN_ADMIN_LOADER = {
    load: loadCoreBundle,
    loadCore: loadCoreBundle,
    loadExtras: loadExtrasBundle,
    preloadStyles: preloadStyles,
    isLoaded: function() { return coreLoaded; },
    version: VERSION
  };
})(window);
