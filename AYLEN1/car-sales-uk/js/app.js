// AYLEN SALE - Main App
var cart = JSON.parse(localStorage.getItem('aylencart') || '[]');
var savedItems = JSON.parse(localStorage.getItem('aylensaved') || '[]');
var currentUser = JSON.parse(localStorage.getItem('aylenuser') || 'null');
var priceMode = 'retail';
var selectedProductImage = {};
var engagementSessionId = getEngagementSessionId();
var engagementPresence = [];
var productViewCounts = {};
var onlineVisitorsCount = 0;
var activeCartsCount = 0;
var currentViewedProductId = '';
var lastPresenceWrite = 0;
var latestActivityIds = {};
var activityFeedInitialized = false;
var revealObserver = null;
var locationWeatherCache = {};
var locationWeatherInFlight = {};
var WHATSAPP_DEFAULT_TEXT = 'Hi AYLENSALE! I\'m interested in your wholesale stock and weekend car boot deals. Please send availability and prices. Thank you!';
var WEATHER_REFRESH_MS = 2 * 60 * 60 * 1000;
var productsRevealInitialized = false;
var WEATHER_RETRY_THROTTLE_MS = 15 * 60 * 1000;
var PRESENCE_FRESH_MS = 90 * 1000;
var PRESENCE_WRITE_MS = 25 * 1000;
var PRODUCT_FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22200%22%20viewBox%3D%220%200%20300%20200%22%3E%3Crect%20fill%3D%22%231a1a2e%22%20width%3D%22300%22%20height%3D%22200%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22Arial%22%20font-size%3D%2224%22%20fill%3D%22%23e94560%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EAYLENSALE%3C%2Ftext%3E%3C%2Fsvg%3E';
var THUMB_FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20fill%3D%22%231a1a2e%22%20width%3D%2280%22%20height%3D%2280%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22Arial%22%20font-size%3D%2210%22%20fill%3D%22%23e94560%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EImage%3C%2Ftext%3E%3C%2Fsvg%3E';
var AUCTION_FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22200%22%20viewBox%3D%220%200%20300%20200%22%3E%3Crect%20fill%3D%22%231a1a2e%22%20width%3D%22300%22%20height%3D%22200%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22Arial%22%20font-size%3D%2224%22%20fill%3D%22%23e94560%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EAuction%3C%2Ftext%3E%3C%2Fsvg%3E';
var LOCATION_FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22460%22%20height%3D%22220%22%20viewBox%3D%220%200%20460%20220%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%20y1%3D%220%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%231a1a2e%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23e94560%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20fill%3D%22url(%23g)%22%20width%3D%22460%22%20height%3D%22220%22%2F%3E%3Ccircle%20cx%3D%2285%22%20cy%3D%2280%22%20r%3D%2238%22%20fill%3D%22%23fff%22%20opacity%3D%22.22%22%2F%3E%3Cpath%20d%3D%22M0%20170%20C80%20135%20135%20185%20220%20148%20C300%20112%20365%20150%20460%20120%20L460%20220%20L0%20220Z%22%20fill%3D%22%23fff%22%20opacity%3D%22.18%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2252%25%22%20font-family%3D%22Arial%22%20font-size%3D%2228%22%20font-weight%3D%22bold%22%20fill%3D%22%23fff%22%20text-anchor%3D%22middle%22%3EPickup%20Point%3C%2Ftext%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2268%25%22%20font-family%3D%22Arial%22%20font-size%3D%2215%22%20fill%3D%22%23fff%22%20opacity%3D%22.9%22%20text-anchor%3D%22middle%22%3EAYLENSALE%20Car%20Boot%3C%2Ftext%3E%3C%2Fsvg%3E';

function jsArg(value) {
  return JSON.stringify(String(value));
}

function jsInlineArg(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeDomId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function stopCarouselEvent(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  if (ev && ev.stopPropagation) ev.stopPropagation();
}

function productImageKey(productId) {
  return String(productId);
}

function imageSourcesMatch(imgEl, nextSrc) {
  if (!imgEl || !nextSrc) return false;
  try {
    var current = document.createElement('a');
    current.href = imgEl.currentSrc || imgEl.src || '';
    var next = document.createElement('a');
    next.href = nextSrc;
    return current.href === next.href;
  } catch (e) {
    return String(imgEl.getAttribute('src') || '') === String(nextSrc);
  }
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showProductSkeletons() {
  var grid = document.getElementById('productsGrid');
  if (!grid || grid.children.length > 0) return;
  var html = '';
  for (var i = 0; i < 8; i++) html += '<div class="product-skeleton"></div>';
  grid.innerHTML = html;
}

function initSmoothReveal() {
  document.documentElement.classList.add('motion-ready');
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal-item').forEach(function(el) {
      el.classList.add('is-visible');
    });
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  }
  refreshRevealItems();
}

function refreshRevealItems() {
  var selectors = [
    '.hero-content',
    '.trust-card',
    '.live-stat',
    '#ebayPromoWrap > *',
    '#newArrivalsSection > *',
    '.product-card',
    '.auction-card',
    '.location-card'
  ];
  document.querySelectorAll(selectors.join(',')).forEach(function(el) {
    if (!el.classList.contains('reveal-item')) {
      el.classList.add('reveal-item');
      if (prefersReducedMotion() || !revealObserver) {
        el.classList.add('is-visible');
      } else {
        revealObserver.observe(el);
      }
    }
  });
}

function antiTheftImageAttrs() {
  return ' draggable="false" loading="lazy" decoding="async" referrerpolicy="no-referrer" oncontextmenu="return false"';
}

function weatherStatus(rainPercent) {
  if (rainPercent <= 25) return { label: 'GOOD', color: '#00cc66' };
  if (rainPercent <= 55) return { label: 'OK', color: '#f39c12' };
  return { label: 'BAD', color: '#e94560' };
}

function weatherStatusLabel(satRain, sunRain) {
  return weatherStatus(Math.max(Number(satRain || 0), Number(sunRain || 0))).label;
}

function pickupWeatherDays(value) {
  var clean = String(value || '').toLowerCase();
  var hasSat = clean.indexOf('sat') !== -1 || clean.indexOf('both') !== -1 || clean.indexOf('weekend') !== -1;
  var hasSun = clean.indexOf('sun') !== -1 || clean.indexOf('both') !== -1 || clean.indexOf('weekend') !== -1;
  if (!hasSat && !hasSun) hasSat = true;
  return { saturday: hasSat, sunday: hasSun };
}

function selectedWeatherStatus(days, satRain, sunRain) {
  var values = [];
  if (days.saturday) values.push(Number(satRain || 0));
  if (days.sunday) values.push(Number(sunRain || 0));
  return weatherStatus(Math.max.apply(Math, values.length ? values : [0])).label;
}

function weatherTimeMs(value) {
  if (!value) return 0;
  if (value.toMillis) return value.toMillis();
  var date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function hasStoredWeather(loc) {
  return loc && (loc.saturdayRainPct !== undefined || loc.sundayRainPct !== undefined || loc.saturdayTemp !== undefined || loc.sundayTemp !== undefined);
}

function isWeatherFresh(loc) {
  var updated = weatherTimeMs(loc.lastWeatherUpdate);
  return hasStoredWeather(loc) && updated > 0 && Date.now() - updated < WEATHER_REFRESH_MS;
}

function storedWeatherForecast(loc) {
  if (!hasStoredWeather(loc)) return null;
  var selectedDays = loc.weatherDays || pickupWeatherDays(loc.days || loc.day);
  return {
    days: selectedDays,
    saturday: { rain: Number(loc.saturdayRainPct || 0), max: Number(loc.saturdayTemp || 0) },
    sunday: { rain: Number(loc.sundayRainPct || 0), max: Number(loc.sundayTemp || 0) }
  };
}

function weatherAttemptKey(loc) {
  return 'aylen_weather_attempt_' + String(loc.id || loc.postcode || loc.name).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function canAttemptWeatherRefresh(loc) {
  try {
    var last = Number(localStorage.getItem(weatherAttemptKey(loc)) || 0);
    return Date.now() - last > WEATHER_RETRY_THROTTLE_MS;
  } catch (e) {
    return true;
  }
}

function markWeatherRefreshAttempt(loc) {
  try { localStorage.setItem(weatherAttemptKey(loc), String(Date.now())); } catch (e) {}
}

function getEngagementSessionId() {
  try {
    var existing = localStorage.getItem('aylen_presence_session');
    if (existing) return existing;
    var created = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('aylen_presence_session', created);
    return created;
  } catch (e) {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }
}

function cartQtyTotal() {
  var total = 0;
  (Array.isArray(cart) ? cart : []).forEach(function(item) {
    total += Number(item.qty || 0);
  });
  return total;
}

function ensureEngagementBar() {
  if (document.getElementById('engagementBar')) return;
  var banner = document.querySelector('.banner');
  if (!banner || !banner.parentNode) return;
  var bar = document.createElement('section');
  bar.id = 'engagementBar';
  bar.style.cssText = 'max-width:1200px;margin:14px auto 0;padding:0 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px';
  bar.innerHTML =
    '<div class="live-stat"><i class="fas fa-circle"></i><span><b id="onlineVisitorsCount">0</b><small>online now</small></span></div>' +
    '<div class="live-stat"><i class="fas fa-box-open"></i><span><b id="productsAvailableCount">0</b><small>products available</small></span></div>' +
    '<div class="live-stat"><i class="fas fa-gavel"></i><span><b id="activeAuctionsCount">0</b><small>active auctions</small></span></div>' +
    '<div class="live-stat"><i class="fas fa-location-dot"></i><span><b id="pickupPointsCount">0</b><small>pickup points</small></span></div>' +
    '<div class="live-stat"><i class="fas fa-cart-shopping"></i><span><b id="activeCartsCount">0</b><small>active carts</small></span></div>';
  banner.parentNode.insertBefore(bar, banner.nextSibling);
}

function renderEngagementStats() {
  ensureEngagementBar();
  var onlineEl = document.getElementById('onlineVisitorsCount');
  var cartsEl = document.getElementById('activeCartsCount');
  var productsEl = document.getElementById('productsAvailableCount');
  var auctionsEl = document.getElementById('activeAuctionsCount');
  var pickupsEl = document.getElementById('pickupPointsCount');
  if (onlineEl) onlineEl.textContent = onlineVisitorsCount;
  if (cartsEl) cartsEl.textContent = activeCartsCount;
  if (productsEl) productsEl.textContent = (products || []).filter(function(p) { return p.active !== false && Number(p.stock || 0) > 0; }).length;
  if (auctionsEl) auctionsEl.textContent = (auctions || []).filter(function(a) { return getAuctionStatus(a) === 'active'; }).length;
  if (pickupsEl) pickupsEl.textContent = (locations || []).filter(function(l) { return l.active !== false; }).length;
  updateProductViewerBadges();
  refreshRevealItems();
}

function updateProductViewerBadges() {
  Object.keys(productViewCounts).forEach(function(productId) {
    var el = document.getElementById('viewers-' + safeDomId(productId));
    if (el) {
      var count = productViewCounts[productId] || 0;
      el.style.display = count > 0 ? 'inline-flex' : 'none';
      el.innerHTML = '<i class="fas fa-eye"></i> ' + count + ' viewing';
    }
  });
}

function updatePresenceFromSnapshot(sessions) {
  var cutoff = Date.now() - PRESENCE_FRESH_MS;
  var active = (sessions || []).filter(function(session) {
    var updated = weatherTimeMs(session.updatedAt);
    return updated && updated >= cutoff;
  });
  var viewers = {};
  var carts = 0;
  active.forEach(function(session) {
    if (session.currentProductId) {
      viewers[String(session.currentProductId)] = (viewers[String(session.currentProductId)] || 0) + 1;
    }
    if (Number(session.cartQty || 0) > 0 || session.hasCart === true) carts++;
  });
  engagementPresence = active;
  productViewCounts = viewers;
  onlineVisitorsCount = active.length;
  activeCartsCount = carts;
  renderEngagementStats();
}

function writePresence(force) {
  if (!window.FBDB || !window.FBDB.savePresence) return;
  var now = Date.now();
  if (!force && now - lastPresenceWrite < PRESENCE_WRITE_MS) return;
  lastPresenceWrite = now;
  window.FBDB.savePresence(engagementSessionId, {
    currentProductId: currentViewedProductId || '',
    cartQty: cartQtyTotal(),
    hasCart: cartQtyTotal() > 0,
    card: currentUser && currentUser.card ? currentUser.card : '',
    page: location.pathname || '/',
    updatedAt: new Date().toISOString()
  }).catch(function(error) {
    console.warn('Presence update failed:', error.message || error);
  });
}

function trackProductView(productId) {
  currentViewedProductId = String(productId || '');
  writePresence(true);
}

function startEngagementTracking() {
  ensureEngagementBar();
  renderEngagementStats();
  if (window.FBDB && window.FBDB.listenPresence) {
    try {
      window.FBDB.listenPresence(updatePresenceFromSnapshot);
    } catch (e) {
      console.warn('Presence listener failed:', e.message || e);
    }
  }
  if (window.FBDB && window.FBDB.listenActivityFeed) {
    try {
      window.FBDB.listenActivityFeed(function(items) {
        if (!activityFeedInitialized) {
          (items || []).forEach(function(item) { latestActivityIds[item.id] = true; });
          activityFeedInitialized = true;
          return;
        }
        (items || []).slice().reverse().forEach(function(item) {
          if (!latestActivityIds[item.id]) {
            latestActivityIds[item.id] = true;
            showLiveActivity(item.message || 'New activity on AYLENSALE');
          }
        });
      });
    } catch (e) {
      console.warn('Activity listener failed:', e.message || e);
    }
  }
  writePresence(true);
  if (window.presenceInterval) clearInterval(window.presenceInterval);
  window.presenceInterval = setInterval(function() { writePresence(false); }, PRESENCE_WRITE_MS);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) writePresence(true);
  });
}

