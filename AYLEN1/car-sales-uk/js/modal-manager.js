/**
 * Central modal manager — one overlay at a time, clean DOM teardown.
 */
(function(global) {
  var ROOT_ID = 'aylen-modal-root';
  var STATIC_IDS = ['cartModal', 'checkoutModal'];
  var CLOSE_MS = 180;

  var state = {
    currentId: null,
    currentKind: null,
    closing: false,
    scrollY: 0,
    onClose: null
  };

  function ensureRoot() {
    var root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'aylen-modal-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<div class="aylen-modal-backdrop" data-aylen-backdrop></div>' +
      '<div class="aylen-modal-panel modal-content" data-aylen-panel></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function(e) {
      if (e.target === root || e.target.hasAttribute('data-aylen-backdrop')) {
        close();
      }
    });
    var panel = root.querySelector('[data-aylen-panel]');
    if (panel && !panel._aylenPanelClickBound) {
      panel._aylenPanelClickBound = true;
      panel.addEventListener('click', function(e) {
        var closeBtn = e.target.closest('[data-aylen-close],.close');
        if (closeBtn) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      });
    }
    return root;
  }

  function getPanel() {
    var root = document.getElementById(ROOT_ID);
    return root ? root.querySelector('[data-aylen-panel]') : null;
  }

  function lockScroll(kind) {
    if (document.body.classList.contains('modal-locked')) return;
    state.scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add('modal-locked');
    if (kind === 'admin' || document.body.classList.contains('admin-dashboard-open')) {
      document.body.classList.add('admin-modal-open');
    } else {
      document.body.classList.add('storefront-modal-open');
    }
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + state.scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    document.body.classList.remove('modal-locked', 'admin-modal-open', 'storefront-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    if (!document.getElementById(ROOT_ID) || !document.getElementById(ROOT_ID).classList.contains('open')) {
      window.scrollTo(0, state.scrollY || 0);
    }
  }

  function parseModalHtml(html, fallbackId) {
    var wrap = document.createElement('div');
    wrap.innerHTML = String(html || '').trim();
    var modalEl = wrap.querySelector('.modal');
    if (modalEl) {
      var content = modalEl.querySelector('.modal-content');
      return {
        id: modalEl.id || fallbackId || ('modal_' + Date.now()),
        panelHtml: content ? content.innerHTML : modalEl.innerHTML
      };
    }
    if (wrap.querySelector('.modal-content')) {
      return { id: fallbackId || ('modal_' + Date.now()), panelHtml: wrap.innerHTML };
    }
    return { id: fallbackId || ('modal_' + Date.now()), panelHtml: wrap.innerHTML };
  }

  function isStatic(id) {
    return STATIC_IDS.indexOf(id) >= 0;
  }

  function resetStaticModals() {
    STATIC_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('open');
      el.style.display = '';
    });
  }

  function removeOrphanModals() {
    document.querySelectorAll('.modal').forEach(function(el) {
      if (el.id === ROOT_ID || isStatic(el.id)) return;
      el.remove();
    });
    document.querySelectorAll('body > .modal').forEach(function(el) {
      if (isStatic(el.id)) return;
      el.remove();
    });
    var root = document.getElementById(ROOT_ID);
    if (root && !root.classList.contains('open')) {
      root.classList.remove('closing');
      var panel = root.querySelector('[data-aylen-panel]');
      if (panel) {
        panel.innerHTML = '';
        panel.removeAttribute('id');
      }
    }
  }

  function finishClose() {
    var root = document.getElementById(ROOT_ID);
    if (root) {
      root.classList.remove('open', 'closing');
      var panel = root.querySelector('[data-aylen-panel]');
      if (panel) {
        panel.innerHTML = '';
        panel.removeAttribute('id');
      }
    }
    resetStaticModals();
    removeOrphanModals();
    state.currentId = null;
    state.currentKind = null;
    state.closing = false;
    unlockScroll();
    if (typeof state.onClose === 'function') {
      var cb = state.onClose;
      state.onClose = null;
      try { cb(); } catch (e) { console.warn('Modal onClose error', e); }
    }
  }

  function close(id, opts) {
    opts = opts || {};
    if (state.closing && !opts.force) return Promise.resolve();

    var targetId = id || state.currentId;
    if (state.currentKind === 'static' && targetId) {
      var staticEl = document.getElementById(targetId);
      if (staticEl) staticEl.classList.remove('open');
      finishClose();
      return Promise.resolve();
    }

    var root = document.getElementById(ROOT_ID);
    if (!root || !root.classList.contains('open')) {
      removeOrphanModals();
      finishClose();
      return Promise.resolve();
    }

    if (opts.immediate) {
      finishClose();
      return Promise.resolve();
    }

    state.closing = true;
    root.classList.add('closing');
    return new Promise(function(resolve) {
      setTimeout(function() {
        finishClose();
        resolve();
      }, CLOSE_MS);
    });
  }

  function closeAll(opts) {
    opts = opts || {};
    state.onClose = null;
    return close(null, { immediate: !!opts.immediate, force: true });
  }

  function open(html, options) {
    options = options || {};
    return closeAll({ immediate: true }).then(function() {
      var parsed = parseModalHtml(html, options.id);
      var root = ensureRoot();
      var panel = root.querySelector('[data-aylen-panel]');
      panel.id = parsed.id;
      panel.innerHTML = parsed.panelHtml;
      panel.className = 'aylen-modal-panel modal-content' + (options.panelClass ? ' ' + options.panelClass : '');
      state.currentId = parsed.id;
      state.currentKind = 'dynamic';
      state.onClose = options.onClose || null;
      root.classList.remove('closing');
      root.classList.add('open');
      lockScroll('admin');
      removeOrphanModals();
      var runAfter = options.afterOpen;
      if (typeof runAfter === 'function') {
        try { runAfter(panel, parsed.id); } catch (e) { console.warn('Modal afterOpen error', e); }
      }
      if (!options.noAutofocus) {
        var first = panel.querySelector('input:not([type="file"]):not([type="hidden"]),textarea,select,button');
        if (first) {
          setTimeout(function() { try { first.focus(); } catch (e) {} }, 50);
        }
      }
      return parsed.id;
    });
  }

  function openStatic(staticId, options) {
    options = options || {};
    if (!isStatic(staticId)) return Promise.resolve();
    return closeAll({ immediate: true }).then(function() {
      removeOrphanModals();
      resetStaticModals();
      var el = document.getElementById(staticId);
      if (!el) return;
      el.classList.add('open');
      el.style.display = '';
      state.currentId = staticId;
      state.currentKind = 'static';
      state.onClose = options.onClose || null;
      lockScroll('storefront');
    });
  }

  function closeStatic(staticId) {
    var el = document.getElementById(staticId);
    if (el) el.classList.remove('open');
    if (state.currentId === staticId) return close(null, { immediate: true });
    return Promise.resolve();
  }

  function onKeydown(e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!state.currentId) return;
    e.preventDefault();
    close();
  }

  function wireStaticBackdrop() {
    STATIC_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el || el._aylenBackdropBound) return;
      el._aylenBackdropBound = true;
      el.addEventListener('click', function(e) {
        if (e.target === el) {
          if (id === 'cartModal' && typeof global.closeCart === 'function') global.closeCart();
          else if (id === 'checkoutModal' && typeof global.closeCheckout === 'function') global.closeCheckout();
          else closeStatic(id);
        }
      });
    });
  }

  function init() {
    ensureRoot();
    wireStaticBackdrop();
    document.addEventListener('keydown', onKeydown);
    removeOrphanModals();
  }

  global.AYLEN_MODAL = {
    open: open,
    close: close,
    closeAll: closeAll,
    openStatic: openStatic,
    closeStatic: closeStatic,
    cleanup: removeOrphanModals,
    lockScroll: lockScroll,
    unlockScroll: unlockScroll,
    getCurrentId: function() { return state.currentId; },
    getPanel: getPanel
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
