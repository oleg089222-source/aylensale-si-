/**
 * Minimal admin entry — loads full admin gate only after explicit user intent.
 */
(function(global) {
  'use strict';

  var VERSION = '202606092000';
  var loading = null;
  var loaded = false;
  var pendingAuthUsers = [];
  var stubLoggedIn = false;

  function isMobileAdminLayout() {
    try {
      return global.matchMedia('(max-width: 640px)').matches;
    } catch (e) {
      return false;
    }
  }

  function installGateStub() {
    if (global.AYLEN_ADMIN_GATE && global.AYLEN_ADMIN_GATE.__stub) return;
    global.AYLEN_ADMIN_GATE = {
      __stub: true,
      onFirebaseAuth: function(user) {
        pendingAuthUsers.push(user);
        if (loaded && global.AYLEN_ADMIN_GATE && !global.AYLEN_ADMIN_GATE.__stub) {
          global.AYLEN_ADMIN_GATE.onFirebaseAuth(user);
        }
      },
      onBundleReady: function() {},
      isGateLoggedIn: function() { return stubLoggedIn; },
      setGateLoggedIn: function(v) { stubLoggedIn = !!v; }
    };
  }

  function ensureAdminGate() {
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    if (!global.AYLEN_LAZY) {
      return Promise.reject(new Error('Lazy loader missing'));
    }
    loading = global.AYLEN_LAZY.loadScript('js/firebase-db-admin.bundle.js')
      .catch(function() {
        return global.AYLEN_LAZY.loadScript('js/firebase-db-admin.js');
      })
      .then(function() {
        return global.AYLEN_LAZY.loadScript('js/admin-session.js');
      })
      .then(function() { return global.AYLEN_LAZY.loadScript('js/admin-loader.js'); })
      .then(function() { return global.AYLEN_LAZY.loadScript('js/admin-gate.js'); })
      .then(function() {
        loaded = true;
        var gate = global.AYLEN_ADMIN_GATE;
        if (gate && !gate.__stub) {
          pendingAuthUsers.forEach(function(user) {
            gate.onFirebaseAuth(user);
          });
        }
        pendingAuthUsers = [];
      });
    return loading;
  }

  function openAdminLogin() {
    ensureAdminGate()
      .then(function() {
        if (typeof global.showAdminLoginModal === 'function') {
          global.showAdminLoginModal();
        }
      })
      .catch(function(err) {
        console.error('Admin gate load failed:', err);
      });
  }

  function updateFooterAdminLink() {
    var footerLink = document.getElementById('footerAdminLink');
    if (!footerLink || footerLink._aylenBound) return;
    footerLink._aylenBound = true;
    footerLink.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        footerLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {}
      openAdminLogin();
    });
  }

  function setupAdminSecretTap() {
    var tapCount = 0;
    var tapTimeout = null;
    var lastTapAt = 0;
    var opening = false;
    var mobile = isMobileAdminLayout();
    var TAP_WINDOW_MS = mobile ? 2200 : 1400;
    var REQUIRED_TAPS = mobile ? 2 : 3;

    function resetTapCount() {
      tapCount = 0;
      if (tapTimeout) {
        clearTimeout(tapTimeout);
        tapTimeout = null;
      }
    }

    function tapHint(remaining) {
      if (typeof global.notify !== 'function') return;
      if (remaining <= 0) {
        global.notify('Opening admin login…', 'info');
        return;
      }
      global.notify('Admin: ' + remaining + ' more tap' + (remaining === 1 ? '' : 's') + ' on ⚡', 'info');
    }

    function onBoltSecretTap(e) {
      if (opening) return;
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();
      var now = Date.now();
      if (now - lastTapAt < 180) return;
      lastTapAt = now;
      tapCount++;
      if (tapTimeout) clearTimeout(tapTimeout);

      if (tapCount === 1) {
        ensureAdminGate().catch(function() {});
      }

      if (tapCount >= REQUIRED_TAPS) {
        opening = true;
        resetTapCount();
        tapHint(0);
        openAdminLogin().finally(function() {
          setTimeout(function() { opening = false; }, 1200);
        });
        return;
      }

      tapHint(REQUIRED_TAPS - tapCount);
      tapTimeout = setTimeout(resetTapCount, TAP_WINDOW_MS);
    }

    function bindBolt(btn) {
      if (!btn || btn.getAttribute('data-admin-tap-bound') === '1') return;
      btn.setAttribute('data-admin-tap-bound', '1');
      btn.addEventListener('touchend', onBoltSecretTap, { passive: false });
      if (!mobile) btn.addEventListener('click', onBoltSecretTap);
    }

    document.querySelectorAll('#adminSecretBolt, .site-header .logo-bolt-btn').forEach(bindBolt);
    setTimeout(function() {
      document.querySelectorAll('#adminSecretBolt, .site-header .logo-bolt-btn').forEach(bindBolt);
    }, 500);
  }

  function setupKeyboardShortcut() {
    document.addEventListener('keydown', function(e) {
      if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.isOpen && global.AyelenAdminDashboard.isOpen()) {
        return;
      }
      var combo = (e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyA';
      var altCombo = e.altKey && e.shiftKey && e.code === 'KeyA';
      if (!combo && !altCombo) return;
      e.preventDefault();
      openAdminLogin();
    });
  }

  function init() {
    if (global._aylenAdminBootstrapInit) return;
    global._aylenAdminBootstrapInit = true;
    installGateStub();
    setupAdminSecretTap();
    setupKeyboardShortcut();
    updateFooterAdminLink();
    if (isMobileAdminLayout()) {
      ensureAdminGate().catch(function() {});
    }
    global.toggleAdminMode = function() {
      return ensureAdminGate().then(function() {
        if (typeof global.__aylenToggleAdminMode === 'function') {
          return global.__aylenToggleAdminMode();
        }
        openAdminLogin();
      });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.AYLEN_ADMIN_BOOTSTRAP = {
    VERSION: VERSION,
    ensureAdminGate: ensureAdminGate,
    openAdminLogin: openAdminLogin
  };
})(typeof window !== 'undefined' ? window : globalThis);