function showLiveActivity(message) {
  var box = document.getElementById('liveActivityPopup');
  if (!box) {
    box = document.createElement('div');
    box.id = 'liveActivityPopup';
    box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:350;background:#1a1a2e;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:min(330px,calc(100vw - 32px));display:none;font-size:13px;line-height:1.35';
    document.body.appendChild(box);
  }
  box.innerHTML = '<div style="display:flex;gap:10px;align-items:flex-start"><span style="width:10px;height:10px;background:#00cc66;border-radius:999px;margin-top:4px;box-shadow:0 0 0 6px rgba(0,204,102,.18)"></span><div><b>Live update</b><br>' + escapeHtml(message) + '</div></div>';
  box.style.display = 'block';
  clearTimeout(window.liveActivityHideTimer);
  window.liveActivityHideTimer = setTimeout(function() { box.style.display = 'none'; }, 5200);
}

function saveLiveActivity(message, type, productId) {
  if (!window.FBDB || !window.FBDB.saveActivity) return;
  window.FBDB.saveActivity({
    message: message,
    type: type || 'activity',
    productId: productId || '',
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now()
  }).catch(function(error) {
    console.warn('Activity save failed:', error.message || error);
  });
}

function productAgeMs(product) {
  return weatherTimeMs(product.createdAt || product.updatedAt || product.lastModified);
}

var FRESH_STOCK_ONE_DAY_MS = 24 * 60 * 60 * 1000;

function freshStockBadgeLabel(product) {
  var ageMs = productAgeMs(product);
  if (!ageMs) return 'THIS WEEK';
  return Date.now() - ageMs < FRESH_STOCK_ONE_DAY_MS ? 'ARRIVED TODAY' : 'THIS WEEK';
}

function productAutoBadge(product) {
  if (product.badge) return product.badge;
  var ageMs = productAgeMs(product);
  if (!ageMs) return '';
  var age = Date.now() - ageMs;
  if (age >= 7 * FRESH_STOCK_ONE_DAY_MS) return '';
  if (age < FRESH_STOCK_ONE_DAY_MS) return 'NEW';
  return 'THIS WEEK';
}

function stockLabel(product) {
  var stock = Number(product.stock || 0);
  if (stock <= 0) return '';
  if (stock <= 2) return 'Only ' + stock + ' left';
  if (stock <= 5) return 'Selling fast';
  return '';
}

function validEbayUrl(ebayUrl) {
  var url = String(ebayUrl || '').trim();
  return url.startsWith('https://www.ebay.co.uk/') ||
    url.startsWith('https://ebay.co.uk/') ||
    url.startsWith('https://www.ebay.com/') ||
    url.startsWith('https://ebay.com/');
}

function safeEbaySettings() {
  var defaults = {
    enabled: false,
    url: '',
    buttonText: 'Shop on eBay',
    description: 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.'
  };
  return Object.assign({}, defaults, (window.siteSettings && window.siteSettings.ebay) || (typeof siteSettings !== 'undefined' && siteSettings.ebay) || {});
}

function defaultWhatsAppUrl() {
  return 'https://wa.me/?text=' + encodeURIComponent(WHATSAPP_DEFAULT_TEXT);
}

function resolveWhatsAppUrl(customUrl) {
  var url = String(customUrl || '').trim();
  if (!url) return defaultWhatsAppUrl();
  if (/^https:\/\/wa\.me\/\d+/i.test(url) && url.indexOf('text=') === -1) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(WHATSAPP_DEFAULT_TEXT);
  }
  return url;
}

function safeMarketplaceSettings() {
  var defaults = {
    newArrivalsEnabled: true,
    telegramUrl: 'https://t.me/aylensale',
    whatsappUrl: defaultWhatsAppUrl()
  };
  return Object.assign({}, defaults, (window.siteSettings && window.siteSettings.marketplace) || (typeof siteSettings !== 'undefined' && siteSettings.marketplace) || {});
}

function renderTelegramLinks() {
  var settings = safeMarketplaceSettings();
  var url = settings.telegramUrl || 'https://t.me/aylensale';
  var whatsappUrl = resolveWhatsAppUrl(settings.whatsappUrl);
  var links = document.querySelectorAll('[data-telegram-link="true"]');
  for (var i = 0; i < links.length; i++) {
    links[i].href = url;
  }
  var whatsappLinks = document.querySelectorAll('[data-whatsapp-link="true"]');
  for (var j = 0; j < whatsappLinks.length; j++) {
    whatsappLinks[j].href = whatsappUrl;
  }
}

function renderEbayPromo() {
  var settings = safeEbaySettings();
  var shouldShow = settings.enabled === true && validEbayUrl(settings.url);
  var wrap = document.getElementById('ebayPromoWrap');
  var headerBtn = document.getElementById('headerEbayBtn');
  var buttonText = settings.buttonText || 'Shop on eBay';

  if (headerBtn) {
    headerBtn.style.display = shouldShow ? 'inline-flex' : 'none';
    if (shouldShow) {
      headerBtn.href = settings.url;
      headerBtn.innerHTML = '<i class="fas fa-store"></i> ' + escapeHtml(buttonText);
    }
  }

  if (!wrap) return;
  if (!shouldShow) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  wrap.style.display = 'block';
  wrap.innerHTML =
    '<div style="background:linear-gradient(135deg,#fff 0%,#f7fbff 100%);border:1px solid #dbeafe;border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(0,100,210,.10);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">' +
      '<div style="display:flex;align-items:center;gap:14px;min-width:240px;flex:1">' +
        '<div style="width:54px;height:54px;border-radius:16px;background:#0064d2;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 6px 16px rgba(0,100,210,.25)"><i class="fas fa-store"></i></div>' +
        '<div>' +
          '<div style="display:inline-flex;gap:4px;align-items:center;font-size:12px;font-weight:900;letter-spacing:.4px;margin-bottom:5px">' +
            '<span style="color:#e53238">e</span><span style="color:#0064d2">B</span><span style="color:#f5af02">a</span><span style="color:#86b817">y</span><span style="color:#1a1a2e;margin-left:4px">OFFICIAL STORE</span>' +
          '</div>' +
          '<div style="color:#1a1a2e;font-weight:800;font-size:18px;margin-bottom:3px">' + escapeHtml(buttonText) + '</div>' +
          '<div style="color:#555;font-size:13px;line-height:1.4">' + escapeHtml(settings.description || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<a href="' + escapeHtml(settings.url) + '" target="_blank" rel="noopener" style="background:#0064d2;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:900;display:inline-flex;align-items:center;gap:8px;white-space:nowrap"><i class="fas fa-external-link-alt"></i> ' + escapeHtml(buttonText) + '</a>' +
    '</div>';
}

function renderNewArrivals() {
  if (!safeMarketplaceSettings().newArrivalsEnabled) {
    var existing = document.getElementById('newArrivalsSection');
    if (existing) {
      existing.style.display = 'none';
      existing.innerHTML = '';
    }
    return;
  }
  var productsSection = document.getElementById('products');
  if (!productsSection || !productsSection.parentNode) return;
  var section = document.getElementById('newArrivalsSection');
  if (!section) {
    section = document.createElement('section');
    section.id = 'newArrivalsSection';
    section.style.cssText = 'padding:18px 20px 0;max-width:1200px;margin:0 auto';
    productsSection.parentNode.insertBefore(section, productsSection);
  }
  var recent = (Array.isArray(products) ? products.slice() : []).filter(function(p) {
    return (window.isAdminMode || p.active !== false) && productAgeMs(p) && Date.now() - productAgeMs(p) < 14 * 24 * 60 * 60 * 1000;
  }).sort(function(a, b) {
    return productAgeMs(b) - productAgeMs(a);
  }).slice(0, 6);
  if (!recent.length) {
    section.style.display = 'none';
    section.innerHTML = '';
    return;
  }
  section.style.display = 'block';
  var html = '<div class="new-arrivals-panel">' +
    '<div class="new-arrivals-head">' +
      '<h2 class="new-arrivals-title"><i class="fas fa-truck-ramp-box"></i> New Arrivals / Fresh Stock</h2>' +
      '<span class="new-arrivals-subtitle">Arrived Today • Amazon returns • Wholesale pallets</span>' +
    '</div>' +
    '<div class="new-arrivals-track" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:4px">';
  recent.forEach(function(p) {
    var img = p.images && p.images[0] ? p.images[0] : PRODUCT_FALLBACK_IMAGE;
    html += '<div class="new-arrival-card" onclick="trackProductView(' + jsInlineArg(p.id) + ');var el=document.getElementById(' + jsInlineArg('product-card-' + safeDomId(p.id)) + ');if(el){el.scrollIntoView({behavior:' + jsInlineArg('smooth') + ',block:' + jsInlineArg('center') + '});}" style="min-width:190px;cursor:pointer;border:1px solid #eef2f7;border-radius:12px;overflow:hidden;background:#fafafa">' +
      '<div style="position:relative"><img src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.name) + '" style="width:100%;height:126px;object-fit:cover" ' + antiTheftImageAttrs() + '><span class="new-arrival-badge">' + escapeHtml(freshStockBadgeLabel(p)) + '</span></div>' +
      '<div style="padding:11px">' +
        '<div style="font-size:13px;font-weight:900;color:#1a1a2e;line-height:1.25">' + escapeHtml(p.name) + '</div>' +
        '<div style="font-size:11px;color:#e94560;margin-top:5px;font-weight:800">Fresh Amazon returns</div>' +
      '</div>' +
    '</div>';
  });
  html += '</div></div>';
  section.innerHTML = html;
  startNewArrivalsAutoScroll();
  refreshRevealItems();
}

function startNewArrivalsAutoScroll() {
  var track = document.querySelector('.new-arrivals-track');
  if (!track) return;
  if (window.newArrivalsScrollTimer) clearInterval(window.newArrivalsScrollTimer);
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  if (reduceMotion || isMobile) return;
  window.newArrivalsScrollTimer = setInterval(function() {
    if (document.hidden || !document.querySelector('.new-arrivals-track')) return;
    if (track.scrollWidth <= track.clientWidth) return;
    var next = track.scrollLeft + 210;
    if (next + track.clientWidth >= track.scrollWidth) next = 0;
    track.scrollTo({ left: next, behavior: 'smooth' });
  }, 4200);
}

function rainBar(label, rainPercent, maxTemp) {
  var status = weatherStatus(rainPercent);
  var width = Math.max(4, Math.min(100, rainPercent));
  return '<div class="weather-day-card">' +
    '<div class="weather-day-head">' +
      '<b>' + label + '</b>' +
      '<span class="weather-status-pill" style="background:' + status.color + '">' + status.label + '</span>' +
    '</div>' +
    '<div class="weather-rain-row">' +
      '<span class="weather-rain-icon">☔</span>' +
      '<span class="weather-rain-value" style="color:' + status.color + '">' + rainPercent + '%</span>' +
      '<span class="weather-rain-label">rain</span>' +
    '</div>' +
    '<div class="weather-rain-track"><div class="weather-rain-fill" style="width:' + width + '%;background:' + status.color + '"></motion></div>' +
    '<div class="weather-temp">Max temp: ' + Math.round(maxTemp || 0) + '°C</div>' +
  '</div>';
}

function nextWeekendDates() {
  var today = new Date();
  var day = today.getDay();
  var saturdayOffset = (6 - day + 7) % 7;
  var sundayOffset = (7 - day) % 7;
  var saturday = new Date(today);
  saturday.setDate(today.getDate() + saturdayOffset);
  var sunday = new Date(today);
  sunday.setDate(today.getDate() + sundayOffset);
  return {
    saturday: saturday.toISOString().slice(0, 10),
    sunday: sunday.toISOString().slice(0, 10)
  };
}

async function geocodeLocationForWeather(loc) {
  var lng = loc.lng || loc.lon;
  if (loc.lat && lng) {
    return { lat: Number(loc.lat), lng: Number(lng) };
  }

  if (loc.postcode) {
    try {
      var response = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(loc.postcode));
      if (response.ok) {
        var data = await response.json();
        if (data && data.result) {
          return { lat: Number(data.result.latitude), lng: Number(data.result.longitude) };
        }
      }
    } catch (e) {
      console.warn('Postcode geocode failed:', e.message);
    }
  }

  return null;
}

