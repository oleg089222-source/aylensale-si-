/**
 * Dynamic legal pages — body loaded from Firestore published settings (or preview draft).
 */
(function(global) {
  var PAGE_MAP = {
    'privacy-policy.html': 'privacy',
    'terms-and-conditions.html': 'terms',
    'returns-policy.html': 'returns',
    'cookie-policy.html': 'cookies'
  };

  function pageKeyFromPath() {
    var path = (global.location.pathname || '').split('/').pop() || '';
    return PAGE_MAP[path] || null;
  }

  function getDefaults() {
    if (global.SITE_LEGAL_DEFAULTS && global.SITE_LEGAL_DEFAULTS.getDefaultLegalContactContent) {
      return global.SITE_LEGAL_DEFAULTS.getDefaultLegalContactContent();
    }
    return {};
  }

  function mergePublished(raw) {
    if (global.AYLEN_SITE_CONTENT && global.AYLEN_SITE_CONTENT.mergePublished) {
      return global.AYLEN_SITE_CONTENT.mergePublished(raw || {});
    }
    return raw || getDefaults();
  }

  function getPreviewContent() {
    if (global.AYLEN_SITE_CONTENT && global.AYLEN_SITE_CONTENT.getPreviewContent) {
      return global.AYLEN_SITE_CONTENT.getPreviewContent();
    }
    return null;
  }

  function isPreviewMode() {
    return global.AYLEN_SITE_CONTENT && global.AYLEN_SITE_CONTENT.isPreviewMode && global.AYLEN_SITE_CONTENT.isPreviewMode();
  }

  function applyLegalPage(key, content) {
    var legal = (content && content.legal) || {};
    var page = legal[key];
    if (!page) return;

    var notice = document.getElementById('legalNotice');
    var title = document.getElementById('legalTitle');
    var updated = document.getElementById('legalUpdated');
    var body = document.getElementById('legalPageBody');

    if (title && page.title) title.textContent = page.title;
    if (updated && page.updated) updated.textContent = page.updated;
    if (notice) {
      if (page.notice) {
        notice.textContent = page.notice;
        notice.style.display = '';
      } else {
        notice.style.display = 'none';
      }
    }
    if (body && page.bodyHtml) body.innerHTML = page.bodyHtml;

    if (isPreviewMode()) {
      var banner = document.createElement('div');
      banner.id = 'legalPreviewBanner';
      banner.className = 'notice';
      banner.style.background = 'rgba(233,69,96,.15)';
      banner.style.borderColor = 'rgba(233,69,96,.4)';
      banner.textContent = 'Preview mode — unpublished draft. Close this tab when finished.';
      var wrap = document.querySelector('.wrap');
      if (wrap && !document.getElementById('legalPreviewBanner')) {
        wrap.insertBefore(banner, wrap.firstChild);
      }
    }
  }

  function resolveContent(callback) {
    if (isPreviewMode()) {
      callback(getPreviewContent() || getDefaults());
      return;
    }
    if (typeof siteSettings !== 'undefined' && siteSettings.legalContact && siteSettings.legalContact.published) {
      callback(mergePublished(siteSettings.legalContact.published));
      return;
    }
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (global.FBDB && global.isFirebaseReady && global.FBDB.loadSiteSettings) {
        clearInterval(timer);
        global.FBDB.loadSiteSettings().then(function(settings) {
          if (typeof siteSettings !== 'undefined' && settings && settings.legalContact) {
            siteSettings.legalContact = settings.legalContact;
          }
          var published = settings && settings.legalContact && settings.legalContact.published;
          callback(mergePublished(published || {}));
        }).catch(function() {
          callback(getDefaults());
        });
        return;
      }
      if (attempts > 40) {
        clearInterval(timer);
        callback(getDefaults());
      }
    }, 150);
  }

  function init() {
    var key = document.body && document.body.getAttribute('data-legal-page');
    if (!key) key = pageKeyFromPath();
    if (!key) return;
    resolveContent(function(content) {
      applyLegalPage(key, content);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
