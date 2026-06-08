/**
 * Apply Firestore / API branding to document icons + PWA manifest (no redeploy).
 */
(function(global) {
  var appliedVersion = 0;

  function bumpUrl(url, version) {
    if (!url || !version) return url;
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'v=' + version;
  }

  function setLink(rel, href, sizes, type) {
    if (!href) return;
    var sel = 'link[rel="' + rel + '"]';
    if (sizes) sel += '[sizes="' + sizes + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      if (sizes) el.setAttribute('sizes', sizes);
      document.head.appendChild(el);
    }
    el.href = href;
    if (type) el.type = type;
  }

  function applyDeployIcons(deployV) {
    var q = '?v=' + deployV;
    setLink('manifest', '/manifest.json' + q);
    setLink('apple-touch-icon', '/apple-touch-icon.png' + q, '180x180');
    setLink('icon', '/favicon.ico' + q, null, 'image/x-icon');
    setLink('icon', '/favicon-32x32.png' + q, '32x32', 'image/png');
    setLink('icon', '/icon-192.png' + q, '192x192', 'image/png');
    purgeServiceWorkerCaches();
  }

  function applyBranding(branding) {
    if (!branding || !branding.icons) return false;
    var v = Number(branding.cacheVersion) || 0;
    var deployV = Number(global.AYLEN_DEPLOY_ICON_VERSION) || 0;
    if (deployV && deployV > v) {
      applyDeployIcons(deployV);
      if (branding.themeColor) {
        var themeEarly = document.querySelector('meta[name="theme-color"]');
        if (themeEarly) themeEarly.setAttribute('content', branding.themeColor);
      }
      appliedVersion = deployV;
      return true;
    }
    if (v && v === appliedVersion) return true;
    appliedVersion = v;

    var icons = branding.icons;
    var icon192 = bumpUrl(icons['icon-192'], v);
    var icon512 = bumpUrl(icons['icon-512'], v);
    var apple = bumpUrl(icons['apple-touch-icon'], v);
    var fav32 = bumpUrl(icons['icon-32'], v);
    var favIco = bumpUrl(icons['favicon.ico'], v);

    setLink('manifest', '/api/manifest?v=' + v);
    setLink('apple-touch-icon', apple, '180x180');
    setLink('icon', favIco, null, 'image/x-icon');
    setLink('icon', fav32, '32x32', 'image/png');
    setLink('icon', icon192, '192x192', 'image/png');

    if (branding.themeColor) {
      var theme = document.querySelector('meta[name="theme-color"]');
      if (theme) theme.setAttribute('content', branding.themeColor);
    }

    purgeServiceWorkerCaches();

    refreshHeroAppIcons(icons, v);

    return true;
  }

  function refreshHeroAppIcons(icons, version) {
    var url = bumpUrl(icons['icon-192'] || icons['apple-touch-icon'], version);
    if (!url) return;
    document.querySelectorAll('[data-aylen-app-icon]').forEach(function(img) {
      img.src = url;
    });
    if (global.AYLEN_PWA && global.AYLEN_PWA.setAppIcon) {
      global.AYLEN_PWA.setAppIcon(url);
    }
  }

  function purgeServiceWorkerCaches() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'AYLEN_PURGE_CACHES' });
      } catch (e) { /* ignore */ }
    }
    if ('caches' in global) {
      caches.keys().then(function(keys) {
        return Promise.all(
          keys.filter(function(k) { return k.indexOf('aylen-pwa-') === 0; }).map(function(k) {
            return caches.delete(k);
          })
        );
      }).catch(function() {});
    }
  }

  function attachFirestoreListener() {
    if (!global.fbDb || !global.firebase) return;
    try {
      global.fbDb.collection('siteSettings').doc('branding').onSnapshot(function(doc) {
        if (!doc.exists) return;
        var data = doc.data() || {};
        if (global.siteSettings) global.siteSettings.branding = data;
        applyBranding(data);
      }, function(err) {
        console.warn('[AYLEN Branding] listener error:', err.message);
      });
    } catch (e) {
      console.warn('[AYLEN Branding] listener skipped:', e.message);
    }
  }

  function init() {
    var deployV = Number(global.AYLEN_DEPLOY_ICON_VERSION) || 0;
    if (deployV) applyDeployIcons(deployV);

    var existing = global.siteSettings && global.siteSettings.branding;
    if (existing) applyBranding(existing);

    if (global.isFirebaseReady && global.fbDb) {
      attachFirestoreListener();
    } else {
      var tries = 0;
      var wait = setInterval(function() {
        tries++;
        if (global.fbDb) {
          clearInterval(wait);
          attachFirestoreListener();
          if (global.FBDB && global.FBDB.loadBrandingSettings) {
            global.FBDB.loadBrandingSettings().then(function(b) {
              if (b) applyBranding(b);
            }).catch(function() {});
          }
        }
        if (tries > 80) clearInterval(wait);
      }, 250);
    }
  }

  global.AYLEN_BRANDING = {
    apply: applyBranding,
    purgeCaches: purgeServiceWorkerCaches
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
