/**
 * AYLENSALE VIP STOCK — subscription UX + member session.
 */
(function(global) {
  var SESSION_KEY = 'aylen_vip_session_v1';
  var VIP_BIDDER_PROFILE_KEY = 'aylen_vip_bidder_profile_v1';
  var PRICE_LABEL = '£9.99';

  var DEFAULT_CAROUSEL = (global.AYLEN_VIP_CAROUSEL_DEFAULTS && global.AYLEN_VIP_CAROUSEL_DEFAULTS.DEFAULT_VIP_PAYWALL_CAROUSEL) || [
    'https://images.pexels.com/photos/4483610/pexels-photo-4483610.jpeg?auto=compress&cs=tinysrgb&w=1200&h=675&fit=crop'
  ];

  function carouselImgHtml(url, alt, eager) {
    var fb = DEFAULT_CAROUSEL[0] || '';
    var safeUrl = esc(url);
    var safeFb = esc(fb);
    return (
      '<img src="' + safeUrl + '" alt="' + esc(alt) + '" loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async"' +
      ' referrerpolicy="no-referrer-when-downgrade"' +
      (safeFb ? ' data-fallback="' + safeFb + '" onerror="if(this.dataset.tried)return;this.dataset.tried=1;this.src=this.dataset.fallback||\'' + safeFb + '\';"' : '') +
      '>'
    );
  }

  var DEFAULT_HUB_CAROUSEL = (global.AYLEN_VIP_CAROUSEL_DEFAULTS && global.AYLEN_VIP_CAROUSEL_DEFAULTS.DEFAULT_VIP_HUB_CAROUSEL) || DEFAULT_CAROUSEL;

  function resolveHubCarousel(settings) {
    if (global.AYLEN_VIP_CAROUSEL_DEFAULTS && global.AYLEN_VIP_CAROUSEL_DEFAULTS.resolveVipHubCarousel) {
      return global.AYLEN_VIP_CAROUSEL_DEFAULTS.resolveVipHubCarousel(settings);
    }
    var raw = settings && settings.hubCarouselImages;
    if (Array.isArray(raw) && raw.length) return raw.slice();
    return DEFAULT_HUB_CAROUSEL.slice();
  }

  function resolvePaywallCarousel(settings) {
    if (global.AYLEN_VIP_CAROUSEL_DEFAULTS && global.AYLEN_VIP_CAROUSEL_DEFAULTS.resolveVipPaywallCarousel) {
      return global.AYLEN_VIP_CAROUSEL_DEFAULTS.resolveVipPaywallCarousel(settings);
    }
    var raw = settings && settings.carouselImages;
    if (Array.isArray(raw) && raw.length) return raw.slice();
    return DEFAULT_CAROUSEL.slice();
  }

  var hubHeroTimer = null;

  function esc(s) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(s)
      : String(s || '').replace(/[&<>"']/g, function(c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
    else if (type === 'error') alert(msg);
    else console.log('[VIP]', type || 'info', msg);
  }

  function setCheckoutError(msg) {
    var el = document.getElementById('vipCheckoutError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function setCheckoutLoading(loading) {
    document.querySelectorAll('[data-vip-subscribe]').forEach(function(btn) {
      if (loading) {
        if (!btn.dataset.vipLabel) btn.dataset.vipLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Opening checkout…';
      } else {
        btn.disabled = false;
        if (btn.dataset.vipLabel) btn.textContent = btn.dataset.vipLabel;
      }
    });
  }

  function isVipPreviewMode() {
    if (global.AYLEN_VIP_DEMO_MEMBER || global.AYLEN_VIP_ADMIN_LIVE_PREVIEW) return true;
    var demo = new URLSearchParams(global.location.search || '').get('demo');
    var preview = new URLSearchParams(global.location.search || '').get('preview');
    return demo === 'member' || preview === 'admin_live';
  }

  function isAdminLivePreviewMode() {
    return !!(global.AYLEN_VIP_ADMIN_LIVE_PREVIEW ||
      new URLSearchParams(global.location.search || '').get('preview') === 'admin_live');
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.accessToken) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveSession(data) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data || {}));
    } catch (e) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  var VIP_DEP_VER = '202605293100';

  function loadScriptOnce(src) {
    return new Promise(function(resolve, reject) {
      var key = src.split('?')[0];
      var existing = document.querySelector('script[data-vip-dep="' + key + '"]');
      if (existing) {
        if (existing.dataset.vipLoaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', function() { resolve(); }, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.dataset.vipDep = key;
      s.async = true;
      s.onload = function() { s.dataset.vipLoaded = '1'; resolve(); };
      s.onerror = function() { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(s);
    });
  }

  function ensureMemberDeps() {
    return Promise.all([
      loadScriptOnce('js/pickup-weather.js?v=' + VIP_DEP_VER),
      loadScriptOnce('js/pickup-locations.js?v=' + VIP_DEP_VER),
      loadScriptOnce('js/pdp-modal.js?v=' + VIP_DEP_VER)
    ]);
  }

  function showGuestPaywall(root, cfg) {
    root.innerHTML = renderLocked(cfg || null);
    bindSubscribeButtons();
    schedulePaywallCarousel(cfg || null);
  }

  async function fetchVipConfig() {
    try {
      var cfgRes = await fetch('/api/vip-config');
      return cfgRes.ok ? await cfgRes.json() : null;
    } catch (e) {
      return null;
    }
  }

  function patchPaywallMemberStats(cfg) {
    if (!cfg) return;
    var urgency = document.querySelector('.vip-page-locked__urgency');
    if (!urgency) return;
    var count = cfg.memberCount != null ? cfg.memberCount : 24;
    var limit = cfg.foundingMemberLimit != null ? cfg.foundingMemberLimit : 50;
    urgency.innerHTML =
      '<i class="fas fa-bolt"></i> Founding Members Price: <strong>' + PRICE_LABEL + '/month</strong><br>' +
      'Limited early access for first ' + esc(limit) + ' members · <strong>' + esc(count) + '</strong> active now';
  }

  function hydrateGuestPaywall(cfg) {
    if (cfg) patchPaywallMemberStats(cfg);
    schedulePaywallCarousel(cfg || null);
  }

  async function postJson(url, payload, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var res = await fetch(url, {
      method: options.method || 'POST',
      headers: headers,
      body: JSON.stringify(payload || {})
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {}
    if (!res.ok) {
      throw new Error(data.error || ('Request failed (' + res.status + ')'));
    }
    return data;
  }

  async function postJsonWithFallback(urls, payload, options) {
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        return await postJson(urls[i], payload, options);
      } catch (err) {
        lastErr = err;
        var msg = String(err.message || '');
        var retryable = /Request failed \((404|405|502|503)\)/.test(msg);
        if (!retryable || i === urls.length - 1) throw err;
      }
    }
    throw lastErr || new Error('Request failed');
  }

  function getAuctionBidFloor(auction) {
    var current = Number(auction.currentPrice || auction.currentBid || 0);
    var start = Number(auction.startingPrice || auction.startPrice || 0);
    return current > 0 ? current : start;
  }

  function getAuctionMinBidAmount(auction) {
    return Number((getAuctionBidFloor(auction) + 1).toFixed(2));
  }

  async function getVipBidRequestOptions() {
    var headers = {};
    if (isAdminLivePreviewMode()) {
      if (!global.FBDB || !global.FBDB.getAdminIdToken) {
        throw new Error('Admin preview needs Firebase — reload vip-live-preview.html');
      }
      headers.Authorization = 'Bearer ' + (await global.FBDB.getAdminIdToken());
      return { headers: headers, useAccessToken: false };
    }
    var session = getSession();
    if (!session || !session.accessToken || session.accessToken === 'admin-live-preview') {
      throw new Error('VIP session expired — refresh and log in again');
    }
    return {
      headers: headers,
      useAccessToken: true,
      accessToken: session.accessToken,
      email: session.email || ''
    };
  }

  async function refreshStatus() {
    var session = getSession();
    if (!session || !session.accessToken) {
      return { vip: { active: false, status: 'none' }, locked: true };
    }
    var data = await postJson('/api/vip-status', { accessToken: session.accessToken });
    if (data.vip) {
      saveSession(Object.assign({}, session, {
        email: data.vip.email || session.email,
        status: data.vip.status,
        active: data.vip.active,
        currentPeriodEnd: data.vip.currentPeriodEnd,
        cancelAtPeriodEnd: data.vip.cancelAtPeriodEnd,
        pastDue: data.vip.pastDue,
        bidderDisplayName: data.vip.bidderDisplayName,
        bidderPhone: data.vip.bidderPhone
      }));
      mergeVipBidderProfileFromStatus(data.vip);
    }
    return data;
  }

  async function startCheckout(email) {
    setCheckoutError('');
    setCheckoutLoading(true);
    try {
      var payload = {};
      var known = String(email || (getSession() && getSession().email) || '').trim().toLowerCase();
      if (known && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(known)) {
        payload.email = known;
      }
      var data = await postJson('/api/stripe-create-checkout', payload);
      if (data.url) {
        global.location.assign(data.url);
        return;
      }
      throw new Error('Checkout URL missing — contact support.');
    } catch (err) {
      setCheckoutLoading(false);
      var msg = err.message || 'Checkout failed';
      setCheckoutError(msg);
      notifyMsg(msg, 'error');
      throw err;
    }
  }

  async function verifyCheckout(sessionId) {
    if (!sessionId) return null;
    var data = await postJson('/api/vip-verify-checkout', { sessionId: sessionId });
    if (data.accessToken) {
      saveSession({
        accessToken: data.accessToken,
        email: data.vip && data.vip.email,
        status: data.vip && data.vip.status,
        active: data.vip && data.vip.active,
        currentPeriodEnd: data.vip && data.vip.currentPeriodEnd
      });
    }
    return data;
  }

  async function openBillingPortal() {
    if (isVipPreviewMode()) {
      notifyMsg('Preview mode — billing portal not available', 'info');
      return;
    }
    var session = getSession();
    if (!session || !session.accessToken) {
      notifyMsg('Log in with your VIP email subscription first.', 'info');
      return startCheckout();
    }
    var data = await postJson('/api/vip-portal', { accessToken: session.accessToken });
    if (data.url) global.location.href = data.url;
  }

  function bindSubscribeButtons() {
    document.querySelectorAll('[data-vip-subscribe]').forEach(function(btn) {
      if (btn._vipBound) return;
      btn._vipBound = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        startCheckout().catch(function(err) {
          notifyMsg(err.message || 'Checkout failed', 'error');
        });
      });
    });
    document.querySelectorAll('[data-vip-portal]').forEach(function(btn) {
      if (btn._vipBound) return;
      btn._vipBound = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        openBillingPortal().catch(function(err) {
          notifyMsg(err.message || 'Billing portal unavailable', 'error');
        });
      });
    });
    document.querySelectorAll('[data-vip-enter]').forEach(function(btn) {
      if (btn._vipBound) return;
      btn._vipBound = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        global.location.href = '/vip-stock';
      });
    });
    var restoreBtn = document.querySelector('[data-vip-restore-send]');
    if (restoreBtn && !restoreBtn._vipBound) {
      restoreBtn._vipBound = true;
      restoreBtn.addEventListener('click', function(e) {
        e.preventDefault();
        requestVipAccessLink();
      });
    }
  }

  async function requestVipAccessLink() {
    var input = document.getElementById('vipRestoreEmail');
    var email = input ? String(input.value || '').trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notifyMsg('Enter the email you used for VIP checkout', 'error');
      return;
    }
    try {
      var data = await postJson('/api/vip-magic-link', { email: email });
      notifyMsg(data.message || 'Check your email for VIP access link', 'success');
    } catch (err) {
      notifyMsg(err.message || 'Could not send access link', 'error');
    }
  }

  async function redeemMagicLink(token) {
    var data = await postJson('/api/vip-magic-redeem', { token: token });
    if (data.accessToken) {
      saveSession({
        accessToken: data.accessToken,
        email: data.email || (data.vip && data.vip.email) || '',
        active: true,
        status: data.vip && data.vip.status,
        currentPeriodEnd: data.vip && data.vip.currentPeriodEnd
      });
      return true;
    }
    return false;
  }

  function updateHomeCta() {
    var session = getSession();
    var active = session && session.active;
    document.querySelectorAll('[data-vip-cta-label]').forEach(function(el) {
      if (active) {
        el.textContent = 'Enter VIP Stock';
      } else {
        el.textContent = 'Subscribe Now';
      }
    });
    document.querySelectorAll('[data-vip-subscribe]').forEach(function(btn) {
      if (active) {
        btn.setAttribute('data-vip-enter', '1');
        btn.removeAttribute('data-vip-subscribe');
      }
    });
  }

  function mountPaywallCarousel(cfg) {
    var images = resolvePaywallCarousel(cfg || {});
    var root = document.querySelector('[data-vip-carousel]');
    if (root) initCarousel(root, images);
  }

  function applyHomeConfig(cfg) {
    if (!cfg) cfg = {};
    document.querySelectorAll('[data-vip-member-count]').forEach(function(el) {
      el.textContent = String(cfg.memberCount != null ? cfg.memberCount : 24);
    });
    document.querySelectorAll('[data-vip-founding-limit]').forEach(function(el) {
      el.textContent = String(cfg.foundingMemberLimit != null ? cfg.foundingMemberLimit : 50);
    });
    mountPaywallCarousel(cfg);
  }

  function schedulePaywallCarousel(cfg) {
    requestAnimationFrame(function() {
      mountPaywallCarousel(cfg || {});
    });
  }

  var carouselTimer = null;

  function bindCarouselSwipe(surface, goTo, getIndex) {
    if (!surface || surface._vipSwipeBound) return;
    surface._vipSwipeBound = true;
    var startX = 0;
    var startY = 0;
    var tracking = false;
    surface.addEventListener('touchstart', function(e) {
      if (!e.touches || !e.touches[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    surface.addEventListener('touchend', function(e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) goTo(getIndex() + 1);
      else goTo(getIndex() - 1);
    }, { passive: true });
  }

  function initCarousel(root, images) {
    if (!root || !images || !images.length) return;
    if (carouselTimer) {
      clearInterval(carouselTimer);
      carouselTimer = null;
    }
    var track = root.querySelector('[data-vip-carousel-track]');
    var dotsWrap = root.querySelector('[data-vip-carousel-dots]');
    if (!track) return;

    var slides = images.slice(0, 6);
    track.innerHTML = slides.map(function(url, i) {
      return (
        '<div class="vip-carousel__slide">' +
          carouselImgHtml(url, 'Amazon warehouse returns ' + (i + 1), i === 0) +
        '</div>'
      );
    }).join('');

    var index = 0;
    var total = slides.length;

    function goTo(i) {
      if (total < 1) return;
      index = ((i % total) + total) % total;
      track.style.transform = 'translate3d(-' + (index * 100) + '%, 0, 0)';
      if (dotsWrap) {
        dotsWrap.querySelectorAll('.vip-carousel__dot').forEach(function(dot, di) {
          dot.classList.toggle('is-active', di === index);
        });
      }
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      for (var d = 0; d < total; d++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'vip-carousel__dot' + (d === 0 ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Slide ' + (d + 1));
        (function(di) {
          dot.addEventListener('click', function() { goTo(di); });
        })(d);
        dotsWrap.appendChild(dot);
      }
    }

    goTo(0);
    bindCarouselSwipe(root, goTo, function() { return index; });
    if (global.ResizeObserver) {
      try {
        var ro = new ResizeObserver(function() { goTo(index); });
        ro.observe(root);
      } catch (e) {}
    }
    var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && total > 1) {
      carouselTimer = setInterval(function() {
        if (document.hidden) return;
        goTo(index + 1);
      }, 4200);
    }
  }

  async function initHomeSection() {
    bindSubscribeButtons();
    try {
      var cfgRes = await fetch('/api/vip-config');
      var cfg = cfgRes.ok ? await cfgRes.json() : null;
      var section = document.getElementById('vip-stock');
      if (cfg && cfg.enabled === false && section) {
        section.hidden = true;
        return;
      }
      applyHomeConfig(cfg);
      if (cfg && !cfg.checkoutReady && section) {
        document.querySelectorAll('[data-vip-subscribe]').forEach(function(btn) {
          btn.disabled = true;
          btn.title = 'VIP checkout is being configured';
        });
      }
      if (cfg && cfg.testMode) {
        document.querySelectorAll('.vip-compliance').forEach(function(el) {
          if (el.textContent.indexOf('TEST MODE') === -1) {
            el.textContent = 'TEST MODE — Stripe test keys active. ' + el.textContent;
          }
        });
      }
    } catch (e) {}
    try {
      await refreshStatus();
    } catch (e) {}
    updateHomeCta();
    bindSubscribeButtons();
  }

  function buildOrderWhatsAppUrl(waBase, title, price, code, orderRef) {
    var msg = 'Hi AYLENSALE VIP! ' +
      (orderRef ? 'Order ' + orderRef + ' — ' : '') +
      'I want to order: ' + String(title || 'VIP item') +
      (price != null ? ' (VIP £' + Number(price).toFixed(2) + ')' : '') +
      '. My code: ' + String(code || 'VIPSTOCK');
    var base = String(waBase || 'https://wa.me/447471647771').split('?')[0];
    return base + '?text=' + encodeURIComponent(msg);
  }

  function buildTelegramOrderUrl(tgBase, title, price, code, orderRef) {
    var msg = 'Hi AYLENSALE VIP! ' +
      (orderRef ? 'Order ' + orderRef + ' — ' : '') +
      'I want to buy: ' + String(title || 'VIP item') +
      (price != null ? ' (VIP £' + Number(price).toFixed(2) + ')' : '') +
      '. Code: ' + String(code || 'VIPSTOCK');
    var tg = String(tgBase || 'https://t.me/aylensale').trim();
    var userMatch = tg.match(/^https:\/\/t\.me\/([a-z0-9_]{3,64})\/?$/i);
    if (userMatch) {
      return 'https://t.me/' + userMatch[1] + '?text=' + encodeURIComponent(msg);
    }
    return 'https://t.me/share/url?url=' + encodeURIComponent('https://aylensale.com/vip-stock.html') +
      '&text=' + encodeURIComponent(msg);
  }

  function formatMoney(n) {
    return '£' + Number(n || 0).toFixed(2);
  }

  function formatAuctionEnds(endTime) {
    if (!endTime) return '';
    var end = Date.parse(endTime);
    if (!end || end <= Date.now()) return 'Ended';
    var diff = end - Date.now();
    var hrs = Math.floor(diff / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    if (hrs >= 48) return 'Ends ' + new Date(end).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (hrs > 0) return hrs + 'h ' + mins + 'm left';
    return mins + ' min left';
  }

  function isVipAuctionEarlyAccess(auction) {
    if (!auction) return false;
    if (auction.vipEarlyAccess) return true;
    if (!Number(auction.vipEarlyAccessHours || 0)) return false;
    var ps = auction.publicStartAt;
    if (!ps) return false;
    return Date.parse(ps) > Date.now();
  }

  function formatAuctionPublicStart(auction) {
    if (!isVipAuctionEarlyAccess(auction)) return '';
    var ps = auction.publicStartAt;
    if (!ps) return '';
    try {
      return 'Public launch: ' + new Date(ps).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function renderHubHeroMedia(settings) {
    var video = settings && settings.hubVideoUrl ? String(settings.hubVideoUrl).trim() : '';
    var imgs = resolveHubCarousel(settings || {});
    if (video) {
      return (
        '<div class="vip-glass-hero" id="vipHubHero">' +
          '<video class="vip-glass-hero__video" src="' + esc(video) + '" autoplay muted loop playsinline></video>' +
        '</div>'
      );
    }
    if (!imgs || !imgs.length) return '';
    var slides = imgs.map(function(url, i) {
      return '<div class="vip-glass-hero__slide">' + carouselImgHtml(url, 'Amazon warehouse returns ' + (i + 1), !i) + '</div>';
    }).join('');
    var dots = imgs.map(function(_, i) {
      return '<button type="button" class="vip-glass-hero__dot' + (i === 0 ? ' is-active' : '') + '" data-vip-hero-dot="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>';
    }).join('');
    return (
      '<div class="vip-glass-hero vip-glass-hero--warehouse" id="vipHubHero">' +
        '<div class="vip-glass-hero__badge"><i class="fas fa-warehouse"></i> Amazon returns warehouse</div>' +
        '<div class="vip-glass-hero__slides" id="vipHubHeroSlides">' + slides + '</div>' +
        (imgs.length > 1 ? '<div class="vip-glass-hero__dots">' + dots + '</div>' : '') +
      '</div>'
    );
  }

  function renderLiveStatsBar(liveStats) {
    var s = liveStats || {};
    var online = s.onlineVisitors != null ? s.onlineVisitors : '—';
    var carts = s.activeCarts != null ? s.activeCarts : '—';
    var vip = s.publicMemberCount != null ? s.publicMemberCount : (s.vipActive != null ? s.vipActive : '—');
    return (
      '<div class="vip-glass-live">' +
        '<span class="vip-glass-pill"><i class="fas fa-circle"></i> Online now <b>' + esc(online) + '</b></span>' +
        '<span class="vip-glass-pill"><i class="fas fa-shopping-cart"></i> Active carts <b>' + esc(carts) + '</b></span>' +
        '<span class="vip-glass-pill"><i class="fas fa-crown"></i> VIP members <b>' + esc(vip) + '</b></span>' +
      '</div>'
    );
  }

  function bindHubHeroCarousel() {
    if (hubHeroTimer) {
      clearInterval(hubHeroTimer);
      hubHeroTimer = null;
    }
    var slides = document.getElementById('vipHubHeroSlides');
    if (!slides) return;
    var index = 0;
    var total = slides.children.length;
    if (total < 2) return;
    function go(i) {
      index = (i + total) % total;
      slides.style.transform = 'translateX(-' + (index * 100) + '%)';
      document.querySelectorAll('[data-vip-hero-dot]').forEach(function(dot) {
        dot.classList.toggle('is-active', Number(dot.getAttribute('data-vip-hero-dot')) === index);
      });
    }
    document.querySelectorAll('[data-vip-hero-dot]').forEach(function(dot) {
      if (dot._vipHeroBound) return;
      dot._vipHeroBound = true;
      dot.addEventListener('click', function() {
        go(Number(dot.getAttribute('data-vip-hero-dot')) || 0);
      });
    });
    var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      hubHeroTimer = setInterval(function() {
        if (document.hidden) return;
        go(index + 1);
      }, 5000);
    }
  }

  function vipWeatherDomId(loc) {
    return 'vip-weather-' + String(loc.id || loc.name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function paintVipLocationWeather(loc) {
    var el = document.getElementById(vipWeatherDomId(loc));
    if (!el || !global.AYLEN_WEATHER) return;
    var forecast = global.AYLEN_WEATHER.forecastFromStored
      ? global.AYLEN_WEATHER.forecastFromStored(loc)
      : null;
    if (forecast) {
      global.AYLEN_WEATHER.paint(el, forecast, loc);
      return;
    }
    if (loc.lat && loc.lng && global.AYLEN_WEATHER.fetchLiveForecast) {
      el.innerHTML = global.AYLEN_WEATHER.renderLoadingHtml();
      global.AYLEN_WEATHER.fetchLiveForecast(Number(loc.lat), Number(loc.lng), global.AYLEN_WEATHER.pickupWeatherDays(loc.day || loc.days))
        .then(function(f) { global.AYLEN_WEATHER.paint(el, f, loc); })
        .catch(function() { el.innerHTML = global.AYLEN_WEATHER.renderFallbackHtml(); });
      return;
    }
    el.innerHTML = global.AYLEN_WEATHER.renderFallbackHtml();
  }

  function refreshVipLocationWeatherAll(locations) {
    (locations || []).forEach(function(loc) { paintVipLocationWeather(loc); });
  }

  async function recordVipItemView(itemId) {
    if (!itemId || isVipPreviewMode()) return;
    var session = getSession();
    if (!session || !session.accessToken) return;
    try {
      await postJson('/api/vip-item-view', { accessToken: session.accessToken, itemId: itemId });
    } catch (e) {}
  }

  function renderVipItemDetailInfoHtml(item) {
    if (!item) return '';
    var qty = item.stock != null ? Number(item.stock) : null;
    var itemId = String(item.id || '');
    var price = item.vipPrice != null ? item.vipPrice : item.price;
    var st = String(item.stockStatus || 'available').toLowerCase();
    var reserved = st === 'reserved';
    var rmEnabled = !!item.royalMailPayEnabled;
    var rmFee = Number(item.royalMailFeeGbp || 0);
    var rmTotal = Number(price || 0) + rmFee;
    var rmBtn = '';
    if (!reserved && rmEnabled) {
      rmBtn = '<button type="button" class="vip-btn vip-btn--gold vip-btn--rm" data-vip-rm-pay' +
        ' data-item-id="' + esc(itemId) + '"' +
        ' data-item-title="' + esc(item.title || item.name || 'VIP item') + '"' +
        ' data-item-price="' + esc(Number(price || 0).toFixed(2)) + '"' +
        ' data-rm-fee="' + esc(rmFee.toFixed(2)) + '"' +
        ' data-rm-total="' + esc(rmTotal.toFixed(2)) + '">' +
        '<i class="fas fa-credit-card"></i> Pay &amp; Royal Mail' +
        (rmFee > 0 ? ' · ' + formatMoney(rmTotal) : '') +
        '</button>';
    }
    var buyActions = reserved
      ? '<p class="vip-pdp-reserved"><i class="fas fa-lock"></i> Reserved — message us on WhatsApp or Telegram</p>'
      : rmBtn +
        '<button type="button" class="vip-btn vip-btn--gold" data-vip-place-order data-item-id="' + esc(itemId) + '" data-channel="whatsapp"><i class="fab fa-whatsapp"></i> Buy on WhatsApp</button>' +
        '<button type="button" class="vip-btn vip-btn--gold" data-vip-place-order data-item-id="' + esc(itemId) + '" data-channel="telegram"><i class="fab fa-telegram"></i> Buy on Telegram</button>';
    return (
      '<h3 id="vipPdpTitle">' + esc(item.title || item.name || 'VIP item') + '</h3>' +
      '<p class="vip-pdp-meta">' + esc(item.categoryLabel || item.category || 'General') +
        (qty != null ? ' · Stock: <b>' + esc(qty) + '</b>' : '') +
        ' · ' + esc(Number(item.viewCount || 0)) + ' views</p>' +
      (price != null ? '<p class="vip-pdp-price">VIP ' + formatMoney(price) + '</p>' : '') +
      (item.desc ? '<div class="vip-pdp-desc">' + esc(item.desc).replace(/\n/g, '<br>') + '</div>' : '') +
      '<div class="vip-pdp-actions">' + buyActions + '</div>'
    );
  }

  function openVipLightbox(imgs, startIdx) {
    if (global.AYLEN_PDP && global.AYLEN_PDP.openLightbox) {
      global.AYLEN_PDP.openLightbox(imgs, startIdx);
      return;
    }
  }

  function closeVipLightbox() {
    if (global.AYLEN_PDP && global.AYLEN_PDP.closeLightbox) global.AYLEN_PDP.closeLightbox();
  }

  function openVipItemDetail(item) {
    if (!item) return;
    var imgs = (item.images && item.images.length) ? item.images : (item.imageUrl ? [item.imageUrl] : []);
    if (global.AYLEN_PDP && global.AYLEN_PDP.openModal) {
      var galleryHtml = item.videoUrl
        ? '<video class="vip-detail-video" src="' + esc(item.videoUrl) + '" controls playsinline></video>'
        : null;
      global.AYLEN_PDP.openModal({
        theme: 'vip',
        id: 'vipItemDetailModal',
        modalClass: 'vip-pdp-modal',
        panelClass: 'vip-pdp-panel',
        imgs: imgs,
        galleryHtml: galleryHtml,
        infoHtml: renderVipItemDetailInfoHtml(item),
        onOpen: function() {
          recordVipItemView(item.id);
          bindVipOrderButtons();
          bindVipRoyalMailButtons();
        }
      });
      return;
    }
  }

  function closeVipItemDetail() {
    if (global.AYLEN_PDP && global.AYLEN_PDP.closeModal) global.AYLEN_PDP.closeModal();
  }

  function getMyVipBidderKey() {
    try {
      var raw = localStorage.getItem(VIP_BIDDER_PROFILE_KEY);
      if (raw) {
        var stored = JSON.parse(raw);
        if (stored && stored.bidderKey) return stored.bidderKey;
      }
    } catch (e) {}
    var session = getSession();
    if (!session || !session.email) return '';
    return 'email:' + String(session.email).trim().toLowerCase();
  }

  function getVipBidderProfile() {
    var session = getSession();
    var stored = null;
    try {
      var raw = localStorage.getItem(VIP_BIDDER_PROFILE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {}
    var email = (session && session.email) || (stored && stored.email) || '';
    var name = (stored && stored.name) ||
      (session && session.bidderDisplayName) ||
      (email ? email.split('@')[0] : '');
    var phone = (stored && stored.phone) || (session && session.bidderPhone) || '';
    return { name: name, phone: phone, email: email };
  }

  function saveVipBidderProfileLocal(profile) {
    var session = getSession();
    try {
      localStorage.setItem(VIP_BIDDER_PROFILE_KEY, JSON.stringify({
        name: String((profile && profile.name) || '').slice(0, 80),
        phone: String((profile && profile.phone) || '').slice(0, 40),
        email: (session && session.email) || (profile && profile.email) || '',
        bidderKey: String((profile && profile.bidderKey) || '').slice(0, 120)
      }));
    } catch (e) {}
  }

  function mergeVipBidderProfileFromStatus(vip) {
    if (!vip) return;
    var session = getSession();
    if (!session) return;
    if (vip.bidderDisplayName) session.bidderDisplayName = vip.bidderDisplayName;
    if (vip.bidderPhone) session.bidderPhone = vip.bidderPhone;
    saveSession(session);
    var local = getVipBidderProfile();
    saveVipBidderProfileLocal({
      name: vip.bidderDisplayName || local.name,
      phone: vip.bidderPhone || local.phone,
      email: vip.email || local.email
    });
  }

  function isMyAuctionBidLeading(auction) {
    var key = getMyVipBidderKey();
    if (!key) return false;
    var top = getAuctionBidsSorted(auction)[0];
    return !!(top && top.bidderKey === key);
  }

  function formatAuctionBidTime(timestamp) {
    if (!timestamp) return '—';
    try {
      return new Date(timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return String(timestamp);
    }
  }

  function getAuctionBidsSorted(auction) {
    return (auction && auction.bids ? auction.bids.slice() : []).sort(function(a, b) {
      return (Date.parse(b.timestamp || 0) || 0) - (Date.parse(a.timestamp || 0) || 0);
    });
  }

  function getAuctionLeadingBidder(auction) {
    var top = getAuctionBidsSorted(auction)[0];
    if (!top) return '';
    return top.bidderName || top.bidder || 'Bidder';
  }

  function renderVipAuctionBidHistory(auction) {
    var bids = getAuctionBidsSorted(auction);
    if (!bids.length) {
      return (
        '<div class="vip-bid-history vip-bid-history--empty" id="vipAuctionBidHistory">' +
          '<h4 class="vip-bid-history__title"><i class="fas fa-users"></i> Bid history</h4>' +
          '<p>No bids yet — be the first.</p>' +
        '</div>'
      );
    }
    var rows = bids.slice(0, 20).map(function(b, i) {
      var crown = i === 0 ? '<i class="fas fa-crown vip-bid-history__crown" aria-hidden="true"></i> ' : '';
      var mine = b.bidderKey && b.bidderKey === getMyVipBidderKey();
      return (
        '<div class="vip-bid-history__row' + (i === 0 ? ' vip-bid-history__row--lead' : '') + (mine ? ' vip-bid-history__row--mine' : '') + '">' +
          '<span class="vip-bid-history__name">' + crown + esc(b.bidderName || b.bidder || 'Bidder') + (mine ? ' <small>(you)</small>' : '') + '</span>' +
          '<span class="vip-bid-history__amount">' + formatMoney(b.amount) + '</span>' +
          '<span class="vip-bid-history__time">' + esc(formatAuctionBidTime(b.timestamp)) + '</span>' +
        '</div>'
      );
    }).join('');
    var more = bids.length > 20
      ? '<p class="vip-bid-history__more">+' + (bids.length - 20) + ' older bids</p>'
      : '';
    return (
      '<div class="vip-bid-history" id="vipAuctionBidHistory">' +
        '<h4 class="vip-bid-history__title"><i class="fas fa-users"></i> Who bid · ' + bids.length + '</h4>' +
        '<div class="vip-bid-history__list">' + rows + more + '</div>' +
      '</div>'
    );
  }

  function refreshVipAuctionBidHistory(auction) {
    var block = document.getElementById('vipAuctionBidHistory');
    if (!block || !block.parentNode) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = renderVipAuctionBidHistory(auction);
    var next = tmp.firstElementChild;
    if (next) block.parentNode.replaceChild(next, block);
    var leaderEl = document.getElementById('vipAuctionLeadingBidder');
    if (leaderEl) {
      var leader = getAuctionLeadingBidder(auction);
      leaderEl.innerHTML = leader
        ? 'Leading bidder: <b>' + esc(leader) + '</b>'
        : '';
      leaderEl.hidden = !leader;
    }
  }

  function renderVipAuctionDetailModal(auction) {
    if (!auction) return '';
    var imgs = (auction.images && auction.images.length) ? auction.images : (auction.imageUrl ? [auction.imageUrl] : []);
    var mainImg = imgs[0] || '/logo.png';
    var current = Number(auction.currentPrice || auction.currentBid || 0);
    var start = Number(auction.startingPrice || auction.startPrice || 0);
    var displayPrice = current > 0 ? current : start;
    var minBid = getAuctionMinBidAmount(auction).toFixed(2);
    var galleryHtml = global.AYLEN_PDP && global.AYLEN_PDP.renderGalleryHtml
      ? global.AYLEN_PDP.renderGalleryHtml(imgs)
      : (
        '<button type="button" class="vip-pdp-main-btn">' +
          '<img class="vip-pdp-main-img" src="' + esc(mainImg) + '" alt="">' +
        '</button>'
      );
    var ends = formatAuctionEnds(auction.endTime);
    var profile = getVipBidderProfile();
    var defaultName = profile.name || '';
    var defaultPhone = profile.phone || '';
    var leader = getAuctionLeadingBidder(auction);
    var myLead = isMyAuctionBidLeading(auction);
    var identityNote = profile.email
      ? '<p class="vip-auction-identity"><i class="fas fa-user-check"></i> Linked to VIP: <strong>' + esc(profile.email) + '</strong> — one account per auction</p>'
      : '';
    var leadNote = myLead
      ? '<p class="vip-auction-you-lead"><i class="fas fa-check-circle"></i> You are the highest bidder — wait for another bid before raising again.</p>'
      : '';
    return (
      '<div id="vipAuctionDetailModal" class="vip-rm-modal vip-pdp-modal" aria-hidden="false">' +
        '<div class="vip-rm-modal__backdrop" data-vip-auction-close></div>' +
        '<div class="vip-rm-modal__panel vip-pdp-panel" role="dialog">' +
          '<button type="button" class="vip-rm-modal__close" data-vip-auction-close aria-label="Close">&times;</button>' +
          '<div class="vip-pdp-layout">' +
            '<div class="vip-pdp-gallery" data-pdp-gallery-root>' + galleryHtml + '</div>' +
            '<div class="vip-pdp-info">' +
              '<span class="vip-stock-card__badge">' + (isVipAuctionEarlyAccess(auction) ? 'VIP Early Access' : 'Live auction') + '</span>' +
              '<h3>' + esc(auction.name || auction.title || 'Auction') + '</h3>' +
              '<p class="vip-pdp-meta">' +
                '<span id="vipAuctionCurrentPrice">Current bid: <b>' + formatMoney(displayPrice) + '</b></span>' +
                (start && current <= start ? ' · Starting ' + formatMoney(start) : '') +
                ' · ' + esc(Number(auction.bidsCount || 0)) + ' bids' +
                (auction.viewCount ? ' · ' + esc(auction.viewCount) + ' views' : '') +
              '</p>' +
              (ends ? '<p class="vip-auction-ends"><i class="fas fa-clock"></i> ' + esc(ends) + '</p>' : '') +
              (formatAuctionPublicStart(auction) ? '<p class="vip-auction-ends vip-auction-ends--early"><i class="fas fa-crown"></i> ' + esc(formatAuctionPublicStart(auction)) + '</p>' : '') +
              (leader ? '<p class="vip-auction-leader" id="vipAuctionLeadingBidder"><i class="fas fa-crown"></i> Leading bidder: <b>' + esc(leader) + '</b></p>' : '<p class="vip-auction-leader" id="vipAuctionLeadingBidder" hidden></p>') +
              (auction.desc ? '<div class="vip-pdp-desc">' + esc(auction.desc).replace(/\n/g, '<br>') + '</div>' : '') +
              renderVipAuctionBidHistory(auction) +
              identityNote +
              leadNote +
              '<form id="vipAuctionBidForm" class="vip-auction-bid-form">' +
                '<input type="hidden" name="auctionId" value="' + esc(String(auction.id || '')) + '">' +
                '<label>Your bid (£)<input type="number" step="0.01" min="' + esc(minBid) + '" name="amount" class="vip-rm-input" placeholder="' + esc(minBid) + '" required' + (myLead ? ' disabled' : '') + '></label>' +
                '<p class="vip-auction-min">Minimum bid: <strong>' + formatMoney(minBid) + '</strong></p>' +
                '<label>Your name<input type="text" name="name" class="vip-rm-input" value="' + esc(defaultName) + '" required maxlength="80" autocomplete="name"></label>' +
                '<label>UK phone <small>(required — links £50 deposit &amp; winner flow)</small><input type="tel" name="phone" class="vip-rm-input" value="' + esc(defaultPhone) + '" maxlength="40" autocomplete="tel" required></label>' +
                '<p id="vipAuctionBidError" class="vip-rm-error" hidden role="alert"></p>' +
                '<button type="submit" class="vip-btn vip-btn--gold"' + (myLead ? ' disabled' : '') + '><i class="fas fa-gavel"></i> Place bid</button>' +
              '</form>' +
              '<p class="vip-auction-hint">Anti-spam: 45s cooldown · same VIP email cannot use fake names · highest bidder must wait.</p>' +
            '</div>' +
          '</div>' +
        '</div></div>'
    );
  }

  function openVipAuctionDetail(auction) {
    var existing = document.getElementById('vipAuctionDetailModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', renderVipAuctionDetailModal(auction));
    document.body.classList.add('vip-rm-modal-open');
    var imgs = (auction.images && auction.images.length) ? auction.images : (auction.imageUrl ? [auction.imageUrl] : []);
    document.querySelectorAll('[data-vip-auction-close]').forEach(function(el) {
      el.addEventListener('click', closeVipAuctionDetail);
    });
    var galleryRoot = document.querySelector('#vipAuctionDetailModal [data-pdp-gallery-root]');
    if (global.AYLEN_PDP && galleryRoot) {
      global.AYLEN_PDP.bindGallery(galleryRoot, imgs);
    }
    var form = document.getElementById('vipAuctionBidForm');
    if (form && !form._vipBidBound) {
      form._vipBidBound = true;
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitVipAuctionBid(form, auction);
      });
    }
  }

  function closeVipAuctionDetail() {
    var modal = document.getElementById('vipAuctionDetailModal');
    if (modal) modal.remove();
    document.body.classList.remove('vip-rm-modal-open');
  }

  function setAuctionBidError(msg) {
    var el = document.getElementById('vipAuctionBidError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  async function submitVipAuctionBid(form, auction) {
    if (isVipPreviewMode() && !isAdminLivePreviewMode()) {
      notifyMsg('Preview mode — bids are not saved here', 'info');
      return;
    }
    var fd = new FormData(form);
    var amount = Number(fd.get('amount'));
    var floor = getAuctionBidFloor(auction);
    if (!Number.isFinite(amount) || amount <= floor) {
      setAuctionBidError('Bid must be higher than ' + formatMoney(floor));
      notifyMsg('Bid must be higher than ' + formatMoney(floor), 'error');
      return;
    }
    if (!String(fd.get('phone') || '').trim()) {
      setAuctionBidError('UK phone is required for auction bids');
      return;
    }
    if (!String(fd.get('name') || '').trim()) {
      setAuctionBidError('Please enter your name');
      return;
    }
    var submitBtn = form.querySelector('button[type="submit"]');
    var label = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing bid…';
    }
    setAuctionBidError('');
    try {
      var authOpts = await getVipBidRequestOptions();
      var payload = {
        auctionId: fd.get('auctionId') || auction.id,
        amount: amount,
        name: fd.get('name'),
        phone: fd.get('phone') || ''
      };
      if (authOpts.useAccessToken) {
        payload.accessToken = authOpts.accessToken;
        payload.contact = authOpts.email || '';
      }
      var data = await postJsonWithFallback(
        ['/api/vip-auction-bid', '/api/vip?action=vip-auction-bid'],
        payload,
        { headers: authOpts.headers }
      );
      saveVipBidderProfileLocal({
        name: fd.get('name'),
        phone: fd.get('phone') || '',
        email: authOpts.email || getVipBidderProfile().email,
        bidderKey: (data.bid && data.bid.bidderKey) || ''
      });
      notifyMsg('Bid placed — ' + formatMoney(data.currentPrice), 'success');
      var priceEl = document.getElementById('vipAuctionCurrentPrice');
      if (priceEl) priceEl.innerHTML = 'Current bid: <b>' + formatMoney(data.currentPrice) + '</b>';
      auction.currentPrice = data.currentPrice;
      auction.currentBid = data.currentPrice;
      auction.bidsCount = data.bidsCount;
      if (Array.isArray(data.bids) && data.bids.length) {
        auction.bids = data.bids;
      } else if (data.bid) {
        auction.bids = [data.bid].concat(getAuctionBidsSorted(auction).filter(function(b) {
          return String(b.id || '') !== String(data.bid.id || '');
        }));
      }
      refreshVipAuctionBidHistory(auction);
      var idx = vipAuctionCache.findIndex(function(a) { return String(a.id) === String(auction.id); });
      if (idx >= 0) {
        vipAuctionCache[idx] = Object.assign({}, vipAuctionCache[idx], auction);
        refreshAuctionCardPrice(auction.id, data.currentPrice, data.bidsCount, getAuctionLeadingBidder(auction));
      }
      var amountInput = form.querySelector('[name="amount"]');
      if (amountInput) {
        var nextMin = getAuctionMinBidAmount(auction).toFixed(2);
        amountInput.min = nextMin;
        amountInput.placeholder = nextMin;
        amountInput.value = '';
        var minHint = form.querySelector('.vip-auction-min strong');
        if (minHint) minHint.textContent = formatMoney(nextMin);
      }
    } catch (err) {
      var errMsg = err.message || 'Could not place bid';
      if (err.code === 'DEPOSIT_REQUIRED' || /deposit/i.test(errMsg)) {
        errMsg = 'Pay the £50 auction deposit on the main site before bidding (one deposit covers all lots).';
      }
      setAuctionBidError(errMsg);
      notifyMsg(errMsg, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = label;
      }
    }
  }

  function refreshAuctionCardPrice(auctionId, price, bidsCount, leaderName) {
    var card = document.querySelector('[data-vip-auction-id="' + auctionId + '"]');
    if (!card) return;
    var priceEl = card.querySelector('[data-vip-auction-price]');
    if (priceEl) priceEl.textContent = formatMoney(price);
    var bidsEl = card.querySelector('[data-vip-auction-bids]');
    if (bidsEl) bidsEl.textContent = String(bidsCount) + ' bids';
    var leaderEl = card.querySelector('[data-vip-auction-leader]');
    if (leaderEl) {
      if (leaderName) {
        leaderEl.innerHTML = '<i class="fas fa-crown"></i> ' + esc(leaderName);
        leaderEl.hidden = false;
      } else {
        leaderEl.hidden = true;
      }
    }
  }

  var vipStockCache = [];
  var vipAuctionCache = [];
  var vipOrderOptsCache = {};
  var vipHubDataCache = null;

  function bindVipItemOpenButtons(stockItems) {
    vipStockCache = stockItems || [];
    document.querySelectorAll('[data-vip-open-item]').forEach(function(btn) {
      if (btn._vipOpenBound) return;
      btn._vipOpenBound = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var id = btn.getAttribute('data-vip-open-item');
        var item = vipStockCache.find(function(x) { return String(x.id) === String(id); });
        if (item) openVipItemDetail(item);
      });
    });
  }

  function renderStockGrid(items, orderOpts) {
    orderOpts = orderOpts || {};
    var wa = orderOpts.wa || 'https://wa.me/447471647771';
    var tg = orderOpts.tg || 'https://t.me/aylensale';
    var code = orderOpts.code || 'VIPSTOCK';
    if (!items || !items.length) {
      return '<div class="vip-stock-empty">No VIP stock yet — Admin → VIP Members → Seed starter pack.</div>';
    }
    var byCat = {};
    items.forEach(function(item) {
      var key = item.category || 'general';
      if (!byCat[key]) byCat[key] = { label: item.categoryLabel || key, items: [] };
      byCat[key].items.push(item);
    });
    var catKeys = Object.keys(byCat);
    return catKeys.map(function(key) {
      var group = byCat[key];
      return (
        '<div class="vip-stock-category">' +
          '<h3 class="vip-stock-category__title">' + esc(group.label) + ' <span>(' + group.items.length + ')</span></h3>' +
          '<div class="vip-stock-grid">' +
            group.items.map(function(item) {
              var imgs = (item.images && item.images.length) ? item.images : [];
              var img = imgs[0] || item.imageUrl || item.photoUrl || '/logo.png';
              var price = item.vipPrice != null ? item.vipPrice : item.price;
              var itemId = String(item.id || '');
              var st = String(item.stockStatus || 'available').toLowerCase();
              var reserved = st === 'reserved';
              var rmEnabled = !!item.royalMailPayEnabled;
              var rmFee = Number(item.royalMailFeeGbp || 0);
              var rmTotal = Number(price || 0) + rmFee;
              var qty = item.stock != null ? Number(item.stock) : null;
              var views = Number(item.viewCount || 0);
              var photoBadge = imgs.length > 1 ? ('+' + (imgs.length - 1)) : '';
              var linkedAuctionId = String(item.linkedAuctionId || '').trim();
              var isAuctionEarly = item.itemType === 'auction_early' || !!linkedAuctionId;
              var rmBtn = '';
              if (!reserved && rmEnabled) {
                rmBtn = '<button type="button" class="vip-btn vip-btn--gold vip-btn--rm" data-vip-rm-pay' +
                  ' data-item-id="' + esc(itemId) + '"' +
                  ' data-item-title="' + esc(item.title || item.name || 'VIP item') + '"' +
                  ' data-item-price="' + esc(Number(price || 0).toFixed(2)) + '"' +
                  ' data-rm-fee="' + esc(rmFee.toFixed(2)) + '"' +
                  ' data-rm-total="' + esc(rmTotal.toFixed(2)) + '">' +
                  '<i class="fas fa-credit-card"></i> Pay &amp; Royal Mail' +
                  (rmFee > 0 ? ' · £' + esc(rmTotal.toFixed(2)) : '') +
                  '</button>';
              }
              return (
                '<article class="vip-stock-card vip-stock-card--glass' + (reserved ? ' vip-stock-card--reserved' : '') + '" data-vip-item-id="' + esc(itemId) + '">' +
                  (item.badge ? '<span class="vip-stock-card__badge">' + esc(item.badge) + '</span>' : '') +
                  (reserved ? '<span class="vip-stock-card__badge vip-stock-card__badge--muted">Reserved</span>' : '') +
                  (photoBadge ? '<span class="vip-stock-card__badge vip-stock-card__badge--photos">' + esc(photoBadge) + ' photos</span>' : '') +
                  '<button type="button" class="vip-stock-card__img-btn" data-vip-open-item="' + esc(itemId) + '">' +
                    '<img class="vip-stock-card__img" src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' +
                  '</button>' +
                  '<h4><button type="button" class="vip-stock-card__title-btn" data-vip-open-item="' + esc(itemId) + '">' + esc(item.title || item.name || 'VIP lot') + '</button></h4>' +
                  (item.desc ? '<p>' + esc(item.desc.slice(0, 120)) + (item.desc.length > 120 ? '…' : '') + '</p>' : '') +
                  '<div class="vip-stock-card__meta">' +
                    (price != null ? '<div class="vip-stock-card__price">VIP £' + esc(Number(price).toFixed(2)) + '</div>' : '') +
                    (qty != null ? '<span class="vip-stock-card__qty">Stock: ' + esc(qty) + '</span>' : '') +
                    (views > 0 ? '<span class="vip-stock-card__views"><i class="fas fa-eye"></i> ' + esc(views) + '</span>' : '') +
                  '</div>' +
                  '<div class="vip-stock-card__actions">' +
                    (isAuctionEarly && linkedAuctionId
                      ? '<button type="button" class="vip-btn vip-btn--gold" data-vip-open-auction="' + esc(linkedAuctionId) + '"><i class="fas fa-gavel"></i> Bid now (VIP early)</button>'
                      : (reserved
                      ? '<span class="vip-btn vip-btn--ghost" style="opacity:0.7">Reserved — message us</span>'
                      : rmBtn +
                        '<button type="button" class="vip-btn vip-btn--gold" data-vip-place-order data-item-id="' + esc(itemId) + '" data-channel="whatsapp"><i class="fab fa-whatsapp"></i> Buy</button>' +
                        '<button type="button" class="vip-btn vip-btn--gold" data-vip-place-order data-item-id="' + esc(itemId) + '" data-channel="telegram"><i class="fab fa-telegram"></i> Telegram</button>')) +
                    '<button type="button" class="vip-btn vip-btn--ghost" data-vip-open-item="' + esc(itemId) + '"><i class="fas fa-expand"></i> Details</button>' +
                  '</div>' +
                '</article>'
              );
            }).join('') +
          '</div></div>'
      );
    }).join('');
  }

  function renderRoyalMailModalShell() {
    return (
      '<div id="vipRmModal" class="vip-rm-modal" hidden aria-hidden="true">' +
        '<div class="vip-rm-modal__backdrop" data-vip-rm-close></div>' +
        '<div class="vip-rm-modal__panel" role="dialog" aria-labelledby="vipRmModalTitle">' +
          '<button type="button" class="vip-rm-modal__close" data-vip-rm-close aria-label="Close">&times;</button>' +
          '<h3 id="vipRmModalTitle">Pay &amp; Royal Mail</h3>' +
          '<p class="vip-rm-modal__lead" id="vipRmModalItem">—</p>' +
          '<p class="vip-rm-modal__total" id="vipRmModalTotal"></p>' +
          '<form id="vipRmForm" class="vip-rm-form">' +
            '<input type="hidden" id="vipRmItemId" value="">' +
            '<label>Full name<input id="vipRmName" class="vip-rm-input" autocomplete="name" required></label>' +
            '<label>Address line 1<input id="vipRmLine1" class="vip-rm-input" autocomplete="address-line1" required></label>' +
            '<label>Address line 2 <small>(optional)</small><input id="vipRmLine2" class="vip-rm-input" autocomplete="address-line2"></label>' +
            '<label>Town / city<input id="vipRmCity" class="vip-rm-input" autocomplete="address-level2" required></label>' +
            '<label>UK postcode<input id="vipRmPostcode" class="vip-rm-input" autocomplete="postal-code" required placeholder="SW1A 1AA"></label>' +
            '<p id="vipRmError" class="vip-rm-error" hidden role="alert"></p>' +
            '<button type="submit" class="vip-btn vip-btn--gold vip-rm-submit"><i class="fas fa-lock"></i> Continue to secure payment</button>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
  }

  function setRoyalMailError(msg) {
    var el = document.getElementById('vipRmError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function openRoyalMailModal(itemId, title, price, fee, total) {
    var modal = document.getElementById('vipRmModal');
    if (!modal) return;
    document.getElementById('vipRmItemId').value = itemId || '';
    document.getElementById('vipRmModalItem').textContent = String(title || 'VIP item') + ' · VIP £' + Number(price || 0).toFixed(2);
    var totalEl = document.getElementById('vipRmModalTotal');
    if (totalEl) {
      totalEl.textContent = Number(fee || 0) > 0
        ? 'Total inc. Royal Mail: £' + Number(total || 0).toFixed(2)
        : 'Total: £' + Number(total || price || 0).toFixed(2) + ' (Royal Mail included)';
    }
    setRoyalMailError('');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('vip-rm-modal-open');
  }

  function closeRoyalMailModal() {
    var modal = document.getElementById('vipRmModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('vip-rm-modal-open');
    setRoyalMailError('');
  }

  async function startRoyalMailCheckout(itemId, shipping) {
    if (isVipPreviewMode()) {
      notifyMsg('Preview mode — card payment not available here', 'info');
      return;
    }
    var session = getSession();
    if (!session || !session.accessToken) {
      notifyMsg('VIP session expired — refresh and log in again', 'error');
      return;
    }
    var data = await postJson('/api/vip-item-checkout', {
      accessToken: session.accessToken,
      itemId: itemId,
      shipping: shipping
    });
    if (data.url) {
      global.location.assign(data.url);
      return;
    }
    throw new Error('Checkout URL missing');
  }

  async function verifyItemPayment(sessionId) {
    if (!sessionId) return null;
    return postJson('/api/vip-item-verify', { sessionId: sessionId });
  }

  function bindRoyalMailModal() {
    var modal = document.getElementById('vipRmModal');
    if (!modal || modal._vipRmBound) return;
    modal._vipRmBound = true;
    modal.querySelectorAll('[data-vip-rm-close]').forEach(function(el) {
      el.addEventListener('click', closeRoyalMailModal);
    });
    var form = document.getElementById('vipRmForm');
    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var itemId = (document.getElementById('vipRmItemId') || {}).value;
        var submitBtn = form.querySelector('.vip-rm-submit');
        var label = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening checkout…';
        }
        setRoyalMailError('');
        try {
          await startRoyalMailCheckout(itemId, {
            name: (document.getElementById('vipRmName') || {}).value,
            line1: (document.getElementById('vipRmLine1') || {}).value,
            line2: (document.getElementById('vipRmLine2') || {}).value,
            city: (document.getElementById('vipRmCity') || {}).value,
            postcode: (document.getElementById('vipRmPostcode') || {}).value
          });
        } catch (err) {
          setRoyalMailError(err.message || 'Checkout failed');
          notifyMsg(err.message || 'Checkout failed', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = label;
          }
        }
      });
    }
  }

  function bindVipRoyalMailButtons() {
    document.querySelectorAll('[data-vip-rm-pay]').forEach(function(btn) {
      if (btn._vipRmBound) return;
      btn._vipRmBound = true;
      btn.addEventListener('click', function() {
        openRoyalMailModal(
          btn.getAttribute('data-item-id'),
          btn.getAttribute('data-item-title'),
          btn.getAttribute('data-item-price'),
          btn.getAttribute('data-rm-fee'),
          btn.getAttribute('data-rm-total')
        );
      });
    });
    bindRoyalMailModal();
  }

  function renderAuctionsGrid(auctions) {
    if (!auctions || !auctions.length) {
      return '<div class="vip-stock-empty">No live auctions right now — we post new lots in VIP Telegram first.</div>';
    }
    return (
      '<div class="vip-stock-grid vip-stock-grid--auctions">' +
      auctions.map(function(a) {
        var imgs = (a.images && a.images.length) ? a.images : [];
        var img = imgs[0] || a.imageUrl || '/logo.png';
        var bid = Number(a.currentPrice || a.currentBid || 0);
        var start = Number(a.startingPrice || a.startPrice || 0);
        var display = bid > 0 ? bid : start;
        var bids = Number(a.bidsCount || 0);
        var views = Number(a.viewCount || 0);
        var ends = formatAuctionEnds(a.endTime);
        var aid = String(a.id || '');
        var photoBadge = imgs.length > 1 ? ('+' + (imgs.length - 1)) : '';
        var leader = getAuctionLeadingBidder(a);
        return (
          '<article class="vip-stock-card vip-stock-card--glass vip-stock-card--auction" data-vip-auction-id="' + esc(aid) + '">' +
            '<span class="vip-stock-card__badge">' + (isVipAuctionEarlyAccess(a) ? 'VIP Early Access' : 'Auction') + '</span>' +
            (photoBadge ? '<span class="vip-stock-card__badge vip-stock-card__badge--photos">' + esc(photoBadge) + ' photos</span>' : '') +
            '<button type="button" class="vip-stock-card__img-btn" data-vip-open-auction="' + esc(aid) + '">' +
              '<img class="vip-stock-card__img" src="' + esc(img) + '" alt="" loading="lazy">' +
            '</button>' +
            '<h4><button type="button" class="vip-stock-card__title-btn" data-vip-open-auction="' + esc(aid) + '">' + esc(a.name || a.title) + '</button></h4>' +
            (a.desc ? '<p>' + esc(a.desc.slice(0, 140)) + (a.desc.length > 140 ? '…' : '') + '</p>' : '') +
            '<div class="vip-stock-card__price" data-vip-auction-price>' + formatMoney(display) + '</div>' +
            (leader ? '<p class="vip-stock-card__leader" data-vip-auction-leader><i class="fas fa-crown"></i> ' + esc(leader) + '</p>' : '<p class="vip-stock-card__leader" data-vip-auction-leader hidden></p>') +
            '<p class="vip-stock-card__meta-line">' +
              '<span data-vip-auction-bids>' + bids + ' bids</span>' +
              (views ? '<span><i class="fas fa-eye"></i> ' + views + '</span>' : '') +
              (ends ? '<span><i class="fas fa-clock"></i> ' + esc(ends) + '</span>' : '') +
              (formatAuctionPublicStart(a) ? '<span><i class="fas fa-crown"></i> ' + esc(formatAuctionPublicStart(a)) + '</span>' : '') +
            '</p>' +
            '<button type="button" class="vip-btn vip-btn--gold vip-btn--sm" data-vip-open-auction="' + esc(aid) + '"><i class="fas fa-gavel"></i> View &amp; bid</button>' +
          '</article>'
        );
      }).join('') +
      '</div>'
    );
  }

  function bindVipAuctionOpenButtons(auctions) {
    vipAuctionCache = auctions || [];
    document.querySelectorAll('[data-vip-open-auction]').forEach(function(btn) {
      if (btn._vipAuctionBound) return;
      btn._vipAuctionBound = true;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var id = btn.getAttribute('data-vip-open-auction');
        var auction = vipAuctionCache.find(function(x) { return String(x.id) === String(id); });
        if (auction) openVipAuctionDetail(auction);
      });
    });
  }

  function renderLocationsList(locations) {
    if (!locations || !locations.length) {
      return '<div class="vip-stock-empty">Pickup routes updating — check <a href="/#pickup">pickup points</a>.</div>';
    }
    return (
      '<div class="vip-locations-list">' +
      locations.map(function(loc) {
        var statusClass = loc.status === 'going' ? 'is-going' : 'is-possible';
        var statusLabel = loc.status === 'going' ? 'Confirmed' : 'Possible';
        var wid = vipWeatherDomId(loc);
        return (
          '<article class="vip-location-card ' + statusClass + '">' +
            '<div class="vip-location-card__head">' +
              '<strong>' + esc(loc.name) + '</strong>' +
              '<span class="vip-location-card__status">' + statusLabel + '</span>' +
            '</div>' +
            (loc.day ? '<p>' + esc(loc.day) + '</p>' : '') +
            (loc.address ? '<p>' + esc(loc.address) + (loc.postcode ? ', ' + esc(loc.postcode) : '') + '</p>' : '') +
            (loc.note ? '<small>' + esc(loc.note) + '</small>' : '') +
            '<div class="vip-location-weather" id="' + esc(wid) + '">' +
              (global.AYLEN_WEATHER ? global.AYLEN_WEATHER.renderLoadingHtml() : 'Weather…') +
            '</div>' +
          '</article>'
        );
      }).join('') +
      '</div>'
    );
  }

  function orderStatusLabel(status) {
    var map = {
      requested: 'Requested',
      confirmed: 'Confirmed',
      paid: 'Paid',
      ready: 'Ready for pickup',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    return map[String(status || '').toLowerCase()] || status || 'Requested';
  }

  function renderOrdersPanel(orders) {
    if (!orders || !orders.length) {
      return '<div class="vip-stock-empty">No orders yet — open <b>Stock</b> and tap <b>Buy</b>.</div>';
    }
    return (
      '<div class="vip-orders-list">' +
      orders.map(function(o) {
        var st = String(o.status || 'requested').toLowerCase();
        var paySt = String(o.paymentStatus || '').toLowerCase();
        var delivery = o.deliveryMethod === 'royal_mail' ? 'Royal Mail UK' : '';
        var ship = o.shipping && o.shipping.postcode
          ? esc(o.shipping.name || '') + ', ' + esc(o.shipping.postcode || '')
          : '';
        var tracking = o.royalMailTracking
          ? '<p class="vip-order-card__tracking"><i class="fas fa-truck"></i> Tracking: <strong>' + esc(o.royalMailTracking) + '</strong></p>'
          : '';
        var payLine = paySt === 'paid'
          ? '<span class="vip-order-card__paid"><i class="fas fa-check-circle"></i> Paid £' + esc(Number(o.totalGbp != null ? o.totalGbp : o.vipPrice || 0).toFixed(2)) + '</span>'
          : (paySt === 'pending' ? '<span class="vip-order-card__pending">Payment pending</span>' : '');
        return (
          '<article class="vip-order-card">' +
            '<div class="vip-order-card__head">' +
              '<strong>' + esc(o.orderNumber || o.id) + '</strong>' +
              '<span class="vip-order-card__status vip-order-card__status--' + esc(st) + '">' + esc(orderStatusLabel(st)) + '</span>' +
            '</div>' +
            '<p class="vip-order-card__item">' + esc(o.itemTitle || 'VIP item') +
              (o.vipPrice != null ? ' · VIP £' + esc(Number(o.vipPrice).toFixed(2)) : '') +
              (delivery ? ' · ' + delivery : '') + '</p>' +
            (ship ? '<p class="vip-order-card__ship"><i class="fas fa-location-dot"></i> ' + ship + '</p>' : '') +
            payLine +
            tracking +
            (o.adminNote ? '<p class="vip-order-card__note"><i class="fas fa-circle-info"></i> ' + esc(o.adminNote) + '</p>' : '') +
            '<small class="vip-order-card__date">' + esc(formatDate(o.createdAt)) + '</small>' +
          '</article>'
        );
      }).join('') +
      '</div>'
    );
  }

  async function fetchMemberOrders() {
    var session = getSession();
    if (!session || !session.accessToken) return [];
    try {
      var data = await postJson('/api/vip-orders', { accessToken: session.accessToken });
      return data.orders || [];
    } catch (e) {
      return [];
    }
  }

  async function placeVipOrder(itemId, channel) {
    if (isVipPreviewMode()) {
      notifyMsg('Preview mode — orders are not saved here', 'info');
      return;
    }
    var session = getSession();
    if (!session || !session.accessToken) {
      notifyMsg('VIP session expired — refresh and log in again', 'error');
      return;
    }
    var data = await postJson('/api/vip-order', {
      accessToken: session.accessToken,
      itemId: itemId,
      channel: channel || 'whatsapp'
    });
    if (data.order && data.order.orderNumber) {
      notifyMsg('Order ' + data.order.orderNumber + ' created', 'success');
    }
    if (data.contactUrl) {
      global.open(data.contactUrl, '_blank', 'noopener');
    } else {
      var item = vipStockCache.find(function(x) { return String(x.id) === String(itemId); });
      var opts = vipOrderOptsCache || {};
      var title = item ? (item.title || item.name) : 'VIP item';
      var price = item ? (item.vipPrice != null ? item.vipPrice : item.price) : null;
      var ref = data.order && data.order.orderNumber;
      if (channel === 'telegram') {
        global.open(buildTelegramOrderUrl(opts.tg, title, price, opts.code, ref), '_blank', 'noopener');
      } else {
        global.open(buildOrderWhatsAppUrl(opts.wa, title, price, opts.code, ref), '_blank', 'noopener');
      }
    }
    return data.order;
  }

  async function refreshOrdersPanelInHub() {
    var panel = document.querySelector('[data-vip-panel="orders"]');
    if (!panel) return;
    panel.innerHTML = '<h2 class="vip-hub-panel__title"><i class="fas fa-receipt"></i> My orders</h2>' +
      '<p class="vip-member-hint">Your VIP stock requests — we update status when confirmed, paid, or ready.</p>' +
      '<div class="vip-page-loading"><i class="fas fa-spinner fa-spin"></i> Loading orders…</div>';
    var orders = await fetchMemberOrders();
    panel.innerHTML = '<h2 class="vip-hub-panel__title"><i class="fas fa-receipt"></i> My orders</h2>' +
      '<p class="vip-member-hint">Your VIP stock requests — we update status when confirmed, paid, or ready.</p>' +
      renderOrdersPanel(orders);
    var badge = document.querySelector('[data-vip-tab="orders"] span');
    if (badge) badge.textContent = String(orders.length);
  }

  function bindVipOrderButtons() {
    document.querySelectorAll('[data-vip-place-order]').forEach(function(btn) {
      if (btn._vipOrderBound) return;
      btn._vipOrderBound = true;
      btn.addEventListener('click', async function() {
        var itemId = btn.getAttribute('data-item-id');
        var channel = btn.getAttribute('data-channel') || 'whatsapp';
        if (!itemId) return;
        var label = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> …';
        try {
          await placeVipOrder(itemId, channel);
          await refreshOrdersPanelInHub();
        } catch (err) {
          notifyMsg(err.message || 'Could not create order', 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = label;
        }
      });
    });
  }

  function renderMemberHub(data, session, showWelcome, orders) {
    var settings = data.settings || {};
    var code = settings.discountCode || 'VIPSTOCK';
    var tg = settings.telegramUrl || 'https://t.me/aylensale';
    var wa = data.whatsappWelcomeUrl || settings.whatsappUrl || 'https://wa.me/447471647771';
    var stockCount = (data.stock && data.stock.length) || 0;
    var auctionCount = (data.auctions && data.auctions.length) || 0;
    var locCount = (data.locations && data.locations.length) || 0;
    var ordersList = orders || [];
    var ordersCount = ordersList.length;
    var orderOpts = { wa: wa, code: code, tg: tg };
    vipOrderOptsCache = orderOpts;
    vipAuctionCache = data.auctions || [];
    var statusNote = '';
    if (data.vip.cancelAtPeriodEnd) {
      statusNote = '<p class="vip-member-note">Access until ' + esc(formatDate(data.vip.currentPeriodEnd)) + ' (cancelled)</p>';
    } else if (data.vip.pastDue) {
      statusNote = '<p class="vip-member-note vip-member-note--warn">Payment issue — update billing to keep access</p>';
    } else {
      statusNote = '<p class="vip-member-note">VIP Active · Next billing: ' + esc(formatDate(data.vip.currentPeriodEnd)) + '</p>';
    }

    var welcome = showWelcome ? (
      '<div class="vip-welcome-banner" id="vipWelcomeBanner">' +
        '<div class="vip-welcome-banner__icon"><i class="fas fa-crown"></i></div>' +
        '<div><h2>Welcome to VIP STOCK</h2>' +
        '<p>Join Telegram or WhatsApp for first-look alerts. Your discount code: <strong>' + esc(code) + '</strong></p></div>' +
        '<button type="button" class="vip-welcome-banner__close" data-vip-welcome-close aria-label="Close">&times;</button>' +
      '</div>'
    ) : '';

    return (
      '<div class="vip-member-shell vip-member-shell--glass">' +
        '<div class="vip-member-exit-bar">' +
          '<a href="/" class="vip-member-exit-bar__back"><i class="fas fa-arrow-left"></i> Shop</a>' +
          '<button type="button" class="vip-member-exit-bar__close" data-vip-exit aria-label="Exit VIP">&times;</button>' +
        '</div>' +
        welcome +
        renderLiveStatsBar(data.liveStats) +
        renderHubHeroMedia(settings) +
        '<div class="vip-member-header">' +
          '<span class="vip-member-badge"><i class="fas fa-crown"></i> VIP Active</span>' +
          '<h1>VIP Member Hub</h1>' +
          '<p class="vip-member-email">' + esc(data.vip.email || session.email || '') + '</p>' +
          statusNote +
        '</div>' +
        '<nav class="vip-hub-nav" aria-label="VIP sections">' +
          '<button type="button" class="vip-hub-nav__btn is-active" data-vip-tab="hub"><i class="fas fa-gauge"></i> Hub</button>' +
          '<button type="button" class="vip-hub-nav__btn" data-vip-tab="stock"><i class="fas fa-boxes-stacked"></i> Stock <span>' + stockCount + '</span></button>' +
          '<button type="button" class="vip-hub-nav__btn" data-vip-tab="auctions"><i class="fas fa-gavel"></i> Auctions <span>' + auctionCount + '</span></button>' +
          '<button type="button" class="vip-hub-nav__btn" data-vip-tab="routes"><i class="fas fa-map-pin"></i> Routes <span>' + locCount + '</span></button>' +
          '<button type="button" class="vip-hub-nav__btn" data-vip-tab="orders"><i class="fas fa-receipt"></i> Orders <span>' + ordersCount + '</span></button>' +
          '<button type="button" class="vip-hub-nav__btn" data-vip-tab="chat"><i class="fas fa-comments"></i> Chat</button>' +
          '<button type="button" class="vip-hub-nav__btn" data-vip-tab="account"><i class="fas fa-user"></i> Account</button>' +
        '</nav>' +

        '<section class="vip-hub-panel is-active" data-vip-panel="hub">' +
          '<div class="vip-hub-cards">' +
            '<button type="button" class="vip-hub-card" data-vip-tab-jump="stock"><i class="fas fa-boxes-stacked"></i><span>Fresh VIP stock</span><small>' + stockCount + ' previews</small></button>' +
            '<button type="button" class="vip-hub-card" data-vip-tab-jump="auctions"><i class="fas fa-gavel"></i><span>Live auctions</span><small>Early access</small></button>' +
            '<button type="button" class="vip-hub-card" data-vip-tab-jump="routes"><i class="fas fa-route"></i><span>Car boot routes</span><small>' + locCount + ' points</small></button>' +
            '<button type="button" class="vip-hub-card" data-vip-tab-jump="orders"><i class="fas fa-receipt"></i><span>My orders</span><small>' + ordersCount + ' requests</small></button>' +
            '<button type="button" class="vip-hub-card" data-vip-tab-jump="chat"><i class="fas fa-comments"></i><span>VIP chat</span><small>Telegram &amp; WhatsApp</small></button>' +
            '<a class="vip-hub-card vip-hub-card--link" href="/?priceList=1" target="_blank" rel="noopener"><i class="fas fa-file-arrow-down"></i><span>Price list</span><small>Download</small></a>' +
          '</div>' +
          '<div class="vip-member-code">' +
            '<span class="vip-member-code__label">Your VIP discount</span>' +
            '<strong id="vipDiscountCode">' + esc(code) + '</strong>' +
            (settings.discountPercent ? '<span class="vip-member-code__pct">' + esc(settings.discountPercent) + '% off eligible stock</span>' : '') +
            '<button type="button" class="vip-btn vip-btn--ghost vip-btn--sm" data-vip-copy-code>Copy code</button>' +
          '</div>' +
          '<div class="vip-member-actions vip-member-actions--welcome">' +
            '<a class="vip-btn vip-btn--gold" href="' + esc(tg) + '" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> Join Telegram VIP</a>' +
            '<a class="vip-btn vip-btn--gold" href="' + esc(wa) + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Message on WhatsApp</a>' +
          '</div>' +
        '</section>' +

        '<section class="vip-hub-panel" data-vip-panel="stock" hidden>' +
          '<h2 class="vip-hub-panel__title"><i class="fas fa-boxes-stacked"></i> Fresh VIP stock</h2>' +
          '<p class="vip-member-hint">Tap a photo or <b>Details</b> for full description, zoom and buy buttons. Use <b>Pay &amp; Royal Mail</b> when card delivery is enabled.</p>' +
          renderStockGrid(data.stock, orderOpts) +
        '</section>' +

        '<section class="vip-hub-panel" data-vip-panel="orders" hidden>' +
          '<h2 class="vip-hub-panel__title"><i class="fas fa-receipt"></i> My orders</h2>' +
          '<p class="vip-member-hint">Track your VIP requests — status updates when we confirm, receive payment, or schedule pickup.</p>' +
          renderOrdersPanel(ordersList) +
        '</section>' +

        '<section class="vip-hub-panel" data-vip-panel="auctions" hidden>' +
          '<h2 class="vip-hub-panel__title"><i class="fas fa-gavel"></i> VIP auction preview</h2>' +
          '<p class="vip-member-hint">Tap a lot to see photos, description and place a bid — all inside VIP.</p>' +
          renderAuctionsGrid(data.auctions) +
        '</section>' +

        '<section class="vip-hub-panel" data-vip-panel="routes" hidden>' +
          '<h2 class="vip-hub-panel__title"><i class="fas fa-map-pin"></i> Weekend pickup routes</h2>' +
          '<p class="vip-member-hint">Confirmed &amp; possible car boot points — route updates in VIP channels first.</p>' +
          renderLocationsList(data.locations) +
          '<a class="vip-btn vip-btn--gold" href="/#pickup"><i class="fas fa-location-dot"></i> Full map on shop</a>' +
        '</section>' +

        '<section class="vip-hub-panel" data-vip-panel="chat" hidden>' +
          '<h2 class="vip-hub-panel__title"><i class="fas fa-comments"></i> VIP chat &amp; alerts</h2>' +
          '<p class="vip-member-hint">Private member channels — stock drops, auctions and routes go here first.</p>' +
          '<div class="vip-glass-chat-grid">' +
            '<div class="vip-glass-chat-card">' +
              '<h4><i class="fab fa-telegram"></i> Telegram VIP</h4>' +
              '<p>Join the member channel for instant alerts on new pallets and auction starts.</p>' +
              '<a class="vip-btn vip-btn--gold" href="' + esc(tg) + '" target="_blank" rel="noopener">Open Telegram</a>' +
            '</div>' +
            '<div class="vip-glass-chat-card">' +
              '<h4><i class="fab fa-whatsapp"></i> WhatsApp VIP</h4>' +
              '<p>Order stock, ask availability, or send photos of what you need.</p>' +
              '<a class="vip-btn vip-btn--gold" href="' + esc(wa) + '" target="_blank" rel="noopener">Open WhatsApp</a>' +
            '</div>' +
            '<div class="vip-glass-chat-card">' +
              '<h4><i class="fas fa-tag"></i> Your discount</h4>' +
              '<p>Use code <strong>' + esc(code) + '</strong> on eligible shop stock.</p>' +
              '<a class="vip-btn vip-btn--ghost" href="/" target="_blank" rel="noopener">Browse main shop</a>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="vip-hub-panel" data-vip-panel="account" hidden>' +
          '<h2 class="vip-hub-panel__title"><i class="fas fa-user"></i> Account &amp; billing</h2>' +
          '<ul class="vip-account-list">' +
            '<li><span>Email</span><strong>' + esc(data.vip.email || '') + '</strong></li>' +
            '<li><span>Status</span><strong>' + esc(data.vip.status || 'active') + '</strong></li>' +
            '<li><span>Next billing</span><strong>' + esc(formatDate(data.vip.currentPeriodEnd)) + '</strong></li>' +
          '</ul>' +
          '<div class="vip-member-actions">' +
            '<button type="button" class="vip-btn vip-btn--ghost" data-vip-portal><i class="fas fa-credit-card"></i> Manage billing</button>' +
            '<a class="vip-btn vip-btn--ghost" href="' + esc(tg) + '" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> Telegram</a>' +
            '<a class="vip-btn vip-btn--ghost" href="' + esc(wa) + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>' +
          '</div>' +
        '</section>' +

        '<p class="vip-compliance vip-compliance--page">Subscription renews monthly at ' + PRICE_LABEL + '. Cancel anytime via billing portal. Access stays active until period end.</p>' +
        '<div class="vip-glass-sticky-bar">' +
          '<a class="vip-btn vip-btn--gold" href="' + esc(tg) + '" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> Telegram</a>' +
          '<a class="vip-btn vip-btn--gold" href="' + esc(wa) + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>' +
        '</div>' +
      '</div>' +
      renderRoyalMailModalShell()
    );
  }

  function activateMemberTab(tab) {
    document.querySelectorAll('[data-vip-tab]').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-vip-tab') === tab);
    });
    document.querySelectorAll('[data-vip-panel]').forEach(function(panel) {
      var on = panel.getAttribute('data-vip-panel') === tab;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
  }

  function bindMemberHubNav(jumpTab) {
    function activateTab(tab) {
      activateMemberTab(tab);
    }
    document.querySelectorAll('[data-vip-tab]').forEach(function(btn) {
      if (btn._vipTabBound) return;
      btn._vipTabBound = true;
      btn.addEventListener('click', function() {
        activateTab(btn.getAttribute('data-vip-tab'));
        if (btn.getAttribute('data-vip-tab') === 'orders') {
          refreshOrdersPanelInHub();
        }
        if (btn.getAttribute('data-vip-tab') === 'routes' && vipHubDataCache && vipHubDataCache.locations) {
          setTimeout(function() { refreshVipLocationWeatherAll(vipHubDataCache.locations); }, 50);
        }
      });
    });
    document.querySelectorAll('[data-vip-tab-jump]').forEach(function(btn) {
      if (btn._vipJumpBound) return;
      btn._vipJumpBound = true;
      btn.addEventListener('click', function() {
        activateTab(btn.getAttribute('data-vip-tab-jump'));
      });
    });
    var copyBtn = document.querySelector('[data-vip-copy-code]');
    if (copyBtn && !copyBtn._vipBound) {
      copyBtn._vipBound = true;
      copyBtn.addEventListener('click', function() {
        var el = document.getElementById('vipDiscountCode');
        var text = el ? el.textContent : '';
        if (navigator.clipboard && text) {
          navigator.clipboard.writeText(text).then(function() {
            notifyMsg('Discount code copied', 'success');
          }).catch(function() { notifyMsg(text, 'info'); });
        } else if (text) notifyMsg(text, 'info');
      });
    }
    var welcomeClose = document.querySelector('[data-vip-welcome-close]');
    if (welcomeClose && !welcomeClose._vipBound) {
      welcomeClose._vipBound = true;
      welcomeClose.addEventListener('click', function() {
        var banner = document.getElementById('vipWelcomeBanner');
        if (banner) banner.remove();
        try { sessionStorage.removeItem('aylen_vip_show_welcome'); } catch (e) {}
      });
    }
    if (jumpTab) activateTab(jumpTab);
    bindVipExitControls();
  }

  function bindVipExitControls() {
    function goShop() {
      global.location.href = '/';
    }
    var topClose = document.getElementById('vipPageCloseBtn');
    if (topClose && !topClose._vipBound) {
      topClose._vipBound = true;
      topClose.addEventListener('click', goShop);
    }
    document.querySelectorAll('[data-vip-exit]').forEach(function(btn) {
      if (btn._vipExitBound) return;
      btn._vipExitBound = true;
      btn.addEventListener('click', goShop);
    });
  }

  function renderPaywallCarouselShell() {
    return (
      '<div class="vip-paywall-hero">' +
        '<div class="vip-carousel vip-carousel--paywall" data-vip-carousel aria-label="Amazon warehouse stock">' +
          '<div class="vip-carousel__track" data-vip-carousel-track></div>' +
          '<div class="vip-carousel__dots" data-vip-carousel-dots></div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderLocked(cfg) {
    var count = (cfg && cfg.memberCount != null) ? cfg.memberCount : 24;
    var limit = (cfg && cfg.foundingMemberLimit != null) ? cfg.foundingMemberLimit : 50;
    return (
      renderPaywallCarouselShell() +
      '<div class="vip-page-locked">' +
        '<div class="vip-page-locked__icon"><i class="fas fa-lock"></i></div>' +
        '<h2>VIP access required</h2>' +
        '<p class="vip-page-locked__lead">Get early access to fresh Amazon returns before public listing</p>' +
        '<p class="vip-page-locked__sub">Members see stock first. Public buyers see it later.</p>' +
        '<p class="vip-page-locked__urgency"><i class="fas fa-bolt"></i> Founding Members Price: <strong>' + PRICE_LABEL + '/month</strong><br>Limited early access for first ' + esc(limit) + ' members · <strong>' + esc(count) + '</strong> active now</p>' +
        '<button type="button" class="vip-btn vip-btn--gold" data-vip-subscribe>Subscribe Now — ' + PRICE_LABEL + '/month</button>' +
        '<p id="vipCheckoutError" class="vip-checkout-error" hidden role="alert"></p>' +
        '<p class="vip-page-locked__pay-hint"><i class="fab fa-apple-pay"></i> Apple Pay · Google Pay · card — email only if needed at checkout</p>' +
        '<div class="vip-restore-access">' +
          '<p><strong>Already subscribed?</strong> Restore access on this device:</p>' +
          '<div class="vip-restore-access__row">' +
            '<input type="email" id="vipRestoreEmail" class="vip-restore-access__input" placeholder="Your VIP email" autocomplete="email">' +
            '<button type="button" class="vip-btn vip-btn--ghost" data-vip-restore-send>Send access link</button>' +
          '</div>' +
        '</div>' +
        '<p class="vip-compliance">Subscription renews monthly at ' + PRICE_LABEL + '. You can cancel anytime.</p>' +
      '</div>'
    );
  }

  function renderPastDue() {
    return (
      '<div class="vip-page-locked vip-page-locked--warn">' +
        '<div class="vip-page-locked__icon"><i class="fas fa-triangle-exclamation"></i></div>' +
        '<h2>Please update your payment method</h2>' +
        '<p>Your last VIP payment did not go through. Update billing to restore access.</p>' +
        '<button type="button" class="vip-btn vip-btn--gold" data-vip-portal>Update payment</button>' +
      '</div>'
    );
  }

  function memberDemoMockData() {
    var next = new Date();
    next.setMonth(next.getMonth() + 1);
    var img = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=640&h=400&q=70';
    return {
      vip: {
        active: true,
        status: 'active',
        email: 'buyer@example.com',
        currentPeriodEnd: next.toISOString(),
        cancelAtPeriodEnd: false,
        pastDue: false
      },
      locked: false,
      settings: {
        discountCode: 'VIPSTOCK',
        discountPercent: 10,
        telegramUrl: 'https://t.me/aylensale',
        whatsappUrl: 'https://wa.me/447471647771',
        hubVideoUrl: '',
        hubCarouselImages: DEFAULT_HUB_CAROUSEL.slice(),
        carouselImages: DEFAULT_CAROUSEL.slice()
      },
      liveStats: { onlineVisitors: 12, activeCarts: 3, vipActive: 8, publicMemberCount: 24 },
      whatsappWelcomeUrl: 'https://wa.me/447471647771?text=Hi%20AYLENSALE%20VIP',
      stock: [
        { title: 'Amazon returns electronics mix', desc: 'Small appliances, cables, gadgets — VIP preview lot.', vipPrice: 89, badge: 'VIP Early', category: 'electronics', categoryLabel: 'Electronics', imageUrl: img },
        { title: 'Homeware returns pallet', desc: 'Kitchen, décor, storage — Amazon liquidation style.', vipPrice: 75, badge: 'VIP', category: 'homeware', categoryLabel: 'Homeware', imageUrl: img },
        { title: 'Clothing returns mix', desc: 'Tagged & untagged — grade A/B mix.', vipPrice: 60, badge: 'New', category: 'clothing', categoryLabel: 'Clothing', imageUrl: img }
      ],
      auctions: [
        { id: 'demo-auction-1', name: 'VIP early auction lot', title: 'VIP early auction lot', desc: 'Amazon returns pallet — homeware & electronics mix. Tap to view photos and bid.', imageUrl: img, images: [img], startPrice: 25, startingPrice: 25, currentBid: 42, currentPrice: 42, bidsCount: 3, active: true, endTime: new Date(Date.now() + 86400000 * 2).toISOString(), bids: [
          { bidderName: 'Mike T', amount: 42, timestamp: new Date(Date.now() - 3600000).toISOString() },
          { bidderName: 'Sarah K', amount: 38, timestamp: new Date(Date.now() - 7200000).toISOString() },
          { bidderName: 'James', amount: 31, timestamp: new Date(Date.now() - 86400000).toISOString() }
        ] }
      ],
      locations: [
        { name: 'North London Car Boot', address: 'Example Market, N12', status: 'going', day: 'Sunday', note: 'VIP route update first in Telegram' }
      ]
    };
  }

  function renderAdminPreviewLoginPrompt() {
    return (
      '<div class="vip-locked-shell">' +
        '<div class="vip-locked-card">' +
          '<h1><i class="fas fa-crown"></i> VIP live preview</h1>' +
          '<p>Log in to the admin CMS first — this page shows <b>real published VIP stock</b> exactly as members see it.</p>' +
          '<div class="vip-member-actions">' +
            '<a class="vip-btn vip-btn--gold" href="/admin-preview.html#vipmembers"><i class="fas fa-user-shield"></i> Open admin CMS</a>' +
            '<a class="vip-btn vip-btn--ghost" href="/"><i class="fas fa-store"></i> Main shop</a>' +
          '</div>' +
          '<p class="vip-member-hint" style="margin-top:16px">Tip: use the same browser where you already opened Admin panel (remember device).</p>' +
        '</div></div>'
    );
  }

  async function renderAdminLivePreviewPage(root) {
    root.innerHTML = '<div class="vip-page-loading"><i class="fas fa-spinner fa-spin"></i> Loading live VIP stock…</div>';

    try {
      await ensureMemberDeps();
      if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.restoreSilent) {
        var restored = await global.AYLEN_ADMIN_SESSION.restoreSilent();
        if (!restored && global.FBDB && global.FBDB.isAdmin && !global.FBDB.isAdmin()) {
          root.innerHTML = renderAdminPreviewLoginPrompt();
          return;
        }
      } else if (!global.FBDB || !global.FBDB.isAdmin || !global.FBDB.isAdmin()) {
        root.innerHTML = renderAdminPreviewLoginPrompt();
        return;
      }

      if (!global.FBDB.loadVipAdminMemberPreview) {
        throw new Error('VIP live preview API is not available — deploy the latest site build.');
      }

      var data = await global.FBDB.loadVipAdminMemberPreview();
      var session = {
        email: (data.vip && data.vip.email) || 'Admin preview',
        active: true,
        accessToken: 'admin-live-preview'
      };
      saveSession(session);
      vipHubDataCache = data;
      root.innerHTML = renderMemberHub(data, session, false, []);
      bindMemberHubNav();
      bindHubHeroCarousel();
      bindVipOrderButtons();
      bindVipRoyalMailButtons();
      bindVipItemOpenButtons(data.stock || []);
      bindVipAuctionOpenButtons(data.auctions || []);
      notifyMsg('Live preview — ' + (data.stock || []).length + ' published item(s) visible to VIP members', 'success');
    } catch (err) {
      root.innerHTML = renderAdminPreviewLoginPrompt();
      notifyMsg(err.message || 'Could not load live VIP preview', 'error');
    }
  }

  function renderMemberDemoPage(root) {
    var mock = memberDemoMockData();
    var session = { email: mock.vip.email, active: true, accessToken: 'demo' };
    root.innerHTML = renderMemberHub(mock, session, true, []);
    bindMemberHubNav();
    bindHubHeroCarousel();
    bindVipOrderButtons();
    bindVipRoyalMailButtons();
    bindVipItemOpenButtons(mock.stock || []);
    bindVipAuctionOpenButtons(mock.auctions || []);
  }

  async function initMemberPage() {
    var root = document.getElementById('vipMemberRoot');
    if (!root) return;
    bindVipExitControls();

    var params = new URLSearchParams(global.location.search || '');
    var jumpOrdersAfterPay = false;

    if (params.get('vip_pay') === 'cancelled') {
      notifyMsg('Payment cancelled — your order was not charged', 'info');
      global.history.replaceState({}, '', '/vip-stock.html');
    }

    if (params.get('vip_pay') === 'success') {
      var paySid = params.get('session_id');
      root.innerHTML = '<div class="vip-page-loading"><i class="fas fa-spinner fa-spin"></i> Confirming payment…</div>';
      try {
        var payData = await verifyItemPayment(paySid);
        notifyMsg('Payment received — Royal Mail order ' + (payData.order && payData.order.orderNumber ? payData.order.orderNumber : 'confirmed'), 'success');
        jumpOrdersAfterPay = true;
        global.history.replaceState({}, '', '/vip-stock.html');
      } catch (err) {
        notifyMsg(err.message || 'Could not verify payment', 'error');
        global.history.replaceState({}, '', '/vip-stock.html');
      }
    }

    if (params.get('preview') === 'admin_live' || global.AYLEN_VIP_ADMIN_LIVE_PREVIEW) {
      await renderAdminLivePreviewPage(root);
      return;
    }

    if (params.get('demo') === 'member' || global.AYLEN_VIP_DEMO_MEMBER) {
      await ensureMemberDeps();
      renderMemberDemoPage(root);
      return;
    }

    var sessionEarly = getSession();
    if (sessionEarly && (sessionEarly.accessToken === 'admin-live-preview' || sessionEarly.accessToken === 'demo') && !isVipPreviewMode()) {
      clearSession();
      sessionEarly = null;
    }

    var needsAuthFlow =
      params.get('checkout') === 'success' ||
      params.get('vip_pay') === 'success' ||
      !!params.get('vip_magic');

    if (!needsAuthFlow && (!sessionEarly || !sessionEarly.accessToken)) {
      if (params.get('checkout') === 'cancelled') {
        showGuestPaywall(root, null);
        fetchVipConfig().then(hydrateGuestPaywall);
        notifyMsg('Checkout cancelled — subscribe anytime when you are ready.', 'info');
        return;
      }
      showGuestPaywall(root, null);
      fetchVipConfig().then(hydrateGuestPaywall);
      return;
    }

    var cfg = await fetchVipConfig();

    var magic = params.get('vip_magic');
    if (magic) {
      root.innerHTML = '<div class="vip-page-loading"><i class="fas fa-spinner fa-spin"></i> Restoring VIP access…</div>';
      try {
        await redeemMagicLink(magic);
        notifyMsg('VIP access restored', 'success');
        global.history.replaceState({}, '', '/vip-stock.html');
      } catch (err) {
        root.innerHTML = renderLocked(null);
        bindSubscribeButtons();
        schedulePaywallCarousel(cfg);
        notifyMsg(err.message || 'Invalid access link', 'error');
        return;
      }
    }

    var showWelcome = false;
    if (params.get('checkout') === 'success') {
      var sid = params.get('session_id');
      root.innerHTML = '<div class="vip-page-loading"><i class="fas fa-spinner fa-spin"></i> Activating VIP access…</div>';
      try {
        await verifyCheckout(sid);
        showWelcome = true;
        try { sessionStorage.setItem('aylen_vip_show_welcome', '1'); } catch (e) {}
        notifyMsg('VIP STOCK activated — welcome!', 'success');
        global.history.replaceState({}, '', '/vip-stock.html');
      } catch (err) {
        root.innerHTML = renderLocked(cfg);
        notifyMsg(err.message || 'Could not verify payment', 'error');
        bindSubscribeButtons();
        schedulePaywallCarousel(cfg);
        return;
      }
    } else {
      try { showWelcome = sessionStorage.getItem('aylen_vip_show_welcome') === '1'; } catch (e) {}
    }

    var session = getSession();
    if (session && (session.accessToken === 'admin-live-preview' || session.accessToken === 'demo') && !isVipPreviewMode()) {
      clearSession();
      session = null;
    }
    if (!session || !session.accessToken) {
      showGuestPaywall(root, cfg);
      return;
    }

    root.innerHTML = '<div class="vip-page-loading"><i class="fas fa-spinner fa-spin"></i> Loading VIP stock…</div>';

    try {
      await ensureMemberDeps();
      var data = await refreshStatus();
      if (data.vip && data.vip.pastDue && !data.vip.active) {
        root.innerHTML = renderPastDue();
        bindSubscribeButtons();
        return;
      }
      if (data.locked || !data.vip || !data.vip.active) {
        root.innerHTML = renderLocked(cfg);
        bindSubscribeButtons();
        schedulePaywallCarousel(cfg);
        return;
      }

      var settings = data.settings || {};
      vipHubDataCache = data;
      var orders = await fetchMemberOrders();
      root.innerHTML = renderMemberHub(data, session, showWelcome, orders);
      bindSubscribeButtons();
      bindMemberHubNav(jumpOrdersAfterPay ? 'orders' : null);
      bindHubHeroCarousel();
      bindVipOrderButtons();
      bindVipRoyalMailButtons();
      bindVipItemOpenButtons(data.stock || []);
      bindVipAuctionOpenButtons(data.auctions || []);
      if (jumpOrdersAfterPay) refreshOrdersPanelInHub();
    } catch (err) {
      root.innerHTML = renderLocked(cfg);
      bindSubscribeButtons();
      schedulePaywallCarousel(cfg);
      notifyMsg(err.message || 'Could not load VIP content', 'error');
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function isVipActive() {
    var s = getSession();
    return !!(s && s.active && s.accessToken);
  }

  global.AYLEN_VIP = {
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearSession,
    refreshStatus: refreshStatus,
    startCheckout: startCheckout,
    verifyCheckout: verifyCheckout,
    openBillingPortal: openBillingPortal,
    initHomeSection: initHomeSection,
    initMemberPage: initMemberPage,
    isVipActive: isVipActive
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('vip-stock')) initHomeSection();
      if (document.getElementById('vipMemberRoot')) initMemberPage();
    });
  } else {
    if (document.getElementById('vip-stock')) initHomeSection();
    if (document.getElementById('vipMemberRoot')) initMemberPage();
  }
})(window);
