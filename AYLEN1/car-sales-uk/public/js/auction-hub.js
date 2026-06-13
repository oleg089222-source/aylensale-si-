/**
 * Live Auction Floor — immersive hub for bidders (casino-style overlay).
 */
(function(global) {
  var PROFILE_KEY = 'aylen_auction_profile_v1';
  var NOTIF_KEY = 'aylen_auction_notifs_v1';
  var LEADER_KEY = 'aylen_auction_leaders_v1';
  var open = false;
  var tickTimer = null;
  var state = { scrollLocked: false, scrollY: 0 };

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function getContact() {
    if (typeof getStoredBidderContact === 'function') {
      return getStoredBidderContact() || {};
    }
    try { return JSON.parse(localStorage.getItem('aylen_bidder_contact') || '{}'); } catch (e) { return {}; }
  }

  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      return {
        outbid: p.outbid !== false,
        endingSoon: p.endingSoon !== false,
        won: p.won !== false
      };
    } catch (e) {
      return { outbid: true, endingSoon: true, won: true };
    }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  function pushNotif(item) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch (e) {}
    list.unshift(Object.assign({ at: new Date().toISOString(), read: false }, item));
    list = list.slice(0, 40);
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(list)); } catch (e) {}
    renderNotifBadge();
  }

  function fmtMoney(n) {
    return '£' + (Number(n) || 0).toFixed(2);
  }

  function fmtLeft(endTime) {
    var ms = Math.max(0, Date.parse(endTime || 0) - Date.now());
    if (ms >= 3600000) return Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    return m + ':' + String(s).padStart(2, '0');
  }

  function auctionList() {
    if (typeof auctions !== 'undefined' && Array.isArray(auctions)) {
      return auctions.slice().filter(function(a) {
        return typeof getAuctionStatus === 'function'
          ? getAuctionStatus(a) === 'active'
          : String(a.status || 'active') === 'active';
      });
    }
    return [];
  }

  function ensureUi() {
    if (document.getElementById('auctionHubRoot')) return;
    var root = document.createElement('div');
    root.id = 'auctionHubRoot';
    root.className = 'auction-hub-root is-hidden';
    root.innerHTML =
      '<div class="auction-hub-backdrop"></div>' +
      '<div class="auction-hub-panel" role="dialog" aria-label="Live Auction Floor">' +
      '<header class="auction-hub-header">' +
      '<div class="auction-hub-brand"><i class="fas fa-gavel"></i> Live Auction Floor</div>' +
      '<div class="auction-hub-header-actions">' +
      '<button type="button" class="auction-hub-notif-btn" id="auctionHubNotifBtn" aria-label="Notifications">' +
      '<i class="fas fa-bell"></i><span class="auction-hub-notif-badge" id="auctionHubNotifBadge" hidden>0</span></button>' +
      '<button type="button" class="auction-hub-close" id="auctionHubCloseBtn" aria-label="Close">&times;</button>' +
      '</div></header>' +
      '<div class="auction-hub-body">' +
      '<aside class="auction-hub-sidebar">' +
      '<div class="auction-hub-profile" id="auctionHubProfile"></div>' +
      '<div class="auction-hub-prefs" id="auctionHubPrefs"></div>' +
      '<div class="auction-hub-notifs" id="auctionHubNotifs"></div>' +
      '</aside>' +
      '<main class="auction-hub-main" id="auctionHubMain"></main>' +
      '</div></div>';
    document.body.appendChild(root);
    root.querySelector('.auction-hub-backdrop').addEventListener('click', close);
    var backdrop = root.querySelector('.auction-hub-backdrop');
    if (backdrop) {
      backdrop.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
      backdrop.addEventListener('wheel', function(e) { e.preventDefault(); }, { passive: false });
    }
    document.getElementById('auctionHubCloseBtn').addEventListener('click', close);
    document.getElementById('auctionHubNotifBtn').addEventListener('click', toggleNotifPanel);
  }

  function renderProfile() {
    var el = document.getElementById('auctionHubProfile');
    if (!el) return;
    var c = getContact();
    var cardLabel = '';
    try {
      var u = JSON.parse(localStorage.getItem('aylenuser') || 'null');
      if (u && u.card) cardLabel = ' · Card #' + u.card;
    } catch (e) {}
    var name = c.name || 'Guest bidder';
    var phone = c.phone || '';
    el.innerHTML =
      '<h3><i class="fas fa-id-badge"></i> Your profile</h3>' +
      '<p class="auction-hub-name">' + esc(name) + esc(cardLabel) + '</p>' +
      '<p class="auction-hub-phone">' + (phone ? esc(phone) : 'Add phone when you bid') + '</p>' +
      '<div class="auction-hub-stats" id="auctionHubStats">' +
      '<div><strong id="ahStatBids">—</strong><span>Bids placed</span></div>' +
      '<div><strong id="ahStatWins">—</strong><span>Wins</span></div>' +
      '<div><strong id="ahStatLoss">—</strong><span>Outbid</span></div></div>' +
      '<p class="auction-hub-hint">Same name & phone as your bids — wins appear here automatically.</p>';
    if (phone && phone.replace(/\D/g, '').length >= 8) loadProfileFromServer(phone);
  }

  async function loadProfileFromServer(phone) {
    try {
      var res = await fetch('/api/spam?action=auction-engine&sub=profile&phone=' + encodeURIComponent(phone));
      var data = await res.json();
      if (!data.ok || !data.profile) return;
      var s = data.profile.stats || {};
      var b = document.getElementById('ahStatBids');
      var w = document.getElementById('ahStatWins');
      var l = document.getElementById('ahStatLoss');
      if (b) b.textContent = String(s.totalBids || 0);
      if (w) w.textContent = String(s.wins || 0);
      if (l) l.textContent = String(s.losses || 0);
    } catch (e) {}
  }

  function renderPrefs() {
    var el = document.getElementById('auctionHubPrefs');
    if (!el) return;
    var p = loadPrefs();
    el.innerHTML =
      '<h3><i class="fas fa-sliders"></i> Alerts</h3>' +
      prefRow('outbid', 'Outbid alerts', p.outbid) +
      prefRow('endingSoon', 'Ending soon (5 min)', p.endingSoon) +
      prefRow('won', 'Win notifications', p.won);
    el.querySelectorAll('[data-pref]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var prefs = loadPrefs();
        prefs[inp.getAttribute('data-pref')] = inp.checked;
        savePrefs(prefs);
        syncPrefsServer(prefs);
      });
    });
  }

  function prefRow(key, label, on) {
    return '<label class="auction-hub-pref"><input type="checkbox" data-pref="' + key + '"' +
      (on ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }

  async function syncPrefsServer(prefs) {
    var c = getContact();
    if (!c.phone) return;
    try {
      await fetch('/api/spam?action=auction-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile-prefs', phone: c.phone, notifyPrefs: prefs })
      });
    } catch (e) {}
  }

  function renderNotifs() {
    var el = document.getElementById('auctionHubNotifs');
    if (!el) return;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch (e) {}
    if (!list.length) {
      el.innerHTML = '<h3>Notifications</h3><p class="auction-hub-hint">Bid on a lot — alerts appear here.</p>';
      el.classList.remove('is-open');
      return;
    }
    el.innerHTML = '<h3>Notifications</h3>' + list.slice(0, 8).map(function(n) {
      return '<div class="auction-hub-notif-item' + (n.read ? '' : ' is-new') + '">' +
        '<b>' + esc(n.title || 'Update') + '</b>' +
        '<p>' + esc(n.body || '') + '</p>' +
        '<time>' + esc(new Date(n.at || 0).toLocaleString('en-GB')) + '</time></div>';
    }).join('');
  }

  function renderNotifBadge() {
    var badge = document.getElementById('auctionHubNotifBadge');
    if (!badge) return;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch (e) {}
    var unread = list.filter(function(n) { return !n.read; }).length;
    badge.hidden = unread <= 0;
    badge.textContent = String(unread);
  }

  function toggleNotifPanel() {
    var el = document.getElementById('auctionHubNotifs');
    if (!el) return;
    el.classList.toggle('is-open');
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
      list.forEach(function(n) { n.read = true; });
      localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
    } catch (e) {}
    renderNotifBadge();
  }

  function renderMain() {
    var el = document.getElementById('auctionHubMain');
    if (!el) return;
    var list = auctionList();
    if (!list.length) {
      el.innerHTML = '<p class="auction-hub-empty">No live auctions right now — check back soon.</p>';
      return;
    }
    el.innerHTML =
      '<div class="auction-hub-intro">' +
      '<p>Welcome to the floor — highest bid wins. Tap a lot to bid.</p></div>' +
      '<div class="auction-hub-grid">' +
      list.map(function(a) {
        var bids = Number(a.bidsCount || (a.bids && a.bids.length) || 0);
        var img = (a.images && a.images[0]) || '';
        var thumb = global.AYLEN_IMAGES ? global.AYLEN_IMAGES.productThumbUrl(img, 400) : img;
        return (
          '<article class="auction-hub-card" data-hub-auction="' + esc(String(a.id)) + '">' +
          (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy">' : '') +
          '<div class="auction-hub-card-body">' +
          '<h4>' + esc(a.name || 'Lot') + '</h4>' +
          '<div class="auction-hub-price">' + fmtMoney(a.currentPrice || a.startingPrice) + '</div>' +
          '<div class="auction-hub-card-meta">' +
          '<span><i class="fas fa-clock"></i> ' + fmtLeft(a.endTime) + '</span>' +
          '<span><i class="fas fa-hand-holding-dollar"></i> ' + bids + ' bids</span></div>' +
          '<button type="button" class="auction-hub-bid-btn">Enter lot</button></div></article>'
        );
      }).join('') +
      '</div>';
    el.querySelectorAll('.auction-hub-card').forEach(function(card) {
      var id = card.getAttribute('data-hub-auction');
      card.addEventListener('click', function() {
        if (typeof openStorefrontAuctionModal === 'function') openStorefrontAuctionModal(id);
      });
    });
  }

  function lockScroll() {
    if (state.scrollLocked) return;
    state.scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add('auction-hub-open', 'modal-locked', 'storefront-modal-open');
    document.documentElement.classList.add('auction-hub-open');
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + state.scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    state.scrollLocked = true;
  }

  function unlockScroll() {
    if (!state.scrollLocked) return;
    document.body.classList.remove('auction-hub-open');
    document.documentElement.classList.remove('auction-hub-open');
    var otherModal = document.getElementById('aylen-modal-root');
    var cartOpen = document.getElementById('cartModal');
    var cartVisible = cartOpen && (cartOpen.classList.contains('open') || cartOpen.style.display === 'flex');
    var modalVisible = otherModal && otherModal.classList.contains('open');
    var pdpOpen = document.body.classList.contains('pdp-modal-open');
    if (!cartVisible && !modalVisible && !pdpOpen) {
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

  function renderAll() {
    renderProfile();
    renderPrefs();
    renderNotifs();
    renderMain();
    renderNotifBadge();
  }

  function openHub() {
    ensureUi();
    var root = document.getElementById('auctionHubRoot');
    if (!root) return;
    root.classList.remove('is-hidden');
    open = true;
    lockScroll();
    renderAll();
    startTick();
  }

  function close() {
    var root = document.getElementById('auctionHubRoot');
    if (root) root.classList.add('is-hidden');
    open = false;
    unlockScroll();
    stopTick();
  }

  function startTick() {
    stopTick();
    tickTimer = setInterval(function() {
      if (!open) return;
      checkEndingSoon();
      renderMain();
    }, 1000);
  }

  function stopTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  }

  function checkEndingSoon() {
    var prefs = loadPrefs();
    if (!prefs.endingSoon) return;
    var list = auctionList();
    list.forEach(function(a) {
      var ms = Date.parse(a.endTime || 0) - Date.now();
      if (ms > 0 && ms < 300000) {
        var key = 'ending_' + a.id;
        var sent = {};
        try { sent = JSON.parse(sessionStorage.getItem('ah_ending_sent') || '{}'); } catch (e) {}
        if (sent[key]) return;
        sent[key] = true;
        try { sessionStorage.setItem('ah_ending_sent', JSON.stringify(sent)); } catch (e) {}
        pushNotif({ title: 'Ending soon', body: (a.name || 'Lot') + ' — less than 5 minutes left!' });
        notifyMsg('⏳ ' + (a.name || 'Auction') + ' ending in under 5 minutes', 'success');
      }
    });
  }

  function trackLeaders() {
    var leaders = {};
    try { leaders = JSON.parse(localStorage.getItem(LEADER_KEY) || '{}'); } catch (e) {}
    var c = getContact();
    var myPhone = String(c.phone || '').replace(/\D/g, '').slice(-6);
    auctionList().forEach(function(a) {
      if (typeof getHighestBid !== 'function') return;
      var top = getHighestBid(a);
      if (!top || top.isBot || top.source === 'bot') return;
      var key = String(a.id);
      var topPhone = String(top.bidderPhone || '').replace(/\D/g, '').slice(-6);
      var prev = leaders[key];
      if (prev && prev.phone && myPhone && prev.phone === myPhone && topPhone !== myPhone) {
        var prefs = loadPrefs();
        if (prefs.outbid) {
          pushNotif({ title: 'Outbid!', body: 'Someone beat your bid on ' + (a.name || 'a lot') + ' — current ' + fmtMoney(a.currentPrice) });
          notifyMsg('You were outbid on ' + (a.name || 'a lot'), 'error');
        }
      }
      leaders[key] = { phone: topPhone, amount: Number(top.amount || 0) };
    });
    try { localStorage.setItem(LEADER_KEY, JSON.stringify(leaders)); } catch (e) {}
  }

  function injectEnterButton() {
    var meta = document.getElementById('auctionsLiveMeta');
    if (!meta || document.getElementById('auctionHubEnterBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'auctionHubEnterBtn';
    btn.className = 'auction-hub-enter-btn';
    btn.innerHTML = '<i class="fas fa-dungeon"></i> Enter Auction Floor';
    btn.addEventListener('click', openHub);
    meta.parentElement.insertBefore(btn, meta.nextSibling);
  }

  function onBidPlaced(auctionId, amount) {
    var c = getContact();
    if (c.phone) {
      fetch('/api/spam?action=auction-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'profile',
          phone: c.phone,
          name: c.name || '',
          event: { type: 'bid', auctionId: auctionId, amount: amount, at: new Date().toISOString() }
        })
      }).catch(function() {});
    }
    if (open) renderProfile();
    trackLeaders();
  }

  function init() {
    ensureUi();
    injectEnterButton();
    if (typeof auctions !== 'undefined') {
      setInterval(trackLeaders, 4000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

  global.AYLEN_AUCTION_HUB = {
    open: openHub,
    close: close,
    onBidPlaced: onBidPlaced,
    pushNotif: pushNotif
  };
})(typeof window !== 'undefined' ? window : this);