async function fetchWeekendWeather(loc) {
  var key = String(loc.id || loc.name);
  if (locationWeatherCache[key] && Date.now() - locationWeatherCache[key].fetchedAt < WEATHER_REFRESH_MS) {
    return locationWeatherCache[key].forecast;
  }

  var coords = await geocodeLocationForWeather(loc);
  if (!coords) return null;

  var dates = nextWeekendDates();
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + coords.lat +
    '&longitude=' + coords.lng +
    '&daily=precipitation_probability_max,weather_code,temperature_2m_max,temperature_2m_min' +
    '&timezone=Europe%2FLondon&start_date=' + dates.saturday + '&end_date=' + dates.sunday;

  var response = await fetch(url);
  if (!response.ok) throw new Error('Weather API failed');
  var data = await response.json();
  var daily = data.daily || {};
  var result = {
    days: pickupWeatherDays(loc.days || loc.day),
    saturday: {
      rain: Number((daily.precipitation_probability_max || [0])[0] || 0),
      max: Number((daily.temperature_2m_max || [0])[0] || 0)
    },
    sunday: {
      rain: Number((daily.precipitation_probability_max || [0, 0])[1] || 0),
      max: Number((daily.temperature_2m_max || [0, 0])[1] || 0)
    }
  };

  locationWeatherCache[key] = { forecast: result, fetchedAt: Date.now() };
  return result;
}

async function updateLocationWeather(loc) {
  var el = document.getElementById('weather-' + String(loc.id).replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!el) return;

  try {
    var stored = storedWeatherForecast(loc);
    if (stored) renderLocationWeatherCard(el, stored, loc);
    if (isWeatherFresh(loc)) return;
    if (!stored) el.innerHTML = '<div style="color:#999;font-size:12px">Loading weekend weather...</div>';
    if (!canAttemptWeatherRefresh(loc)) return;
    await refreshLocationWeather(loc);
  } catch (e) {
    el.innerHTML = '<div style="color:#999;font-size:12px">Weather unavailable</div>';
  }
}

function renderLocationWeatherCard(el, forecast, loc) {
  var updated = weatherTimeMs(loc.lastWeatherUpdate);
  var updatedText = updated ? new Date(updated).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'updating';
  var days = forecast.days || loc.weatherDays || pickupWeatherDays(loc.days || loc.day);
  var dayCards = '';
  if (days.saturday) dayCards += rainBar('Saturday', forecast.saturday.rain, forecast.saturday.max);
  if (days.sunday) dayCards += rainBar('Sunday', forecast.sunday.rain, forecast.sunday.max);
  if (!dayCards) dayCards = rainBar('Saturday', forecast.saturday.rain, forecast.saturday.max);
  var gridCols = days.saturday && days.sunday ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)';
  el.innerHTML =
    '<div class="weather-card-inner" style="width:100%;max-width:100%;box-sizing:border-box;margin-top:10px;background:#f8fafc;border-radius:10px;padding:8px;border:1px solid #e9eef5;overflow:hidden">' +
      '<div style="display:flex;justify-content:space-between;gap:6px;align-items:flex-start;margin-bottom:8px;min-width:0;flex-wrap:wrap">' +
        '<div style="font-size:12px;font-weight:800;color:#1a1a2e">Weekend rain forecast</div>' +
        '<div style="font-size:10px;color:#777;max-width:100%">Updated: ' + escapeHtml(updatedText) + '</div>' +
      '</div>' +
      '<div class="weather-days-grid" style="display:grid;grid-template-columns:' + gridCols + ';gap:6px;max-width:100%;overflow:hidden">' +
        dayCards +
      '</div>' +
    '</div>';
}

async function refreshLocationWeather(loc) {
  var key = String(loc.id || loc.name);
  if (locationWeatherInFlight[key]) return locationWeatherInFlight[key];
  markWeatherRefreshAttempt(loc);
  locationWeatherInFlight[key] = (async function() {
    var forecast = await fetchWeekendWeather(loc);
    if (!forecast) {
      var errEl = document.getElementById('weather-' + String(loc.id).replace(/[^a-zA-Z0-9_-]/g, '_'));
      if (errEl) errEl.innerHTML = '<div style="color:#e94560;font-size:12px">Invalid postcode / Weather unavailable</div>';
      return null;
    }
    var coords = await geocodeLocationForWeather(loc);
    var selectedDays = forecast.days || pickupWeatherDays(loc.days || loc.day);
    var update = {
      saturdayTemp: Math.round(Number(forecast.saturday.max || 0)),
      sundayTemp: Math.round(Number(forecast.sunday.max || 0)),
      saturdayRainPct: Math.round(Number(forecast.saturday.rain || 0)),
      sundayRainPct: Math.round(Number(forecast.sunday.rain || 0)),
      weatherDays: selectedDays,
      weatherStatus: selectedWeatherStatus(selectedDays, forecast.saturday.rain, forecast.sunday.rain),
      lastWeatherUpdate: new Date().toISOString()
    };
    if (coords) {
      update.lat = coords.lat;
      update.lng = coords.lng;
      update.lon = coords.lng;
    }
    Object.assign(loc, update);
    var el = document.getElementById('weather-' + String(loc.id).replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (el) renderLocationWeatherCard(el, forecast, loc);
    if (window.FBDB && window.FBDB.saveLocationWeather) {
      window.FBDB.saveLocationWeather(loc.id, update).catch(function(error) {
        console.warn('Could not save weather cache:', error.message || error);
      });
    }
    return update;
  })();
  try {
    return await locationWeatherInFlight[key];
  } finally {
    delete locationWeatherInFlight[key];
  }
}

document.addEventListener("DOMContentLoaded", async function() {
  if (window.AYLEN_SEO && window.AYLEN_SEO.init) window.AYLEN_SEO.init();
  if (window.AYLEN_COMPLIANCE && window.AYLEN_COMPLIANCE.init) window.AYLEN_COMPLIANCE.init();
  var footerYear = document.getElementById('footerYear');
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());
  var footerCookie = document.getElementById('footerCookieSettings');
  if (footerCookie) {
    footerCookie.addEventListener('click', function(e) {
      e.preventDefault();
      if (window.AYLEN_COMPLIANCE && window.AYLEN_COMPLIANCE.openPreferences) {
        window.AYLEN_COMPLIANCE.openPreferences();
      }
    });
  }
  showProductSkeletons();
  if (!prefersReducedMotion() && !(window.matchMedia && window.matchMedia('(max-width: 1024px)').matches)) {
    initSmoothReveal();
  }
  await loadAllData();
  applyCardFromUrl();
  validateCurrentUserCard();
  normalizeCart();
  renderProducts();
  renderEbayPromo();
  renderTelegramLinks();
  renderLocations();
  renderAuctions();
  showPrices('retail');
  updateCartCount();
  fillPickup();
  scheduleWeatherAutoRefresh();
  if (window.AYLEN_PERF && window.AYLEN_PERF.scheduleEngagement) {
    window.AYLEN_PERF.scheduleEngagement();
  } else {
    startEngagementTracking();
  }
  if (document.documentElement.classList.contains('motion-ready')) refreshRevealItems();
  if (currentUser) showWelcome(currentUser);
});

function refreshVisibleWeatherCards() {
  sortedPickupLocations().filter(function(loc) {
    return window.isAdminMode || loc.active !== false;
  }).forEach(function(loc) {
    updateLocationWeather(loc);
  });
}

function scheduleWeatherAutoRefresh() {
  if (window.weatherRefreshInterval) clearInterval(window.weatherRefreshInterval);
  window.weatherRefreshInterval = setInterval(refreshVisibleWeatherCards, WEATHER_REFRESH_MS);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) refreshVisibleWeatherCards();
  });
}

function saveCart() {
  localStorage.setItem('aylencart', JSON.stringify(cart));
}

function productById(id) {
  for (var i = 0; i < products.length; i++) {
    if (sameId(products[i].id, id)) return products[i];
  }
  return null;
}

function getProductBasePrice(product) {
  if (!product) return 0;
  var retailPrice = Number(product.retail || product.retailPrice || product.price || 0);
  var salePrice = Number(product.salePrice || retailPrice || 0);
  return Number(product.discount || 0) > 0 ? salePrice : retailPrice;
}

function getDiscountPercent() {
  return currentUser && Number(currentUser.discount || 0) > 0 ? Number(currentUser.discount || 0) : 0;
}

function cleanClientCardCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}

function getCartUnitPrice(item) {
  var product = productById(item.id);
  var basePrice = product ? getProductBasePrice(product) : Number(item.basePrice || item.price || 0);
  var discount = getDiscountPercent();
  if (discount > 0) basePrice = basePrice * (1 - discount / 100);
  return Number(basePrice.toFixed(2));
}

function normalizeCart() {
  cart = (Array.isArray(cart) ? cart : []).filter(function(item) {
    return item && item.id !== undefined && Number(item.qty || 0) > 0;
  }).map(function(item) {
    var product = productById(item.id);
    var canonicalId = product ? product.id : item.id;
    var basePrice = product ? getProductBasePrice(product) : Number(item.basePrice || item.price || 0);
    if (!Number.isFinite(basePrice) || basePrice < 0) basePrice = 0;
    var normalized = {
      id: canonicalId,
      name: product ? product.name : (item.name || 'Product'),
      basePrice: Number(basePrice.toFixed(2)),
      qty: Math.max(1, parseInt(item.qty, 10) || 1)
    };
    normalized.price = getCartUnitPrice(normalized);
    return normalized;
  });
  saveCart();
}

