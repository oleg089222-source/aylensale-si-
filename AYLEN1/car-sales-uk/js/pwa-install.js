/**
 * AYLENSALE PWA — install prompt, iOS guide, service worker registration.
 */
(function(global) {
  var STORAGE_PROMO_DISMISS = 'aylen_pwa_promo_dismissed';
  var STORAGE_PROMO_DISMISS_AT = 'aylen_pwa_promo_dismiss_at';
  var STORAGE_INSTALLED = 'aylen_pwa_installed';
  var PROMO_DELAY_MS = 30000;
  var PROMO_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  var DEFAULT_APP_ICON = '/install-app-icon.jpeg';

  var deferredPrompt = null;
  var promoShown = false;
  var promoRoot = null;
  var iosRoot = null;
  var appIconUrl = DEFAULT_APP_ICON;

  function resolveAppIconFromDom() {
    var heroIcon = document.querySelector('[data-aylen-install-icon]');
    if (heroIcon) {
      var src = heroIcon.getAttribute('src') || heroIcon.src || '';
      if (src) return src.split('?')[0];
    }
    var link = document.querySelector('link[rel="apple-touch-icon"]');
    if (link && link.href) return link.href.split('?')[0];
    return DEFAULT_APP_ICON;
  }

  function setAppIcon(url) {
    if (!url) return;
    appIconUrl = url;
    document.querySelectorAll('[data-aylen-app-icon]').forEach(function(img) {
      img.src = url;
    });
    var promoImg = promoRoot && promoRoot.querySelector('.pwa-promo-head img');
    if (promoImg) promoImg.src = url;
    if (iosRoot) {
      var guideImg = iosRoot.querySelector('.pwa-ios-icon-row img');
      if (guideImg) guideImg.src = url;
    }
  }

  function getAppIconUrl() {
    return appIconUrl;
  }

  function isStandalone() {
    return (
      global.matchMedia('(display-mode: standalone)').matches ||
      global.matchMedia('(display-mode: fullscreen)').matches ||
      global.navigator.standalone === true
    );
  }

  function isIOS() {
    var ua = global.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) && !global.MSStream;
  }

  function isAndroid() {
    return /Android/i.test(global.navigator.userAgent || '');
  }

  function canUseNativeInstall() {
    return !!deferredPrompt;
  }

  function shouldOfferInstall() {
    if (!(global.AYLEN_SITE && global.AYLEN_SITE.features && global.AYLEN_SITE.features.pwa !== false)) {
      return false;
    }
    if (isStandalone()) return false;
    if (global.localStorage.getItem(STORAGE_INSTALLED) === '1') return false;
    return true;
  }

  function isPromoDismissed() {
    try {
      if (global.localStorage.getItem(STORAGE_PROMO_DISMISS) === '1') return true;
      var dismissedAt = parseInt(global.localStorage.getItem(STORAGE_PROMO_DISMISS_AT) || '0', 10);
      if (dismissedAt && Date.now() - dismissedAt < PROMO_COOLDOWN_MS) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function markInstalled() {
    try {
      global.localStorage.setItem(STORAGE_INSTALLED, '1');
    } catch (e) { /* ignore */ }
    updateInstallButtonVisibility();
    closePromo();
    closeIOSGuide();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in global.navigator)) return;
    var secure = global.location.protocol === 'https:' || global.location.hostname === 'localhost';
    if (!secure) return;
    global.navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
      if (reg.update) reg.update();
      if (typeof console !== 'undefined' && console.log) {
        console.log('[AYLEN PWA] Service worker registered', reg.scope);
      }
    }).catch(function(err) {
      console.warn('[AYLEN PWA] SW registration failed', err);
    });
  }

  function getHeroButton() {
    return document.getElementById('pwaInstallHeroBtn');
  }

  function updateInstallButtonVisibility() {
    var btn = getHeroButton();
    if (!btn) return;
    var show = shouldOfferInstall();
    if (show) {
      btn.removeAttribute('hidden');
      btn.classList.remove('is-hidden');
      btn.setAttribute('aria-hidden', 'false');
    } else {
      btn.setAttribute('hidden', '');
      btn.classList.add('is-hidden');
      btn.setAttribute('aria-hidden', 'true');
    }
  }

  function buildPromo() {
    if (promoRoot || !shouldOfferInstall()) return;
    if (global.localStorage.getItem(STORAGE_PROMO_DISMISS) === '1') return;

    promoRoot = document.createElement('div');
    promoRoot.className = 'pwa-promo-root';
    promoRoot.setAttribute('role', 'dialog');
    promoRoot.setAttribute('aria-labelledby', 'pwaPromoTitle');
    promoRoot.innerHTML =
      '<div class="pwa-promo-backdrop" data-pwa-promo-close></div>' +
      '<div class="pwa-promo-card">' +
        '<div class="pwa-promo-head">' +
          '<img src="' + getAppIconUrl() + '" width="52" height="52" alt="AYLENSALE" data-aylen-app-icon>' +
          '<div><h3 id="pwaPromoTitle">Install AYLENSALE App</h3><p>Marketplace on your home screen</p></div>' +
        '</div>' +
        '<ul class="pwa-promo-benefits">' +
          '<li><i class="fas fa-check"></i> Faster access</li>' +
          '<li><i class="fas fa-check"></i> Live auctions</li>' +
          '<li><i class="fas fa-check"></i> Pickup updates</li>' +
          '<li><i class="fas fa-check"></i> New stock alerts</li>' +
        '</ul>' +
        '<div class="pwa-promo-actions">' +
          '<button type="button" class="pwa-promo-install" data-pwa-promo-install>Install</button>' +
          '<button type="button" class="pwa-promo-later" data-pwa-promo-close>Later</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(promoRoot);

    promoRoot.querySelectorAll('[data-pwa-promo-close]').forEach(function(el) {
      el.addEventListener('click', dismissPromo);
    });
    var installBtn = promoRoot.querySelector('[data-pwa-promo-install]');
    if (installBtn) installBtn.addEventListener('click', function() {
      closePromo();
      triggerInstall();
    });
  }

  function openPromo() {
    if (!shouldOfferInstall() || promoShown) return;
    if (isPromoDismissed()) return;
    buildPromo();
    if (!promoRoot) return;
    promoShown = true;
    promoRoot.classList.add('is-open');
    document.body.classList.add('pwa-promo-visible');
  }

  function closePromo() {
    if (!promoRoot) return;
    promoRoot.classList.remove('is-open');
    document.body.classList.remove('pwa-promo-visible');
    if (global.AYLEN_SCROLL && global.AYLEN_SCROLL.release) global.AYLEN_SCROLL.release();
  }

  function dismissPromo() {
    try {
      global.localStorage.setItem(STORAGE_PROMO_DISMISS_AT, String(Date.now()));
      global.localStorage.removeItem(STORAGE_PROMO_DISMISS);
    } catch (e) { /* ignore */ }
    closePromo();
  }

  var GUIDES = {
    ios: {
      icon: DEFAULT_APP_ICON,
      title: 'Add AYLENSALE to Home Screen',
      sub: 'Install like a real app — no App Store needed',
      steps: [
        ['Tap <strong>Share</strong>', 'fa-arrow-up-from-bracket'],
        ['Tap <strong>Add to Home Screen</strong>', 'fa-plus-square'],
        ['Tap <strong>Add</strong>', 'fa-check']
      ]
    },
    android: {
      icon: DEFAULT_APP_ICON,
      title: 'Install AYLENSALE App',
      sub: 'Add the marketplace to your home screen',
      steps: [
        ['Open browser <strong>menu</strong> (⋮)', 'fa-ellipsis-vertical'],
        ['Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>', 'fa-download'],
        ['Confirm <strong>Install</strong>', 'fa-check']
      ]
    },
    desktop: {
      icon: DEFAULT_APP_ICON,
      title: 'Install AYLENSALE App',
      sub: 'Opens in its own window — like a desktop app',
      steps: [
        ['Look for the <strong>install</strong> icon in the address bar', 'fa-window-maximize'],
        ['Or menu → <strong>Install AYLENSALE</strong>', 'fa-download'],
        ['Launch from dock / taskbar with AYLENSALE icon', 'fa-check']
      ]
    }
  };

  function buildGuideShell() {
    if (iosRoot) return iosRoot;
    iosRoot = document.createElement('div');
    iosRoot.className = 'pwa-ios-root';
    iosRoot.setAttribute('role', 'dialog');
    iosRoot.setAttribute('aria-modal', 'true');
    iosRoot.innerHTML = '<div class="pwa-ios-card" data-pwa-guide-card></div>';
    iosRoot.addEventListener('click', function(ev) {
      if (ev.target === iosRoot) closeIOSGuide();
    });
    document.body.appendChild(iosRoot);
    return iosRoot;
  }

  function renderGuide(kind) {
    var g = GUIDES[kind] || GUIDES.desktop;
    var iconUrl = getAppIconUrl() || g.icon;
    buildGuideShell();
    var stepsHtml = g.steps.map(function(step, i) {
      return '<li><span class="pwa-ios-step-num">' + (i + 1) + '</span><span>' + step[0] + '</span>' +
        '<i class="fas ' + step[1] + ' step-icon" aria-hidden="true"></i></li>';
    }).join('');
    var card = iosRoot.querySelector('[data-pwa-guide-card]');
    card.innerHTML =
      '<div class="pwa-ios-icon-row"><img src="' + iconUrl + '" width="72" height="72" alt="AYLENSALE"></div>' +
      '<h3>' + g.title + '</h3>' +
      '<p class="pwa-ios-sub">' + g.sub + '</p>' +
      '<ol class="pwa-ios-steps">' + stepsHtml + '</ol>' +
      '<button type="button" class="pwa-ios-close" data-pwa-ios-close>Got it</button>';
    card.querySelector('[data-pwa-ios-close]').addEventListener('click', closeIOSGuide);
  }

  function openInstallGuide(kind) {
    renderGuide(kind);
    iosRoot.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeIOSGuide() {
    if (!iosRoot) return;
    iosRoot.classList.remove('is-open');
    document.body.style.overflow = '';
    if (global.AYLEN_SCROLL && global.AYLEN_SCROLL.release) global.AYLEN_SCROLL.release();
  }

  async function triggerInstall() {
    if (isStandalone()) return;

    if (isIOS()) {
      openInstallGuide('ios');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        var choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          markInstalled();
        }
      } catch (e) {
        console.warn('[AYLEN PWA] install prompt error', e);
      }
      updateInstallButtonVisibility();
      return;
    }

    if (isAndroid()) {
      openInstallGuide('android');
      return;
    }

    openInstallGuide('desktop');
  }

  function shouldAutoShowPromo() {
    if (!shouldOfferInstall() || isPromoDismissed()) return false;
    /* Desktop: no blocking popup — install via hero button only */
    if (global.matchMedia && global.matchMedia('(min-width: 1025px)').matches) return false;
    return true;
  }

  function schedulePromo() {
    if (!shouldAutoShowPromo()) return;

    setTimeout(function() {
      if (!shouldAutoShowPromo()) return;
      openPromo();
    }, PROMO_DELAY_MS);
  }

  function init() {
    appIconUrl = resolveAppIconFromDom();
    setAppIcon(appIconUrl);
    registerServiceWorker();
    updateInstallButtonVisibility();

    var heroBtn = getHeroButton();
    if (heroBtn) {
      heroBtn.addEventListener('click', function(ev) {
        ev.preventDefault();
        triggerInstall();
      });
    }

    global.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
      updateInstallButtonVisibility();
    });

    global.addEventListener('appinstalled', function() {
      deferredPrompt = null;
      markInstalled();
    });

    if (isStandalone()) {
      markInstalled();
    }

    schedulePromo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.AYLEN_PWA = {
    install: triggerInstall,
    isStandalone: isStandalone,
    shouldOfferInstall: shouldOfferInstall,
    setAppIcon: setAppIcon,
    getAppIconUrl: getAppIconUrl
  };
})(typeof window !== 'undefined' ? window : this);
