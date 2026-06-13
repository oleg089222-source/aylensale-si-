/**
 * Storefront discount codes — validates against Firestore `cards` (cardHolders).
 */
(function(global) {
  var SESSION_KEY = 'aylen_discount_session_v1';
  var session = null;

  function cleanCode(code) {
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
  }

  function getCards() {
    return (typeof cardHolders !== 'undefined' && cardHolders) ? cardHolders : {};
  }

  function waitForCards(maxMs) {
    maxMs = maxMs || 6000;
    return new Promise(function(resolve) {
      var start = Date.now();
      (function tick() {
        var cards = getCards();
        if (Object.keys(cards).length > 0 || Date.now() - start >= maxMs) {
          resolve(cards);
          return;
        }
        setTimeout(tick, 120);
      })();
    });
  }

  function cardIsUsable(card) {
    if (!card) return { ok: false, message: 'Invalid or unknown discount code' };
    var status = String(card.status || (card.active === false ? 'blocked' : 'active')).toLowerCase();
    if (status === 'blocked' || status === 'paused' || status === 'expired') {
      return { ok: false, message: 'This discount code is not active' };
    }
    if (status !== 'active' && status !== 'unused') {
      return { ok: false, message: 'This discount code is not active' };
    }
    if (card.expiryDate) {
      var exp = new Date(String(card.expiryDate).slice(0, 10) + 'T23:59:59');
      if (!isNaN(exp.getTime()) && exp < new Date()) {
        return { ok: false, message: 'This discount code has expired' };
      }
    }
    if (Number(card.usageLimit || 0) > 0 && Number(card.usageCount || 0) >= Number(card.usageLimit)) {
      return { ok: false, message: 'This discount code has reached its usage limit' };
    }
    return { ok: true };
  }

  function buildSession(card, code) {
    var type = card.discountType || 'percent';
    var value = Number(card.discountValue != null ? card.discountValue : card.discount || 0);
    var percent = type === 'percent' ? value : Number(card.discount || 0);
    return {
      card: code,
      name: card.name || 'Customer',
      discountType: type,
      discountValue: value,
      discount: percent > 0 ? percent : 0,
      wholesaleAccess: type === 'wholesale' || !!card.wholesaleAccess,
      freeDelivery: type === 'free_delivery' || !!card.freeDelivery,
      priceGroup: card.priceGroup || '',
      minOrderValue: Number(card.minOrderValue || 0),
      status: card.status || 'active'
    };
  }

  function applySessionToApp(next) {
    session = next;
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    if (typeof global.currentUser !== 'undefined') {
      global.currentUser = session;
    }
    try {
      if (session) localStorage.setItem('aylenuser', JSON.stringify(session));
      else localStorage.removeItem('aylenuser');
    } catch (e2) {}
  }

  function loadStoredSession() {
    if (session) return session;
    try {
      var raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem('aylenuser');
      if (raw) session = JSON.parse(raw);
    } catch (e) {
      session = null;
    }
    if (session && session.card) applySessionToApp(session);
    return session;
  }

  function lookupCard(code) {
    var cards = getCards();
    return cards[code] || cards[String(code).toUpperCase()] || null;
  }

  async function validateCode(code) {
    code = cleanCode(code);
    if (!code) return { valid: false, message: 'Enter a discount code' };

    await waitForCards();
    var card = lookupCard(code);
    var check = cardIsUsable(card);
    if (!check.ok) {
      applySessionToApp(null);
      return { valid: false, message: check.message };
    }

    var next = buildSession(card, code);
    applySessionToApp(next);

    var msg = 'Discount applied';
    if (next.discountType === 'percent' && next.discount > 0) {
      msg = next.discount + '% discount applied';
    } else if (next.discountType === 'fixed' && next.discountValue > 0) {
      msg = '£' + next.discountValue.toFixed(2) + ' off your order';
    } else if (next.wholesaleAccess) {
      msg = 'Special card pricing applied';
    } else if (next.freeDelivery) {
      msg = 'Free delivery applied';
    }

    return { valid: true, message: msg, session: next };
  }

  function validateStoredSession() {
    loadStoredSession();
    if (!session || !session.card) {
      applySessionToApp(null);
      return false;
    }
    var card = lookupCard(session.card);
    var check = cardIsUsable(card);
    if (!check.ok) {
      applySessionToApp(null);
      var banner = document.querySelector('.welcome-banner');
      if (banner) banner.remove();
      return false;
    }
    var refreshed = buildSession(card, session.card);
    applySessionToApp(refreshed);
    return true;
  }

  function getSession() {
    loadStoredSession();
    if (!session || !session.card) return null;
    var card = lookupCard(session.card);
    if (!cardIsUsable(card).ok) return null;
    return session;
  }

  function getDiscountPercent() {
    var s = getSession();
    if (!s) return 0;
    if (s.discountType && s.discountType !== 'percent') {
      return s.discountType === 'wholesale' ? 0 : (Number(s.discount) || 0);
    }
    return Number(s.discount || s.discountValue || 0) > 0 ? Number(s.discount || s.discountValue) : 0;
  }

  function hasWholesaleAccess() {
    var s = getSession();
    return !!(s && s.wholesaleAccess);
  }

  function applyOrderDiscount(subtotal) {
    var s = getSession();
    var total = Number(subtotal || 0);
    if (!s || !Number.isFinite(total)) return total;
    if (Number(s.minOrderValue || 0) > 0 && total < Number(s.minOrderValue)) {
      return total;
    }
    if (s.discountType === 'fixed' && Number(s.discountValue) > 0) {
      return Math.max(0, total - Number(s.discountValue));
    }
    return total;
  }

  function clearDiscount() {
    applySessionToApp(null);
  }

  function randomCode(prefix) {
    prefix = String(prefix || 'AYLEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    var n = Math.floor(1000 + Math.random() * 9000);
    return prefix + n;
  }

  loadStoredSession();

  global.AYLEN_DISCOUNT = {
    validateCode: validateCode,
    validateStoredSession: validateStoredSession,
    getSession: getSession,
    getDiscountPercent: getDiscountPercent,
    hasWholesaleAccess: hasWholesaleAccess,
    applyOrderDiscount: applyOrderDiscount,
    clearDiscount: clearDiscount,
    randomCode: randomCode
  };
})(typeof window !== 'undefined' ? window : globalThis);
