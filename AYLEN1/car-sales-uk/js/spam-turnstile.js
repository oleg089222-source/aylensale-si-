/**
 * Client Turnstile helper — loads only when /api/spam-config returns a site key.
 */
(function(global) {
  var siteKey = null;
  var scriptLoading = null;
  var widgets = {};

  function loadScript() {
    if (global.turnstile) return Promise.resolve(global.turnstile);
    if (scriptLoading) return scriptLoading;
    scriptLoading = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = function() { resolve(global.turnstile); };
      s.onerror = function() { reject(new Error('Captcha script failed to load')); };
      document.head.appendChild(s);
    });
    return scriptLoading;
  }

  function fetchConfig() {
    return fetch('/api/spam-config', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        siteKey = data && data.turnstileSiteKey ? data.turnstileSiteKey : null;
        return !!siteKey;
      })
      .catch(function() {
        siteKey = null;
        return false;
      });
  }

  function renderWidget(containerId) {
    if (!siteKey || !containerId) return Promise.resolve(null);
    var el = document.getElementById(containerId);
    if (!el) return Promise.resolve(null);
    if (widgets[containerId]) return Promise.resolve(widgets[containerId]);

    return loadScript().then(function(turnstile) {
      el.innerHTML = '';
      el.classList.add('aylen-turnstile--ready');
      var id = turnstile.render(el, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'flexible'
      });
      widgets[containerId] = id;
      return id;
    }).catch(function() {
      return null;
    });
  }

  function getToken(containerId) {
    if (!siteKey || !global.turnstile) return null;
    var widgetId = widgets[containerId];
    if (!widgetId) return null;
    try {
      return global.turnstile.getResponse(widgetId) || null;
    } catch (e) {
      return null;
    }
  }

  function resetWidget(containerId) {
    if (!siteKey || !global.turnstile) return;
    var widgetId = widgets[containerId];
    if (!widgetId) return;
    try { global.turnstile.reset(widgetId); } catch (e) { /* ignore */ }
  }

  function isEnabled() {
    return !!siteKey;
  }

  function initCheckout() {
    return fetchConfig().then(function(enabled) {
      if (!enabled) return false;
      return renderWidget('orderTurnstile').then(function() { return true; });
    });
  }

  global.AYLEN_SPAM = {
    initCheckout: initCheckout,
    renderWidget: renderWidget,
    getToken: getToken,
    resetWidget: resetWidget,
    isEnabled: isEnabled,
    prefetchConfig: fetchConfig
  };
})(window);
