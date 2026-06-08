/**
 * Deferred Firebase compat SDK loader — core SDK after first paint; storage on demand.
 */
(function(global) {
  var SDK_BASE = 'https://www.gstatic.com/firebasejs/10.5.0/';
  var CORE_SCRIPTS = [
    'firebase-app-compat.js?t=20250516',
    'firebase-auth-compat.js?t=202605182214',
    'firebase-firestore-compat.js?t=20250516'
  ];
  var STORAGE_SCRIPT = 'firebase-storage-compat.js?t=20250516';

  if (typeof global.firebaseConfig === 'undefined') {
    global.firebaseConfig = {
      apiKey: 'AIzaSyBpnzLxvk3uGQL-8jOIqQ_M_gTlh0a4mqg',
      authDomain: 'aylensale.firebaseapp.com',
      projectId: 'aylensale',
      storageBucket: 'aylensale.firebasestorage.app',
      messagingSenderId: '554559570562',
      appId: '1:554559570562:web:714d322ab781b4314cea9b',
      measurementId: 'G-8XWD4DQFDX'
    };
  }

  var corePromise = null;
  var storagePromise = null;
  var paintDone = false;
  var paintWaiters = [];
  var sdkReady = typeof global.firebase !== 'undefined';

  function notifySdkReady() {
    if (sdkReady) return;
    if (typeof global.firebase === 'undefined') return;
    sdkReady = true;
    try {
      document.dispatchEvent(new CustomEvent('aylen-firebase-sdk-ready'));
    } catch (e) {}
  }

  function afterFirstPaint(fn) {
    if (paintDone) {
      fn();
      return;
    }
    paintWaiters.push(fn);
  }

  function markPaintDone() {
    if (paintDone) return;
    paintDone = true;
    var waiters = paintWaiters.slice();
    paintWaiters = [];
    waiters.forEach(function(fn) {
      try { fn(); } catch (e) { console.warn('[Firebase Loader]', e); }
    });
  }

  function injectScript(src) {
    return new Promise(function(resolve, reject) {
      var existing = document.querySelector('script[data-aylen-firebase="' + src + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', function() { resolve(); }, { once: true });
        existing.addEventListener('error', function() { reject(new Error('Failed to load ' + src)); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = SDK_BASE + src;
      script.async = false;
      script.defer = false;
      script.setAttribute('data-aylen-firebase', src);
      script.onload = function() {
        script.setAttribute('data-loaded', '1');
        resolve();
      };
      script.onerror = function() {
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(script);
    });
  }

  function loadScriptChain(scripts) {
    return scripts.reduce(function(chain, src) {
      return chain.then(function() { return injectScript(src); });
    }, Promise.resolve());
  }

  function loadCoreSdk() {
    if (typeof global.firebase !== 'undefined') {
      notifySdkReady();
      return Promise.resolve(true);
    }
    if (corePromise) return corePromise;

    corePromise = loadScriptChain(CORE_SCRIPTS).then(function() {
      notifySdkReady();
      return true;
    }).catch(function(err) {
      console.error('[Firebase Loader]', err.message || err);
      corePromise = null;
      return false;
    });

    return corePromise;
  }

  function ensureStorage() {
    return loadCoreSdk().then(function(ok) {
      if (!ok) return false;
      if (typeof global.firebase !== 'undefined' && typeof global.firebase.storage === 'function') {
        return true;
      }
      if (storagePromise) return storagePromise;
      storagePromise = injectScript(STORAGE_SCRIPT).then(function() {
        return typeof global.firebase !== 'undefined' && typeof global.firebase.storage === 'function';
      }).catch(function(err) {
        console.error('[Firebase Loader] storage:', err.message || err);
        storagePromise = null;
        return false;
      });
      return storagePromise;
    });
  }

  function scheduleBackgroundLoad(callback) {
    afterFirstPaint(function() {
      var run = function() {
        loadCoreSdk().then(function() {
          if (typeof callback === 'function') callback();
        });
      };
      if (typeof global.requestIdleCallback === 'function') {
        global.requestIdleCallback(run, { timeout: 20000 });
      } else {
        global.setTimeout(run, 3000);
      }
    });
  }

  function ensureReady() {
    if (typeof global.firebase !== 'undefined') {
      notifySdkReady();
      return Promise.resolve(true);
    }
    return new Promise(function(resolve) {
      afterFirstPaint(function() {
        loadCoreSdk().then(resolve);
      });
    });
  }

  function whenSdkReady() {
    if (sdkReady || typeof global.firebase !== 'undefined') {
      notifySdkReady();
      return Promise.resolve(true);
    }
    return new Promise(function(resolve) {
      function done() {
        resolve(typeof global.firebase !== 'undefined');
      }
      document.addEventListener('aylen-firebase-sdk-ready', done, { once: true });
      ensureReady();
    });
  }

  global.AYLEN_FIREBASE = {
    ensureReady: ensureReady,
    ensureStorage: ensureStorage,
    whenSdkReady: whenSdkReady,
    loadNow: loadCoreSdk,
    scheduleBackgroundLoad: scheduleBackgroundLoad
  };

  if (typeof global.firebase !== 'undefined') {
    notifySdkReady();
    paintDone = true;
    return;
  }

  if (document.documentElement.classList.contains('defer-firebase')) {
    global.requestAnimationFrame(function() {
      global.requestAnimationFrame(function() {
        markPaintDone();
      });
    });
  } else {
    markPaintDone();
  }
})(window);