function recalculateCartPrices() {
  for (var i = 0; i < cart.length; i++) {
    var product = productById(cart[i].id);
    if (product) {
      cart[i].id = product.id;
      cart[i].name = product.name;
      cart[i].basePrice = Number(getProductBasePrice(product).toFixed(2));
    }
    if (!Number.isFinite(cart[i].basePrice)) cart[i].basePrice = 0;
    cart[i].price = getCartUnitPrice(cart[i]);
    if (!Number.isFinite(cart[i].price)) cart[i].price = cart[i].basePrice || 0;
  }
  saveCart();
  updateCartCount();
}

function validateCurrentUserCard() {
  if (!currentUser || !currentUser.card) return true;
  var code = cleanClientCardCode(currentUser.card);
  var card = cardHolders[code];
  if (!card || card.status === 'blocked' || card.active === false) {
    currentUser = null;
    localStorage.removeItem('aylenuser');
    var banner = document.querySelector('.welcome-banner');
    if (banner) banner.remove();
    var input = document.getElementById('cardNumber');
    if (input) input.value = '';
    return false;
  }
  currentUser = { card: code, name: card.name || 'Customer', discount: Number(card.discount || 0), status: card.status || 'active' };
  localStorage.setItem('aylenuser', JSON.stringify(currentUser));
  if (document.querySelector('.welcome-banner')) showWelcome(currentUser);
  return true;
}

function loginCard() {
  var num = cleanClientCardCode(document.getElementById('cardNumber').value);
  document.getElementById('cardNumber').value = num;
  var card = cardHolders[num];
  if (card && card.status !== 'blocked' && card.active !== false) {
    currentUser = {card: num, name: card.name || 'Customer', discount: Number(card.discount || 0), status: card.status || 'active'};
    localStorage.setItem('aylenuser', JSON.stringify(currentUser));
    showWelcome(currentUser);
    recalculateCartPrices();
    renderProducts();
    renderCart();
    notify('Welcome ' + currentUser.name + '! Discount: ' + currentUser.discount + '%', 'success');
  } else {
    currentUser = null;
    localStorage.removeItem('aylenuser');
    var banner = document.querySelector('.welcome-banner');
    if (banner) banner.remove();
    document.getElementById('cardNumber').value = '';
    recalculateCartPrices();
    renderProducts();
    renderCart();
    notify('Card/discount code is not valid', 'error');
  }
}

function applyCardFromUrl() {
  try {
    var params = new URLSearchParams(window.location.search || '');
    var cardCode = cleanClientCardCode(params.get('card'));
    if (!cardCode) return;
    var input = document.getElementById('cardNumber');
    if (input) input.value = cardCode;
    if (cardHolders[cardCode] && cardHolders[cardCode].status !== 'blocked') {
      loginCard();
    }
  } catch (e) {
    console.warn('Could not apply card from URL:', e.message);
  }
}

function showWelcome(u) {
  var old = document.querySelector('.welcome-banner');
  if (old) old.remove();
  var d = document.createElement('div');
  d.className = 'welcome-banner';
  d.innerHTML = 'Welcome, <b>' + u.name + '</b>! Discount: <span class="discount">' + u.discount + '% OFF</span> <button onclick="logout()" style="background:none;border:1px solid #fff;color:#fff;padding:3px 10px;border-radius:3px;cursor:pointer;margin-left:10px">Logout</button>';
  document.querySelector('header').after(d);
}

function logout() {
  currentUser = null;
  localStorage.removeItem('aylenuser');
  var b = document.querySelector('.welcome-banner');
  if (b) b.remove();
  recalculateCartPrices();
  renderProducts();
  renderCart();
  notify('Logged out', 'success');
}

function renderLocations() {
  var row = document.getElementById('locationsRow');
  if (!row) return;
  row.innerHTML = '';
  var visibleLocations = sortedPickupLocations().filter(function(loc) {
    return window.isAdminMode || loc.active !== false;
  });
  if (!visibleLocations.length) {
    row.innerHTML = '<div style="min-width:260px;background:#fff;border-radius:10px;padding:18px;color:#777;border:1px dashed #ddd">No pickup locations configured.</div>';
    return;
  }
  for (var i = 0; i < visibleLocations.length; i++) {
    var loc = visibleLocations[i];
    var c = document.createElement('div');
    c.className = 'location-card' + (loc.active ? ' active' : '');
    var h = '';
    var locationImage = loc.photoUrl || LOCATION_FALLBACK_IMAGE;
    h += '<img src="' + escapeHtml(locationImage) + '" alt="' + escapeHtml(loc.name) + '"' + antiTheftImageAttrs() + ' style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:10px;background:#1a1a2e" onerror="this.src=\'' + LOCATION_FALLBACK_IMAGE + '\';this.onerror=null;">';
    h += '<div class="loc-name">' + (loc.active ? '<i class="fas fa-check-circle" style="color:#00cc66"></i> ' : '<i class="fas fa-map-pin" style="color:#ccc"></i> ') + escapeHtml(loc.name) + '</div>';
    h += '<div class="loc-address"><i class="fas fa-location-dot"></i> ' + escapeHtml(loc.address) + '</div>';
    if (loc.postcode) h += '<div class="loc-address"><i class="fas fa-envelope"></i> ' + escapeHtml(loc.postcode) + '</div>';
    h += '<div class="loc-day"><i class="fas fa-calendar"></i> ' + escapeHtml(loc.days || loc.day || 'Mon-Fri') + ' | ' + escapeHtml(loc.time || '') + '</div>';
    if (loc.note) h += '<div class="loc-day"><i class="fas fa-note-sticky"></i> ' + escapeHtml(loc.note) + '</div>';
    h += '<div class="loc-status ' + (loc.active ? 'here' : 'not') + '">' + (loc.active ? '<i class="fas fa-star"></i> We are here this week!' : '<i class="fas fa-minus-circle"></i> Not this week') + '</div>';
    h += '<div class="weather-wrap" id="weather-' + String(loc.id).replace(/[^a-zA-Z0-9_-]/g, '_') + '" style="width:100%;max-width:100%;box-sizing:border-box;margin-top:8px;color:#666;font-size:12px;overflow:hidden">Loading weekend weather...</div>';
    h += '<button onclick="markGoingToLocation(' + jsInlineArg(loc.id) + ')" style="width:100%;margin-top:8px;padding:8px;border:none;border-radius:5px;background:' + (loc.active ? '#00cc66' : '#eee') + ';color:' + (loc.active ? '#fff' : '#333') + ';cursor:pointer;font-size:12px;font-weight:bold">I am going here this weekend</button>';
    h += '<a class="map-link" href="' + escapeHtml(loc.mapLink || '#') + '" target="_blank"><i class="fas fa-map"></i> View on Map</a>';
    
    // Admin controls
    if (typeof window.isAdminMode !== 'undefined' && window.isAdminMode) {
      h += '<div style="display:flex;gap:5px;margin-top:8px">';
      h += '<button onclick="editLocation(' + jsInlineArg(loc.id) + ')" style="flex:1;padding:6px;background:#f39c12;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Edit</button>';
      h += '<button onclick="deleteLocationConfirm(' + jsInlineArg(loc.id) + ')" style="flex:1;padding:6px;background:#e94560;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Delete</button>';
      h += '</div>';
    }
    
    c.innerHTML = h;
    row.appendChild(c);
    updateLocationWeather(loc);
  }
  refreshRevealItems();
}

