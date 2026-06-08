/**
 * Minimal admin entry — login UI and shortcuts without loading the full admin bundle.
 */
(function(global) {
  var adminLoggedIn = false;

  function isMobileAdminLayout() {
    try {
      return global.matchMedia('(max-width: 640px)').matches;
    } catch (e) {
      return false;
    }
  }

  function updateAdminAccessVisibility() {
    var headerBtn = document.getElementById('headerAdminBtn');
    var mobileBtn = document.getElementById('mobileAdminBtn');
    var adminWrap = document.getElementById('adminAccessDiv');
    var footerLink = document.getElementById('footerAdminLink');
    var isAdmin = !!(global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin());
    [headerBtn, mobileBtn, adminWrap].forEach(function(el) {
      if (!el) return;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
    if (footerLink) {
      footerLink.hidden = false;
      footerLink.style.display = 'inline-block';
      footerLink.textContent = isAdmin ? 'Admin panel' : 'Admin login';
      if (!footerLink._aylenBound) {
        footerLink._aylenBound = true;
        footerLink.addEventListener('click', function(e) {
          e.preventDefault();
          showAdminLoginModal();
        });
      }
    }
  }

  function ensureBundle() {
    if (!global.AYLEN_ADMIN_LOADER) {
      return Promise.reject(new Error('Admin loader missing'));
    }
    return global.AYLEN_ADMIN_LOADER.load();
  }

  function waitForFirebaseAuthReady(timeoutMs) {
    return new Promise(function(resolve, reject) {
      var started = Date.now();
      var timer = setInterval(function() {
        if (global.FBDB && global.FBDB.signInAdmin && global.isFirebaseReady) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - started >= (timeoutMs || 12000)) {
          clearInterval(timer);
          reject(new Error('Firebase Auth is not ready. Check your connection and refresh the page.'));
        }
      }, 100);
    });
  }

  function isValidAdminLoginId(value) {
    var key = String(value || '').trim().toLowerCase();
    return key === 'admin' || key === 'admin@aylensale.com';
  }

  function setAdminAuthBusy(on) {
    document.documentElement.classList.toggle('admin-auth-busy', !!on);
    if (!on && global.AYLEN_SCROLL && global.AYLEN_SCROLL.release) {
      global.AYLEN_SCROLL.release();
    }
  }

  function showAdminAuthOverlay(message) {
    var el = document.getElementById('adminAuthOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'adminAuthOverlay';
      el.className = 'admin-auth-overlay';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.innerHTML = '<span><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ' +
      (message || 'Loading admin…') + '</span>';
    el.classList.add('is-visible');
  }

  function hideAdminAuthOverlay() {
    var el = document.getElementById('adminAuthOverlay');
    if (el) el.classList.remove('is-visible');
  }

  function closeAdminLoginModalAsync() {
    if (global.AYLEN_MODAL && global.AYLEN_MODAL.close) {
      return Promise.resolve(global.AYLEN_MODAL.close('adminLoginModal'));
    }
    closeAdminLoginModal();
    return Promise.resolve();
  }

  function bindAdminLoginForm() {
    var passEl = document.getElementById('adminPass');
    var toggleBtn = document.getElementById('adminPassToggle');
    if (toggleBtn && passEl && !toggleBtn._aylenBound) {
      toggleBtn._aylenBound = true;
      toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var show = passEl.type === 'password';
        passEl.type = show ? 'text' : 'password';
        toggleBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        toggleBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
        toggleBtn.innerHTML = show
          ? '<i class="fas fa-eye-slash" aria-hidden="true"></i>'
          : '<i class="fas fa-eye" aria-hidden="true"></i>';
      });
    }
    if (passEl && !passEl._aylenEnterBound) {
      passEl._aylenEnterBound = true;
      passEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') verifyAdminLogin();
      });
    }
    var userEl = document.getElementById('adminUser');
    if (userEl && !userEl._aylenEnterBound) {
      userEl._aylenEnterBound = true;
      userEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') verifyAdminLogin();
      });
    }
  }

  function showAdminLoginModal() {
    if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.isOpen && global.AyelenAdminDashboard.isOpen()) {
      return;
    }
    if (document.getElementById('adminLoginModal')) {
      closeAdminLoginModal();
    }
    if (global.AYLEN_ADMIN_LOADER && global.AYLEN_ADMIN_LOADER.preloadStyles) {
      global.AYLEN_ADMIN_LOADER.preloadStyles().catch(function() {});
    }

    function openLoginForm() {
      if (document.getElementById('adminLoginModal')) return;
      var rememberChecked = true;
      var savedLogin = 'admin';
      if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.getSessionLogin) {
        savedLogin = global.AYLEN_ADMIN_SESSION.getSessionLogin() || 'admin';
      }
      var loginHtml =
        '<div id="adminLoginModal" class="modal" style="display:flex">' +
          '<div class="modal-content" style="width:380px">' +
            '<h2 style="color:#e94560;text-align:center">Admin Login</h2>' +
            '<p style="color:#888;font-size:12px;margin:0 0 10px;text-align:center">Use <b style="color:#ccc">admin</b> or <b style="color:#ccc">admin@aylensale.com</b></p>' +
            '<input type="text" id="adminUser" value="' + (savedLogin.replace(/"/g, '&quot;')) + '" autocomplete="username" placeholder="admin or admin@aylensale.com" style="width:100%;padding:12px;margin:10px 0;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
            '<div class="aylen-password-wrap">' +
              '<input type="password" id="adminPass" autocomplete="current-password" placeholder="Password" class="aylen-password-input">' +
              '<button type="button" id="adminPassToggle" class="aylen-password-toggle" aria-label="Show password" aria-pressed="false">' +
                '<i class="fas fa-eye" aria-hidden="true"></i>' +
              '</button>' +
            '</div>' +
            '<p class="aylen-admin-login-hint">Forgot password? After login open <b>Admin → Settings → Admin password</b> to set a new one.</p>' +
            '<label style="display:flex;align-items:center;gap:8px;color:#aab4c8;font-size:12px;margin:4px 0 12px;cursor:pointer">' +
              '<input type="checkbox" id="adminRememberDevice" ' + (rememberChecked ? 'checked' : '') + ' style="width:16px;height:16px">' +
              ' Remember this phone / computer</label>' +
            '<button onclick="verifyAdminLogin()" style="width:100%;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;margin:10px 0">Login</button>' +
            '<button onclick="closeAdminLoginModal()" style="width:100%;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer;margin:5px 0">Cancel</button>' +
          '</div>' +
        '</div>';
      if (global.AYLEN_MODAL) {
        global.AYLEN_MODAL.open(loginHtml, {
          id: 'adminLoginModal',
          panelClass: 'aylen-admin-login-panel',
          afterOpen: function() { bindAdminLoginForm(); }
        });
        setTimeout(function() {
          bindAdminLoginForm();
          var u = document.getElementById('adminUser');
          if (u) u.focus();
        }, 60);
        return;
      }
      document.body.insertAdjacentHTML('beforeend', loginHtml);
      bindAdminLoginForm();
      var userInput = document.getElementById('adminUser');
      if (userInput) userInput.focus();
    }

    function tryOpenRememberedAdmin() {
      if (!global.AYLEN_ADMIN_SESSION || !global.AYLEN_ADMIN_SESSION.openAdminIfReady) {
        return Promise.resolve(false);
      }
      showAdminAuthOverlay('Opening admin…');
      return global.AYLEN_ADMIN_SESSION.openAdminIfReady('dashboard')
        .then(function(ok) {
          hideAdminAuthOverlay();
          if (ok) {
            if (global.AYLEN_ADMIN_GATE) global.AYLEN_ADMIN_GATE.setGateLoggedIn(true);
            notify('Admin CMS ready', 'success');
          }
          return ok;
        })
        .catch(function() {
          hideAdminAuthOverlay();
          return false;
        });
    }

    if (!global.isFirebaseReady) {
      notify('Loading admin…', 'info');
      waitForFirebaseAuthReady(15000)
        .then(function() { return tryOpenRememberedAdmin(); })
        .then(function(ok) { if (!ok) openLoginForm(); })
        .catch(function(err) { notify(err.message, 'error'); openLoginForm(); });
      return;
    }

    tryOpenRememberedAdmin().then(function(ok) {
      if (!ok) openLoginForm();
    });
  }

  function closeAdminLoginModal() {
    if (global.AYLEN_MODAL) global.AYLEN_MODAL.close('adminLoginModal');
    else {
      var modal = document.getElementById('adminLoginModal');
      if (modal) modal.remove();
    }
  }

  async function verifyAdminLogin() {
    var user = (document.getElementById('adminUser').value || '').trim();
    var pass = document.getElementById('adminPass').value;

    if (!isValidAdminLoginId(user)) {
      notify('Use admin or admin@aylensale.com', 'error');
      return;
    }
    if (!pass) {
      notify('Enter your admin password', 'error');
      return;
    }

    try {
      notify('Loading admin…', 'info');
      await waitForFirebaseAuthReady(12000);
      notify('Checking admin credentials...', 'info');
      var response;
      try {
        response = await fetch('/api/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
      } catch (netErr) {
        throw new Error('Cannot reach /api/admin-auth. On localhost run: npx vercel dev.');
      }

      var data = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        if (response.status === 501 || response.status === 404) {
          throw new Error('Admin API not available. Use https://aylensale.com or run: npx vercel dev');
        }
        throw new Error('Invalid server response (status ' + response.status + ')');
      }

      if (response.status === 429) {
        throw new Error('Too many attempts. Wait 15 minutes and try again.');
      }
      if (response.status === 500 && data.error && String(data.error).indexOf('not configured') !== -1) {
        throw new Error('ADMIN_PASSWORD is not set in Vercel environment variables.');
      }
      if (!response.ok || !data.authenticated) {
        if (response.status === 401) {
          throw new Error('Wrong password for website API.');
        }
        throw new Error(data.error || 'Login failed (HTTP ' + response.status + ')');
      }

      setAdminAuthBusy(true);
      await closeAdminLoginModalAsync();
      showAdminAuthOverlay('Loading admin tools…');

      await ensureBundle();
      await global.FBDB.signInAdmin(pass, user);
      adminLoggedIn = true;
      var rememberEl = document.getElementById('adminRememberDevice');
      var remember = rememberEl ? rememberEl.checked : true;
      if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.persistSession) {
        global.AYLEN_ADMIN_SESSION.persistSession(user, pass, remember);
      } else {
        try {
          sessionStorage.setItem('aylen_admin_key', pass);
          sessionStorage.setItem('aylen_admin_login', user);
          sessionStorage.setItem('aylen_admin_restore_ok', '1');
        } catch (e) {}
      }

      hideAdminAuthOverlay();
      window.isAdminMode = true;
      if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.enterCms) {
        global.AyelenAdminDashboard.enterCms('dashboard');
      } else if (typeof global.__aylenToggleAdminMode === 'function') {
        await global.__aylenToggleAdminMode();
      }
      notify('Admin CMS ready', 'success');
    } catch (error) {
      console.error('Admin login failed:', error);
      hideAdminAuthOverlay();
      notify(error.message || 'Authentication failed. Please try again.', 'error');
    } finally {
      setAdminAuthBusy(false);
    }
    updateAdminAccessVisibility();
  }

  function setupAdminAccessibility() {
    if (global._aylenAdminGateSetup) return;
    global._aylenAdminGateSetup = true;

    document.addEventListener('keydown', function(e) {
      if (global.AyelenAdminDashboard && global.AyelenAdminDashboard.isOpen && global.AyelenAdminDashboard.isOpen()) {
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        showAdminLoginModal();
        return;
      }
      if (e.metaKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        showAdminLoginModal();
        return;
      }
      if (e.altKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        showAdminLoginModal();
      }
    });

    setupAdminSecretTap();
    warmAdminBundleOnMobile();
    updateAdminAccessVisibility();
    if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.restoreSilent) {
      if (global.AYLEN_ADMIN_SESSION.hydrateFromRemember) {
        global.AYLEN_ADMIN_SESSION.hydrateFromRemember();
      }
      global.AYLEN_ADMIN_SESSION.restoreSilent().then(function(ok) {
        if (ok && global.AYLEN_ADMIN_GATE) global.AYLEN_ADMIN_GATE.setGateLoggedIn(true);
        updateAdminAccessVisibility();
      }).catch(function() {});
    }
  }

  function warmAdminBundleOnMobile() {
    if (!isMobileAdminLayout() || !global.AYLEN_ADMIN_LOADER) return;
    function warm() {
      global.AYLEN_ADMIN_LOADER.preloadStyles().catch(function() {});
    }
    if ('requestIdleCallback' in global) {
      global.requestIdleCallback(warm, { timeout: 5000 });
    } else {
      setTimeout(warm, 2500);
    }
  }

  function preloadAdminOnSecretTap() {
    if (!global.AYLEN_ADMIN_LOADER) return;
    global.AYLEN_ADMIN_LOADER.preloadStyles().catch(function() {});
    if (global.AYLEN_ADMIN_LOADER.loadCore) {
      global.AYLEN_ADMIN_LOADER.loadCore().catch(function() {});
    }
  }

  function setupAdminSecretTap() {
    var tapCount = 0;
    var tapTimeout = null;
    var lastTapAt = 0;
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

    function onBoltSecretTap(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();

      var now = Date.now();
      if (now - lastTapAt < 180) return;
      lastTapAt = now;

      tapCount++;
      if (tapTimeout) clearTimeout(tapTimeout);
      preloadAdminOnSecretTap();

      if (tapCount >= REQUIRED_TAPS) {
        resetTapCount();
        showAdminAuthOverlay('Opening admin…');
        showAdminLoginModal();
        return;
      }

      if (typeof notify === 'function') {
        notify('Admin: ' + (REQUIRED_TAPS - tapCount) + ' more tap' + (REQUIRED_TAPS - tapCount === 1 ? '' : 's') + ' on ⚡', 'info');
      }

      tapTimeout = setTimeout(resetTapCount, TAP_WINDOW_MS);
    }

    function bindBolt(btn) {
      if (!btn || btn.getAttribute('data-admin-tap-bound') === '1') return;
      btn.setAttribute('data-admin-tap-bound', '1');

      btn.addEventListener('touchend', onBoltSecretTap, { passive: false });
      if (!mobile) {
        btn.addEventListener('click', onBoltSecretTap);
      }
    }

    document.querySelectorAll('#adminSecretBolt, .site-header .logo-bolt-btn').forEach(bindBolt);

    if (!document.querySelector('.site-header .logo-bolt-btn[data-admin-tap-bound="1"]')) {
      setTimeout(function() {
        document.querySelectorAll('#adminSecretBolt, .site-header .logo-bolt-btn').forEach(bindBolt);
      }, 500);
    }
  }

  function onFirebaseAuth(user) {
    var allowed = Boolean(global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin());
    adminLoggedIn = allowed;
    if (!allowed) {
      if (typeof syncAdminModeWithFirebaseAuth === 'function') {
        syncAdminModeWithFirebaseAuth(user);
      }
      updateAdminAccessVisibility();
      return;
    }
    ensureBundle()
      .then(function() {
        if (typeof syncAdminModeWithFirebaseAuth === 'function') {
          syncAdminModeWithFirebaseAuth(user);
        }
        updateAdminAccessVisibility();
      })
      .catch(function() {});
  }

  function onBundleReady() {
    updateAdminAccessVisibility();
  }

  global.toggleAdminMode = function() {
    return ensureBundle().then(function() {
      if (typeof global.__aylenToggleAdminMode === 'function') {
        return global.__aylenToggleAdminMode();
      }
      showAdminLoginModal();
    });
  };

  global.showAdminLoginModal = showAdminLoginModal;
  global.closeAdminLoginModal = closeAdminLoginModal;
  global.verifyAdminLogin = verifyAdminLogin;

  global.AYLEN_ADMIN_GATE = {
    onFirebaseAuth: onFirebaseAuth,
    onBundleReady: onBundleReady,
    isGateLoggedIn: function() { return adminLoggedIn; },
    setGateLoggedIn: function(v) { adminLoggedIn = !!v; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAdminAccessibility);
  } else {
    setupAdminAccessibility();
  }
})(window);
