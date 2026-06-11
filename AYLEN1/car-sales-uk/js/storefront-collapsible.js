/**
 * Collapsible storefront panels — all users, preference saved in localStorage.
 * Header sections (desktop), trust badges, live stats, message, eBay, filters (mobile).
 */
(function (global) {
  var STORAGE_PREFIX = 'aylen-fold-';
  var MOBILE_MQ = '(max-width: 768px)';

  function isMobile() {
    try {
      return global.matchMedia(MOBILE_MQ).matches;
    } catch (e) {
      return false;
    }
  }

  function readState(id, defaultExpanded) {
    try {
      var v = global.localStorage.getItem(STORAGE_PREFIX + id);
      if (v === '0') return false;
      if (v === '1') return true;
    } catch (e) {}
    return defaultExpanded;
  }

  function writeState(id, expanded) {
    try {
      global.localStorage.setItem(STORAGE_PREFIX + id, expanded ? '1' : '0');
    } catch (e) {}
  }

  function initFold(config) {
    var root = config.root;
    if (!root || root.getAttribute('data-fold-init') === '1') return null;
    root.setAttribute('data-fold-init', '1');

    var panel = config.panel;
    var toggle = config.toggle;
    var id = config.id;
    var defaultExpanded = config.defaultExpanded === true;
    var expanded = readState(id, defaultExpanded);

    function setExpanded(next, persist) {
      expanded = !!next;
      root.classList.toggle('storefront-fold--collapsed', !expanded);
      root.classList.toggle('storefront-fold--expanded', expanded);
      if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (toggle) toggle.classList.toggle('is-active', expanded);
      if (panel) panel.hidden = !expanded;
      if (typeof config.onChange === 'function') config.onChange(expanded);
      if (persist) writeState(id, expanded);
      if (expanded && id === 'live-stats' && root.scrollIntoView) {
        try {
          root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) {
          root.scrollIntoView(true);
        }
      }
      if (expanded && id === 'price-list' && root.scrollIntoView) {
        try {
          root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
          root.scrollIntoView(true);
        }
      }
    }

    setExpanded(expanded, false);
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (typeof config.openOnClick === 'function') {
          config.openOnClick();
          return;
        }
        setExpanded(!expanded, true);
      });
    }

    return { setExpanded: setExpanded, isExpanded: function () { return expanded; } };
  }

  function ensureExtrasBar() {
    var bar = document.getElementById('storefrontExtrasBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'storefrontExtrasBar';
    bar.className = 'storefront-extras-bar';
    bar.setAttribute('aria-label', 'Optional site panels');
    var hero = document.getElementById('hero');
    if (hero && hero.parentNode) {
      hero.parentNode.insertBefore(bar, hero.nextSibling);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
    return bar;
  }

  function createChipToggle(id, label, iconClass, controlsId, shortLabel) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'storefront-extras-chip';
    btn.id = 'storefrontFoldToggle-' + id;
    btn.setAttribute('aria-controls', controlsId);
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', label);
    var text = isMobile() && shortLabel ? shortLabel : label;
    btn.innerHTML =
      '<i class="fas ' + iconClass + '" aria-hidden="true"></i>' +
      '<span>' + text + '</span>';
    return btn;
  }

  function wrapInFold(contentEl, foldClass, foldId, panelId) {
    if (!contentEl || contentEl.closest('.storefront-fold')) return null;
    var parent = contentEl.parentNode;
    var fold = document.createElement('div');
    fold.className = 'storefront-fold ' + foldClass;
    fold.id = foldId;
    fold.setAttribute('data-fold-id', foldId);

    var panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'storefront-fold__panel';

    parent.insertBefore(fold, contentEl);
    fold.appendChild(panel);
    panel.appendChild(contentEl);
    return { root: fold, panel: panel };
  }

  function unwrapHeaderNav() {
    var chip = document.getElementById('storefrontFoldToggle-header-nav');
    if (chip) chip.remove();
    var fold = document.getElementById('headerNavFold');
    if (!fold) return;
    var nav = fold.querySelector('.header-nav');
    var shell = document.querySelector('.site-header .header-shell');
    if (nav && shell) {
      shell.appendChild(nav);
    }
    fold.remove();
  }

  function wrapHeaderNav() {
    /* Sections chip removed — nav stays visible in header */
    unwrapHeaderNav();
  }

  function wrapLiveStats() {
    var barEl = document.getElementById('engagementBar');
    if (!barEl) return;

    if (isMobile()) {
      var heroStatsBtn = document.getElementById('heroStatsBtn');
      if (heroStatsBtn && heroStatsBtn.getAttribute('data-stats-scroll') !== '1') {
        heroStatsBtn.setAttribute('data-stats-scroll', '1');
        heroStatsBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          try {
            barEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (err) {
            barEl.scrollIntoView(true);
          }
        }, true);
      }
      return;
    }

    var wrapped = wrapInFold(barEl, 'storefront-fold--stats', 'liveStatsFold', 'storefrontLiveStatsPanel');
    if (!wrapped) return;

    var heroBtn = document.getElementById('heroStatsBtn');
    var toggle;
    if (heroBtn) {
      toggle = heroBtn;
    } else {
      var bar = ensureExtrasBar();
      toggle = createChipToggle('live-stats', 'Live stats', 'fa-signal', 'storefrontLiveStatsPanel', 'Stats');
      bar.appendChild(toggle);
    }

    var foldApi = initFold({
      root: wrapped.root,
      toggle: toggle,
      panel: wrapped.panel,
      id: 'live-stats',
      defaultExpanded: false
    });
    global.__aylenStatsFold = foldApi;
  }

  function initContactFloatFold() {
    var floatRoot = document.getElementById('contactFloat');
    var backdrop = document.getElementById('contactFloatBackdrop');
    if (!floatRoot) return;

    var heroBtn = document.getElementById('heroMessageBtn');
    var toggle = heroBtn;
    if (!heroBtn) {
      var bar = ensureExtrasBar();
      toggle = createChipToggle('contact-float', 'Message', 'fa-comment-dots', 'contactFloat', 'Message');
      bar.appendChild(toggle);
    } else if (!global.document.body.classList.contains('hero-contact-via-hub')) {
      global.document.body.classList.add('hero-contact-via-hub');
    }

    var expanded = readState('contact-float', false);

    function setExpanded(next, persist) {
      expanded = !!next;
      if (heroBtn) {
        floatRoot.hidden = false;
        floatRoot.classList.toggle('contact-float--hub-open', expanded);
        floatRoot.classList.toggle('contact-float--open', expanded);
        if (backdrop) {
          backdrop.hidden = !expanded;
          backdrop.classList.toggle('is-visible', expanded);
          backdrop.classList.toggle('contact-float-backdrop--visible', expanded);
          backdrop.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        }
        global.document.body.classList.toggle('hero-contact-open', expanded);
      } else {
        floatRoot.hidden = !expanded;
        if (backdrop) backdrop.hidden = !expanded;
        global.document.body.classList.toggle('contact-float-hidden', !expanded);
      }
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.classList.toggle('is-active', expanded);
      if (persist) writeState('contact-float', expanded);
    }

    setExpanded(expanded, false);
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setExpanded(!expanded, true);
    });
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        setExpanded(false, true);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!heroBtn || !expanded) return;
      setExpanded(false, true);
    });

    global.openMessageMenu = function(forceOpen) {
      setExpanded(typeof forceOpen === 'boolean' ? forceOpen : !expanded, true);
    };
    global.__aylenMessageFold = {
      setExpanded: setExpanded,
      isExpanded: function () { return expanded; },
      toggle: function () { setExpanded(!expanded, true); }
    };
  }

  function syncCatalogFoldMeta() {
    var meta = document.getElementById('catalogResultMeta');
    var foldMeta = document.getElementById('catalogFoldMeta');
    if (!meta || !foldMeta) return;
    foldMeta.textContent = (meta.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function wrapEbayPromo() {}

  function syncEbayFoldVisibility() {}

  function wrapCatalogFilters() {
    if (!isMobile()) return;
    var toolbar = document.getElementById('catalogToolbar');
    if (!toolbar || toolbar.closest('.storefront-fold')) return;

    var parent = toolbar.parentNode;
    var fold = document.createElement('div');
    fold.className = 'storefront-fold storefront-fold--filters';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'storefront-fold__toggle';
    toggle.setAttribute('aria-controls', 'catalogFiltersPanel');
    toggle.innerHTML =
      '<span class="storefront-fold__label"><i class="fas fa-list" aria-hidden="true"></i> Search &amp; filters</span>' +
      '<span class="storefront-fold__meta" id="catalogFoldMeta"></span>' +
      '<span class="storefront-fold__chevron" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>';

    var panel = document.createElement('div');
    panel.id = 'catalogFiltersPanel';
    panel.className = 'storefront-fold__panel';

    parent.insertBefore(fold, toolbar);
    fold.appendChild(toggle);
    fold.appendChild(panel);
    panel.appendChild(toolbar);

    initFold({
      root: fold,
      toggle: toggle,
      panel: panel,
      id: 'catalog-filters',
      defaultExpanded: false
    });

    syncCatalogFoldMeta();
    var meta = document.getElementById('catalogResultMeta');
    if (meta && 'MutationObserver' in global) {
      new MutationObserver(syncCatalogFoldMeta).observe(meta, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  function setPriceListFoldVisible(cta, heroBtn, visible, persist) {
    if (!cta) return;
    cta.classList.toggle('is-visible', !!visible);
    if (heroBtn) {
      heroBtn.setAttribute('aria-expanded', visible ? 'true' : 'false');
      heroBtn.classList.toggle('is-active', !!visible);
    }
    if (persist) writeState('price-list', !!visible);
    if (visible && cta.scrollIntoView) {
      try {
        cta.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        cta.scrollIntoView(true);
      }
    }
  }

  function wrapPriceList() {
    var cta = document.querySelector('.price-list-fold-root');
    if (!cta) return;
    cta.hidden = false;

    var heroBtn = document.getElementById('heroPriceListBtn');
    var mobile = isMobile();
    var expanded = mobile ? readState('price-list', false) : true;
    setPriceListFoldVisible(cta, heroBtn, expanded, false);

    if (heroBtn && heroBtn.getAttribute('data-price-list-fold') !== '1') {
      heroBtn.setAttribute('data-price-list-fold', '1');
      heroBtn.setAttribute('aria-label', mobile ? 'Price list panel' : 'Preview price list');
      heroBtn.addEventListener('click', function (ev) {
        if (mobile) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          var next = !cta.classList.contains('is-visible');
          setPriceListFoldVisible(cta, heroBtn, next, true);
          return;
        }
        if (typeof global.openPriceList !== 'function') return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        global.openPriceList();
      }, true);
    }
  }

  function togglePriceList() {
    if (typeof global.openPriceList === 'function') global.openPriceList();
    return true;
  }

  function hideEmptyExtrasBar() {
    var bar = document.getElementById('storefrontExtrasBar');
    if (!bar) return;
    bar.hidden = bar.children.length === 0;
  }

  function initMobileDomWraps() {
    wrapPriceList();
    wrapHeaderNav();
    wrapLiveStats();
    wrapCatalogFilters();
    syncEbayFoldVisibility();
    hideEmptyExtrasBar();
  }

  function init() {
    initContactFloatFold();
    if (isMobile()) {
      var wrapped = false;
      function runWraps() {
        if (wrapped) return;
        wrapped = true;
        var paint = function() {
          initMobileDomWraps();
          syncCatalogFoldMeta();
        };
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(paint, { timeout: 3000 });
        } else {
          setTimeout(paint, 0);
        }
      }
      document.addEventListener('aylen-catalog-ready', runWraps, { once: true });
      return;
    }
    wrapPriceList();
    wrapHeaderNav();
    wrapLiveStats();
    wrapCatalogFilters();
    syncEbayFoldVisibility();
    hideEmptyExtrasBar();
  }

  global.AYLEN_STOREFRONT_FOLDS = {
    init: init,
    syncCatalogFoldMeta: syncCatalogFoldMeta,
    syncEbayFoldVisibility: syncEbayFoldVisibility,
    togglePriceList: togglePriceList
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
