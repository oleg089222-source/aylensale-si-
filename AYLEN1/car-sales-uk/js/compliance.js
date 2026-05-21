/**
 * UK GDPR / PECR-style cookie consent & analytics gating.
 */
(function(global) {
  var STORAGE_KEY = 'aylen_cookie_consent_v1';

  function site() {
    return global.AYLEN_SITE || {};
  }

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(choices) {
    var payload = {
      necessary: true,
      analytics: !!choices.analytics,
      marketing: !!choices.marketing,
      version: (site().cookiePolicyVersion || '1.0'),
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
    applyConsent(payload);
    hideBanner();
  }

  function loadGoogleAnalytics(measurementId) {
    if (!measurementId || global._aylenGaLoaded) return;
    global._aylenGaLoaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(script);
    global.dataLayer = global.dataLayer || [];
    global.gtag = global.gtag || function() { global.dataLayer.push(arguments); };
    global.gtag('js', new Date());
    global.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    global.gtag('config', measurementId, { anonymize_ip: true, allow_google_signals: false });
  }

  function applyConsent(consent) {
    var cfg = site();
    var gaId = (cfg.analytics && cfg.analytics.googleAnalyticsId) || '';
    if (consent && consent.analytics && gaId) {
      loadGoogleAnalytics(gaId);
    }
    if (global.AYLEN_SEO && typeof global.AYLEN_SEO.onConsentApplied === 'function') {
      global.AYLEN_SEO.onConsentApplied(consent);
    }
  }

  function hideBanner() {
    var el = document.getElementById('cookieConsent');
    if (el) el.classList.remove('open');
  }

  function showBanner() {
    var el = document.getElementById('cookieConsent');
    if (el) el.classList.add('open');
  }

  function bindBanner() {
    var acceptAll = document.getElementById('cookieAcceptAll');
    var acceptEssential = document.getElementById('cookieAcceptEssential');
    var savePrefs = document.getElementById('cookieSavePrefs');
    var analyticsToggle = document.getElementById('cookieAnalyticsToggle');

    if (acceptAll) {
      acceptAll.addEventListener('click', function() {
        saveConsent({ analytics: true, marketing: false });
      });
    }
    if (acceptEssential) {
      acceptEssential.addEventListener('click', function() {
        saveConsent({ analytics: false, marketing: false });
      });
    }
    if (savePrefs) {
      savePrefs.addEventListener('click', function() {
        saveConsent({
          analytics: analyticsToggle ? !!analyticsToggle.checked : false,
          marketing: false
        });
      });
    }
  }

  function initDefaultConsent() {
    global.dataLayer = global.dataLayer || [];
    global.gtag = global.gtag || function() { global.dataLayer.push(arguments); };
    global.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
  }

  function init() {
    initDefaultConsent();
    bindBanner();
    var existing = readConsent();
    if (existing && existing.version === (site().cookiePolicyVersion || '1.0')) {
      applyConsent(existing);
      return;
    }
    showBanner();
  }

  global.AYLEN_COMPLIANCE = {
    init: init,
    readConsent: readConsent,
    saveConsent: saveConsent,
    openPreferences: showBanner
  };
})(typeof window !== 'undefined' ? window : this);