function sortedPickupLocations() {
  return (Array.isArray(locations) ? locations.slice() : []).sort(function(a, b) {
    var pinned = (b.pinned === true) - (a.pinned === true);
    if (pinned) return pinned;
    var order = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (order) return order;
    var usage = Number(b.useCount || b.goingCount || 0) - Number(a.useCount || a.goingCount || 0);
    if (usage) return usage;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function markGoingToLocation(id) {
  if (!window.FBDB || !window.FBDB.isAdmin || !window.FBDB.isAdmin()) {
    notify('Pickup locations are managed by admin only.', 'info');
    return;
  }
  var loc = locations.find(function(l) { return sameId(l.id, id); });
  if (!loc) return;
  loc.active = !loc.active;
  loc.goingThisWeekend = loc.active;
  if (window.FBDB && window.FBDB.saveLocation) {
    window.FBDB.saveLocation(loc).catch(function(error) {
      notify('Could not save pickup status: ' + (error.message || error), 'error');
    });
  }
  renderLocations();
  fillPickup();
}

function renderProducts(forceRender) {
  if (!forceRender && document.body.classList.contains('admin-dashboard-open')) return;
  var grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (window.AYLEN_PRODUCTION && !window.AYLEN_PRODUCTION.state.productsHydrated && !products.length) {
    showProductSkeletons();
    return;
  }
  if (window.AYLEN_CATALOG) {
    window.AYLEN_CATALOG.ensureToolbar();
    window.AYLEN_CATALOG.refreshCategories();
  }
  var catalogSlice = window.AYLEN_CATALOG
    ? window.AYLEN_CATALOG.getSlice()
    : { page: products, total: products.length, showing: products.length, hasMore: false };
  var visibleCount = 0;
  for (var i = 0; i < catalogSlice.page.length; i++) {
    var p = catalogSlice.page[i];
    visibleCount++;
    
    var activeIndex = (selectedProductImage[p.id] !== undefined ? selectedProductImage[p.id] : 0);
    if (!p.images) p.images = [];
    if (activeIndex < 0 || activeIndex >= p.images.length) activeIndex = 0;
    var card = document.createElement('div');
    card.className = 'product-card product-card-grid-item';
    card.id = 'product-card-' + safeDomId(p.id);
    card.setAttribute('data-product-id', productImageKey(p.id));
    card.setAttribute('onmouseenter', 'trackProductView(' + jsInlineArg(p.id) + ')');
    card.setAttribute('ontouchstart', 'trackProductView(' + jsInlineArg(p.id) + ')');
    
    // Get image URL with fallback
    var img = (p.images && p.images.length > 0 && p.images[activeIndex]) ? p.images[activeIndex] : null;
    // Use fallback if image is missing
    if (!img || img.trim() === '') {
      img = PRODUCT_FALLBACK_IMAGE;
    } else if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productCardImageUrl) {
      img = window.AYLEN_IMAGES.productCardImageUrl(img);
    }
    var lazyAttrs = window.AYLEN_IMAGES ? window.AYLEN_IMAGES.lazyImgAttrs() : ' loading="lazy" decoding="async"';
    
    var desc = p.description || p.desc || '';
    var isSaved = savedItems.indexOf(p.id) !== -1;
    var isComingSoon = p.status === 'coming_soon' || p.stockStatus === 'coming_soon' || p.badge === 'COMING SOON';
    
    var h = '<div class="product-card-media">';
    h += '<div class="product-image-container">';
    h += '<img data-main-product-image="' + escapeHtml(p.id) + '" src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.name) + '"' + lazyAttrs + antiTheftImageAttrs() + (isComingSoon ? ' style="filter:blur(3px)"' : '') + ' onerror="this.src=\'' + PRODUCT_FALLBACK_IMAGE + '\';this.onerror=null;" />';
    if (isComingSoon) {
      h += '<div class="product-coming-soon-overlay">COMING SOON<span>Reserve before release</span></div>';
    }
    h += '<div class="product-image-overlay">';
    var autoBadge = isComingSoon ? 'COMING SOON' : productAutoBadge(p);
    if (autoBadge) {
      var badgeColor = '#e94560';
      if (autoBadge === 'NEW' || autoBadge === 'THIS WEEK') badgeColor = '#00cc66';
      else if (autoBadge === 'SALE') badgeColor = '#ff9800';
      else if (autoBadge === 'HOT') badgeColor = '#ff6b6b';
      h += '<span class="product-card-badge" style="background:' + badgeColor + '">' + escapeHtml(autoBadge) + '</span>';
    } else {
      h += '<span></span>';
    }
    h += '<div class="product-image-actions">';
    if (window.isAdminMode && p.active === false) {
      h += '<span class="product-card-badge" style="background:#64748b">HIDDEN</span>';
    }
    h += '<div class="product-badge' + (isSaved ? ' saved' : '') + '" onclick="toggleSaveProduct(' + jsInlineArg(p.id) + ')" title="Save">' + (isSaved ? '★' : '☆') + '</div>';
    h += '</div></div>';
    if (p.images && p.images.length > 1) {
      h += '<button type="button" class="product-arrow left" data-carousel-prev="1" aria-label="Previous photo" onclick="prevImage(' + jsInlineArg(p.id) + ', event); return false;"><i class="fas fa-chevron-left"></i></button>';
      h += '<button type="button" class="product-arrow right" data-carousel-next="1" aria-label="Next photo" onclick="nextImage(' + jsInlineArg(p.id) + ', event); return false;"><i class="fas fa-chevron-right"></i></button>';
    }
    h += '</div>';
    if (p.images && p.images.length > 1) {
      h += '<div class="product-thumbnails">';
      var maxThumbs = 4;
      var visibleThumbs = Math.min(p.images.length, maxThumbs);
      for (var j = 0; j < visibleThumbs; j++) {
        var activeClass = (j === activeIndex) ? ' active' : '';
        var thumbSrc = (p.images[j] && p.images[j].trim() !== '') ? p.images[j] : THUMB_FALLBACK_IMAGE;
        h += '<img src="' + escapeHtml(thumbSrc) + '" class="product-thumb' + activeClass + '" data-product-thumb="' + escapeHtml(p.id) + '" data-thumb-index="' + j + '" onclick="selectProductImage(' + jsInlineArg(p.id) + ',' + j + ', event); return false;"' + antiTheftImageAttrs() + ' onerror="this.src=\'' + THUMB_FALLBACK_IMAGE + '\';this.onerror=null;" alt="Photo ' + (j + 1) + '">';
      }
      if (p.images.length > maxThumbs) {
        h += '<div class="product-thumb more" onclick="selectProductImage(' + jsInlineArg(p.id) + ',' + maxThumbs + ')">+' + (p.images.length - maxThumbs) + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '<div class="product-card-body product-info">';
    h += '<h3 class="product-title">' + escapeHtml(p.name) + '</h3>';
    h += '<div class="product-desc-block">' + renderProductDescriptionBlock(p.id, desc) + '</div>';
    var policy = (window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.getById)
      ? window.AYLEN_LISTING_POLICIES.getById(p.policyId || p.listingPolicyId)
      : (typeof getListingPolicyById === 'function' ? getListingPolicyById(p.policyId || p.listingPolicyId) : null);
    if (policy && window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.renderSummary) {
      h += '<div class="product-policy-compact">' + window.AYLEN_LISTING_POLICIES.renderSummary(policy) + '</div>';
    }
    h += '<div class="product-card-pricing">';
    
    // Price logic with discount support
    var retailPrice = parseFloat(p.price || p.retail || 0);
    var wholesalePrice = parseFloat(p.wholesale || 0);
    var hasDiscount = p.discount && p.discount > 0;
    var salePrice = hasDiscount ? parseFloat(p.salePrice || retailPrice) : retailPrice;
    var displayPrice = (priceMode === 'wholesale') ? wholesalePrice : salePrice;
    
    if (currentUser && currentUser.discount > 0) {
      var dp = (displayPrice * (1 - currentUser.discount / 100)).toFixed(2);
      h += '<div class="product-prices">';
      if (hasDiscount) {
        h += '<span class="price-original">£' + retailPrice.toFixed(2) + '</span>';
        h += '<span class="price-sale">£' + salePrice.toFixed(2) + '</span>';
        h += '<span class="price-secondary">Your price £' + dp + '</span>';
      } else {
        h += '<span class="price-main">£' + displayPrice.toFixed(2) + '</span>';
        h += '<span class="price-secondary">Your price £' + dp + '</span>';
      }
      h += '</div>';
    } else {
      h += '<div class="product-prices">';
      if (hasDiscount) {
        h += '<span class="price-original">£' + retailPrice.toFixed(2) + '</span>';
        h += '<span class="price-sale">£' + salePrice.toFixed(2) + '</span>';
        h += '<span class="price-badge-discount">-' + p.discount + '%</span>';
      } else if (priceMode === 'wholesale' && wholesalePrice > 0) {
        h += '<span class="price-main">£' + wholesalePrice.toFixed(2) + '</span>';
        if (retailPrice > 0) h += '<span class="price-secondary">Retail £' + retailPrice.toFixed(2) + '</span>';
      } else {
        h += '<span class="price-main">£' + retailPrice.toFixed(2) + '</span>';
        if (wholesalePrice > 0 && priceMode === 'retail') h += '<span class="price-secondary">Wholesale £' + wholesalePrice.toFixed(2) + '</span>';
      }
      h += '</div>';
    }
    
    var liveStockLabel = stockLabel(p);
    h += '<div class="product-stock-row">';
    h += '<span class="stock-info">Stock: ' + (parseInt(p.stock) || 0) + '</span>';
    h += '<span id="viewers-' + safeDomId(p.id) + '" class="product-chip product-chip-viewers live-product-viewers" style="display:none"></span>';
    if (liveStockLabel) {
      h += '<span class="product-chip product-chip-stock"><i class="fas fa-fire"></i> ' + escapeHtml(liveStockLabel) + '</span>';
    }
    h += '</div>';
    if (window.isAdminMode && p.sku) {
      h += '<p class="product-sku-admin">SKU: ' + escapeHtml(p.sku) + '</p>';
    }
    h += '</div></div>';
    h += '<div class="product-card-footer">';
    h += '<div class="product-card-actions action-buttons">';
    if (isComingSoon) {
      h += '<button type="button" class="btn-action secondary" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'email\')"><i class="fas fa-bell"></i> Reserve</button>';
    } else if (parseInt(p.stock) === 0) {
      h += '<div class="out-of-stock">Out of stock</div>';
    } else {
      h += '<button type="button" class="btn-action primary" onclick="addToCart(' + jsInlineArg(p.id) + ')"><i class="fas fa-cart-plus"></i> Add to Cart</button>';
    }
    h += '</div>';
    if (parseInt(p.stock) === 0 && !isComingSoon) {
      h += '<p class="product-notify-compact">Notify when back in stock:</p>';
      h += '<div class="notify-line">';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'email\')">Email</button>';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'telegram\')">Telegram</button>';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'whatsapp\')">WhatsApp</button>';
      h += '</div>';
    }
    if (typeof window.isAdminMode !== 'undefined' && window.isAdminMode) {
      h += '<div class="product-card-admin">';
      h += '<button type="button" onclick="editProduct(' + jsInlineArg(p.id) + ')" style="background:#3498db;color:#fff">Edit</button>';
      h += '<button type="button" onclick="deleteProductConfirm(' + jsInlineArg(p.id) + ')" style="background:#e94560;color:#fff">Delete</button>';
      h += '</div>';
    }
    h += '</div>';
    
    card.innerHTML = h;
    grid.appendChild(card);
  }
  if (visibleCount === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;background:#fff;border-radius:12px;padding:32px;color:#777;border:1px dashed #ddd">' +
      '<h3 style="color:#1a1a2e;margin-bottom:8px">No products available</h3>' +
      '<p>Products will appear here when they are added in Firestore.</p>' +
    '</div>';
  }
  if (window.AYLEN_CATALOG) window.AYLEN_CATALOG.renderFooter(catalogSlice);
  renderNewArrivals();
  renderEngagementStats();
  refreshRevealItems();
  if (productsRevealInitialized) {
    grid.querySelectorAll('.product-card.reveal-item').forEach(function(card) {
      card.classList.add('is-visible');
    });
  } else {
    productsRevealInitialized = true;
  }
  if (window.AYLEN_SEO && window.AYLEN_SEO.refreshProductSchema) {
    window.AYLEN_SEO.refreshProductSchema(products);
  }
}

function activePriceListProducts() {
  return (Array.isArray(priceListItems) ? priceListItems.slice() : []).filter(function(item) {
    return item && item.visible !== false;
  }).sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function priceListProductHtml(p) {
  var img = (p.images && p.images.length > 0 && p.images[0]) ? p.images[0] : (p.photoUrl || PRODUCT_FALLBACK_IMAGE);
  var retailPrice = Number(p.retailPrice || p.retail || p.price || 0);
  var wholesalePrice = Number(p.wholesalePrice || p.wholesale || 0);
  var minQty = Number(p.minQty || 1);
  var stockStatus = p.stockStatus || 'available';
  return '<div class="pl-card">' +
    '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.name) + '">' +
    '<div class="pl-info">' +
      '<h3>' + escapeHtml(p.name || 'Product') + '</h3>' +
      '<p>' + escapeHtml(p.desc || p.description || '') + '</p>' +
      '<div class="pl-prices">' +
        '<b>Retail: £' + retailPrice.toFixed(2) + '</b>' +
        (wholesalePrice > 0 ? '<span>Wholesale: £' + wholesalePrice.toFixed(2) + '</span>' : '') +
        '<span>Min qty: ' + minQty + '</span>' +
        '<span>Status: ' + escapeHtml(stockStatus) + '</span>' +
        (p.note ? '<span>Note: ' + escapeHtml(p.note) + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

function buildPriceListHtml() {
  var list = activePriceListProducts();
  var generatedAt = new Date().toLocaleString('en-GB');
  var cards = list.map(priceListProductHtml).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<title>AYLENSALE Price List</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;background:#f4f6f8;color:#1a1a2e;margin:0;padding:20px}' +
      '.pl-header{background:linear-gradient(135deg,#e94560,#1a1a2e);color:#fff;border-radius:14px;padding:22px;margin-bottom:18px;text-align:center}' +
      '.pl-header h1{margin:0 0 6px;font-size:28px;letter-spacing:1px}.pl-header p{margin:0;opacity:.9}' +
      '.pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}' +
      '.pl-card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08);break-inside:avoid}' +
      '.pl-card img{width:100%;height:190px;object-fit:cover;background:#1a1a2e}' +
      '.pl-info{padding:12px}.pl-info h3{margin:0 0 6px;font-size:16px}.pl-info p{margin:0 0 10px;color:#666;font-size:13px;min-height:34px}' +
      '.pl-prices{display:flex;flex-direction:column;gap:4px;color:#333;font-size:13px}.pl-prices b{color:#e94560;font-size:17px}.pl-old{text-decoration:line-through;color:#999}' +
      '.pl-footer{text-align:center;color:#777;font-size:12px;margin-top:20px}' +
      '@media print{body{background:#fff;padding:10px}.pl-card{box-shadow:none;border:1px solid #ddd}.pl-header{border-radius:0}}' +
    '</style></head><body>' +
    '<div class="pl-header"><h1>AYLENSALE Price List</h1><p>Products with photos and latest prices</p><p>Generated: ' + escapeHtml(generatedAt) + '</p></div>' +
    '<div class="pl-grid">' + cards + '</div>' +
    '<div class="pl-footer">AYLENSALE | Save this file or print to PDF</div>' +
  '</body></html>';
}

function openPriceList() {
  var list = activePriceListProducts();
  if (!list.length) {
    notify('Price list is empty. Add items in Price List Admin.', 'error');
    return;
  }
  var modalId = 'priceListModal_' + Date.now();
  var preview = list.slice(0, 12).map(function(p) {
    var img = (p.images && p.images.length > 0 && p.images[0]) ? p.images[0] : PRODUCT_FALLBACK_IMAGE;
    var price = Number(p.retailPrice || p.retail || p.price || 0);
    return '<div style="display:flex;gap:10px;align-items:center;padding:8px;border:1px solid #eee;border-radius:8px;background:#fff">' +
      '<img src="' + escapeHtml(img) + '" style="width:58px;height:58px;object-fit:cover;border-radius:6px;background:#1a1a2e">' +
      '<div style="flex:1"><b>' + escapeHtml(p.name || 'Product') + '</b><div style="color:#e94560;font-weight:bold">£' + price.toFixed(2) + '</div></div>' +
    '</div>';
  }).join('');

  var html = '<div id="' + modalId + '" class="modal" style="display:flex">' +
    '<div class="modal-content" style="max-width:720px">' +
      '<span class="close" onclick="AYLEN_MODAL.close()">&times;</span>' +
      '<h2><i class="fas fa-file-arrow-down"></i> AYLENSALE Price List</h2>' +
      '<p style="color:#666;margin-bottom:14px">Download a price list with product photos, or print it and save as PDF.</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;max-height:430px;overflow:auto;margin-bottom:14px">' + preview + '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn-order" style="flex:1;min-width:190px" onclick="downloadPriceList()"><i class="fas fa-download"></i> Download HTML</button>' +
        '<button class="btn-order" style="flex:1;min-width:190px;background:#1a1a2e" onclick="printPriceList()"><i class="fas fa-print"></i> Print / Save PDF</button>' +
        '<button class="btn-order" style="flex:1;min-width:190px;background:#3498db" onclick="downloadPriceListCsv()"><i class="fas fa-file-csv"></i> Download CSV</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
}

function downloadPriceList() {
  var blob = new Blob([buildPriceListHtml()], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'aylensale-price-list.html';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  notify('Price list downloaded', 'success');
}

function printPriceList() {
  var win = window.open('', '_blank');
  if (!win) {
    notify('Allow popups to print price list', 'error');
    return;
  }
  win.document.open();
  win.document.write(buildPriceListHtml());
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 500);
}

function downloadPriceListCsv() {
  var rows = [['name', 'description', 'retail price', 'wholesale price', 'minimum quantity', 'stock/status', 'note', 'photo']];
  activePriceListProducts().forEach(function(item) {
    rows.push([
      item.name || '',
      item.desc || '',
      Number(item.retailPrice || 0).toFixed(2),
      Number(item.wholesalePrice || 0).toFixed(2),
      String(item.minQty || 1),
      item.stockStatus || '',
      item.note || '',
      item.photoUrl || (item.images && item.images[0]) || ''
    ]);
  });
  var csv = rows.map(function(row) {
    return row.map(function(value) {
      return '"' + String(value || '').replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'aylensale-price-list.csv';
  link.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  notify('Price list CSV downloaded', 'success');
}

function selectProductImage(productId, index) {
  var p = products.find(function(item) { return sameId(item.id, productId); });
  if (!p || !p.images || !p.images.length) return;
  var safeIndex = Math.max(0, Math.min(Number(index) || 0, p.images.length - 1));
  selectedProductImage[p.id] = safeIndex;
  updateProductCardImage(p.id, safeIndex);
}

function prevImage(productId) {
  var p = products.find(function(item) { return sameId(item.id, productId); });
  if (!p || !p.images || p.images.length <= 1) return;
  var current = selectedProductImage[p.id] || 0;
  var newIndex = current > 0 ? current - 1 : p.images.length - 1;
  selectedProductImage[p.id] = newIndex;
  updateProductCardImage(p.id, newIndex);
}

function nextImage(productId) {
  var p = products.find(function(item) { return sameId(item.id, productId); });
  if (!p || !p.images || p.images.length <= 1) return;
  var current = selectedProductImage[p.id] || 0;
  var newIndex = current < p.images.length - 1 ? current + 1 : 0;
  selectedProductImage[p.id] = newIndex;
  updateProductCardImage(p.id, newIndex);
}

function updateProductCardImage(productId, index) {
  var p = products.find(function(item) { return sameId(item.id, productId); });
  if (!p || !Array.isArray(p.images) || !p.images.length) return;
  var src = p.images[index] || PRODUCT_FALLBACK_IMAGE;
  var card = document.getElementById('product-card-' + safeDomId(productId));
  if (!card) return;
  var img = card.querySelector('[data-main-product-image]');
  if (img) {
    img.style.opacity = '0.35';
    window.setTimeout(function() {
      img.src = src;
      img.alt = p.name || 'Product image';
      img.style.opacity = '1';
    }, 70);
  }
  var thumbs = card.querySelectorAll('[data-product-thumb]');
  thumbs.forEach(function(thumb) {
    var thumbIndex = Number(thumb.getAttribute('data-thumb-index') || 0);
    thumb.classList.toggle('active', thumbIndex === index);
  });
}

function toggleSaveProduct(productId) {
  var idx = savedItems.indexOf(productId);
  if (idx === -1) {
    savedItems.push(productId);
    notify('Product saved!', 'success');
  } else {
    savedItems.splice(idx, 1);
    notify('Product removed from saved', 'success');
  }
  localStorage.setItem('aylensaved', JSON.stringify(savedItems));
  saveWishlistToFirebase();
  renderProducts();
}

function saveWishlistToFirebase() {
  if (!window.FBDB || !window.FBDB.saveWishlist) return;
  window.FBDB.saveWishlist(engagementSessionId, {
    productIds: savedItems.map(function(id) { return String(id); }).slice(0, 80),
    card: currentUser && currentUser.card ? currentUser.card : '',
    updatedAt: new Date().toISOString()
  }).catch(function(error) {
    console.warn('Wishlist save failed:', error.message || error);
  });
}

function showPrices(mode, btn) {
  priceMode = mode;
  var buttons = document.querySelectorAll('.tbtn');
  buttons.forEach(function(b) {
    b.classList.toggle('active', b === btn);
  });
  renderProducts();
}

async function requestNotify(productId, method) {
  var p = typeof getProductById === 'function' ? getProductById(productId) : productById(productId);
  if (!p) return;
  var label = method === 'email' ? 'email address' : (method === 'telegram' ? 'Telegram chat_id or @username' : 'WhatsApp phone number');
  var promptLabel = 'Enter your ' + label + ' for "' + p.name + '"';
  var contact = prompt(promptLabel + ':');
  contact = String(contact || '').trim();
  if (!contact) return;
  if (method === 'email' && contact.indexOf('@') === -1) {
    notify('Please enter a valid email', 'error');
    return;
  }
  if (method === 'whatsapp' && contact.replace(/\D/g, '').length < 8) {
    notify('Please enter a valid WhatsApp phone number', 'error');
    return;
  }
  if (method === 'telegram' && contact.charAt(0) !== '@' && !/^-?\d{6,}$/.test(contact.replace(/\s/g, ''))) {
    notify('Telegram needs a numeric chat_id, or enter @username for manual admin follow-up.', 'error');
    return;
  }
  try {
    await addNotifyRequest(productId, method, contact);
    notify('Notify request saved (' + method + ')', 'success');
  } catch (error) {
    notify('Notify request failed: ' + (error.message || error), 'error');
  }
}

function fillPickup() {
  var sel = document.getElementById('custPickup');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select Pickup Point --</option>';
  var pickupLocations = sortedPickupLocations();
  for (var i = 0; i < pickupLocations.length; i++) {
    if (pickupLocations[i].active) {
      var opt = document.createElement('option');
      opt.value = pickupLocations[i].name + ' - ' + pickupLocations[i].address;
      opt.textContent = '✅ ' + pickupLocations[i].name + ' (' + pickupLocations[i].day + ')';
      sel.appendChild(opt);
    }
  }
  var od = document.createElement('option');
  od.value = 'Delivery';
  od.textContent = '🚚 Delivery';
  sel.appendChild(od);
}

function addToCart(id) {
  var p = productById(id);
  if (!p) return;
  var basePrice = Number(getProductBasePrice(p).toFixed(2));
  var price = getCartUnitPrice({ id: p.id, basePrice: basePrice, price: basePrice });
  var item = null;
  for (var i = 0; i < cart.length; i++) {
    if (sameId(cart[i].id, id)) { item = cart[i]; break; }
  }
  if (item) {
    item.qty = (parseInt(item.qty, 10) || 0) + 1;
    item.name = p.name;
    item.basePrice = basePrice;
    item.price = price;
  } else {
    cart.push({id: p.id, name: p.name, basePrice: basePrice, price: price, qty: 1});
  }
  recalculateCartPrices();
  updateCartCount();
  renderCart();
  writePresence(true);
  notify(p.name + ' added!', 'success');
}

function removeFromCart(id) {
  cart = cart.filter(function(item) { return !sameId(item.id, id); });
  saveCart();
  updateCartCount();
  renderCart();
  writePresence(true);
}

function changeQty(id, d) {
  var changed = false;
  for (var i = 0; i < cart.length; i++) {
    if (sameId(cart[i].id, id)) {
      cart[i].qty = (parseInt(cart[i].qty, 10) || 0) + d;
      if (cart[i].qty <= 0) { removeFromCart(id); return; }
      changed = true;
      break;
    }
  }
  if (!changed) return;
  recalculateCartPrices();
  updateCartCount();
  renderCart();
  writePresence(true);
}

function updateCartCount() {
  var c = 0;
  for (var i = 0; i < cart.length; i++) c += cart[i].qty;
  var el = document.getElementById('cartCount');
  if (el) el.textContent = c;
}

function getTotal() {
  recalculateCartPrices();
  var t = 0;
  for (var i = 0; i < cart.length; i++) t += cart[i].price * cart[i].qty;
  return t.toFixed(2);
}

function renderCart() {
  var div = document.getElementById('cartItems');
  if (!div) return;
  if (cart.length === 0) {
    div.innerHTML = '<p style="text-align:center;color:#999;padding:30px">Cart is empty</p>';
    document.getElementById('cartTotal').textContent = '£0.00';
    return;
  }
  var h = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var unitPrice = getCartUnitPrice(item);
    item.price = unitPrice;
    h += '<div class="cart-item">' +
      '<div class="cart-item-info"><h4>' + escapeHtml(item.name) + '</h4><span class="cart-item-price">£' + unitPrice.toFixed(2) + ' each</span></div>' +
      '<div class="cart-item-qty">' +
        '<button type="button" aria-label="Decrease quantity" ontouchend="event.preventDefault();changeQty(' + jsInlineArg(item.id) + ',-1)" onclick="changeQty(' + jsInlineArg(item.id) + ',-1)">-</button>' +
        '<span id="cartQty_' + String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_') + '">' + item.qty + '</span>' +
        '<button type="button" aria-label="Increase quantity" ontouchend="event.preventDefault();changeQty(' + jsInlineArg(item.id) + ',1)" onclick="changeQty(' + jsInlineArg(item.id) + ',1)">+</button>' +
      '</div>' +
      '<div style="font-weight:800;color:#1a1a2e;min-width:70px;text-align:right">£' + (unitPrice * item.qty).toFixed(2) + '</div>' +
    '</div>';
  }
  div.innerHTML = h;
  saveCart();
  document.getElementById('cartTotal').textContent = '£' + getTotal();
}

function openCart() {
  renderCart();
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.openStatic('cartModal');
  else document.getElementById('cartModal').classList.add('open');
}
function closeCart() {
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.closeStatic('cartModal');
  else document.getElementById('cartModal').classList.remove('open');
}
function openCheckout() {
  var started = document.getElementById('orderFormStartedAt');
  if (started) started.value = String(Date.now());
  if (window.AYLEN_MODAL) {
    window.AYLEN_MODAL.closeStatic('cartModal');
    window.AYLEN_MODAL.openStatic('checkoutModal');
  } else {
    closeCart();
    document.getElementById('checkoutModal').classList.add('open');
  }
}
function closeCheckout() {
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.closeStatic('checkoutModal');
  else document.getElementById('checkoutModal').classList.remove('open');
}

function sendOrder(e) {
  e.preventDefault();
  
  // Check if cart is empty
  if (cart.length === 0) { 
    notify('Cart is empty!', 'error'); 
    return; 
  }
  
  // Get form values
  var name = document.getElementById('custName').value;
  var phone = document.getElementById('custPhone').value;
  var pickup = document.getElementById('custPickup').value;
  var comment = document.getElementById('custComment').value;
  var orderWebsiteEl = document.getElementById('orderWebsite');
  var orderStartedEl = document.getElementById('orderFormStartedAt');
  var honeypot = orderWebsiteEl ? orderWebsiteEl.value : '';
  var startedAt = orderStartedEl ? orderStartedEl.value : 0;
  
  // Validate form inputs
  var validation = SECURITY.validateOrderForm(name, phone, pickup, comment);
  if (!validation.valid) {
    notify('Validation error: ' + validation.error, 'error');
    return;
  }
  var honeypotValidation = SECURITY.validateHoneypot(honeypot);
  if (!honeypotValidation.valid) {
    notify(honeypotValidation.error, 'error');
    return;
  }
  var timingValidation = SECURITY.validateMinimumSubmitTime(startedAt, 1200);
  if (!timingValidation.valid) {
    notify(timingValidation.error, 'error');
    return;
  }
  
  // Check rate limit
  var rateLimit = SECURITY.checkOrderRateLimit();
  if (!rateLimit.allowed) {
    notify(rateLimit.reason, 'error');
    return;
  }
  
  var total = getTotal();
  
  var orderData = {
    name: name,
    phone: phone,
    pickup: pickup,
    comment: comment,
    items: cart,
    total: total,
    card: currentUser ? currentUser.card : null,
    discount: currentUser ? currentUser.discount : null,
    security: SECURITY.submissionMeta(startedAt, honeypot)
  };
  
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/send-order', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  
  xhr.onload = function() {
    try {
      var data = JSON.parse(xhr.responseText);
      if (data.success) {
        var firstItemName = cart[0] && cart[0].name ? cart[0].name : 'AYLENSALE item';
        saveLiveActivity('Someone ordered ' + firstItemName, 'order', cart[0] && cart[0].id ? cart[0].id : '');
        if (window.FBDB && window.FBDB.saveOrder) {
          window.FBDB.saveOrder(Object.assign({}, orderData, {
            telegramMessageId: data.messageId || null
          })).catch(function(error) {
            console.error('Order Firestore save failed:', error);
          });
        }
        notify('Order sent successfully!', 'success');
        cart = [];
        localStorage.setItem('aylencart', JSON.stringify(cart));
        updateCartCount();
        writePresence(true);
        closeCheckout();
        document.getElementById('orderForm').reset();
      } else {
        notify('Error: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      notify('Server error: ' + e.message, 'error');
    }
  };
  
  xhr.onerror = function() { 
    notify('Network error - check connection and try again', 'error'); 
  };
  
  xhr.send(JSON.stringify(orderData));
}

function notify(msg, type) {
  var el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg;
  el.className = 'notification ' + type;
  setTimeout(function() { el.className = 'notification'; }, 3000);
}

// ===== AUCTIONS FUNCTIONS =====
function auctionStatusLabel(auction) {
  var status = getAuctionStatus(auction);
  if (status === 'completed') return 'COMPLETED';
  if (status === 'order_sent') return 'ORDER SENT';
  if (status === 'winner_pending') return 'WINNER PENDING';
  if (status === 'ended') return 'ENDED';
  var timeLeft = new Date(auction.endTime) - new Date();
  return timeLeft < 3600000 ? 'ENDING SOON' : 'ACTIVE';
}

function auctionStatusColor(label) {
  if (label === 'ACTIVE') return '#00cc66';
  if (label === 'ENDING SOON') return '#f39c12';
  if (label === 'ENDED') return '#555';
  if (label === 'WINNER PENDING') return '#3498db';
  if (label === 'ORDER SENT') return '#8e44ad';
  if (label === 'COMPLETED') return '#00a36c';
  return '#e94560';
}

function maskPhone(phone) {
  var value = String(phone || '');
  if (value.length <= 4) return value;
  return value.slice(0, 3) + '***' + value.slice(-3);
}

function highestAuctionBid(auction) {
  var bids = auctionBids[String(auction.id)] || auction.bids || [];
  if (!bids.length) return null;
  if (typeof getHighestBid === 'function') return getHighestBid(auction);
  return bids.reduce(function(best, bid) {
    return Number(bid.amount || 0) > Number(best.amount || 0) ? bid : best;
  }, bids[0]);
}

function auctionParticipantStats(auction) {
  var bids = auctionBids[String(auction.id)] || auction.bids || [];
  var map = {};
  bids.forEach(function(b) {
    var key = String(b.bidderPhone || b.bidderName || b.bidder || 'anonymous');
    if (!map[key]) map[key] = { name: b.bidderName || b.bidder || 'Anonymous', count: 0 };
    map[key].count++;
  });
  var list = [];
  Object.keys(map).forEach(function(k) { list.push(map[k]); });
  return { totalBids: bids.length, participants: list.length, list: list };
}

function formatAuctionBidTime(timestamp) {
  if (!timestamp) return '—';
  try { return new Date(timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }); }
  catch (e) { return String(timestamp); }
}

function toggleProductDesc(btn) {
  var box = btn && btn.previousElementSibling;
  if (!box) return;
  var expanded = box.classList.toggle('is-expanded');
  btn.textContent = expanded ? 'Show less' : 'Read more';
}

function renderProductDescriptionBlock(productId, desc) {
  var text = String(desc || '').trim();
  if (!text) return '';
  var safeId = 'product-desc-' + safeDomId(productId);
  var longText = text.length > 140 || text.split('\n').length > 3;
  var html = '<p class="desc product-desc-clamp" id="' + safeId + '">' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
  if (longText) {
    html += '<button type="button" class="desc-toggle-btn" onclick="toggleProductDesc(this)">Read more</button>';
  }
  return html;
}

function renderAuctions() {
  var grid = document.getElementById('auctionsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!auctions.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;background:#fff;border-radius:12px;padding:32px;color:#777;border:1px dashed #ddd">' +
      '<h3 style="color:#1a1a2e;margin-bottom:8px">No active auctions</h3>' +
      '<p>Auctions will appear here when they are added in Firestore.</p>' +
    '</div>';
    return;
  }
  
  for (var i = 0; i < auctions.length; i++) {
    var a = auctions[i];
    var card = document.createElement('div');
    card.className = 'auction-card';
    card.id = 'auction-' + a.id;
    
    var endTime = new Date(a.endTime);
    var now = new Date();
    var timeLeft = endTime - now;
    var isEnding = timeLeft < 3600000; // Less than 1 hour
    var isEnded = timeLeft <= 0 || getAuctionStatus(a) !== 'active';
    var statusLabel = auctionStatusLabel(a);
    
    var highestBid = highestAuctionBid(a);
    var bidStats = auctionParticipantStats(a);
    var h = '<div class="auction-header">';
    h += '<span><i class="fas fa-fire"></i> ' + (isEnded ? 'AUCTION' : 'LIVE AUCTION') + '</span>';
    h += '<span class="auction-badge">' + (a.bidsCount || bidStats.totalBids || 0) + ' bids · ' + bidStats.participants + ' users</span>';
    h += '</div>';
    
    h += '<div class="auction-image">';
    var img = (a.images && a.images.length > 0) ? a.images[0] : AUCTION_FALLBACK_IMAGE;
    h += '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(a.name) + '"' + antiTheftImageAttrs() + ' onerror="this.src=\'' + AUCTION_FALLBACK_IMAGE + '\';this.onerror=null;">';
    h += '<div class="auction-status" style="background:' + auctionStatusColor(statusLabel) + '">' + statusLabel + '</div>';
    h += '</div>';
    
    h += '<div class="auction-info">';
    h += '<div class="auction-title">' + a.name + '</div>';
    h += '<div class="auction-desc">' + (a.desc || '') + '</div>';
    
    h += '<div class="auction-price-section">';
    h += '<div class="auction-price-label">Current Price</div>';
    h += '<div class="auction-current-price">£' + Number(a.currentPrice || 0).toFixed(2) + '</div>';
    h += '<div class="auction-bids">Starting from: £' + Number(a.startingPrice || 0).toFixed(2) + '</div>';
    if (highestBid) {
      h += '<div style="margin-top:7px;background:#fff;border:1px solid #e9eef5;border-radius:7px;padding:7px;color:#1a1a2e;font-size:12px"><i class="fas fa-crown" style="color:#f5af02"></i> Highest bidder: <b>' + escapeHtml(highestBid.bidderName || highestBid.bidder || 'Customer') + '</b></div>';
    }
    h += '</div>';
    
    // Timer
    if (!isEnded) {
      h += '<div class="auction-timer ' + (isEnding ? 'ending' : '') + '">';
      h += '<div class="timer-label"><i class="fas fa-hourglass-end"></i> Auction ends in</div>';
      h += '<div class="timer-display" id="timer-' + a.id + '">' + formatTimeLeft(timeLeft) + '</div>';
      h += '</div>';
    } else {
      h += '<div class="auction-timer ending">';
      h += '<div class="timer-label"><i class="fas fa-check-circle"></i> Auction Ended</div>';
      h += '</div>';
    }
    
    // Bid section
    if (getAuctionStatus(a) === 'active') {
      h += '<div class="bid-input-section">';
      h += '<input type="number" id="bid-amount-' + a.id + '" placeholder="Enter bid amount" min="' + (Number(a.currentPrice || 0) + 1).toFixed(2) + '" step="0.01">';
      h += '<button onclick="openBidModal(' + jsInlineArg(a.id) + ')"><i class="fas fa-gavel"></i> Bid</button>';
      h += '</div>';
    }
    
    var bids = (auctionBids[String(a.id)] || a.bids || []).slice().sort(function(x, y) {
      return new Date(y.timestamp || 0) - new Date(x.timestamp || 0);
    });
    if (bids.length > 0) {
      h += '<div class="bid-history">';
      h += '<strong>Latest bid:</strong> £' + Number(bids[0].amount || 0).toFixed(2) + ' by ' + escapeHtml(bids[0].bidderName || bids[0].bidder || 'Customer') +
        ' <span style="color:#888">(' + formatAuctionBidTime(bids[0].timestamp) + ')</span>';
      h += '</div>';
      h += '<div class="bid-history-list">';
      bids.slice(0, 5).forEach(function(b) {
        h += '<div class="bid-history-row"><span>' + escapeHtml(b.bidderName || b.bidder || 'Customer') + '</span>' +
          '<span>£' + Number(b.amount || 0).toFixed(2) + '</span>' +
          '<span>' + formatAuctionBidTime(b.timestamp) + '</span></div>';
      });
      if (bids.length > 5) h += '<div style="font-size:11px;color:#888;margin-top:4px">+' + (bids.length - 5) + ' older bids</div>';
      h += '</div>';
    }

    if (a.winner) {
      h += '<div class="bid-history" style="background:#f8fafc;border-radius:6px;padding:8px;border-top:none">';
      h += '<strong>Winner:</strong> ' + escapeHtml(a.winner.bidderName || 'Unknown') + ' / ' + escapeHtml(maskPhone(a.winner.bidderPhone || ''));
      h += '<br><strong>Final price:</strong> £' + Number(a.winner.amount || a.currentPrice || 0).toFixed(2);
      h += '</div>';
    }

    if (getAuctionStatus(a) === 'winner_pending' && !a.winnerOrder) {
      h += '<button onclick="openWinnerClaimModal(' + jsInlineArg(a.id) + ')" style="width:100%;padding:10px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:bold;margin-top:8px"><i class="fas fa-trophy"></i> Claim winning order</button>';
    }

    if (a.winnerOrder) {
      h += '<div class="bid-history" style="color:#00a36c"><strong>Winner order:</strong> ' + escapeHtml(a.winnerOrder.method || 'Pickup') + ' sent to admin</div>';
    }
    
    // Admin controls
    if (typeof window.isAdminMode !== 'undefined' && window.isAdminMode) {
      h += '<div style="display:flex;gap:5px;margin-top:8px">';
      h += '<button onclick="editAuction(' + jsInlineArg(a.id) + ')" style="flex:1;padding:6px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Edit</button>';
      h += '<button onclick="deleteAuctionConfirm(' + jsInlineArg(a.id) + ')" style="flex:1;padding:6px;background:#e94560;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Delete</button>';
      h += '</div>';
      h += '<div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap">';
      h += '<button onclick="adminFinalizeAuction(' + jsInlineArg(a.id) + ')" style="flex:1;min-width:90px;padding:6px;background:#f39c12;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Finalize</button>';
      if (a.winner) {
        h += '<button onclick="adminSendAuctionWinner(' + jsInlineArg(a.id) + ')" style="flex:1;min-width:90px;padding:6px;background:#8e44ad;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Send Winner</button>';
      }
      h += '<button onclick="adminMarkAuctionCompleted(' + jsInlineArg(a.id) + ')" style="flex:1;min-width:90px;padding:6px;background:#00a36c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Completed</button>';
      h += '<button onclick="adminReopenAuction(' + jsInlineArg(a.id) + ')" style="flex:1;min-width:90px;padding:6px;background:#555;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Reopen</button>';
      h += '</div>';
      h += '<button onclick="openAuctionBidHistoryModal(' + jsInlineArg(a.id) + ')" style="width:100%;margin-top:6px;padding:8px;background:#1a1a2e;color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold"><i class="fas fa-list"></i> Full bid history (' + bidStats.totalBids + ')</button>';
    }
    
    h += '</div>';
    card.innerHTML = h;
    grid.appendChild(card);
  }
  
  // Start timers
  startAuctionTimers();
  renderEngagementStats();
  refreshRevealItems();
}

function formatTimeLeft(ms) {
  if (ms <= 0) return '00:00:00';
  var hours = Math.floor(ms / 3600000);
  var mins = Math.floor((ms % 3600000) / 60000);
  var secs = Math.floor((ms % 60000) / 1000);
  return (hours < 10 ? '0' : '') + hours + ':' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function startAuctionTimers() {
  // Clear any existing interval
  if (window.auctionTimerInterval) clearInterval(window.auctionTimerInterval);
  
  window.auctionTimerInterval = setInterval(function() {
    var now = new Date();
    for (var i = 0; i < auctions.length; i++) {
      var a = auctions[i];
      var el = document.getElementById('timer-' + a.id);
      if (!el) continue;
      
      var endTime = new Date(a.endTime);
      var timeLeft = endTime - now;
      
      if (timeLeft <= 0) {
        el.textContent = '00:00:00';
        if (!a.finalizedAt && getAuctionStatus(a) === 'ended') {
          finalizeAuction(a.id).then(function() { renderAuctions(); });
        } else {
          var card = document.getElementById('auction-' + a.id);
          if (card) renderAuctions();
        }
      } else {
        el.textContent = formatTimeLeft(timeLeft);
      }
    }
  }, 1000);
}

function openBidModal(auctionId) {
  var a = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!a) { notify('Auction not found!', 'error'); return; }
  var inputEl = document.getElementById('bid-amount-' + auctionId);
  var bidAmount = parseFloat(inputEl ? inputEl.value : '');
  if (!bidAmount || isNaN(bidAmount)) {
    notify('Please enter a valid bid amount', 'error');
    return;
  }
  
  var currentPrice = Number(a.currentPrice || a.startingPrice || 0);
  if (bidAmount <= currentPrice) {
    notify('Bid must be higher than current price (£' + currentPrice.toFixed(2) + ')', 'error');
    return;
  }

  var stored = getStoredBidderContact() || {};
  var modalId = 'bidModal_' + Date.now();
  var html = '<div id="' + modalId + '" class="modal" style="display:flex">' +
    '<div class="modal-content">' +
      '<span class="close" onclick="AYLEN_MODAL.close()">&times;</span>' +
      '<h2><i class="fas fa-gavel"></i> Confirm Bid</h2>' +
      '<p style="margin-bottom:12px;color:#666">Bid for <b>' + escapeHtml(a.name) + '</b>: <b>£' + bidAmount.toFixed(2) + '</b></p>' +
      '<input type="text" id="bidWebsite_' + modalId + '" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0" value="">' +
      '<input type="hidden" id="bidStartedAt_' + modalId + '" value="' + Date.now() + '">' +
      '<input type="text" id="bidName_' + modalId + '" placeholder="Your Name *" value="' + escapeHtml(stored.name || (currentUser && currentUser.name ? currentUser.name : '')) + '" required>' +
      '<input type="tel" id="bidPhone_' + modalId + '" placeholder="Phone *" value="' + escapeHtml(stored.phone || '') + '" required>' +
      '<input type="text" id="bidContact_' + modalId + '" placeholder="Telegram / WhatsApp (optional)" value="' + escapeHtml(stored.contact || '') + '">' +
      '<button class="btn-order" onclick="submitBid(' + jsInlineArg(auctionId) + ',' + bidAmount + ',' + jsInlineArg(modalId) + ')"><i class="fas fa-check"></i> Place Bid</button>' +
    '</div>' +
  '</div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
}

async function submitBid(auctionId, bidAmount, modalId) {
  var name = document.getElementById('bidName_' + modalId).value.trim();
  var phone = document.getElementById('bidPhone_' + modalId).value.trim();
  var contact = document.getElementById('bidContact_' + modalId).value.trim();
  var honeypot = document.getElementById('bidWebsite_' + modalId).value;
  var startedAt = document.getElementById('bidStartedAt_' + modalId).value;
  var validation = SECURITY.validateBidForm(name, phone, contact, honeypot, startedAt);
  if (!validation.valid) {
    notify(validation.error, 'error');
    return;
  }
  var rateLimit = SECURITY.checkBidRateLimit();
  if (!rateLimit.allowed) {
    notify(rateLimit.reason, 'error');
    return;
  }

  notify('Saving bid...', 'info');
  if (await placeBid(auctionId, bidAmount, { name: name, phone: phone, contact: contact })) {
    notify('✓ Bid placed! £' + bidAmount.toFixed(2) + ' by ' + name, 'success');
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else {
      var modal = document.getElementById(modalId);
      if (modal) modal.remove();
    }
    renderAuctions();
  } else {
    notify('Error placing bid', 'error');
  }
}

function auctionPickupOptions() {
  var html = '<option value="">-- Select Pickup Point --</option>';
  locations.forEach(function(loc) {
    if (loc.active) {
      html += '<option value="' + escapeHtml(loc.name) + '">' + escapeHtml(loc.name) + ' - ' + escapeHtml(loc.address || '') + '</option>';
    }
  });
  return html;
}

function toggleWinnerDeliveryFields(modalId) {
  var method = document.getElementById('winnerMethod_' + modalId).value;
  var pickup = document.getElementById('winnerPickupWrap_' + modalId);
  var delivery = document.getElementById('winnerDeliveryWrap_' + modalId);
  if (pickup) pickup.style.display = method === 'Pickup' ? 'block' : 'none';
  if (delivery) delivery.style.display = method === 'Delivery' ? 'block' : 'none';
}

function openWinnerClaimModal(auctionId) {
  var auction = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!auction) { notify('Auction not found', 'error'); return; }
  if (!auction.winner) { notify('Winner is not ready yet', 'error'); return; }
  var stored = getStoredBidderContact() || {};
  var modalId = 'winnerModal_' + Date.now();
  var html = '<div id="' + modalId + '" class="modal" style="display:flex">' +
    '<div class="modal-content">' +
      '<span class="close" onclick="AYLEN_MODAL.close()">&times;</span>' +
      '<h2><i class="fas fa-trophy"></i> Claim Winning Order</h2>' +
      '<p style="margin-bottom:12px;color:#666"><b>' + escapeHtml(auction.name) + '</b><br>Final price: <b>£' + Number(auction.currentPrice || 0).toFixed(2) + '</b></p>' +
      '<input type="text" id="winnerWebsite_' + modalId + '" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0" value="">' +
      '<input type="hidden" id="winnerStartedAt_' + modalId + '" value="' + Date.now() + '">' +
      '<input type="text" id="winnerName_' + modalId + '" placeholder="Your Name *" value="' + escapeHtml(stored.name || auction.winner.bidderName || '') + '" required>' +
      '<input type="tel" id="winnerPhone_' + modalId + '" placeholder="Phone used for bid *" value="' + escapeHtml(stored.phone || '') + '" required>' +
      '<select id="winnerMethod_' + modalId + '" onchange="toggleWinnerDeliveryFields(' + jsInlineArg(modalId) + ')"><option value="Pickup">Pickup</option><option value="Delivery">Delivery</option></select>' +
      '<div id="winnerPickupWrap_' + modalId + '"><select id="winnerPickup_' + modalId + '">' + auctionPickupOptions() + '</select></div>' +
      '<div id="winnerDeliveryWrap_' + modalId + '" style="display:none">' +
        '<input type="text" id="winnerAddress_' + modalId + '" placeholder="Delivery address">' +
        '<input type="text" id="winnerPostcode_' + modalId + '" placeholder="Postcode">' +
      '</div>' +
      '<textarea id="winnerComment_' + modalId + '" placeholder="Comment" rows="2"></textarea>' +
      '<button class="btn-order" onclick="submitAuctionWinnerOrder(' + jsInlineArg(auctionId) + ',' + jsInlineArg(modalId) + ')"><i class="fas fa-paper-plane"></i> Send Winning Order</button>' +
    '</div>' +
  '</div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
}

async function submitAuctionWinnerOrder(auctionId, modalId) {
  var auction = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!auction || !auction.winner) { notify('Winner not found', 'error'); return; }
  var name = document.getElementById('winnerName_' + modalId).value.trim();
  var phone = document.getElementById('winnerPhone_' + modalId).value.trim();
  var method = document.getElementById('winnerMethod_' + modalId).value;
  var pickup = document.getElementById('winnerPickup_' + modalId).value;
  var address = document.getElementById('winnerAddress_' + modalId).value.trim();
  var postcode = document.getElementById('winnerPostcode_' + modalId).value.trim();
  var comment = document.getElementById('winnerComment_' + modalId).value.trim();
  var honeypot = document.getElementById('winnerWebsite_' + modalId).value;
  var startedAt = document.getElementById('winnerStartedAt_' + modalId).value;
  var winnerDigits = String(auction.winner.bidderPhone || '').replace(/\D/g, '');
  var phoneDigits = phone.replace(/\D/g, '');

  var validation = SECURITY.validateWinnerForm(name, phone, method, pickup, address, postcode, comment, honeypot, startedAt);
  if (!validation.valid) { notify(validation.error, 'error'); return; }
  var rateLimit = SECURITY.checkWinnerRateLimit();
  if (!rateLimit.allowed) { notify(rateLimit.reason, 'error'); return; }
  if (winnerDigits && phoneDigits.slice(-6) !== winnerDigits.slice(-6)) {
    notify('Phone must match the winning bid phone', 'error');
    return;
  }

  var order = {
    type: 'auction_winner',
    name: name,
    phone: phone,
    method: method,
    pickup: method === 'Pickup' ? pickup : '',
    address: method === 'Delivery' ? address : '',
    postcode: method === 'Delivery' ? postcode : '',
    comment: comment,
    auctionId: auction.id,
    auctionName: auction.name,
    finalPrice: Number(auction.currentPrice || 0),
    bidId: auction.winner.bidId || '',
    security: SECURITY.submissionMeta(startedAt, honeypot)
  };

  notify('Sending winner order...', 'info');
  try {
    var response = await fetch('/api/send-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    var data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Telegram send failed');
    }
    order.telegramMessageId = data.messageId || null;
    if (!await saveAuctionWinnerOrder(auctionId, order)) {
      throw new Error('Could not save winner order');
    }
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else {
      var modal = document.getElementById(modalId);
      if (modal) modal.remove();
    }
    notify('Winner order sent to admin!', 'success');
    renderAuctions();
  } catch (error) {
    notify('Winner order failed: ' + error.message, 'error');
  }
}
