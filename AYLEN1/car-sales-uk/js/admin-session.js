/**
 * Admin session — remember device, restore Firebase + API password.
 */
(function(global) {
  var REMEMBER_KEY = 'aylen_admin_remember_v1';
  var REMEMBER_DATA = 'aylen_admin_remember_data_v1';
  var SESSION_PASS = 'aylen_admin_key';
  var SESSION_USER = 'aylen_admin_login';
  var SESSION_RESTORE = 'aylen_admin_restore_ok';

  function hasRememberEnabled() {
    try {
      return localStorage.getItem(REMEMBER_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  /** Copy remembered credentials into sessionStorage (survives new tabs / iOS reload). */
  function hydrateFromRemember() {
    if (!hasRememberEnabled()) return false;
    try {
      var raw = localStorage.getItem(REMEMBER_DATA);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || !data.pass) return false;
      sessionStorage.setItem(SESSION_PASS, data.pass);
      sessionStorage.setItem(SESSION_USER, data.user || 'admin');
      sessionStorage.setItem(SESSION_RESTORE, '1');
      return true;
    } catch (e) {
      return false;
    }
  }

  function persistSession(user, pass, remember) {
    var keepDevice = remember !== false;
    try {
      sessionStorage.setItem(SESSION_PASS, pass);
      sessionStorage.setItem(SESSION_USER, user);
      sessionStorage.setItem(SESSION_RESTORE, '1');
    } catch (e) {}
    try {
      if (keepDevice) {
        localStorage.setItem(REMEMBER_KEY, '1');
        localStorage.setItem(REMEMBER_DATA, JSON.stringify({ user: user, pass: pass, at: Date.now() }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(REMEMBER_DATA);
      }
    } catch (e2) {}
  }

  function getSessionPassword() {
    try {
      var p = sessionStorage.getItem(SESSION_PASS);
      if (p) return p;
      if (hydrateFromRemember()) {
        return sessionStorage.getItem(SESSION_PASS);
      }
    } catch (e) {}
    return null;
  }

  function getSessionLogin() {
    try {
      var u = sessionStorage.getItem(SESSION_USER);
      if (u) return u;
      if (hydrateFromRemember()) {
        return sessionStorage.getItem(SESSION_USER) || 'admin';
      }
    } catch (e) {}
    return 'admin';
  }

  function clearAll() {
    try {
      sessionStorage.removeItem(SESSION_PASS);
      sessionStorage.removeItem(SESSION_USER);
      sessionStorage.removeItem(SESSION_RESTORE);
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(REMEMBER_DATA);
    } catch (e) {}
  }

  function isAdminReady() {
    return !!(global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin());
  }

  function waitForFirebaseReady(timeoutMs) {
    return new Promise(function(resolve, reject) {
      var started = Date.now();
      var timer = setInterval(function() {
        if (global.FBDB && global.FBDB.signInAdmin && global.isFirebaseReady) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started >= (timeoutMs || 15000)) {
          clearInterval(timer);
          reject(new Error('Firebase is not ready yet.'));
        }
      }, 100);
    });
  }

  async function restoreSilent() {
    hydrateFromRemember();
    if (isAdminReady()) return true;
    await waitForFirebaseReady(20000);
    if (isAdminReady()) return true;
    var pass = getSessionPassword();
    if (!pass) return false;
    var login = getSessionLogin();
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await global.FBDB.signInAdmin(pass, login);
        if (isAdminReady()) {
          if (global.AYLEN_ADMIN_GATE && global.AYLEN_ADMIN_GATE.setGateLoggedIn) {
            global.AYLEN_ADMIN_GATE.setGateLoggedIn(true);
          }
          return true;
        }
      } catch (e) {
        console.warn('[AYLEN] Admin restore attempt ' + (attempt + 1) + ':', e.message);
        if (attempt < 2) {
          await new Promise(function(r) { setTimeout(r, 600); });
        }
      }
    }
    return false;
  }

  async function openAdminIfReady(startPanel) {
    try {
      if (!isAdminReady()) {
        var ok = await restoreSilent();
        if (!ok) return false;
      }
      if (global.AYLEN_ADMIN_GATE && global.AYLEN_ADMIN_GATE.setGateLoggedIn) {
        global.AYLEN_ADMIN_GATE.setGateLoggedIn(true);
      }
      if (global.AYLEN_ADMIN_LOADER && global.AYLEN_ADMIN_LOADER.load) {
        try {
          await global.AYLEN_ADMIN_LOADER.load();
        } catch (e) {
          console.warn('[AYLEN] Admin bundle load failed:', e.message);
          return false;
        }
      }
      if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.enterCmsAsync) {
        await global.AyelenAdminDashboard.enterCmsAsync(startPanel || 'dashboard');
        return true;
      }
      if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.enterCms) {
        global.AyelenAdminDashboard.enterCms(startPanel || 'dashboard');
        return true;
      }
      return false;
    } finally {
      if (global.AYLEN_ADMIN_GATE && global.AYLEN_ADMIN_GATE.hideAuthOverlay) {
        global.AYLEN_ADMIN_GATE.hideAuthOverlay();
      }
    }
  }

  hydrateFromRemember();

  global.AYLEN_ADMIN_SESSION = {
    hasRememberEnabled: hasRememberEnabled,
    hydrateFromRemember: hydrateFromRemember,
    persistSession: persistSession,
    getSessionPassword: getSessionPassword,
    getSessionLogin: getSessionLogin,
    clearAll: clearAll,
    restoreSilent: restoreSilent,
    openAdminIfReady: openAdminIfReady,
    isAdminReady: isAdminReady
  };
})(typeof window !== 'undefined' ? window : globalThis);
