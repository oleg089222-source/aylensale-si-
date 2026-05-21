/**
 * AI feature toggles — persisted in localStorage (admin device only).
 */
(function(global) {
  var STORAGE_KEY = 'aylen_ai_settings_v1';
  var DEFAULTS = {
    master: true,
    voice: true,
    whisper: true,
    camera: true,
    autoFill: true,
    tts: true,
    browserVoiceFallback: true,
    autoParseAfterVoice: true
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save(partial) {
    var next = Object.assign(load(), partial || {});
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('AI settings save failed', e);
    }
    return next;
  }

  function isEnabled() {
    return !!load().master;
  }

  function canUseVoice() {
    var s = load();
    return s.master && s.voice;
  }

  function useWhisper() {
    var s = load();
    return s.master && s.voice && s.whisper;
  }

  function canUseCamera() {
    var s = load();
    return s.master && s.camera;
  }

  function canAutoFill() {
    var s = load();
    return s.master && s.autoFill;
  }

  function canSpeak() {
    var s = load();
    return s.master && s.tts;
  }

  function applyVisibility() {
    var on = isEnabled();
    document.querySelectorAll('[data-aylen-ai]').forEach(function(el) {
      el.style.display = on ? '' : 'none';
    });
    var panel = document.getElementById('aiAdminPanel');
    if (panel && !on) panel.classList.remove('open');
  }

  global.AYLEN_AI_SETTINGS = {
    load: load,
    save: save,
    isEnabled: isEnabled,
    canUseVoice: canUseVoice,
    useWhisper: useWhisper,
    canUseCamera: canUseCamera,
    canAutoFill: canAutoFill,
    canSpeak: canSpeak,
    applyVisibility: applyVisibility,
    defaults: DEFAULTS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyVisibility);
  } else {
    applyVisibility();
  }
})(typeof window !== 'undefined' ? window : this);
