/**
 * Runtime environment flags and production write confirmation (no top banner).
 */
(function(global) {
  var host = (global.location && global.location.hostname) || '';
  var params = new URLSearchParams((global.location && global.location.search) || '');
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  var isPreview = /\.vercel\.app$/i.test(host);
  var isProduction = /^aylensale\.com$/i.test(host) || /^www\.aylensale\.com$/i.test(host);
  var forceStaging = params.get('staging') === '1';
  var allowProdWrites = params.get('allowProdWrites') === '1';

  var env = {
    host: host,
    isLocal: isLocal,
    isPreview: isPreview,
    isProduction: isProduction,
    isStaging: isLocal || isPreview || forceStaging,
    allowProdWrites: allowProdWrites,
    label: isProduction && !forceStaging ? 'production' : 'staging'
  };

  global.AYLEN_RUNTIME = env;

  function clearEnvBanner() {
    var existing = document.getElementById('aylenEnvBanner');
    if (existing) existing.remove();
    if (document.body) document.body.classList.remove('aylen-has-env-banner');
  }

  global.mountEnvBannerForAdmin = clearEnvBanner;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', clearEnvBanner);
  } else {
    clearEnvBanner();
  }

  global.confirmAylenProductionWrite = function(actionLabel) {
    if (!env.isProduction || env.isStaging || env.allowProdWrites) return true;
    if (global.FBDB && global.FBDB.isAdmin && global.FBDB.isAdmin()) return true;
    return global.confirm(
      'You are on LIVE production (aylensale.com).\n\n' +
      'Recommended: test on localhost or Vercel preview first.\n\n' +
      'Continue with: ' + (actionLabel || 'this change') + '?'
    );
  };
})(window);
