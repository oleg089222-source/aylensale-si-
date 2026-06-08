/**
 * Customer loyalty hub — jar progress, orders, upgrade request, themes, quick contact.
 */
(function(global) {
  var THEME_KEY = 'aylen_loyalty_theme_v1';
  var OPENED_KEY = 'aylen_loyalty_opened_v1';
  var state = {
    data: null,
    loading: false,
    open: false,
    theme: 'emerald',
    scrollY: 0,
    scrollLocked: false
  };

  var THEMES = [
    { id: 'emerald', label: 'Emerald', icon: 'fa-leaf' },
    { id: 'pink', label: 'Rose', icon: 'fa-heart' },
    { id: 'gold', label: 'Gold', icon: 'fa-crown' },
    { id: 'midnight', label: 'Midnight', icon: 'fa-moon' }
  ];

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function fmtMoney(n) {
    return '£' + Number(n || 0).toFixed(2);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }

  function getSessionCode() {
    if (global.AYLEN_DISCOUNT && global.AYLEN_DISCOUNT.getSession) {
      var s = global.AYLEN_DISCOUNT.getSession();
      if (s && s.card) return String(s.card).toUpperCase();
    }
    if (global.currentUser && global.currentUser.card) return String(global.currentUser.card).toUpperCase();
    return '';
  }

  function loadTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      if (t && THEMES.some(function(x) { return x.id === t; })) state.theme = t;
    } catch (e) {}
  }

  function saveTheme(id) {
    state.theme = id;
    try { localStorage.setItem(THEME_KEY, id); } catch (e) {}
    var root = document.getElementById('loyaltyPortalRoot');
    if (root) {
      THEMES.forEach(function(th) { root.classList.remove('lp-theme--' + th.id); });
      root.classList.add('lp-theme--' + state.theme);
    }
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function marketplaceLinks() {
    var settings = typeof safeMarketplaceSettings === 'function'
      ? safeMarketplaceSettings()
      : { telegramUrl: 'https://t.me/aylensale', whatsappUrl: '' };
    var tg = String(settings.telegramUrl || 'https://t.me/aylensale').trim();
    var wa = typeof resolveWhatsAppUrl === 'function'
      ? resolveWhatsAppUrl(settings.whatsappUrl)
      : (settings.whatsappUrl || 'https://wa.me/447471647771');
    return { telegramUrl: tg, whatsappUrl: wa };
  }

  function buildContactUrl(base, message) {
    var msg = String(message || '');
    if (!base) return '#';
    if (base.indexOf('wa.me') !== -1 || base.indexOf('whatsapp.com') !== -1) {
      var root = base.split('?')[0];
      if (base.indexOf('text=') !== -1) return base.split('text=')[0] + 'text=' + encodeURIComponent(msg);
      return root + '?text=' + encodeURIComponent(msg);
    }
    var userMatch = base.match(/^https:\/\/t\.me\/([a-z0-9_]{3,64})\/?$/i);
    if (userMatch) return 'https://t.me/' + userMatch[1] + '?text=' + encodeURIComponent(msg);
    return 'https://t.me/share/url?url=' + encodeURIComponent(location.origin) + '&text=' + encodeURIComponent(msg);
  }

  function ensureUi() {
    if (document.getElementById('loyaltyPortalChip')) return;

    var chip = document.createElement('button');
    chip.type = 'button';
    chip.id = 'loyaltyPortalChip';
    chip.className = 'loyalty-portal-chip is-hidden';
    chip.setAttribute('aria-label', 'Open my discount hub');
    chip.innerHTML = '<span class="loyalty-portal-chip__jar" aria-hidden="true"></span><span class="loyalty-portal-chip__text">Discount</span>';
    chip.addEventListener('click', function() { open(true); });

    var form = document.querySelector('.header-card-access');
    if (form) form.appendChild(chip);

    var strip = document.createElement('div');
    strip.id = 'loyaltyPortalStrip';
    strip.className = 'loyalty-portal-strip is-hidden';
    strip.setAttribute('role', 'region');
    strip.setAttribute('aria-label', 'Your loyalty discount');
    strip.innerHTML =
      '<div class="loyalty-portal-strip__inner">' +
        '<div class="loyalty-portal-strip__jar" aria-hidden="true"></div>' +
        '<div class="loyalty-portal-strip__copy">' +
          '<strong class="loyalty-portal-strip__title">Your personal discount is active</strong>' +
          '<span class="loyalty-portal-strip__sub">Track your loyalty jar &amp; savings</span>' +
        '</div>' +
        '<button type="button" class="loyalty-portal-strip__btn">My Discount</button>' +
      '</div>';
    strip.querySelector('.loyalty-portal-strip__btn').addEventListener('click', function() { open(true); });

    var headerShell = document.querySelector('.header-shell');
    if (headerShell && headerShell.parentNode) {
      headerShell.parentNode.insertBefore(strip, headerShell.nextSibling);
    }

    var root = document.createElement('div');
    root.id = 'loyaltyPortalRoot';
    root.className = 'loyalty-portal-root is-hidden lp-theme--' + state.theme;
    root.innerHTML =
      '<div class="loyalty-portal-backdrop" data-lp-close></div>' +
      '<div class="loyalty-portal-panel" role="dialog" aria-modal="true" aria-labelledby="loyaltyPortalTitle">' +
        '<header class="loyalty-portal-header">' +
          '<div class="loyalty-portal-grab" aria-hidden="true"></div>' +
          '<button type="button" class="loyalty-portal-close" data-lp-close aria-label="Close">' +
            '<i class="fas fa-times" aria-hidden="true"></i></button>' +
          '<div id="loyaltyPortalHeader" class="loyalty-portal-header__inner">' +
            '<p class="loyalty-portal-loading">Loading…</p></div>' +
        '</header>' +
        '<div id="loyaltyPortalBody" class="loyalty-portal-scroll">' +
          '<p class="loyalty-portal-loading">Loading your hub…</p></div>' +
      '</div>';
    document.body.appendChild(root);

    root.addEventListener('click', function(e) {
      if (e.target.hasAttribute('data-lp-close') || e.target.closest('[data-lp-close]')) close();
    });

    var scrollEl = root.querySelector('.loyalty-portal-scroll');
    if (scrollEl) {
      scrollEl.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: true });
    }
  }

  function lockPageScroll() {
    if (state.scrollLocked) return;
    state.scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add('modal-locked', 'storefront-modal-open', 'loyalty-portal-open');
    document.documentElement.classList.add('loyalty-portal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + state.scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    state.scrollLocked = true;
  }

  function unlockPageScroll() {
    if (!state.scrollLocked) return;
    document.body.classList.remove('loyalty-portal-open');
    document.documentElement.classList.remove('loyalty-portal-open');
    var otherModal = document.getElementById('aylen-modal-root');
    var cartOpen = document.getElementById('cartModal');
    var cartVisible = cartOpen && (cartOpen.classList.contains('open') || cartOpen.style.display === 'flex');
    var modalVisible = otherModal && otherModal.classList.contains('open');
    if (!cartVisible && !modalVisible) {
      document.body.classList.remove('modal-locked', 'storefront-modal-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, state.scrollY || 0);
    }
    state.scrollLocked = false;
  }

  function syncChip(data) {
    var chip = document.getElementById('loyaltyPortalChip');
    var strip = document.getElementById('loyaltyPortalStrip');
    var code = getSessionCode();
    var visible = !!code;
    applyChipUi(chip, strip, code, visible, data);
  }

  function applyChipUi(chip, strip, code, visible, data) {
    if (chip) {
      chip.classList.toggle('is-hidden', !visible);
      if (data) {
        var pct = data.discountPercent || data.tierPercent || 0;
        var codeLabel = code || data.code || getSessionCode();
        chip.querySelector('.loyalty-portal-chip__text').textContent =
          (codeLabel ? codeLabel + ' · ' : '') + pct + '%';
        chip.setAttribute('aria-label', 'Open my discount hub' + (codeLabel ? ' — card ' + codeLabel : ''));
        var mini = chip.querySelector('.loyalty-portal-chip__jar');
        if (mini) {
          mini.innerHTML = jarMarkup(data.jarFill || 20, data.loyaltyTier || 0, true);
        }
      }
    }

    if (strip) {
      strip.classList.toggle('is-hidden', !visible);
      if (data) {
        var jarEl = strip.querySelector('.loyalty-portal-strip__jar');
        if (jarEl) jarEl.innerHTML = jarMarkup(data.jarFill || 20, data.loyaltyTier || 0, true);
        var sub = strip.querySelector('.loyalty-portal-strip__sub');
        if (sub) {
          sub.textContent = (data.discountPercent || 0) + '% off now · ' + (data.progressToNext || 0) + '% to next tier';
        }
      }
    }
  }

  function syncChipFromSession() {
    ensureUi();
    var code = getSessionCode();
    var chip = document.getElementById('loyaltyPortalChip');
    var strip = document.getElementById('loyaltyPortalStrip');
    if (!code) {
      applyChipUi(chip, strip, '', false, null);
      return;
    }
    var pct = 0;
    if (global.AYLEN_DISCOUNT && global.AYLEN_DISCOUNT.getSession) {
      var s = global.AYLEN_DISCOUNT.getSession();
      if (s) pct = Number(s.discount || s.discountValue || 0);
    }
    applyChipUi(chip, strip, code, true, {
      code: code,
      discountPercent: pct,
      jarFill: 20,
      loyaltyTier: 0,
      progressToNext: 0
    });
  }

  function jarMarkup(fill, tier, mini) {
    var cls = 'lp-jar-fill';
    if (tier >= 4) cls += ' lp-jar-fill--t4';
    else if (tier >= 3) cls += ' lp-jar-fill--t3';
    else if (tier >= 2) cls += ' lp-jar-fill--t2';
    else if (tier >= 1) cls += ' lp-jar-fill--t1';
    return '<span class="lp-jar' + (mini ? ' lp-jar--mini' : '') + '">' +
      '<span class="' + cls + '" style="height:' + Math.min(100, Math.max(8, fill)) + '%"></span></span>';
  }

  function tierRoadHtml(data) {
    if (!data || !Array.isArray(data.tiers)) return '';
    return data.tiers.map(function(t) {
      var active = t.tier === data.loyaltyTier ? ' lp-tier-step--active' : '';
      var done = t.tier < data.loyaltyTier ? ' lp-tier-step--done' : '';
      var eligible = t.tier <= data.suggestedTier ? ' lp-tier-step--eligible' : '';
      return '<div class="lp-tier-step' + active + done + eligible + '">' +
        '<span class="lp-tier-step__pct">' + t.percent + '%</span>' +
        '<span class="lp-tier-step__label">' + esc(t.label) + '</span>' +
      '</div>';
    }).join('');
  }

  function ordersHtml(data) {
    var list = data.recentOrders || [];
    if (!list.length) {
      return '<p class="lp-empty">No orders linked to your card yet. Place your first order — it will appear here.</p>';
    }
    return '<ul class="lp-orders">' + list.map(function(o) {
      return '<li class="lp-order">' +
        '<span class="lp-order__date">' + esc(fmtDate(o.date)) + '</span>' +
        '<span class="lp-order__meta">' + esc(String(o.itemsCount || 0)) + ' items' +
          (o.pickup ? ' · ' + esc(o.pickup) : '') + '</span>' +
        '<span class="lp-order__total">' + esc(fmtMoney(o.total)) + '</span>' +
      '</li>';
    }).join('') + '</ul>';
  }

  function themePickerHtml() {
    return THEMES.map(function(t) {
      var on = t.id === state.theme ? ' lp-theme-pick--on' : '';
      return '<button type="button" class="lp-theme-pick' + on + '" data-lp-theme="' + t.id + '" title="' + esc(t.label) + '">' +
        '<i class="fas ' + t.icon + '"></i><span>' + esc(t.label) + '</span></button>';
    }).join('');
  }

  function renderHeader(data) {
    var code = data.code || getSessionCode();
    return (
      '<div class="lp-hero lp-hero--sticky">' +
        '<p class="lp-hero__eyebrow"><i class="fas fa-ticket"></i> Visit card · ' + esc(code) + '</p>' +
        '<h2 id="loyaltyPortalTitle" class="lp-hero__title">Hello, ' + esc((data.name || 'Customer').split(' ')[0]) + '</h2>' +
        '<p class="lp-hero__discount"><span class="lp-hero__pct">' + (data.discountPercent || 0) + '%</span> personal discount active on site prices</p>' +
      '</div>'
    );
  }

  function renderScrollContent(data) {
    var links = marketplaceLinks();
    var code = data.code || getSessionCode();
    var contactMsg = 'Hi AYLENSALE! My visit card is ' + code + '. I have a question about my discount.';
    var upgradeBlock = '';

    if (data.pendingUpgrade) {
      upgradeBlock =
        '<div class="lp-upgrade lp-upgrade--pending">' +
          '<i class="fas fa-hourglass-half"></i>' +
          '<div><strong>Upgrade request received</strong>' +
          '<p>We are reviewing your loyalty level. We will confirm your new discount and visit card soon.</p></div>' +
        '</div>';
    } else if (data.upgradeReady) {
      upgradeBlock =
        '<div class="lp-upgrade lp-upgrade--ready">' +
          '<div class="lp-upgrade__icon"><i class="fas fa-gift"></i></div>' +
          '<div><strong>Your jar is full!</strong>' +
          '<p>Request your upgraded visit card with <b>' + data.suggestedTierPercent + '%</b> (' + esc(data.suggestedTierLabel) + ').</p>' +
          '<button type="button" class="lp-btn lp-btn--primary" id="lpUpgradeBtn">' +
            '<i class="fas fa-paper-plane"></i> Request upgrade</button></div>' +
        '</div>';
    } else if (data.nextTier) {
      upgradeBlock =
        '<div class="lp-upgrade lp-upgrade--progress">' +
          '<div class="lp-progress-ring" style="--lp-progress:' + (data.progressToNext || 0) + '%">' +
            '<span>' + (data.progressToNext || 0) + '%</span></div>' +
          '<div><strong>Next: ' + esc(data.nextTier.label) + ' · ' + data.nextTier.percent + '%</strong>' +
          '<p>' + data.orders + ' orders · ' + fmtMoney(data.spend) + ' spent. Need ' +
            data.nextTier.ordersNeed + ' orders or ' + fmtMoney(data.nextTier.spendNeed) + '.</p></div>' +
        '</div>';
    }

    return (
      '<section class="lp-message">' +
        '<div class="lp-message__icon"><i class="fas fa-store"></i></div>' +
        '<p>' + esc(data.messageFromUs || '') + '</p>' +
      '</section>' +

      '<section class="lp-jar-section">' +
        '<div class="lp-jar-main">' + jarMarkup(data.jarFill, data.loyaltyTier, false) + '</div>' +
        '<div class="lp-jar-stats">' +
          '<div class="lp-stat"><span class="lp-stat__val">' + esc(String(data.orders || 0)) + '</span><span class="lp-stat__lbl">Orders</span></div>' +
          '<div class="lp-stat"><span class="lp-stat__val">' + esc(fmtMoney(data.spend)) + '</span><span class="lp-stat__lbl">Spent with us</span></div>' +
          '<div class="lp-stat"><span class="lp-stat__val">' + esc(data.tierLabel || '') + '</span><span class="lp-stat__lbl">Your tier</span></div>' +
        '</div>' +
      '</section>' +

      upgradeBlock +

      '<section class="lp-section">' +
        '<h3 class="lp-section__title">Loyalty path</h3>' +
        '<div class="lp-tier-road">' + tierRoadHtml(data) + '</div>' +
      '</section>' +

      '<section class="lp-section">' +
        '<h3 class="lp-section__title">Your recent orders</h3>' + ordersHtml(data) +
      '</section>' +

      '<section class="lp-section lp-section--contact">' +
        '<h3 class="lp-section__title">Quick contact</h3>' +
        '<div class="lp-contact-grid">' +
          '<a class="lp-contact lp-contact--wa" href="' + esc(buildContactUrl(links.whatsappUrl, contactMsg)) + '" target="_blank" rel="noopener noreferrer">' +
            '<i class="fab fa-whatsapp"></i><span>WhatsApp</span></a>' +
          '<a class="lp-contact lp-contact--tg" href="' + esc(buildContactUrl(links.telegramUrl, contactMsg)) + '" target="_blank" rel="noopener noreferrer">' +
            '<i class="fab fa-telegram"></i><span>Telegram</span></a>' +
          '<button type="button" class="lp-contact lp-contact--msg" id="lpOpenMessageBtn">' +
            '<i class="fas fa-comment-dots"></i><span>Message</span></button>' +
        '</div>' +
      '</section>' +

      '<section class="lp-section lp-section--ai">' +
        '<div class="lp-ai-card">' +
          '<div class="lp-ai-card__badge">Coming soon</div>' +
          '<h3 class="lp-ai-card__title"><i class="fas fa-robot"></i> Smart shopping assistant</h3>' +
          '<p>AI agents will help answer questions about stock, pickup and your discount — trained on AYLENSALE policies.</p>' +
        '</div>' +
      '</section>' +

      '<section class="lp-section lp-section--themes">' +
        '<h3 class="lp-section__title">Hub theme</h3>' +
        '<div class="lp-theme-picks">' + themePickerHtml() + '</div>' +
      '</section>'
    );
  }

  function bindPanelEvents(data) {
    var body = document.getElementById('loyaltyPortalBody');
    if (!body) return;

    body.querySelectorAll('[data-lp-theme]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        saveTheme(btn.getAttribute('data-lp-theme'));
        body.querySelectorAll('[data-lp-theme]').forEach(function(b) {
          b.classList.toggle('lp-theme-pick--on', b === btn);
        });
      });
    });

    var upgradeBtn = document.getElementById('lpUpgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', function() { submitUpgrade(data); });
    }

    var msgBtn = document.getElementById('lpOpenMessageBtn');
    if (msgBtn) {
      msgBtn.addEventListener('click', function() {
        close();
        var floatBtn = document.getElementById('heroMessageBtn') || document.querySelector('.contact-float-fab');
        if (floatBtn) floatBtn.click();
      });
    }
  }

  async function fetchData(force) {
    var code = getSessionCode();
    if (!code) return null;
    if (!force && state.data && state.data.code === code) return state.data;

    state.loading = true;
    try {
      var res = await fetch('/api/loyalty?code=' + encodeURIComponent(code), { credentials: 'same-origin' });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not load loyalty data');
      state.data = json;
      return json;
    } catch (e) {
      notifyMsg(e.message || 'Loyalty hub unavailable', 'error');
      return null;
    } finally {
      state.loading = false;
    }
  }

  async function submitUpgrade(data) {
    var btn = document.getElementById('lpUpgradeBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      var res = await fetch('/api/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: data.code,
          note: '',
          security: { formStartedAt: Date.now() - 2000, submittedAt: Date.now() }
        })
      });
      var json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      notifyMsg(json.message || 'Request sent!', 'success');
      state.data = null;
      await refresh(true);
    } catch (e) {
      notifyMsg(e.message || 'Could not send request', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Request upgrade'; }
    }
  }

  async function refresh(force) {
    ensureUi();
    var data = await fetchData(force);
    syncChip(data);
    if (state.open && data) {
      var header = document.getElementById('loyaltyPortalHeader');
      var body = document.getElementById('loyaltyPortalBody');
      if (header) header.innerHTML = renderHeader(data);
      if (body) {
        body.innerHTML = renderScrollContent(data);
        body.scrollTop = 0;
        bindPanelEvents(data);
      }
    }
    return data;
  }

  function open(focusPanel) {
    ensureUi();
    var root = document.getElementById('loyaltyPortalRoot');
    if (!root) return;
    state.open = true;
    root.classList.remove('is-hidden');
    lockPageScroll();
    refresh(true).then(function(data) {
      if (!data && focusPanel) close();
    });
  }

  function close() {
    state.open = false;
    var root = document.getElementById('loyaltyPortalRoot');
    if (root) root.classList.add('is-hidden');
    unlockPageScroll();
  }

  function onLogin(user) {
    loadTheme();
    ensureUi();
    syncChip(null);
    refresh(true).then(function(data) {
      if (!data) return;
      var seen = false;
      try { seen = !!localStorage.getItem(OPENED_KEY); } catch (e) {}
      if (!seen) {
        try { localStorage.setItem(OPENED_KEY, '1'); } catch (e2) {}
        setTimeout(function() { open(true); }, 600);
      }
    });
  }

  function onLogout() {
    state.data = null;
    close();
    syncChip(null);
  }

  function init() {
    loadTheme();
    if (!getSessionCode()) return;
    ensureUi();
    refresh(false);
  }

  global.AYLEN_LOYALTY_PORTAL = {
    init: init,
    open: open,
    close: close,
    refresh: refresh,
    syncChipFromSession: syncChipFromSession,
    onLogin: onLogin,
    onLogout: onLogout
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 400);
  }
})(window);
