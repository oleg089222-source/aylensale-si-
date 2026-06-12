// AYLEN SALE - Main App
var cart = JSON.parse(localStorage.getItem('aylencart') || '[]');
var savedItems = JSON.parse(localStorage.getItem('aylensaved') || '[]');
var currentUser = JSON.parse(localStorage.getItem('aylenuser') || 'null');
var priceMode = 'retail';
var selectedProductImage = {};
var selectedAuctionImage = {};
var engagementSessionId = getEngagementSessionId();
var engagementPresence = [];
var productViewCounts = {};
var PRODUCT_VIEW_STATS_KEY = 'aylen_product_view_stats';
var productViewTotals = loadLocalProductViewStats();
var auctionViewTotals = {};
var viewedProductsSession = {};
var trackProductViewLastAt = {};
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
var WEATHER_REFRESH_MS = (window.AYLEN_WEATHER && window.AYLEN_WEATHER.REFRESH_MS) || (30 * 60 * 1000);
var productsRevealInitialized = false;
var WEATHER_RETRY_THROTTLE_MS = 8 * 60 * 1000;
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

function withLazyPdpModal(onReady) {
  if (window.AYLEN_PDP && window.AYLEN_PDP.openModal) {
    onReady(window.AYLEN_PDP);
    return;
  }
  if (!window.AYLEN_LAZY || !window.AYLEN_LAZY.ensurePdpModal) {
    notify('Product viewer not ready — refresh the page', 'error');
    return;
  }
  window.AYLEN_LAZY.ensurePdpModal()
    .then(function(pdp) { onReady(pdp); })
    .catch(function() {
      notify('Product viewer not ready — refresh the page', 'error');
    });
}

function withLazyLoyaltyPortal(onReady) {
  if (window.AYLEN_LOYALTY_PORTAL) {
    onReady(window.AYLEN_LOYALTY_PORTAL);
    return;
  }
  if (!window.AYLEN_LAZY || !window.AYLEN_LAZY.ensureLoyaltyPortal) return;
  window.AYLEN_LAZY.ensureLoyaltyPortal()
    .then(function(portal) { onReady(portal); })
    .catch(function() {});
}

function prefetchLoyaltyPortalIfNeeded() {
  if (window.AYLEN_LOYALTY_PORTAL || !window.AYLEN_LAZY) return;
  try {
    var u = JSON.parse(localStorage.getItem('aylenuser') || 'null');
    if (!u || !u.card) return;
  } catch (e) {
    return;
  }
  var idle = window.requestIdleCallback || function(fn) { setTimeout(fn, 2200); };
  idle(function() {
    window.AYLEN_LAZY.ensureLoyaltyPortal().catch(function() {});
  });
}

function safeDomId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function stopCarouselEvent(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  if (ev && ev.stopPropagation) ev.stopPropagation();
}

function productImageKey(productId) {
  if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.canonicalProductKey) {
    return window.AYLEN_PRODUCTION.canonicalProductKey(productId);
  }
  var raw = String(productId || '');
  return raw.indexOf('prod_') === 0 ? raw.slice(5) : raw;
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

function catalogInitialPageSize() {
  return (window.AYLEN_CATALOG && window.AYLEN_CATALOG.PAGE_SIZE) || 24;
}

function productsGridGap(grid) {
  if (isMobileStorefrontLayout()) return 10;
  var width = grid ? (grid.clientWidth || 0) : (window.innerWidth || 0);
  if (width <= 640) return 10;
  if (width <= 1024) return 14;
  if (width >= 1400) return 20;
  return 12;
}

function productsGridColumnCount(grid) {
  if (isMobileStorefrontLayout()) return 2;
  var width = grid.clientWidth || window.innerWidth || 0;
  if (width <= 1024) return 2;
  if (width <= 1399) return 3;
  return 4;
}

var measuredProductCardHeight = 0;
var MOBILE_PRODUCTS_GRID_RESERVE = 1760;
var MOBILE_PRODUCTS_SECTION_RESERVE = 1960;
var MOBILE_PRODUCT_CARD_HEIGHT = 420;
var MOBILE_SSR_EAGER_IMAGE_COUNT = 1;

function readMobileReserveMeta(name, fallback) {
  var meta = document.querySelector('meta[name="' + name + '"]');
  var n = meta ? parseInt(meta.getAttribute('content'), 10) : 0;
  return n > 0 ? n : fallback;
}

function mobileProductsGridReservePx() {
  return readMobileReserveMeta('aylen-mobile-grid-reserve', MOBILE_PRODUCTS_GRID_RESERVE);
}

function mobileProductsSectionReservePx() {
  return readMobileReserveMeta('aylen-mobile-section-reserve', MOBILE_PRODUCTS_SECTION_RESERVE);
}

function estimateProductCardHeightFallback() {
  var cardMin = 420;
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) cardMin = 420;
  } catch (e) {}
  return cardMin;
}

function isMobileStorefrontLayout() {
  try {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  } catch (e) {
    return false;
  }
}

function isTabletStorefrontLayout() {
  try {
    return window.matchMedia && window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;
  } catch (e) {
    return false;
  }
}

function storefrontBelowFoldTiming() {
  if (isMobileStorefrontLayout()) {
    return { delayAfterLoad: 2000, idleTimeout: 8000 };
  }
  if (isTabletStorefrontLayout()) {
    return { delayAfterLoad: 1500, idleTimeout: 6000 };
  }
  return { delayAfterLoad: 2000, idleTimeout: 8000 };
}

function clearProductsLayoutReserve(section, grid) {
  if (section) {
    section.style.minHeight = '';
    section.style.height = '';
    section.style.maxHeight = '';
    section.style.removeProperty('--products-section-reserved-h');
  }
  if (grid) {
    grid.style.minHeight = '';
    grid.style.height = '';
    grid.style.maxHeight = '';
    grid.style.removeProperty('--products-grid-reserved-h');
  }
}

function pinProductsLayoutReserve(section, grid) {
  if (isMobileStorefrontLayout()) return;
  if (grid) {
    var gridH = Math.ceil(grid.getBoundingClientRect().height);
    if (gridH > 0) {
      syncProductsGridReserveVar(grid, gridH);
      grid.style.height = gridH + 'px';
      grid.style.maxHeight = gridH + 'px';
    }
  }
  if (section) {
    var sectionH = measureProductsSectionHeight();
    if (sectionH > 0) {
      syncProductsSectionReserve(section, sectionH, false);
      section.style.height = sectionH + 'px';
      section.style.maxHeight = sectionH + 'px';
    }
  }
}

function syncProductsGridReserveVar(grid, heightPx) {
  if (!grid || !heightPx) return;
  var next = Math.ceil(heightPx);
  var current = parseInt(grid.style.getPropertyValue('--products-grid-reserved-h'), 10) || 0;
  if (isMobileStorefrontLayout()) {
    if (current > 0 && next < current) next = current;
    grid.style.setProperty('--products-grid-reserved-h', next + 'px');
    return;
  }
  grid.style.setProperty('--products-grid-reserved-h', next + 'px');
  grid.style.minHeight = next + 'px';
}

function syncProductsSectionReserve(section, heightPx, allowShrink) {
  if (!section || !heightPx) return;
  var next = Math.ceil(heightPx);
  var current = parseInt(section.style.getPropertyValue('--products-section-reserved-h'), 10) || 0;
  if (!allowShrink && current > 0 && next < current) next = current;
  section.style.setProperty('--products-section-reserved-h', next + 'px');
  if (!isMobileStorefrontLayout()) {
    section.style.minHeight = next + 'px';
  }
}

function measureProductsSectionHeight() {
  if (isMobileStorefrontLayout()) {
    var section = document.getElementById('products');
    if (!section) return mobileProductsSectionReservePx();
    var reserved = parseInt(section.style.getPropertyValue('--products-section-reserved-h'), 10);
    return reserved > 0 ? reserved : mobileProductsSectionReservePx();
  }
  var section = document.getElementById('products');
  if (!section) return 0;
  return Math.ceil(section.getBoundingClientRect().height);
}

function lockProductsSectionShell() {
  var section = document.getElementById('products');
  if (!section || section.classList.contains('products-section--settled')) return;
  if (!isMobileStorefrontLayout()) {
    var measured = measureProductsSectionHeight();
    if (measured > 0) syncProductsSectionReserve(section, measured, false);
  }
  section.classList.add('products-section--loading');
}

function waitForDeferredShellCss(timeoutMs) {
  timeoutMs = timeoutMs || 4000;
  return new Promise(function(resolve) {
    if (document.documentElement.classList.contains('shell-deferred-ready')) {
      resolve();
      return;
    }
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      resolve();
    }
    var observer = new MutationObserver(function() {
      if (document.documentElement.classList.contains('shell-deferred-ready')) {
        observer.disconnect();
        finish();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function() {
      observer.disconnect();
      finish();
    }, timeoutMs);
  });
}

function waitForStorefrontPaintReady(timeoutMs) {
  timeoutMs = timeoutMs || 3000;
  return new Promise(function(resolve) {
    if (document.readyState === 'complete') {
      resolve();
      return;
    }
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      resolve();
    }
    window.addEventListener('load', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

function waitForFirstProductImages(grid, limit, timeoutMs) {
  limit = limit || 4;
  timeoutMs = timeoutMs || 2500;
  return new Promise(function(resolve) {
    if (!grid) {
      resolve();
      return;
    }
    var imgs = grid.querySelectorAll('.product-card-grid-item img[data-main-product-image]');
    var targets = [];
    for (var i = 0; i < imgs.length && targets.length < limit; i++) {
      targets.push(imgs[i]);
    }
    if (!targets.length) {
      resolve();
      return;
    }
    var pending = targets.length;
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      resolve();
    }
    targets.forEach(function(img) {
      if (img.complete && img.naturalHeight > 0) {
        pending -= 1;
        if (pending <= 0) finish();
        return;
      }
      function onImgDone() {
        pending -= 1;
        if (pending <= 0) finish();
      }
      img.addEventListener('load', onImgDone, { once: true });
      img.addEventListener('error', onImgDone, { once: true });
    });
    if (pending <= 0) finish();
    setTimeout(finish, timeoutMs);
  });
}

function measureSkeletonGridHeight(grid) {
  if (isMobileStorefrontLayout()) return mobileProductsGridReservePx();
  if (!grid) return 0;
  return Math.ceil(grid.getBoundingClientRect().height);
}

function pinMobileProductsLayoutReserve(section, grid, itemCount) {
  /* Mobile reserve is fixed in HTML critical CSS — no runtime resize (CLS). */
}

function releaseMobileProductsLayoutReserve(section, grid) {
  var above = document.getElementById('storefrontAboveProducts');
  if (above) {
    above.style.removeProperty('height');
    above.style.removeProperty('max-height');
    above.style.removeProperty('overflow');
  }
  if (grid) {
    var measured = Math.ceil(grid.getBoundingClientRect().height);
    var reserved = parseInt(grid.style.getPropertyValue('--products-grid-reserved-h'), 10) || 0;
    if (!reserved || !Number.isFinite(reserved)) reserved = mobileProductsGridReservePx();
    syncProductsGridReserveVar(grid, Math.max(measured, reserved));
    grid.style.removeProperty('height');
    grid.style.removeProperty('max-height');
    grid.classList.remove('products-grid--loading');
    grid.classList.add('products-grid--settled');
    grid.removeAttribute('aria-busy');
  }
  if (section) {
    var gridReserve = grid
      ? (parseInt(grid.style.getPropertyValue('--products-grid-reserved-h'), 10) || mobileProductsGridReservePx())
      : mobileProductsGridReservePx();
    syncProductsSectionReserve(section, Math.max(measureProductsSectionHeight(), gridReserve + 248), true);
    section.style.removeProperty('height');
    section.style.removeProperty('max-height');
    section.classList.remove('products-section--loading');
    section.classList.add('products-section--settled');
  }
}

function scheduleBelowFoldStorefrontWork(fn, opts) {
  opts = opts || {};
  var delayAfterLoad = opts.delayAfterLoad || 0;
  var idleTimeout = opts.idleTimeout || 10000;
  function runWork() {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: idleTimeout });
    } else {
      setTimeout(fn, Math.min(idleTimeout, 8000));
    }
  }
  function afterLoad() {
    if (delayAfterLoad > 0) setTimeout(runWork, delayAfterLoad);
    else runWork();
  }
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}

function releaseProductsLayoutReserveWhenStable(section, grid, onDone) {
  function settleProductsLayout() {
    requestAnimationFrame(function() {
      if (isMobileStorefrontLayout()) {
        releaseMobileProductsLayoutReserve(section, grid);
      } else {
        if (section && !section.classList.contains('products-section--settled')) {
          section.classList.remove('products-section--loading');
          section.classList.add('products-section--settled');
        }
        if (grid && !grid.classList.contains('products-grid--settled')) {
          grid.classList.remove('products-grid--loading');
          grid.classList.add('products-grid--settled');
          grid.removeAttribute('aria-busy');
        }
      }
      requestAnimationFrame(function() {
        if (!isMobileStorefrontLayout()) {
          pinProductsLayoutReserve(section, grid);
        }
        if (typeof onDone === 'function') onDone();
      });
    });
  }

  if (isMobileStorefrontLayout()) {
    scheduleBelowFoldStorefrontWork(function() {
      requestAnimationFrame(settleProductsLayout);
    }, storefrontBelowFoldTiming());
    return;
  }

  var imageLimit = 4;
  Promise.all([
    waitForStorefrontPaintReady(3000),
    waitForFirstProductImages(grid, imageLimit, 3000)
  ]).then(function() {
    waitForStableGridHeight(grid || section, function(stableGridH) {
      if (grid && stableGridH > 0) {
        syncProductsGridReserveVar(grid, stableGridH);
      }
      if (section) {
        syncProductsSectionReserve(section, measureProductsSectionHeight(), true);
      }
      settleProductsLayout();
    }, { stableFrames: 3, tolerance: 3, maxFrames: 48 });
  });
}

function finalizeProductsSectionLayout(onDone) {
  var section = document.getElementById('products');
  var grid = document.getElementById('productsGrid');
  if (!section) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  if (isMobileStorefrontLayout()) {
    releaseProductsLayoutReserveWhenStable(section, grid, onDone);
    return;
  }
  waitForStableGridHeight(section, function() {
    releaseProductsLayoutReserveWhenStable(section, grid, onDone);
  }, { stableFrames: 2, tolerance: 4, maxFrames: 36 });
}

function measureProductCardHeight(grid) {
  if (isMobileStorefrontLayout()) {
    if (measuredProductCardHeight > 0 && measuredProductCardHeight < 900) return measuredProductCardHeight;
    return MOBILE_PRODUCT_CARD_HEIGHT;
  }
  var sample = grid && (grid.querySelector('.product-card-grid-item') || grid.querySelector('.product-skeleton'));
  if (sample) {
    var savedMin = grid ? grid.style.minHeight : '';
    if (grid) grid.style.minHeight = '';
    var box = Math.ceil(sample.getBoundingClientRect().height);
    if (grid) grid.style.minHeight = savedMin;
    if (box > 0 && box < 900) {
      measuredProductCardHeight = box;
      return box;
    }
  }
  if (measuredProductCardHeight > 0 && measuredProductCardHeight < 900) return measuredProductCardHeight;
  return estimateProductCardHeightFallback();
}

function estimateProductCardHeight(grid) {
  return measureProductCardHeight(grid);
}

function waitForStableGridHeight(el, done, opts) {
  if (isMobileStorefrontLayout()) {
    requestAnimationFrame(function() {
      done(el && el.id === 'products' ? mobileProductsSectionReservePx() : mobileProductsGridReservePx());
    });
    return;
  }
  opts = opts || {};
  var stableFrames = opts.stableFrames || 2;
  var tolerance = opts.tolerance || 2;
  var maxFrames = opts.maxFrames || 30;
  var readings = [];
  var frame = 0;

  function tick() {
    frame += 1;
    readings.push(Math.ceil(el.getBoundingClientRect().height));
    if (readings.length > stableFrames) readings.shift();
    var isStable = readings.length === stableFrames && readings.every(function(h) {
      return Math.abs(h - readings[0]) <= tolerance;
    });
    if (isStable || frame >= maxFrames) {
      done(readings[readings.length - 1] || Math.ceil(el.getBoundingClientRect().height));
      return;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function productSkeletonCount() {
  var grid = document.getElementById('productsGrid');
  var cols = productsGridColumnCount(grid);
  var rows = Math.ceil(catalogInitialPageSize() / cols);
  var visualRows = Math.min(rows, 3);
  return cols * Math.max(visualRows, 2);
}

function estimateProductsGridHeight(grid, itemCount) {
  if (!grid || !itemCount) return 0;
  var cols = productsGridColumnCount(grid);
  var gap = productsGridGap(grid);
  var rows = Math.ceil(itemCount / cols);
  var cardH = estimateProductCardHeight(grid);
  return rows * cardH + Math.max(0, rows - 1) * gap + 12;
}

function applyProductsGridLoadingReserve(grid, itemCount) {
  if (!grid || !itemCount) return 0;
  if (isMobileStorefrontLayout()) {
    syncProductsGridReserveVar(grid, mobileProductsGridReservePx());
    var section = document.getElementById('products');
    if (section) syncProductsSectionReserve(section, mobileProductsSectionReservePx(), false);
    return mobileProductsGridReservePx();
  }
  var current = Math.ceil(grid.getBoundingClientRect().height);
  var skeletonH = measureSkeletonGridHeight(grid);
  var target = estimateProductsGridHeight(grid, itemCount);
  var reservedRaw = grid.style.getPropertyValue('--products-grid-reserved-h');
  var reservedVar = reservedRaw ? parseInt(reservedRaw, 10) : 0;
  var reserved = Math.ceil(Math.max(current, skeletonH, target, reservedVar || 0));
  syncProductsGridReserveVar(grid, reserved);
  var section = document.getElementById('products');
  if (section) {
    syncProductsSectionReserve(section, Math.max(measureProductsSectionHeight(), reserved + 200), false);
  }
  return reserved;
}

function reserveProductsGridHeight(grid, itemCount) {
  return applyProductsGridLoadingReserve(grid, itemCount);
}

function finalizeProductsGridSwap(grid, onStable) {
  if (!grid) return;
  grid.classList.add('products-grid--revealed');
  if (isMobileStorefrontLayout()) {
    var section = document.getElementById('products');
    grid.removeAttribute('aria-busy');
    scheduleBelowFoldStorefrontWork(function() {
      releaseMobileProductsLayoutReserve(section, grid);
      if (typeof onStable === 'function') onStable();
    }, { delayAfterLoad: 2000, idleTimeout: 8000 });
    return;
  }
  var locked = Math.ceil(grid.getBoundingClientRect().height);
  var reservedRaw = grid.style.getPropertyValue('--products-grid-reserved-h');
  var reserved = reservedRaw ? parseInt(reservedRaw, 10) : 0;
  if (!reserved || !Number.isFinite(reserved)) {
    reserved = locked;
  }
  syncProductsGridReserveVar(grid, Math.max(locked, reserved));

  waitForStableGridHeight(grid, function(stableHeight) {
    var pinned = Math.max(locked, stableHeight, reserved);
    syncProductsGridReserveVar(grid, pinned);
    grid.classList.remove('products-grid--loading');
    grid.removeAttribute('aria-busy');

    waitForStableGridHeight(grid, function(finalHeight) {
      var settled = Math.max(pinned, Math.ceil(finalHeight));
      syncProductsGridReserveVar(grid, settled);
      if (typeof onStable === 'function') onStable();
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          var current = Math.ceil(grid.getBoundingClientRect().height);
          var floor = parseInt(grid.style.getPropertyValue('--products-grid-reserved-h'), 10) || settled;
          if (current > 0) syncProductsGridReserveVar(grid, Math.max(floor, current));
        });
      });
    }, { stableFrames: 4, tolerance: 2, maxFrames: 60 });
  }, { stableFrames: 4, tolerance: 2, maxFrames: 60 });
}

function prepareProductsGridLoadingShell() {
  var grid = document.getElementById('productsGrid');
  if (!grid || !grid.classList.contains('products-grid--loading')) return;
  if (!isMobileStorefrontLayout()) {
    ensureProductSkeletonCount();
  }
  applyProductsGridLoadingReserve(grid, catalogInitialPageSize());
  lockProductsSectionShell();
}

function ensureProductSkeletonCount() {
  var grid = document.getElementById('productsGrid');
  if (!grid || !grid.classList.contains('products-grid--loading')) return;
  var needed = productSkeletonCount();
  var existing = grid.querySelectorAll('.product-skeleton').length;
  for (var i = existing; i < needed; i++) {
    var el = document.createElement('div');
    el.className = 'product-skeleton';
    el.setAttribute('aria-hidden', 'true');
    grid.appendChild(el);
  }
}

function renderProductSkeletonGrid() {
  var grid = document.getElementById('productsGrid');
  if (!grid) return;
  var count = productSkeletonCount();
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="product-skeleton" aria-hidden="true"></div>';
  }
  grid.innerHTML = html;
  grid.classList.add('products-grid--loading');
  grid.setAttribute('aria-busy', 'true');
}

function showProductSkeletons() {
  renderProductSkeletonGrid();
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
    '.live-stat',
    '#ebayPromoWrap > *',
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
  return ' draggable="false" oncontextmenu="return false"';
}

function aylenProductImageFallback(img) {
  if (!img) return;
  var before = img.src;
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.imageLoadFallback) {
    window.AYLEN_IMAGES.imageLoadFallback(img);
    if (img.src !== before) return;
  } else {
    var full = img.getAttribute('data-full');
    if (full && img.src !== full) {
      img.src = full;
      return;
    }
    var fb = img.getAttribute('data-fallback');
    if (fb && img.src !== fb) {
      img.src = fb;
      img.onerror = null;
      return;
    }
  }
  if (typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' && img.src !== PRODUCT_FALLBACK_IMAGE) {
    img.src = PRODUCT_FALLBACK_IMAGE;
    img.onerror = null;
  }
}
window.aylenProductImageFallback = aylenProductImageFallback;
window.aylenImageLoadFallback = aylenProductImageFallback;

var DEFERRED_GALLERY_IMG =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function productCardDisplayDims() {
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productCardDisplaySize) {
    return window.AYLEN_IMAGES.productCardDisplaySize();
  }
  return { w: 320, h: 220 };
}

function hydrateDeferredGalleryImage(img) {
  if (!img) return;
  var deferred = img.getAttribute('data-deferred-src');
  if (!deferred || img.getAttribute('data-hydrated') === '1') return;
  img.setAttribute('data-hydrated', '1');
  var deferredSrcset = img.getAttribute('data-deferred-srcset');
  if (deferredSrcset) {
    img.srcset = deferredSrcset;
    img.removeAttribute('data-deferred-srcset');
  }
  var deferredSizes = img.getAttribute('data-deferred-sizes');
  if (deferredSizes) {
    img.sizes = deferredSizes;
    img.removeAttribute('data-deferred-sizes');
  }
  img.src = deferred;
  img.removeAttribute('data-deferred-src');
}

function initSsrDeferredProductImages() {
  var grid = document.getElementById('productsGrid');
  if (!grid) return;
  var imgs = grid.querySelectorAll('img[data-deferred-src]');
  if (!imgs.length) return;
  function reveal(img) {
    hydrateDeferredGalleryImage(img);
  }
  function wireObserver() {
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(reveal);
      return;
    }
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: isMobileStorefrontLayout() ? '48px 0px' : '96px 0px', threshold: 0.01 });
    imgs.forEach(function(img) { observer.observe(img); });
  }
  if (isMobileStorefrontLayout()) {
    scheduleMobileBelowFoldCatalogWork(wireObserver);
    return;
  }
  wireObserver();
}

function hydrateProductScrollGalleryImages(scroller) {
  if (!scroller) return;
  scroller.querySelectorAll('img[data-deferred-src]').forEach(hydrateDeferredGalleryImage);
}

function productCardImageErrorAttr() {
  return ' onerror="aylenProductImageFallback(this)"';
}

function storefrontImageDataAttrs(rawUrl, fallbackImg) {
  var full = productCardImageFullUrl(rawUrl);
  var fb = fallbackImg || (typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : '');
  return ' data-full="' + escapeHtml(full) + '" data-fallback="' + escapeHtml(fb) + '"' + productCardImageErrorAttr();
}

function productCardResponsiveImgAttrs(rawUrl) {
  if (!window.AYLEN_IMAGES || !window.AYLEN_IMAGES.productCardImageSrcset) return '';
  var srcset = window.AYLEN_IMAGES.productCardImageSrcset(rawUrl);
  if (!srcset) return '';
  var sizes = window.AYLEN_IMAGES.productCardImageSizes
    ? window.AYLEN_IMAGES.productCardImageSizes()
    : '(max-width: 768px) 50vw, 320px';
  return ' srcset="' + escapeHtml(srcset) + '" sizes="' + escapeHtml(sizes) + '"';
}

function productCardPictureHtml(rawUrl, imgAttrs, dims) {
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.buildProductCardPictureHtml) {
    return window.AYLEN_IMAGES.buildProductCardPictureHtml(rawUrl, {
      imgAttrs: imgAttrs,
      width: dims && dims.w,
      height: dims && dims.h
    });
  }
  var src = productCardImageSrc(rawUrl);
  var d = dims || productCardDisplayDims();
  return '<img src="' + escapeHtml(src) + '" width="' + d.w + '" height="' + d.h + '"' + productCardResponsiveImgAttrs(rawUrl) + (imgAttrs || '') + '>';
}

function auctionImageDataAttrs(rawUrl) {
  var full = productCardImageFullUrl(rawUrl);
  var fb = typeof AUCTION_FALLBACK_IMAGE !== 'undefined' ? AUCTION_FALLBACK_IMAGE : (typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : '');
  return ' data-full="' + escapeHtml(full) + '" data-fallback="' + escapeHtml(fb) + '" onerror="auctionImageFailed(this)"';
}

function formatViewCount(count) {
  var n = Number(count || 0);
  return n + ' ' + (n === 1 ? 'view' : 'views');
}

function pickupWeatherDays(value) {
  if (window.AYLEN_WEATHER && window.AYLEN_WEATHER.pickupWeatherDays) {
    return window.AYLEN_WEATHER.pickupWeatherDays(value);
  }
  return { saturday: true, sunday: false };
}

function weatherTimeMs(value) {
  if (!value) return 0;
  if (value.toMillis) return value.toMillis();
  var date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function hasStoredWeather(loc) {
  return loc && (
    loc.currentTemp !== undefined ||
    loc.saturdayRainPct !== undefined ||
    loc.sundayRainPct !== undefined ||
    loc.saturdayTemp !== undefined ||
    loc.sundayTemp !== undefined
  );
}

function isWeatherFresh(loc) {
  var updated = weatherTimeMs(loc.lastWeatherUpdate);
  return hasStoredWeather(loc) && updated > 0 && Date.now() - updated < WEATHER_REFRESH_MS;
}

function storedWeatherForecast(loc) {
  if (window.AYLEN_WEATHER && window.AYLEN_WEATHER.forecastFromStored) {
    return window.AYLEN_WEATHER.forecastFromStored(loc);
  }
  if (!hasStoredWeather(loc)) return null;
  var selectedDays = loc.weatherDays || pickupWeatherDays(loc.days || loc.day);
  return {
    days: selectedDays,
    current: {
      temp: Number(loc.currentTemp || loc.saturdayTemp || 0),
      rain: Number(loc.currentRainPct != null ? loc.currentRainPct : Math.max(loc.saturdayRainPct || 0, loc.sundayRainPct || 0)),
      wind: Number(loc.windSpeed || 0),
      code: Number(loc.weatherCode || 0)
    },
    saturday: { rain: Number(loc.saturdayRainPct || 0), max: Number(loc.saturdayTemp || 0), code: Number(loc.saturdayWeatherCode || 0), wind: Number(loc.saturdayWind || 0) },
    sunday: { rain: Number(loc.sundayRainPct || 0), max: Number(loc.sundayTemp || 0), code: Number(loc.sundayWeatherCode || 0), wind: Number(loc.sundayWind || 0) }
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
  return !!document.getElementById('engagementBar');
}

function readSsrEngagementSeed() {
  try {
    var meta = document.querySelector('meta[name="aylen-engagement-seed"]');
    if (!meta || !meta.content) return null;
    return JSON.parse(meta.content);
  } catch (e) {
    return null;
  }
}

function renderEngagementStats() {
  ensureEngagementBar();
  var onlineEl = document.getElementById('onlineVisitorsCount');
  var cartsEl = document.getElementById('activeCartsCount');
  var productsEl = document.getElementById('productsAvailableCount');
  var auctionsEl = document.getElementById('activeAuctionsCount');
  var pickupsEl = document.getElementById('pickupPointsCount');
  var seed = readSsrEngagementSeed();
  if (onlineEl) onlineEl.textContent = onlineVisitorsCount;
  if (cartsEl) cartsEl.textContent = activeCartsCount;
  if (productsEl) {
    var inStock = (products || []).filter(function(p) { return p.active !== false && Number(p.stock || 0) > 0; }).length;
    productsEl.textContent = inStock || (seed && seed.productsInStock) || productsEl.textContent || '0';
  }
  if (auctionsEl) {
    var activeAuctions = (auctions || []).filter(function(a) { return getAuctionStatus(a) === 'active'; }).length;
    auctionsEl.textContent = activeAuctions || (seed && seed.activeAuctions) || auctionsEl.textContent || '0';
  }
  if (pickupsEl) {
    var pickupCount = (locations || []).filter(function(l) {
      if (window.AYLEN_PICKUP) return window.AYLEN_PICKUP.normalizePickupStatus(l) === 'going';
      return l.active !== false;
    }).length;
    pickupsEl.textContent = pickupCount || (seed && seed.pickupPoints) || pickupsEl.textContent || '0';
  }
  updateProductViewerBadges();
}

function loadLocalProductViewStats() {
  try {
    var raw = localStorage.getItem(PRODUCT_VIEW_STATS_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveLocalProductViewStats() {
  try {
    localStorage.setItem(PRODUCT_VIEW_STATS_KEY, JSON.stringify(productViewTotals || {}));
  } catch (e) {}
}

function mergeProductViewStats(map) {
  map = map || {};
  Object.keys(map).forEach(function(pid) {
    var remote = Number(map[pid] || 0);
    var local = Number(productViewTotals[pid] || 0);
    productViewTotals[pid] = Math.max(remote, local);
  });
  saveLocalProductViewStats();
  updateProductViewTotalsFromSnapshot(productViewTotals);
}

function getDisplayViewCount(productId) {
  var pid = String(productId || '');
  if (!pid) return 0;
  var live = Number(productViewCounts[pid] || 0);
  var total = Number(productViewTotals[pid] || 0);
  var product = (products || []).find(function(p) { return sameId(p.id, pid); });
  if (product && Number(product.viewCount || 0) > total) {
    total = Number(product.viewCount);
  }
  return Math.max(live, total);
}

function renderViewerBadge(productId) {
  var el = document.getElementById('viewers-' + safeDomId(productId));
  if (!el) return;
  var count = getDisplayViewCount(productId);
  if (count > 0) {
    el.style.display = 'inline-flex';
    el.innerHTML = '<i class="fas fa-eye"></i> ' + count + ' viewing';
  } else {
    el.style.display = 'none';
  }
}

function updateProductViewerBadges() {
  var seen = {};
  (products || []).forEach(function(p) {
    var pid = String(p.id);
    seen[pid] = true;
    renderViewerBadge(pid);
  });
  Object.keys(productViewCounts).forEach(function(productId) {
    if (!seen[productId]) renderViewerBadge(productId);
  });
}

function updateProductViewTotalsFromSnapshot(map) {
  productViewTotals = map || {};
  saveLocalProductViewStats();
  (products || []).forEach(function(p) {
    var pid = String(p.id);
    if (productViewTotals[pid] != null) {
      p.viewCount = Number(productViewTotals[pid] || 0);
    }
  });
  updateProductViewerBadges();
}

function recordPersistentProductView(productId) {
  var pid = String(productId || '');
  if (!pid || viewedProductsSession[pid]) return;
  viewedProductsSession[pid] = true;
  productViewTotals[pid] = Number(productViewTotals[pid] || 0) + 1;
  saveLocalProductViewStats();
  var product = (products || []).find(function(p) { return sameId(p.id, pid); });
  if (product) product.viewCount = Number(product.viewCount || 0) + 1;
  updateProductViewerBadges();
  if (window.FBDB && window.FBDB.recordProductView) {
    window.FBDB.recordProductView(pid).catch(function() {});
  }
}

function mergeAuctionViewStats(map) {
  auctionViewTotals = map || {};
}

function recordAuctionViewOnce(auctionId) {
  var aid = String(auctionId || '');
  if (!aid || viewedProductsSession['auc_' + aid]) return;
  viewedProductsSession['auc_' + aid] = true;
  auctionViewTotals[aid] = Number(auctionViewTotals[aid] || 0) + 1;
  if (window.FBDB && window.FBDB.recordAuctionView) {
    window.FBDB.recordAuctionView(aid).catch(function() {});
  }
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
  var pid = String(productId || '');
  if (!pid) return;
  var now = Date.now();
  if (trackProductViewLastAt[pid] && now - trackProductViewLastAt[pid] < 800) return;
  trackProductViewLastAt[pid] = now;
  currentViewedProductId = pid;
  writePresence(true);
  recordPersistentProductView(pid);
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
  if (window.FBDB && window.FBDB.loadProductViewStats) {
    window.FBDB.loadProductViewStats().then(function(map) {
      if (map && Object.keys(map).length) mergeProductViewStats(map);
    }).catch(function() {});
  }
  if (window.FBDB && window.FBDB.loadAuctionViewStats) {
    window.FBDB.loadAuctionViewStats().then(function(map) {
      if (map && Object.keys(map).length) mergeAuctionViewStats(map);
    }).catch(function() {});
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
    description: 'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.'
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
    newArrivalsEnabled: false,
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

function buildEbayPromoCardHtml(settings) {
  var buttonText = settings.buttonText || 'Shop on eBay';
  var description = settings.description || 'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.';
  if (description === 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.') {
    description = 'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.';
  }
  return (
    '<div class="ebay-promo-card">' +
      '<div class="ebay-promo-card__main">' +
        '<div class="ebay-promo-card__icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16v2H4V4zm2 4h12l-1.2 10H7.2L6 8zm6 2v6h2v-6h-2z"/></svg></div>' +
        '<div class="ebay-promo-card__copy">' +
          '<div class="ebay-promo-card__logo" aria-hidden="true">' +
            '<span class="ebay-promo-card__logo-e">e</span><span class="ebay-promo-card__logo-b">B</span><span class="ebay-promo-card__logo-a">a</span><span class="ebay-promo-card__logo-y">y</span>' +
          '</div>' +
          '<p class="ebay-promo-card__desc">' + escapeHtml(description) + '</p>' +
        '</div>' +
      '</div>' +
      '<a class="ebay-promo-card__cta" href="' + escapeHtml(settings.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<i class="fas fa-external-link-alt" aria-hidden="true"></i> ' + escapeHtml(buttonText) +
      '</a>' +
    '</div>'
  );
}

function renderEbayPromo() {
  var settings = safeEbaySettings();
  var shouldShow = settings.enabled === true && validEbayUrl(settings.url);
  var wrap = document.getElementById('ebayPromoWrap');
  var headerBtn = document.getElementById('headerEbayBtn');
  var buttonText = settings.buttonText || 'Shop on eBay';

  if (!headerBtn) {
    var headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerBtn = document.createElement('a');
      headerBtn.id = 'headerEbayBtn';
      headerBtn.className = 'header-ebay-btn';
      headerBtn.target = '_blank';
      headerBtn.rel = 'noopener noreferrer';
      headerRight.insertBefore(headerBtn, headerRight.firstChild);
    }
  }

  if (headerBtn) {
    if (shouldShow && !isMobileStorefrontLayout()) {
      headerBtn.href = settings.url;
      headerBtn.innerHTML = '<i class="fas fa-store" aria-hidden="true"></i> ' + escapeHtml(buttonText);
      headerBtn.classList.add('is-visible');
      headerBtn.removeAttribute('aria-hidden');
    } else {
      headerBtn.classList.remove('is-visible');
      headerBtn.setAttribute('aria-hidden', 'true');
    }
  }

  if (!wrap) return;
  function hideEbayWrap() {
    wrap.classList.remove('is-visible');
    wrap.style.removeProperty('display');
    wrap.style.visibility = 'hidden';
    wrap.style.pointerEvents = 'none';
    wrap.innerHTML = '';
  }
  function showEbayWrap() {
    wrap.classList.add('is-visible');
    wrap.style.removeProperty('display');
    wrap.style.visibility = 'visible';
    wrap.style.pointerEvents = 'auto';
  }
  if (wrap.getAttribute('data-ssr-ebay') === '1') {
    if (!shouldShow) {
      hideEbayWrap();
      wrap.removeAttribute('data-ssr-ebay');
      if (window.AYLEN_STOREFRONT_FOLDS && window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility) {
        window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility(false);
      }
      if (headerBtn) {
        headerBtn.classList.remove('is-visible');
        headerBtn.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    showEbayWrap();
    if (headerBtn) {
      if (!isMobileStorefrontLayout()) {
        headerBtn.href = settings.url;
        headerBtn.innerHTML = '<i class="fas fa-store" aria-hidden="true"></i> ' + escapeHtml(buttonText);
        headerBtn.classList.add('is-visible');
        headerBtn.removeAttribute('aria-hidden');
      } else {
        headerBtn.classList.remove('is-visible');
        headerBtn.setAttribute('aria-hidden', 'true');
      }
    }
    return;
  }
  if (!shouldShow) {
    hideEbayWrap();
    if (window.AYLEN_STOREFRONT_FOLDS && window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility) {
      window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility();
    }
    return;
  }

  showEbayWrap();
  if (wrap.querySelector('.ebay-promo-card')) {
    if (window.AYLEN_STOREFRONT_FOLDS && window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility) {
      window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility();
    }
    return;
  }
  wrap.innerHTML = buildEbayPromoCardHtml(settings);
  if (window.AYLEN_STOREFRONT_FOLDS && window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility) {
    window.AYLEN_STOREFRONT_FOLDS.syncEbayFoldVisibility();
  }
}

function renderNewArrivals() {
  if (window.newArrivalsScrollTimer) {
    clearInterval(window.newArrivalsScrollTimer);
    window.newArrivalsScrollTimer = null;
  }
  var section = document.getElementById('newArrivalsSection');
  if (section) section.remove();
}

async function geocodeLocationForWeather(loc) {
  var lng = loc.lng || loc.lon;
  if (loc.lat && lng && Number(loc.lat) && Number(lng)) {
    return { lat: Number(loc.lat), lng: Number(lng) };
  }
  var pc = loc.weatherPostcode || loc.postcode;
  if (window.AYLEN_PICKUP && window.AYLEN_PICKUP.geocodeUKPostcode && pc) {
    var geo = await window.AYLEN_PICKUP.geocodeUKPostcode(pc);
    if (geo) {
      loc.weatherPostcode = geo.postcode || (window.AYLEN_PICKUP.normalizeUKPostcode ? window.AYLEN_PICKUP.normalizeUKPostcode(pc) : pc);
      return { lat: geo.lat, lng: geo.lng };
    }
  }
  return null;
}

function renderLocationWeatherCard(el, forecast, loc) {
  if (window.AYLEN_WEATHER && window.AYLEN_WEATHER.paint) {
    window.AYLEN_WEATHER.paint(el, forecast, loc);
  } else if (el) {
    el.textContent = 'Weather updating…';
  }
  applyPickupWeatherRiskBadge(el && el.closest('.pickup-card'), loc, forecast);
}

function applyPickupWeatherRiskBadge(cardEl, loc, forecast) {
  if (!cardEl || !loc) return;
  var existing = cardEl.querySelector('.pickup-weather-risk');
  if (existing) existing.remove();
  var status = window.AYLEN_PICKUP
    ? window.AYLEN_PICKUP.normalizePickupStatus(loc)
    : (loc.active ? 'going' : 'not_confirmed');
  if (status !== 'going') return;
  var risk = window.AYLEN_PICKUP && window.AYLEN_PICKUP.weatherRiskMeta
    ? window.AYLEN_PICKUP.weatherRiskMeta(loc, forecast)
    : null;
  if (!risk) return;
  var banner = document.createElement('div');
  banner.className = 'pickup-weather-risk pickup-weather-risk--' + String(risk.key || 'possible').toLowerCase();
  banner.setAttribute('role', 'status');
  banner.innerHTML =
    '<span class="pickup-weather-risk__icon"><i class="fas fa-cloud-showers-heavy"></i></span>' +
    '<span class="pickup-weather-risk__copy">' +
      '<strong>' + escapeHtml(risk.label || 'WEATHER RISK') + '</strong>' +
      '<span>' + escapeHtml(risk.hint || '') + '</span>' +
    '</span>';
  var media = cardEl.querySelector('.pickup-card-media');
  if (media && media.nextSibling) {
    cardEl.insertBefore(banner, media.nextSibling);
  } else {
    cardEl.insertBefore(banner, cardEl.firstChild);
  }
}

function updatePickupSectionMeta(visibleLocations) {
  var datesEl = document.getElementById('pickupWeekendDates');
  if (datesEl && window.AYLEN_PICKUP && window.AYLEN_PICKUP.formatWeekendDatesLabel) {
    datesEl.textContent = window.AYLEN_PICKUP.formatWeekendDatesLabel();
  }
  var summaryEl = document.getElementById('pickupGoingSummary');
  if (summaryEl) {
    var going = (visibleLocations || []).filter(function(loc) {
      return window.AYLEN_PICKUP
        ? window.AYLEN_PICKUP.normalizePickupStatus(loc) === 'going'
        : !!loc.active;
    });
    if (!going.length) {
      summaryEl.innerHTML = '<span class="pickup-going-summary__empty">No confirmed AYLENSALE stops this weekend yet — check back soon.</span>';
    } else {
      summaryEl.innerHTML = going.map(function(loc) {
        return '<span class="pickup-going-summary__chip"><i class="fas fa-check-circle"></i> ' + escapeHtml(loc.name || 'Car boot') + '</span>';
      }).join('');
    }
  }
}

function initPickupCarouselDots(count) {
  var rail = document.getElementById('locationsRow');
  var dotsEl = document.getElementById('pickupCarouselDots');
  if (!rail || !dotsEl) return;
  dotsEl.innerHTML = '';
  if (count <= 1) {
    dotsEl.hidden = true;
    return;
  }
  dotsEl.hidden = false;
  for (var i = 0; i < count; i++) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'pickup-carousel-dot' + (i === 0 ? ' is-active' : '');
    dot.setAttribute('aria-label', 'Car boot ' + (i + 1));
    dot.setAttribute('data-index', String(i));
    dotsEl.appendChild(dot);
  }
  if (rail._pickupCarouselBound) return;
  rail._pickupCarouselBound = true;
  rail.addEventListener('scroll', function() {
    var cards = rail.querySelectorAll('.pickup-card');
    if (!cards.length) return;
    var idx = 0;
    var minDist = Infinity;
    var railRect = rail.getBoundingClientRect();
    cards.forEach(function(card, i) {
      var rect = card.getBoundingClientRect();
      var dist = Math.abs(rect.left - railRect.left);
      if (dist < minDist) {
        minDist = dist;
        idx = i;
      }
    });
    dotsEl.querySelectorAll('.pickup-carousel-dot').forEach(function(d, i) {
      d.classList.toggle('is-active', i === idx);
    });
  }, { passive: true });
  dotsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.pickup-carousel-dot');
    if (!btn) return;
    var idx = Number(btn.getAttribute('data-index') || 0);
    var card = rail.querySelectorAll('.pickup-card')[idx];
    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  });
}

async function fetchWeekendWeather(loc) {
  var coords = await geocodeLocationForWeather(loc);
  if (!coords || !window.AYLEN_WEATHER) return null;
  return window.AYLEN_WEATHER.fetchLiveForecast(
    coords.lat,
    coords.lng,
    pickupWeatherDays(loc.days || loc.day)
  );
}

async function updateLocationWeather(loc) {
  var el = document.getElementById('weather-' + String(loc.id).replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!el) return;
  var flightKey = String(loc.id || loc.name);

  try {
    var stored = storedWeatherForecast(loc);
    if (stored) renderLocationWeatherCard(el, stored, loc);
    else if (window.AYLEN_WEATHER) {
      el.innerHTML = window.AYLEN_WEATHER.renderLoadingHtml();
    }
    if (locationWeatherInFlight[flightKey]) return;

    var needsRefresh = !stored || !isWeatherFresh(loc);
    if (!needsRefresh) return;
    if (!canAttemptWeatherRefresh(loc)) {
      if (!stored && window.AYLEN_WEATHER) {
        el.innerHTML = window.AYLEN_WEATHER.renderFallbackHtml();
      }
      return;
    }
    await refreshLocationWeather(loc);
  } catch (e) {
    if (window.AYLEN_WEATHER) el.innerHTML = window.AYLEN_WEATHER.renderFallbackHtml();
    else el.textContent = 'Weather updating…';
  }
}

async function refreshLocationWeather(loc) {
  var key = String(loc.id || loc.name);
  if (locationWeatherInFlight[key]) return locationWeatherInFlight[key];
  markWeatherRefreshAttempt(loc);
  locationWeatherInFlight[key] = (async function() {
    var forecast = await fetchWeekendWeather(loc);
    var el = document.getElementById('weather-' + String(loc.id).replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (!forecast) {
      if (el && window.AYLEN_WEATHER) el.innerHTML = window.AYLEN_WEATHER.renderFallbackHtml();
      return null;
    }
    var coords = await geocodeLocationForWeather(loc);
    if (coords && coords.postcode) {
      loc.weatherPostcode = coords.postcode;
    }
    var update = window.AYLEN_WEATHER
      ? window.AYLEN_WEATHER.weatherUpdatePayload(forecast, loc)
      : {};
    if (coords) {
      update.lat = coords.lat;
      update.lng = coords.lng;
      update.lon = coords.lng;
      if (coords.postcode) update.weatherPostcode = coords.postcode;
    }
    Object.assign(loc, update);
    if (el) renderLocationWeatherCard(el, forecast, loc);
    if (window.FBDB && window.FBDB.saveLocationWeather && window.FBDB.isAdmin && window.FBDB.isAdmin()) {
      window.FBDB.saveLocationWeather(loc.id, update).catch(function() {});
    }
    return update;
  })();
  try {
    return await locationWeatherInFlight[key];
  } finally {
    delete locationWeatherInFlight[key];
  }
}

function ensureStorefrontInteraction() {
  if (window.AYLEN_LAZY && window.AYLEN_LAZY.ensureStorefrontInteraction) {
    return window.AYLEN_LAZY.ensureStorefrontInteraction();
  }
  return Promise.resolve(true);
}

document.addEventListener("DOMContentLoaded", function() {
  initSsrDeferredProductImages();
  var footerYear = document.getElementById('footerYear');
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());
  var footerCookie = document.getElementById('footerCookieSettings');
  if (footerCookie) {
    footerCookie.addEventListener('click', function(e) {
      e.preventDefault();
      ensureStorefrontInteraction().then(function() {
        if (window.AYLEN_COMPLIANCE && window.AYLEN_COMPLIANCE.openPreferences) {
          window.AYLEN_COMPLIANCE.openPreferences();
        }
      });
    });
  }
  var isProductPage = document.body.classList.contains('product-page');
  if (!isProductPage && !isMobileStorefrontLayout()) {
    prepareProductsGridLoadingShell();
    window.addEventListener('resize', function() {
      var w = window.innerWidth || 0;
      if (w === layoutResizeLastWidth) return;
      layoutResizeLastWidth = w;
      if (layoutResizeTimer) clearTimeout(layoutResizeTimer);
      layoutResizeTimer = setTimeout(function() {
        var grid = document.getElementById('productsGrid');
        if (grid && grid.classList.contains('products-grid--loading')) {
          applyProductsGridLoadingReserve(grid, catalogInitialPageSize());
        }
      }, 320);
    }, { passive: true });
  }
  if (!isProductPage && !prefersReducedMotion() && !(window.matchMedia && window.matchMedia('(max-width: 1024px)').matches)) {
    initSmoothReveal();
  }
  var runStorefrontBoot = async function() {
  await loadAllData();
  await loadAuctionDepositConfig();
  await loadAuctionWinnerPaymentConfig();
  applyCardFromUrl();
  await handleAuctionDepositReturn();
  await handleAuctionPaymentReturn();
  prefetchLoyaltyPortalIfNeeded();
  if (window.AYLEN_VIP_SHOP_BRIDGE && window.AYLEN_VIP_SHOP_BRIDGE.apply) {
    await window.AYLEN_VIP_SHOP_BRIDGE.apply();
  }
  validateCurrentUserCard();
  normalizeCart();
  if (isProductPage && typeof initProductDetailPage === 'function') {
    await initProductDetailPage();
  } else {
    renderProducts(false);
  }
  requestAnimationFrame(function() {
    document.dispatchEvent(new CustomEvent('aylen-catalog-ready'));
  });
  if (!isProductPage) renderTelegramLinks();
  updateCartCount();
  if (!isProductPage) {
    priceMode = 'retail';
    if (window.AYLEN_PERF && window.AYLEN_PERF.scheduleEngagement) {
      window.AYLEN_PERF.scheduleEngagement();
    } else {
      startEngagementTracking();
    }
    if (currentUser) {
      showWelcome(currentUser);
      setDiscountActiveUi(true);
      refreshStorefrontPricesAfterDiscount();
    }
    renderEbayPromo();
    var paintBelowFoldRest = function() {
      fillPickup();
      renderLocations();
      renderAuctions();
      scheduleWeatherAutoRefresh();
      if (document.documentElement.classList.contains('motion-ready')) refreshRevealItems();
    };
    if (isMobileStorefrontLayout()) {
      scheduleMobilePostCatalogWork(paintBelowFoldRest);
    } else {
      scheduleBelowFoldStorefrontWork(paintBelowFoldRest, storefrontBelowFoldTiming());
    }
    try {
      if (new URLSearchParams(window.location.search || '').get('priceList') === '1') {
        setTimeout(function() {
          if (window.AYLEN_STOREFRONT_FOLDS && window.AYLEN_STOREFRONT_FOLDS.togglePriceList) {
            window.AYLEN_STOREFRONT_FOLDS.togglePriceList(true);
          }
          if (typeof openPriceList === 'function') openPriceList();
        }, 500);
      }
    } catch (e) {}
  } else if (typeof renderTelegramLinks === 'function') {
    renderTelegramLinks();
  }
  };
  runStorefrontBoot();
});

function refreshVisibleWeatherCards() {
  var isAdmin = !!window.isAdminMode;
  sortedPickupLocations().filter(function(loc) {
    return window.AYLEN_PICKUP
      ? window.AYLEN_PICKUP.isPickupVisibleOnSite(loc, isAdmin)
      : (isAdmin || loc.showOnWebsite !== false);
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
  if (window.AYLEN_DISCOUNT && window.AYLEN_DISCOUNT.getDiscountPercent) {
    return window.AYLEN_DISCOUNT.getDiscountPercent();
  }
  return currentUser && Number(currentUser.discount || 0) > 0 ? Number(currentUser.discount || 0) : 0;
}

function getDiscountSummaryLabel(u) {
  u = u || currentUser;
  if (!u) return '';
  if (u.message) return u.message;
  var pct = getDiscountPercent();
  if (u.discountType === 'percent' && pct > 0) return pct + '% off every item';
  if (u.discountType === 'fixed' && Number(u.discountValue) > 0) {
    return '£' + Number(u.discountValue).toFixed(2) + ' off your order';
  }
  if (u.wholesaleAccess) return 'Special card pricing on all items';
  if (u.freeDelivery) return 'Free delivery on your order';
  if (pct > 0) return pct + '% off every item';
  return 'Your card discount is active';
}

function productEligibleForCardDiscount(product) {
  if (!product) return true;
  if (product.vipOnly || product.isVipOnly || product.vipStock) return false;
  var cat = String(product.category || product.cat || '').toLowerCase();
  if (cat.indexOf('vip') !== -1) return false;
  return true;
}

function buildCardDiscountPriceHtml(basePrice, product) {
  if (product && !productEligibleForCardDiscount(product)) return '';
  var pct = getDiscountPercent();
  var base = Number(basePrice);
  if (!(pct > 0) || !Number.isFinite(base) || base <= 0) return '';
  var your = base * (1 - pct / 100);
  var saved = base - your;
  return (
    '<div class="product-prices product-prices--card-discount">' +
      '<span class="price-was">Was £' + base.toFixed(2) + '</span>' +
      '<span class="price-your">Your price £' + your.toFixed(2) + '</span>' +
      '<span class="price-save-badge">−' + pct + '% · you save £' + saved.toFixed(2) + '</span>' +
    '</div>'
  );
}

function markCardInputApplied(on) {
  var input = document.getElementById('cardNumber');
  if (!input) return;
  input.classList.toggle('card-applied', !!on);
  if (on && currentUser && currentUser.card) {
    input.setAttribute('aria-label', 'Card ' + currentUser.card + ' applied');
  }
}

function syncCardExitButton(on) {
  var btn = document.getElementById('cardLogoutBtn');
  if (!btn) return;
  btn.hidden = !on;
  btn.classList.toggle('is-visible', !!on);
}

function setDiscountActiveUi(on) {
  document.body.classList.toggle('aylen-discount-active', !!on);
  markCardInputApplied(!!on);
  syncCardExitButton(!!on);
  var input = document.getElementById('cardNumber');
  if (!input) return;
  if (on) {
    input.readOnly = true;
  } else {
    input.readOnly = false;
    input.setAttribute('aria-label', 'Card number from your visit card');
  }
  withLazyLoyaltyPortal(function(portal) {
    if (portal.syncChipFromSession) portal.syncChipFromSession();
  });
}

function highlightDiscountApplied() {
  setDiscountActiveUi(true);
  var products = document.getElementById('products');
  if (products) {
    products.classList.add('discount-flash');
    setTimeout(function() { products.classList.remove('discount-flash'); }, 900);
    try {
      products.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      products.scrollIntoView(true);
    }
  }
}

function cleanClientCardCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}

function getCartUnitPrice(item) {
  var product = productById(item.id);
  var basePrice = product ? getProductBasePrice(product) : Number(item.basePrice || item.price || 0);
  if (window.AYLEN_DISCOUNT && window.AYLEN_DISCOUNT.hasWholesaleAccess && window.AYLEN_DISCOUNT.hasWholesaleAccess()) {
    var wholesale = product ? Number(product.wholesale || product.wholesalePrice || 0) : 0;
    if (wholesale > 0) basePrice = wholesale;
  }
  var discount = getDiscountPercent();
  if (discount > 0 && product && !productEligibleForCardDiscount(product)) discount = 0;
  if (discount > 0) basePrice = basePrice * (1 - discount / 100);
  return Number(basePrice.toFixed(2));
}

function refreshStorefrontPricesAfterDiscount() {
  renderProductsLastFingerprint = '';
  renderProducts(true);
  syncProductCardCartBadges();
}

function normalizeCart() {
  var raw = (Array.isArray(cart) ? cart : []).filter(function(item) {
    return item && item.id !== undefined && Number(item.qty || 0) > 0;
  });
  var merged = [];
  raw.forEach(function(item) {
    var product = productById(item.id);
    var canonicalId = product ? product.id : item.id;
    var existing = null;
    for (var i = 0; i < merged.length; i++) {
      if (sameId(merged[i].id, canonicalId)) { existing = merged[i]; break; }
    }
    var qty = Math.max(1, parseInt(item.qty, 10) || 1);
    if (existing) {
      existing.qty += qty;
    } else {
      merged.push({
        id: canonicalId,
        name: product ? product.name : (item.name || 'Product'),
        basePrice: 0,
        qty: qty,
        price: 0
      });
    }
  });
  cart = merged.map(function(item) {
    var product = productById(item.id);
    var basePrice = product ? getProductBasePrice(product) : Number(item.basePrice || item.price || 0);
    if (!Number.isFinite(basePrice) || basePrice < 0) basePrice = 0;
    var normalized = {
      id: product ? product.id : item.id,
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
  if (!window.AYLEN_DISCOUNT) {
    ensureStorefrontInteraction().then(function() {
      validateCurrentUserCard();
    }).catch(function() {});
    return true;
  }
  if (window.AYLEN_DISCOUNT && window.AYLEN_DISCOUNT.validateStoredSession) {
    var ok = window.AYLEN_DISCOUNT.validateStoredSession();
    if (!ok) {
      currentUser = null;
      setDiscountActiveUi(false);
      var banner = document.querySelector('.welcome-banner');
      if (banner) banner.remove();
      return false;
    }
    if (window.AYLEN_DISCOUNT.getSession) {
      var session = window.AYLEN_DISCOUNT.getSession();
      if (session) currentUser = session;
    }
    return true;
  }
  if (!currentUser || !currentUser.card) return true;
  var card = (typeof cardHolders !== 'undefined' && cardHolders) ? cardHolders[currentUser.card] : null;
  if (!card || card.status === 'blocked' || card.active === false) {
    currentUser = null;
    try { localStorage.removeItem('aylenuser'); } catch (e) {}
    setDiscountActiveUi(false);
    var oldBanner = document.querySelector('.welcome-banner');
    if (oldBanner) oldBanner.remove();
    return false;
  }
  return true;
}

async function loginCard() {
  var input = document.getElementById('cardNumber');
  if (!input) return;
  var num = cleanClientCardCode(input.value);
  input.value = num;
  if (!num) {
    notify('Enter a discount code', 'error');
    return;
  }

  if (window.AYLEN_DISCOUNT && window.AYLEN_DISCOUNT.validateCode) {
    input.disabled = true;
    try {
      var result = await window.AYLEN_DISCOUNT.validateCode(num);
      if (result.valid) {
        if (result.session) currentUser = result.session;
        if (!currentUser) {
          notify('Discount code accepted but session failed. Refresh and try again.', 'error');
          return;
        }
        try { localStorage.setItem('aylenuser', JSON.stringify(currentUser)); } catch (e) {}
        showWelcome(currentUser);
        highlightDiscountApplied();
        withLazyLoyaltyPortal(function(portal) {
          if (portal.onLogin) portal.onLogin(currentUser);
        });
        recalculateCartPrices();
        refreshStorefrontPricesAfterDiscount();
        renderCart();
        var pct = getDiscountPercent();
        notify(
          pct > 0
            ? ('Card #' + num + ' active — ' + pct + '% off. Prices updated below.')
            : (result.message || 'Discount applied'),
          'success'
        );
      } else {
        currentUser = null;
        try { localStorage.removeItem('aylenuser'); } catch (e) {}
        setDiscountActiveUi(false);
        var banner = document.querySelector('.welcome-banner');
        if (banner) banner.remove();
        recalculateCartPrices();
        refreshStorefrontPricesAfterDiscount();
        renderCart();
        notify(result.message || 'Invalid or expired discount code', 'error');
      }
    } finally {
      input.disabled = false;
    }
    return;
  }

  notify('Discount validation unavailable. Please try again later.', 'error');
}

function parseAuctionHashParams() {
  try {
    var hash = String(window.location.hash || '').replace(/^#/, '');
    var qIdx = hash.indexOf('?');
    if (qIdx < 0) return {};
    var params = new URLSearchParams(hash.slice(qIdx + 1));
    var out = {};
    params.forEach(function(v, k) { out[k] = v; });
    return out;
  } catch (e) {
    return {};
  }
}

function clearAuctionDepositHash() {
  try {
    var clean = (window.location.pathname || '/') + (window.location.search || '') + '#auctions';
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', clean);
    }
  } catch (e) {}
}

async function reloadAuctionCatalogAfterDeposit(auctionId) {
  await loadAuctionDepositConfig(true);
  if (typeof loadAllData === 'function') {
    try { await loadAllData(); } catch (e) {}
  }
  if (typeof renderAuctions === 'function') renderAuctions();
  if (auctionId && typeof refreshAuctionModalContent === 'function') {
    refreshAuctionModalContent(auctionId);
  }
}

async function handleAuctionPaymentReturn() {
  var params = parseAuctionHashParams();
  var paymentState = params.auction_payment;
  if (!paymentState) return;

  clearAuctionDepositHash();

  if (paymentState === 'cancelled') {
    if (typeof notify === 'function') notify('Winner payment cancelled.', 'info');
    return;
  }
  if (paymentState !== 'success') return;

  var sessionId = String(params.session_id || '').trim();
  if (!sessionId) {
    if (typeof notify === 'function') notify('Payment received — refreshing auction status…', 'info');
    if (typeof loadAllData === 'function') await loadAllData();
    if (typeof renderAuctions === 'function') renderAuctions();
    return;
  }

  if (typeof notify === 'function') notify('Confirming winner payment…', 'info');
  try {
    var response = await fetch('/api/auction-payment-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId })
    });
    var data = await response.json().catch(function() { return {}; });
    if (response.ok && data.paid) {
      if (typeof notify === 'function') {
        notify(data.alreadyPaid
          ? 'Payment already confirmed — you can claim collection.'
          : '✓ Payment received! You can now claim your winning lot.', 'success');
      }
      if (typeof loadAllData === 'function') await loadAllData();
      if (typeof renderAuctions === 'function') renderAuctions();
      if (data.auctionId && typeof refreshAuctionModalContent === 'function') {
        refreshAuctionModalContent(data.auctionId);
      }
      return;
    }
    if (response.status === 402) {
      if (typeof notify === 'function') notify('Payment is still processing — please wait and refresh.', 'info');
      return;
    }
    if (typeof notify === 'function') notify(data.error || 'Could not confirm payment yet.', 'warning');
  } catch (e) {
    if (typeof notify === 'function') notify('Network error confirming payment.', 'warning');
  }
}

async function handleAuctionDepositReturn() {
  var params = parseAuctionHashParams();
  var depositState = params.auction_deposit;
  if (!depositState) return;

  clearAuctionDepositHash();

  if (depositState === 'cancelled') {
    if (typeof notify === 'function') notify('Deposit payment cancelled.', 'info');
    return;
  }

  if (depositState !== 'success') return;

  var sessionId = String(params.session_id || '').trim();
  if (!sessionId) {
    if (typeof notify === 'function') {
      notify('Deposit received — refreshing auction status…', 'info');
    }
    await reloadAuctionCatalogAfterDeposit('');
    return;
  }

  if (typeof notify === 'function') notify('Confirming deposit payment…', 'info');
  try {
    var response = await fetch('/api/auction-deposit-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId })
    });
    var data = await response.json().catch(function() { return {}; });
    if (response.ok && data.paid) {
      if (typeof notify === 'function') {
        notify(data.alreadyPaid
          ? 'Deposit already confirmed — you can place bids.'
          : '✓ Deposit paid! You can now place bids on this lot.', 'success');
      }
      await reloadAuctionCatalogAfterDeposit(data.auctionId || '');
      return;
    }
    if (response.status === 402) {
      if (typeof notify === 'function') {
        notify('Payment is still processing — please wait a moment and refresh.', 'info');
      }
      return;
    }
    if (typeof notify === 'function') {
      notify(data.error || 'Could not confirm deposit yet. Refresh in a moment.', 'warning');
    }
  } catch (e) {
    if (typeof notify === 'function') {
      notify('Network error confirming deposit. Please refresh shortly.', 'warning');
    }
  }
}

function applyCardFromUrl() {
  try {
    var params = new URLSearchParams(window.location.search || '');
    var cardCode = cleanClientCardCode(params.get('card'));
    if (!cardCode) return;
    var input = document.getElementById('cardNumber');
    if (input) input.value = cardCode;
    loginCard();
  } catch (e) {
    console.warn('Could not apply card from URL:', e.message);
  }
}

function showWelcome(u) {
  var old = document.querySelector('.welcome-banner');
  if (old) old.remove();
  var cardCode = u && u.card ? String(u.card) : '';
  var input = document.getElementById('cardNumber');
  if (input && cardCode) input.value = cardCode;
  setDiscountActiveUi(true);
  withLazyLoyaltyPortal(function(portal) {
    if (portal.refresh) portal.refresh(false);
  });
}

function logout() {
  currentUser = null;
  if (window.AYLEN_DISCOUNT && window.AYLEN_DISCOUNT.clearDiscount) {
    window.AYLEN_DISCOUNT.clearDiscount();
  }
  localStorage.removeItem('aylenuser');
  var b = document.querySelector('.welcome-banner');
  if (b) b.remove();
  setDiscountActiveUi(false);
  withLazyLoyaltyPortal(function(portal) {
    if (portal.onLogout) portal.onLogout();
  });
  var input = document.getElementById('cardNumber');
  if (input) input.value = '';
  recalculateCartPrices();
  refreshStorefrontPricesAfterDiscount();
  renderCart();
}

function renderLocations() {
  if (window.AYLEN_PERF && window.AYLEN_PERF.shouldSkipStorefrontRender && window.AYLEN_PERF.shouldSkipStorefrontRender()) return;
  var row = document.getElementById('locationsRow');
  if (!row) return;
  row.classList.add('pickup-cards-rail');
  row.innerHTML = '';
  var isAdmin = !!window.isAdminMode;
  var visibleLocations = sortedPickupLocations().filter(function(loc) {
    return window.AYLEN_PICKUP
      ? window.AYLEN_PICKUP.isPickupVisibleOnSite(loc, isAdmin)
      : (isAdmin || loc.showOnWebsite !== false);
  });
  updatePickupSectionMeta(visibleLocations);
  if (!visibleLocations.length) {
    row.innerHTML = '<div class="pickup-empty">No car boot locations yet. Follow AYLENSALE for weekend updates.</div>';
    initPickupCarouselDots(0);
    return;
  }
  for (var i = 0; i < visibleLocations.length; i++) {
    var loc = visibleLocations[i];
    if (window.AYLEN_PICKUP && window.AYLEN_PICKUP.syncPickupStatusFields) {
      window.AYLEN_PICKUP.syncPickupStatusFields(loc);
    }
    var status = window.AYLEN_PICKUP ? window.AYLEN_PICKUP.normalizePickupStatus(loc) : (loc.active ? 'going' : 'not_confirmed');
    var meta = window.AYLEN_PICKUP ? window.AYLEN_PICKUP.pickupStatusMeta(status) : { cardClass: '', label: '' };
    var daysShort = window.AYLEN_PICKUP && window.AYLEN_PICKUP.formatDaysShort
      ? window.AYLEN_PICKUP.formatDaysShort(loc.days || loc.day)
      : (loc.days || loc.day || '');
    var c = document.createElement('article');
    c.className = 'location-card pickup-card ' + meta.cardClass;
    c.setAttribute('data-pickup-status', status);
    var h = '';
    var locRaw = loc.photoUrl || loc.imageUrl || LOCATION_FALLBACK_IMAGE;
    var locationImage = pickupCardImageSrc(locRaw);
    var pickupDims = isMobileStorefrontLayout() ? { w: 360, h: 270 } : { w: 460, h: 345 };
    h += '<div class="pickup-card-media">';
    if (status === 'going') {
      h += '<span class="pickup-going-badge pickup-going-badge--overlay">' + escapeHtml(meta.badge || 'WE ARE GOING') + '</span>';
    }
    h += '<img class="pickup-card-photo" src="' + escapeHtml(locationImage) + '" alt="' + escapeHtml(loc.name) + ' car boot"' +
      ' width="' + pickupDims.w + '" height="' + pickupDims.h + '" loading="lazy" decoding="async"' + antiTheftImageAttrs() + storefrontImageDataAttrs(locRaw, LOCATION_FALLBACK_IMAGE) + '>';
    h += '<span class="pickup-card-media-badge"><i class="fas fa-store"></i> Car Boot</span>';
    h += '</div>';
    h += '<div class="pickup-card-body">';
    h += '<div class="loc-name">' + escapeHtml(loc.name) + '</div>';
    if (loc.city) h += '<div class="loc-city"><i class="fas fa-city"></i> ' + escapeHtml(loc.city) + '</div>';
    if (loc.postcode) h += '<div class="loc-postcode"><i class="fas fa-envelope"></i> ' + escapeHtml(loc.postcode) + '</div>';
    if (loc.address) h += '<div class="loc-address"><i class="fas fa-location-dot"></i> ' + escapeHtml(loc.address) + '</div>';
    h += '<div class="loc-day"><i class="fas fa-calendar-week"></i> ' + escapeHtml(daysShort) +
      (loc.openingTime || loc.time ? ' · ' + escapeHtml(loc.openingTime || loc.time) : '') + '</div>';
    var desc = String(loc.description || loc.desc || '').trim();
    if (desc) h += '<p class="pickup-card-desc">' + escapeHtml(desc) + '</p>';
    if (loc.note) h += '<div class="pickup-card-note"><i class="fas fa-note-sticky"></i> ' + escapeHtml(loc.note) + '</div>';
    if (status === 'going') {
      h += '<div class="pickup-status-banner pickup-status-banner--going"><i class="fas fa-circle-check"></i> ' + escapeHtml(meta.label) + '</div>';
    } else if (status === 'possible') {
      h += '<div class="pickup-status-banner"><i class="fas fa-circle-question"></i> ' + escapeHtml(meta.label) + '</div>';
    } else {
      h += '<div class="pickup-status-banner"><i class="fas fa-circle"></i> ' + escapeHtml(meta.label) + '</div>';
    }
    h += '<div class="weather-wrap" id="weather-' + String(loc.id).replace(/[^a-zA-Z0-9_-]/g, '_') + '">' +
      (window.AYLEN_WEATHER ? window.AYLEN_WEATHER.renderLoadingHtml() : 'Loading weather…') +
      '</div>';
    h += '<a class="map-link" href="' + escapeHtml(loc.mapLink || '#') + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-map"></i> Open in Maps</a>';
    h += '</div>';
    c.innerHTML = h;
    row.appendChild(c);
    var storedForecast = storedWeatherForecast(loc);
    if (storedForecast) applyPickupWeatherRiskBadge(c, loc, storedForecast);
    updateLocationWeather(loc);
  }
  initPickupCarouselDots(visibleLocations.length);
  refreshRevealItems();
}

function sortedPickupLocations() {
  var list = Array.isArray(locations) ? locations.slice() : [];
  if (window.AYLEN_PICKUP && window.AYLEN_PICKUP.sortPickupLocations) {
    return window.AYLEN_PICKUP.sortPickupLocations(list);
  }
  return list.sort(function(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

async function setPickupWeekendStatus(id, status) {
  if (!window.FBDB || !window.FBDB.isAdmin || !window.FBDB.isAdmin()) {
    notify('Log in to admin to change pickup status (Ctrl+Shift+A).', 'info');
    if (typeof showAdminLoginModal === 'function') showAdminLoginModal();
    return;
  }
  var loc = locations.find(function(l) { return sameId(l.id, id); });
  if (!loc) return;
  var next = String(status || 'not_confirmed').toLowerCase();
  if (next === 'notconfirmed') next = 'not_confirmed';
  if (next !== 'going' && next !== 'possible' && next !== 'not_confirmed') return;

  loc.status = next;
  if (window.AYLEN_PICKUP && window.AYLEN_PICKUP.syncPickupStatusFields) {
    window.AYLEN_PICKUP.syncPickupStatusFields(loc);
  } else {
    loc.active = next === 'going';
    loc.goingThisWeekend = loc.active;
  }

  try {
    if (window.FBDB && window.FBDB.saveLocation) {
      var saved = await window.FBDB.saveLocation(loc);
      if (saved) {
        if (window.AYLEN_PICKUP && window.AYLEN_PICKUP.hydrateLocationRecord) {
          saved = window.AYLEN_PICKUP.hydrateLocationRecord(saved);
        }
        var idx = locations.findIndex(function(l) { return sameId(l.id, saved.id); });
        if (idx >= 0) locations[idx] = saved;
      }
    }
    renderLocations();
    fillPickup();
    if (window.AYLEN_WEATHER && window.AYLEN_WEATHER.clearCache) {
      window.AYLEN_WEATHER.clearCache();
    }
    refreshVisibleWeatherCards();
    if (window.AyelenAdminDashboard && window.AyelenAdminDashboard.isOpen && window.AyelenAdminDashboard.isOpen()) {
      if (window.AyelenAdminDashboard.refreshLocations) {
        window.AyelenAdminDashboard.refreshLocations();
      }
    }
    var msg = next === 'going'
      ? 'Going ON — green card live on Weekend Car Boots'
      : (next === 'possible' ? 'Marked POSSIBLE' : 'Going OFF — grey card on shop');
    notify(msg, 'success');
  } catch (error) {
    notify('Could not save pickup status: ' + (error.message || error), 'error');
  }
}

function markGoingToLocation(id) {
  if (!window.FBDB || !window.FBDB.isAdmin || !window.FBDB.isAdmin()) {
    notify('Pickup locations are managed in Admin → Locations.', 'info');
    return;
  }
  var loc = locations.find(function(l) { return sameId(l.id, id); });
  if (!loc) return;
  var cur = window.AYLEN_PICKUP ? window.AYLEN_PICKUP.normalizePickupStatus(loc) : (loc.active ? 'going' : 'not_confirmed');
  setPickupWeekendStatus(id, cur === 'going' ? 'not_confirmed' : 'going');
}

window.setPickupWeekendStatus = setPickupWeekendStatus;
window.markGoingToLocation = markGoingToLocation;

window.AYLEN_CARD_UI_VERSION = 6;

var PRODUCT_CARD_TITLE_MAX_CHARS = 80;

var renderProductsDebounceTimer;
var renderProductsLastFingerprint = '';
var renderAuctionsStructuralFp = '';
var layoutResizeLastWidth = 0;
var layoutResizeTimer;

function storefrontProductsFingerprint(slice) {
  slice = slice || { page: products || [] };
  var page = slice.page || [];
  var parts = [String(page.length), String(slice.total || page.length)];
  for (var i = 0; i < page.length; i++) {
    var p = page[i];
    parts.push(String(p.id) + ':' + String(p.stock || 0) + ':' + String(p.price || '') + ':' + String((p.images && p.images[0]) || ''));
  }
  return parts.join('|');
}

function shouldDelayMobileSsrCatalogRender(forceRender) {
  if (forceRender) return false;
  if (!isMobileStorefrontLayout()) return false;
  if (window._aylenMobileSsrCatalogHydrated) return false;
  var grid = document.getElementById('productsGrid');
  return !!(grid && grid.querySelector('[data-ssr-hydrate="1"]'));
}

function renderProducts(forceRender) {
  if (shouldDelayMobileSsrCatalogRender(forceRender)) {
    scheduleBelowFoldStorefrontWork(function() {
      renderProducts(true);
    }, storefrontBelowFoldTiming());
    return;
  }
  if (!forceRender && window.AYLEN_PERF && window.AYLEN_PERF.shouldSkipStorefrontRender && window.AYLEN_PERF.shouldSkipStorefrontRender()) return;
  if (renderProductsDebounceTimer) {
    clearTimeout(renderProductsDebounceTimer);
    renderProductsDebounceTimer = null;
  }
  if (!forceRender) {
    renderProductsDebounceTimer = setTimeout(function() {
      renderProductsDebounceTimer = null;
      renderProducts(true);
    }, 120);
    return;
  }
  renderProductsLastFingerprint = '';
  renderProductsNow();
}

function upgradeSsrScrollGallery(card, p) {
  if (!card || !p || !p.images || p.images.length <= 1) return;
  var track = card.querySelector('.product-image-scroll-track');
  if (!track || track.getAttribute('data-ssr-upgraded') === '1') return;
  for (var j = 1; j < p.images.length; j++) {
    var src = productCardImageSrc(p.images[j]);
    var slide = document.createElement('div');
    slide.className = 'product-image-slide';
    var img = document.createElement('img');
    img.setAttribute('data-main-product-image', String(p.id));
    img.setAttribute('data-slide-index', String(j));
    img.setAttribute('data-deferred-src', src);
    img.src = DEFERRED_GALLERY_IMG;
    img.alt = '';
    var dims = productCardDisplayDims();
    img.width = dims.w;
    img.height = dims.h;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.setAttribute('fetchpriority', 'low');
    slide.appendChild(img);
    track.appendChild(slide);
  }
  track.setAttribute('data-ssr-upgraded', '1');
}

function buildSsrHydrateCardMap(grid) {
  var map = Object.create(null);
  if (!grid) return map;
  grid.querySelectorAll('.product-card-grid-item[data-ssr-hydrate="1"]').forEach(function(el) {
    var pid = el.getAttribute('data-product-id');
    var key = productImageKey(pid);
    if (key && !map[key]) map[key] = el;
  });
  return map;
}

function pruneDuplicateSsrCatalogCards(grid) {
  if (!grid) return;
  var seen = Object.create(null);
  grid.querySelectorAll('.product-card-grid-item[data-ssr-hydrate="1"]').forEach(function(el) {
    var key = productImageKey(el.getAttribute('data-product-id'));
    if (!key) return;
    if (seen[key]) el.remove();
    else seen[key] = true;
  });
}

function mobileSsrCatalogIsComplete(grid, pageLength) {
  if (!grid || !pageLength || !isMobileStorefrontLayout()) return false;
  if (!grid.querySelector('[data-ssr-hydrate="1"]')) return false;
  return grid.querySelectorAll('.product-card-grid-item[data-ssr-hydrate="1"]').length >= pageLength;
}

function scheduleMobilePostCatalogWork(fn) {
  scheduleBelowFoldStorefrontWork(fn, { idleTimeout: 10000, delayAfterLoad: 1500 });
}

function scheduleMobileBelowFoldCatalogWork(fn) {
  scheduleBelowFoldStorefrontWork(function() {
    waitForDeferredShellCss(2500).then(fn);
  }, { idleTimeout: 8000, delayAfterLoad: 1500 });
}

function finalizeMobileSsrCatalog(grid, catalogSlice) {
  if (window.AYLEN_CATALOG) {
    window.AYLEN_CATALOG.ensureToolbar();
    window.AYLEN_CATALOG.renderFooter(catalogSlice);
  }
  syncProductCardCartBadges();
  scheduleMobilePostCatalogWork(function() {
    renderEngagementStats();
    if (window.AYLEN_CATALOG) window.AYLEN_CATALOG.refreshCategories();
    renderNewArrivals();
    updateProductViewerBadges();
    if (productsRevealInitialized) {
      grid.querySelectorAll('.product-card.reveal-item').forEach(function(card) {
        card.classList.add('is-visible');
      });
    } else {
      productsRevealInitialized = true;
    }
    ensureStorefrontInteraction().then(function() {
      if (window.AYLEN_SEO && window.AYLEN_SEO.refreshProductSchema) {
        window.AYLEN_SEO.refreshProductSchema(products);
      }
    });
  });
}

function scheduleSsrScrollGalleryUpgrade(card, product) {
  if (!card || !product) return;
  if (isMobileStorefrontLayout()) return;
  var run = function() {
    upgradeSsrScrollGallery(card, product);
    initProductCardScrollGalleries(card);
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 3000);
  }
}

function renderProductsNow() {
  var grid = document.getElementById('productsGrid');
  if (!grid) return;
  if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.dedupeProductionProducts && products.length > 1) {
    var dedupedProducts = window.AYLEN_PRODUCTION.dedupeProductionProducts(products);
    if (dedupedProducts.length !== products.length) products = dedupedProducts;
  }
  pruneDuplicateSsrCatalogCards(grid);
  if (window.AYLEN_PRODUCTION && !window.AYLEN_PRODUCTION.state.productsHydrated && !products.length) {
    if (!grid.querySelector('[data-ssr-lcp="1"]')) {
      renderProductSkeletonGrid();
    }
    return;
  }
  if (window.AYLEN_CATALOG) {
    window.AYLEN_CATALOG.ensureToolbar();
    window.AYLEN_CATALOG.refreshCategories();
  }
  var catalogSlice = window.AYLEN_CATALOG
    ? window.AYLEN_CATALOG.getSlice()
    : { page: products, total: products.length, showing: products.length, hasMore: false };
  var fingerprint = storefrontProductsFingerprint(catalogSlice);
  if (fingerprint === renderProductsLastFingerprint && grid.querySelector('.product-card-grid-item')) {
    if (window.AYLEN_CATALOG) window.AYLEN_CATALOG.renderFooter(catalogSlice);
    syncProductCardCartBadges();
    return;
  }
  if (mobileSsrCatalogIsComplete(grid, catalogSlice.page.length)) {
    renderProductsLastFingerprint = fingerprint;
    window._aylenMobileSsrCatalogHydrated = true;
    finalizeMobileSsrCatalog(grid, catalogSlice);
    return;
  }
  renderProductsLastFingerprint = fingerprint;
  var ssrExisting = grid.querySelector('[data-ssr-lcp="1"]');
  var ssrPid = ssrExisting ? ssrExisting.getAttribute('data-product-id') : '';
  var firstProduct = catalogSlice.page[0];
  var keepSsrCard = !!(ssrExisting && firstProduct && ssrPid && productImageKey(firstProduct.id) === ssrPid);
  var hasSsrHydrate = !!grid.querySelector('[data-ssr-hydrate="1"]');
  var ssrHydrateMap = hasSsrHydrate ? buildSsrHydrateCardMap(grid) : null;
  var fragment = document.createDocumentFragment();
  var visibleCount = 0;
  for (var i = 0; i < catalogSlice.page.length; i++) {
    var p = catalogSlice.page[i];
    var ssrPidMatch = productImageKey(p.id);
    var ssrCard = ssrHydrateMap ? ssrHydrateMap[ssrPidMatch] : null;
    if (ssrCard) {
      visibleCount++;
      continue;
    }
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
    
    var eagerLimit = MOBILE_SSR_EAGER_IMAGE_COUNT;
    var lazyAttrs = productCardEagerImgAttrs(visibleCount, eagerLimit);
    
    var desc = p.description || p.desc || '';
    var isComingSoon = p.status === 'coming_soon' || p.stockStatus === 'coming_soon' || p.badge === 'COMING SOON';
    var detailUrl = typeof productPageUrl === 'function' ? productPageUrl(p.id) : '#products';
    
    var h = '<div class="product-card-media">';
    h += '<div class="product-image-container product-card-hit">';
    h += renderProductCardImageMedia(p, activeIndex, lazyAttrs, isComingSoon, detailUrl, visibleCount, eagerLimit);
    if (isComingSoon) {
      h += '<div class="product-coming-soon-overlay">COMING SOON<span>Reserve before release</span></div>';
    }
    h += '<div class="product-image-overlay">';
    var autoBadge = isComingSoon ? 'COMING SOON' : productAutoBadge(p);
    if (autoBadge) {
      var badgeClass = 'product-card-badge--default';
      if (autoBadge === 'NEW' || autoBadge === 'THIS WEEK') badgeClass = 'product-card-badge--new';
      else if (autoBadge === 'SALE') badgeClass = 'product-card-badge--sale';
      else if (autoBadge === 'HOT') badgeClass = 'product-card-badge--hot';
      h += '<span class="product-card-badge ' + badgeClass + '">' + escapeHtml(autoBadge) + '</span>';
    } else {
      h += '<span></span>';
    }
    h += '<div class="product-image-actions">';
    if (window.isAdminMode && p.active === false) {
      h += '<span class="product-card-badge product-card-badge--hidden">HIDDEN</span>';
    }
    h += renderProductCardCartBadge(p, isComingSoon);
    h += '</div></div>';
    if (p.images && p.images.length > 1 && !useMobileProductScrollGallery()) {
      h += '<button type="button" class="product-arrow left" data-carousel-prev="1" data-action="carousel-prev" data-product-id="' + escapeHtml(String(p.id)) + '" aria-label="Previous photo"><i class="fas fa-chevron-left"></i></button>';
      h += '<button type="button" class="product-arrow right" data-carousel-next="1" data-action="carousel-next" data-product-id="' + escapeHtml(String(p.id)) + '" aria-label="Next photo"><i class="fas fa-chevron-right"></i></button>';
    }
    h += '</div>';
    if (p.images && p.images.length > 1 && !useMobileProductScrollGallery()) {
      h += '<div class="product-thumbnails">';
      var maxThumbs = 4;
      var visibleThumbs = Math.min(p.images.length, maxThumbs);
      for (var j = 0; j < visibleThumbs; j++) {
        var activeClass = (j === activeIndex) ? ' active' : '';
        var thumbRaw = (p.images[j] && p.images[j].trim() !== '') ? p.images[j] : THUMB_FALLBACK_IMAGE;
        var thumbSrc = productCardImageSrc(thumbRaw);
        h += '<img src="' + escapeHtml(thumbSrc) + '" class="product-thumb' + activeClass + '" width="48" height="48" data-product-thumb="' + escapeHtml(p.id) + '" data-thumb-index="' + j + '" data-action="select-image" data-product-id="' + escapeHtml(String(p.id)) + '" data-index="' + j + '" loading="lazy" decoding="async"' + antiTheftImageAttrs() + storefrontImageDataAttrs(thumbRaw, THUMB_FALLBACK_IMAGE) + ' alt="Photo ' + (j + 1) + '">';
      }
      if (p.images.length > maxThumbs) {
        h += '<div class="product-thumb more" onclick="selectProductImage(' + jsInlineArg(p.id) + ',' + maxThumbs + ')">+' + (p.images.length - maxThumbs) + '</div>';
      }
      h += '</div>';
    }
    h += '<div class="product-card-title-block">';
    h += renderProductCardTitle(p, detailUrl);
    h += '</div>';
    h += '</div>';
    h += '<div class="product-card-body product-info">';
    h += renderProductCardSubtitle(p);
    var policyId = String(p.policyId || p.listingPolicyId || '').trim();
    var hasDetailContent = !!String(desc || '').trim() || !!policyId;
    h += '<div class="product-card-pricing">';
    
    // Price logic with discount support
    var retailPrice = parseFloat(p.price || p.retail || 0);
    var hasDiscount = p.discount && p.discount > 0;
    var salePrice = hasDiscount ? parseFloat(p.salePrice || retailPrice) : retailPrice;
    var displayPrice = salePrice;

    var cardPriceHtml = buildCardDiscountPriceHtml(displayPrice, p);
    if (cardPriceHtml) {
      h += cardPriceHtml;
    } else {
      h += '<div class="product-prices">';
      if (hasDiscount) {
        h += '<span class="price-original">£' + retailPrice.toFixed(2) + '</span>';
        h += '<span class="price-sale">£' + salePrice.toFixed(2) + '</span>';
        h += '<span class="price-badge-discount">-' + p.discount + '%</span>';
      } else {
        h += '<span class="price-main">£' + retailPrice.toFixed(2) + '</span>';
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
      h += '<button type="button" class="btn-action secondary" data-action="notify" data-product-id="' + escapeHtml(String(p.id)) + '" data-channel="email"><i class="fas fa-bell"></i> Reserve</button>';
    } else if (parseInt(p.stock) === 0) {
      h += '<div class="out-of-stock">Out of stock</div>';
    } else {
      h += '<button type="button" class="btn-action primary" data-action="add-to-cart" data-action-stop="1" data-product-id="' + escapeHtml(String(p.id)) + '"><i class="fas fa-cart-plus"></i> Add to Cart</button>';
    }
    h += '<button type="button" class="btn-action secondary product-view-details" data-action="product-modal" data-product-id="' + escapeHtml(String(p.id)) + '"><i class="fas fa-expand"></i> Quick view</button>';
    h += '</div>';
    if (hasDetailContent) {
      h += '<div class="product-card-detail-links">';
      h += '<button type="button" class="product-card-link-btn" onclick="openProductCardDetailsModal(' + jsInlineArg(p.id) + ');return false"><i class="fas fa-file-lines"></i> Condition &amp; Policy</button>';
      if (String(desc || '').trim()) {
        var detailsName = String(p.name || 'Product').trim();
        if (detailsName.length > 30) detailsName = detailsName.slice(0, 29).trim() + '…';
        h += '<a href="' + escapeHtml(detailUrl) + '" class="product-card-link-btn product-card-link-btn--quiet" onclick="trackProductView(' + jsInlineArg(p.id) + ')">' + escapeHtml(detailsName + ' — details') + '</a>';
      }
      h += '</div>';
    }
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
    stripHeavyTextFromProductCard(card);
    fragment.appendChild(card);
  }
  function appendProductsToGrid() {
    grid.querySelectorAll('.product-skeleton').forEach(function(el) {
      el.remove();
    });
    grid.querySelectorAll('.product-card-grid-item:not([data-ssr-hydrate="1"])').forEach(function(el) {
      el.remove();
    });
    while (fragment.firstChild) {
      grid.appendChild(fragment.firstChild);
    }
  }
  function afterProductsGridSwap() {
    if (window.AYLEN_ICONS) window.AYLEN_ICONS.upgrade(grid);
    if (isMobileStorefrontLayout()) {
      if (visibleCount > 0) {
        if (window.AYLEN_CATALOG) window.AYLEN_CATALOG.renderFooter(catalogSlice);
        syncProductCardCartBadges();
      }
      finalizeProductsGridSwap(grid, function() {
        finalizeMobileSsrCatalog(grid, catalogSlice);
      });
      return;
    }
    if (visibleCount > 0) {
      scheduleProductCardScrollGalleries(grid);
      measuredProductCardHeight = 0;
      var firstCard = grid.querySelector('.product-card-grid-item');
      if (firstCard) {
        var cardBox = Math.ceil(firstCard.getBoundingClientRect().height);
        if (cardBox > 0 && cardBox < 900) measuredProductCardHeight = cardBox;
      }
      reserveProductsGridHeight(grid, visibleCount);
    }
    if (window.AYLEN_CATALOG) {
      window.AYLEN_CATALOG.renderFooter(catalogSlice);
    }
    syncProductsSectionReserve(document.getElementById('products'), measureProductsSectionHeight(), true);
    finalizeProductsGridSwap(grid, function() {
      finalizeProductsSectionLayout(function() {
        renderNewArrivals();
        renderEngagementStats();
        updateProductViewerBadges();
        syncProductCardCartBadges();
        refreshRevealItems();
        if (productsRevealInitialized) {
          grid.querySelectorAll('.product-card.reveal-item').forEach(function(card) {
            card.classList.add('is-visible');
          });
        } else {
          productsRevealInitialized = true;
        }
        ensureStorefrontInteraction().then(function() {
          if (window.AYLEN_SEO && window.AYLEN_SEO.refreshProductSchema) {
            window.AYLEN_SEO.refreshProductSchema(products);
          }
        });
      });
    });
  }

  if (visibleCount === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;background:rgba(18,27,48,.88);border-radius:12px;padding:32px;color:#94a3b8;border:1px dashed rgba(255,255,255,.12)">' +
      '<h3 style="color:#fff;margin-bottom:8px">No products available</h3>' +
      '<p>Products will appear here when they are added in Firestore.</p>' +
    '</div>';
    afterProductsGridSwap();
    return;
  }

  var section = document.getElementById('products');
  lockProductsSectionShell();
  if (isMobileStorefrontLayout()) {
    pinMobileProductsLayoutReserve(section, grid, visibleCount);
  } else {
    reserveProductsGridHeight(grid, visibleCount);
    var pinGrid = Math.ceil(Math.max(
      grid.getBoundingClientRect().height,
      parseInt(grid.style.getPropertyValue('--products-grid-reserved-h'), 10) || 0,
      estimateProductsGridHeight(grid, visibleCount)
    ));
    syncProductsGridReserveVar(grid, pinGrid);
    if (section) {
      syncProductsSectionReserve(section, Math.max(measureProductsSectionHeight(), pinGrid + 320), false);
    }
  }
  if (keepSsrCard || hasSsrHydrate) {
    appendProductsToGrid();
    if (keepSsrCard) scheduleSsrScrollGalleryUpgrade(ssrExisting, firstProduct);
  } else {
    grid.replaceChildren(fragment);
  }
  reserveProductsGridHeight(grid, visibleCount);
  if (isMobileStorefrontLayout()) window._aylenMobileSsrCatalogHydrated = true;
  afterProductsGridSwap();
}

function activePriceListProducts() {
  return (Array.isArray(priceListItems) ? priceListItems.slice() : []).filter(function(item) {
    return item && item.visible !== false;
  }).sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function priceListFromShopProducts() {
  return (Array.isArray(products) ? products : []).filter(function(p) {
    return p && p.active !== false && p.hidden !== true;
  }).map(function(p, i) {
    var imgs = Array.isArray(p.images) ? p.images.slice() : (p.photoUrl ? [p.photoUrl] : []);
    return {
      id: 'shop_' + String(p.id || i),
      sourceProductId: p.id,
      name: p.name || p.title || 'Product',
      desc: p.desc || p.description || '',
      images: imgs,
      photoUrl: imgs[0] || '',
      retailPrice: Number(p.price || p.retailPrice || 0),
      minQty: 1,
      stockStatus: Number(p.quantity) > 0 ? 'available' : 'sold',
      visible: true,
      sortOrder: i
    };
  });
}

async function ensurePriceListReady() {
  if (activePriceListProducts().length) return activePriceListProducts();
  if (window.FBDB && window.FBDB.loadPriceListItems) {
    try {
      var items = await window.FBDB.loadPriceListItems();
      if (Array.isArray(items)) {
        priceListItems = items;
      }
    } catch (e) {
      console.warn('Price list reload failed:', e.message || e);
    }
  }
  var list = activePriceListProducts();
  if (list.length) return list;
  return priceListFromShopProducts();
}

function resolvedPriceListProducts() {
  var list = activePriceListProducts();
  return list.length ? list : priceListFromShopProducts();
}

function absoluteSiteUrl(path) {
  var origin = 'https://aylensale.com';
  try {
    if (window.location && window.location.origin) origin = window.location.origin;
  } catch (e) {}
  if (!path) return origin;
  if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0) return path;
  if (path.indexOf('//') === 0) return 'https:' + path;
  return origin + (path.indexOf('/') === 0 ? path : '/' + path);
}

function priceListExportImageSrc(raw) {
  var src = raw && String(raw).trim() ? raw : PRODUCT_FALLBACK_IMAGE;
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productDetailMainUrl) {
    src = window.AYLEN_IMAGES.productDetailMainUrl(src);
  } else {
    src = productCardImageFullUrl(src);
  }
  return absoluteSiteUrl(src);
}

function priceListProductHtml(p) {
  var raw = (p.images && p.images.length > 0 && p.images[0]) ? p.images[0] : (p.photoUrl || '');
  if (!String(raw || '').trim()) raw = PRODUCT_FALLBACK_IMAGE;
  var img = priceListExportImageSrc(raw);
  var retailPrice = Number(p.retailPrice || p.retail || p.price || 0);
  var minQty = Number(p.minQty || 1);
  var stockStatus = p.stockStatus || 'available';
  return '<div class="pl-card">' +
    '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.name) + '" width="320" height="220" loading="eager" decoding="async"' + storefrontImageDataAttrs(raw) + '>' +
    '<div class="pl-info">' +
      '<h3>' + escapeHtml(p.name || 'Product') + '</h3>' +
      '<p>' + escapeHtml(p.desc || p.description || '') + '</p>' +
      '<div class="pl-prices">' +
        '<b>£' + retailPrice.toFixed(2) + '</b>' +
        '<span>Min qty: ' + minQty + '</span>' +
        '<span>Status: ' + escapeHtml(stockStatus) + '</span>' +
        (p.note ? '<span>Note: ' + escapeHtml(p.note) + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

function buildPriceListHtml(opts) {
  opts = opts || {};
  var list = resolvedPriceListProducts();
  var generatedAt = new Date().toLocaleString('en-GB');
  var cards = list.map(priceListProductHtml).join('');
  var baseHref = absoluteSiteUrl('/');
  var autoPrintScript = opts.autoPrint
    ? '<script>(function(){function run(){try{window.focus();window.print()}catch(e){}}function wait(){var imgs=Array.prototype.slice.call(document.images||[]),n=imgs.length;if(!n){run();return}var left=n;function done(){left--;if(left<=0)run()}imgs.forEach(function(img){if(img.complete)done();else{img.addEventListener("load",done,{once:true});img.addEventListener("error",done,{once:true})}});setTimeout(run,12000)}if(document.readyState==="complete")wait();else window.addEventListener("load",wait,{once:true})})();<\/script>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<base href="' + escapeHtml(baseHref) + '">' +
    '<title>AYLENSALE Price List</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;background:#f4f6f8;color:#1a1a2e;margin:0;padding:20px}' +
      '.pl-header{background:linear-gradient(135deg,#e94560,#1a1a2e);color:#fff;border-radius:14px;padding:22px;margin-bottom:18px;text-align:center}' +
      '.pl-header h1{margin:0 0 6px;font-size:28px;letter-spacing:1px}.pl-header p{margin:0;opacity:.9}' +
      '.pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}' +
      '.pl-card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08);break-inside:avoid;page-break-inside:avoid}' +
      '.pl-card img{width:100%;height:190px;object-fit:cover;background:#1a1a2e}' +
      '.pl-info{padding:12px}.pl-info h3{margin:0 0 6px;font-size:16px}.pl-info p{margin:0 0 10px;color:#666;font-size:13px;min-height:34px}' +
      '.pl-prices{display:flex;flex-direction:column;gap:4px;color:#333;font-size:13px}.pl-prices b{color:#e94560;font-size:17px}.pl-old{text-decoration:line-through;color:#999}' +
      '.pl-footer{text-align:center;color:#777;font-size:12px;margin-top:20px}' +
      '@page{margin:12mm}' +
      '@media print{body{background:#fff;padding:10px}.pl-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pl-card{box-shadow:none;border:1px solid #ddd;border-radius:8px}.pl-header{border-radius:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
    '</style></head><body>' +
    '<div class="pl-header"><h1>AYLENSALE Price List</h1><p>Products with photos and latest prices</p><p>Generated: ' + escapeHtml(generatedAt) + '</p></div>' +
    '<div class="pl-grid">' + cards + '</div>' +
    '<div class="pl-footer">AYLENSALE | Print and choose Save as PDF</div>' +
    autoPrintScript +
  '</body></html>';
}

function openPriceList() {
  (async function() {
    var list = await ensurePriceListReady();
    if (!list.length) {
      notify('Price list is empty. Check back soon or message us on WhatsApp.', 'info');
      return;
    }
    showPriceListModal(list);
  })();
}

function showPriceListModal(list) {
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { showPriceListModal(list); });
    return;
  }
  var modalId = 'priceListModal_' + Date.now();
  var preview = list.slice(0, 12).map(function(p) {
    var raw = (p.images && p.images.length > 0 && p.images[0]) ? p.images[0] : (p.photoUrl || PRODUCT_FALLBACK_IMAGE);
    var img = productCardImageSrc(raw);
    var price = Number(p.retailPrice || p.retail || p.price || 0);
    return '<div style="display:flex;gap:10px;align-items:center;padding:8px;border:1px solid #eee;border-radius:8px;background:#fff">' +
      '<img src="' + escapeHtml(img) + '" alt="" width="58" height="58" loading="lazy" decoding="async" style="width:58px;height:58px;object-fit:cover;border-radius:6px;background:#1a1a2e"' + storefrontImageDataAttrs(raw) + '>' +
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

window.openPriceList = openPriceList;

function downloadPriceList() {
  (async function() {
    var list = await ensurePriceListReady();
    if (!list.length) {
      notify('Price list is empty. Check back soon or message us on WhatsApp.', 'info');
      return;
    }
    var blob = new Blob([buildPriceListHtml()], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'aylensale-price-list.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    notify('Price list HTML downloaded', 'success');
  })();
}

function printPriceList() {
  (async function() {
    var list = await ensurePriceListReady();
    if (!list.length) {
      notify('Price list is empty. Check back soon or message us on WhatsApp.', 'info');
      return;
    }
    var blob = new Blob([buildPriceListHtml({ autoPrint: true })], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var win = window.open(url, '_blank');
    if (!win) {
      URL.revokeObjectURL(url);
      notify('Allow popups, then tap PDF again (Print → Save as PDF)', 'error');
      return;
    }
    setTimeout(function() { URL.revokeObjectURL(url); }, 120000);
    notify('In the print dialog choose Save as PDF', 'info');
  })();
}

function downloadPriceListCsv() {
  (async function() {
    var list = await ensurePriceListReady();
    if (!list.length) {
      notify('Price list is empty. Check back soon or message us on WhatsApp.', 'info');
      return;
    }
    var rows = [['name', 'description', 'retail price', 'wholesale price', 'minimum quantity', 'stock/status', 'note', 'photo']];
    list.forEach(function(item) {
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
  })();
}

window.downloadPriceList = downloadPriceList;
window.printPriceList = printPriceList;
window.downloadPriceListCsv = downloadPriceListCsv;

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

function preloadProductCardImage(url) {
  if (!url || String(url).indexOf('data:') === 0) return;
  var img = new Image();
  img.decoding = 'async';
  img.src = url;
}

function updateProductCardImage(productId, index) {
  if (window.AYLEN_PRODUCT_GALLERY && window.AYLEN_PRODUCT_GALLERY.setIndex &&
      window.AYLEN_PRODUCT_GALLERY.productId && sameId(window.AYLEN_PRODUCT_GALLERY.productId, productId)) {
    window.AYLEN_PRODUCT_GALLERY.setIndex(index);
    return;
  }
  var p = products.find(function(item) { return sameId(item.id, productId); });
  if (!p || !Array.isArray(p.images) || !p.images.length) return;
  var raw = p.images[index] || PRODUCT_FALLBACK_IMAGE;
  var src = productCardImageSrc(raw);
  var full = productCardImageFullUrl(raw);
  if (p.images.length > 1) {
    var nextIdx = (index + 1) % p.images.length;
    var prevIdx = (index - 1 + p.images.length) % p.images.length;
    var nextRaw = p.images[nextIdx];
    var prevRaw = p.images[prevIdx];
    if (nextRaw) preloadProductCardImage(productCardImageSrc(nextRaw));
    if (prevRaw) preloadProductCardImage(productCardImageSrc(prevRaw));
  }
  var pid = String(productId);
  document.querySelectorAll('[data-main-product-image]').forEach(function(img) {
    if (String(img.getAttribute('data-main-product-image')) !== pid) return;
    if (!imageSourcesMatch(img, src)) img.src = src;
    img.setAttribute('data-full', full);
    img.setAttribute('data-fallback', typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : '');
    img.alt = p.name || 'Product image';
  });
  var card = document.getElementById('product-card-' + safeDomId(productId));
  if (card) {
    card.querySelectorAll('[data-product-thumb]').forEach(function(thumb) {
      var thumbIndex = Number(thumb.getAttribute('data-thumb-index') || 0);
      thumb.classList.toggle('active', thumbIndex === index);
    });
  }
  document.querySelectorAll('.product-detail-thumb').forEach(function(btn, j) {
    btn.classList.toggle('active', j === index);
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
  if (document.body.classList.contains('product-page') && typeof refreshProductDetailPage === 'function') {
    refreshProductDetailPage();
  } else {
    renderProducts();
  }
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
  priceMode = 'retail';
  if (document.body.classList.contains('product-page') && typeof refreshProductDetailPage === 'function') {
    refreshProductDetailPage();
  } else if (typeof renderProducts === 'function') {
    renderProducts();
  }
}

async function requestNotify(productId, method) {
  var p = typeof getProductById === 'function' ? getProductById(productId) : productById(productId);
  if (!p) return;
  var formStartedAt = Date.now();
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
  if (typeof SECURITY !== 'undefined') {
    var formLimit = SECURITY.checkFormRateLimit();
    if (!formLimit.allowed) {
      notify(formLimit.reason, 'error');
      return;
    }
    var botCheck = SECURITY.detectBot(contact, method === 'email' ? contact : '', contact, p.name);
    if (botCheck.isBot) {
      notify(botCheck.reason || 'Submission blocked.', 'error');
      return;
    }
  }
  try {
    var payload = {
      productId: String(productId),
      productName: p.name || 'Product',
      method: method,
      contact: contact,
      security: typeof SECURITY !== 'undefined' && SECURITY.submissionMeta
        ? SECURITY.submissionMeta(formStartedAt, '')
        : {}
    };
    var response = await fetch('/api/notify-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Request failed');
    }
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
    var loc = pickupLocations[i];
    var status = window.AYLEN_PICKUP ? window.AYLEN_PICKUP.normalizePickupStatus(loc) : (loc.active ? 'going' : '');
    if (status !== 'going') continue;
    var opt = document.createElement('option');
    opt.value = loc.name + ' - ' + loc.address;
    opt.textContent = '✅ ' + loc.name + ' (' + (loc.days || loc.day || '') + ')';
    sel.appendChild(opt);
  }
  var od = document.createElement('option');
  od.value = 'Delivery';
  od.textContent = '🚚 Delivery';
  sel.appendChild(od);
}

function addToCart(id) {
  var cardEl = document.getElementById('product-card-' + safeDomId(id));
  if (cardEl && cardEl.scrollIntoView) {
    try {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      cardEl.scrollIntoView();
    }
  }
  var p = productById(id);
  if (!p) return;
  var stock = parseInt(p.stock, 10) || 0;
  if (stock <= 0 && p.status !== 'coming_soon' && p.stockStatus !== 'coming_soon') {
    notify('Out of stock', 'error');
    return;
  }
  var basePrice = Number(getProductBasePrice(p).toFixed(2));
  var price = getCartUnitPrice({ id: p.id, basePrice: basePrice, price: basePrice });
  var item = null;
  for (var i = 0; i < cart.length; i++) {
    if (sameId(cart[i].id, id)) { item = cart[i]; break; }
  }
  if (item) {
    var nextQty = (parseInt(item.qty, 10) || 0) + 1;
    if (stock > 0 && nextQty > stock) {
      notify('Only ' + stock + ' in stock', 'error');
      return;
    }
    item.qty = nextQty;
    item.name = p.name;
    item.basePrice = basePrice;
    item.price = price;
  } else {
    cart.push({id: p.id, name: p.name, basePrice: basePrice, price: price, qty: 1});
  }
  recalculateCartPrices();
  updateCartCount();
  renderCart();
  syncProductCardCartBadges();
  writePresence(true);
  notify(p.name + ' added!', 'success');
}

function removeFromCart(id) {
  cart = cart.filter(function(item) { return !sameId(item.id, id); });
  saveCart();
  updateCartCount();
  renderCart();
  syncProductCardCartBadges();
  writePresence(true);
}

function changeQty(id, d) {
  var p = productById(id);
  var changed = false;
  for (var i = 0; i < cart.length; i++) {
    if (sameId(cart[i].id, id)) {
      var nextQty = (parseInt(cart[i].qty, 10) || 0) + d;
      if (nextQty <= 0) { removeFromCart(id); return; }
      if (p && d > 0) {
        var stock = parseInt(p.stock, 10) || 0;
        if (stock > 0 && nextQty > stock) {
          notify('Only ' + stock + ' in stock', 'error');
          nextQty = stock;
        }
      }
      cart[i].qty = nextQty;
      changed = true;
      break;
    }
  }
  if (!changed) return;
  recalculateCartPrices();
  updateCartCount();
  renderCart();
  syncProductCardCartBadges();
  writePresence(true);
}

function updateCartCount() {
  var c = 0;
  for (var i = 0; i < cart.length; i++) c += cart[i].qty;
  var el = document.getElementById('cartCount');
  if (el) el.textContent = c;
  var btn = el && el.closest ? el.closest('.cart-btn') : document.querySelector('.site-header .cart-btn');
  if (btn) btn.classList.toggle('cart-btn--empty', c <= 0);
}

function isMobileStorefront() {
  return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

function validateCartStockClient() {
  var changed = false;
  for (var i = cart.length - 1; i >= 0; i--) {
    var item = cart[i];
    var p = productById(item.id);
    if (!p) continue;
    var stock = parseInt(p.stock, 10) || 0;
    var qty = parseInt(item.qty, 10) || 0;
    if (stock <= 0 && p.status !== 'coming_soon' && p.stockStatus !== 'coming_soon') {
      cart.splice(i, 1);
      changed = true;
      notify((p.name || 'Item') + ' is out of stock', 'error');
      continue;
    }
    if (stock > 0 && qty > stock) {
      item.qty = stock;
      changed = true;
      notify('Only ' + stock + ' left for ' + (p.name || 'item'), 'error');
    }
  }
  if (changed) {
    saveCart();
    updateCartCount();
    renderCart();
    syncProductCardCartBadges();
  }
  return !changed;
}

function getTotal() {
  recalculateCartPrices();
  var t = 0;
  for (var i = 0; i < cart.length; i++) t += cart[i].price * cart[i].qty;
  if (window.AYLEN_DISCOUNT && window.AYLEN_DISCOUNT.applyOrderDiscount) {
    t = window.AYLEN_DISCOUNT.applyOrderDiscount(t);
  }
  return t.toFixed(2);
}

function renderCart() {
  var div = document.getElementById('cartItems');
  if (!div) return;
  var totalEl = document.getElementById('cartTotal');
  var summaryEl = document.getElementById('cartSummary');
  if (cart.length === 0) {
    div.innerHTML = '<p style="text-align:center;color:#999;padding:30px">Cart is empty</p>';
    if (totalEl) totalEl.textContent = '£0.00';
    if (summaryEl) summaryEl.innerHTML = '';
    return;
  }
  var pct = getDiscountPercent();
  var retailSubtotal = 0;
  var h = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var product = productById(item.id);
    var basePrice = product ? getProductBasePrice(product) : Number(item.basePrice || 0);
    var unitPrice = getCartUnitPrice(item);
    item.price = unitPrice;
    var qty = Math.max(1, parseInt(item.qty, 10) || 1);
    retailSubtotal += basePrice * qty;
    var priceLine = (pct > 0 && basePrice > unitPrice + 0.001)
      ? '<span class="cart-item-price cart-item-price--discounted"><s class="cart-item-price-was">£' + basePrice.toFixed(2) + '</s> <strong class="cart-item-price-your">£' + unitPrice.toFixed(2) + '</strong> each</span>'
      : '<span class="cart-item-price">£' + unitPrice.toFixed(2) + ' each</span>';
    h += '<div class="cart-item">' +
      '<div class="cart-item-info"><h4>' + escapeHtml(item.name) + '</h4>' + priceLine + '</div>' +
      '<div class="cart-item-qty">' +
        '<button type="button" aria-label="Decrease quantity" onclick="changeQty(' + jsInlineArg(item.id) + ',-1)">-</button>' +
        '<span id="cartQty_' + String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_') + '">' + qty + '</span>' +
        '<button type="button" aria-label="Increase quantity" onclick="changeQty(' + jsInlineArg(item.id) + ',1)">+</button>' +
      '</div>' +
      '<div class="cart-item-line-total">£' + (unitPrice * qty).toFixed(2) + '</div>' +
    '</div>';
  }
  div.innerHTML = h;
  saveCart();
  var finalTotal = parseFloat(getTotal());
  var savings = Math.max(0, retailSubtotal - finalTotal);
  if (summaryEl) {
    if (pct > 0 && savings > 0.009) {
      summaryEl.innerHTML =
        '<div class="cart-summary-row"><span class="cart-summary-label">Was</span><span class="cart-summary-value">£' + retailSubtotal.toFixed(2) + '</span></div>' +
        '<div class="cart-summary-row cart-summary-row--savings"><span class="cart-summary-label">Card savings</span><span class="cart-summary-value">−£' + savings.toFixed(2) + ' (' + pct + '%)</span></div>';
    } else {
      summaryEl.innerHTML = '';
    }
  }
  if (totalEl) totalEl.textContent = '£' + finalTotal.toFixed(2);
}

function openCart() {
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { openCart(); });
    return;
  }
  renderCart();
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.openStatic('cartModal');
  else document.getElementById('cartModal').classList.add('open');
}
function closeCart() {
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.closeStatic('cartModal');
  else document.getElementById('cartModal').classList.remove('open');
}
function openCheckout() {
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { openCheckout(); });
    return;
  }
  var started = document.getElementById('orderFormStartedAt');
  if (started) started.value = String(Date.now());
  if (window.AYLEN_SPAM && window.AYLEN_SPAM.initCheckout) {
    window.AYLEN_SPAM.initCheckout().catch(function() {});
  }
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
  if (typeof SECURITY === 'undefined') {
    ensureStorefrontInteraction().then(function() { sendOrder(e); });
    return;
  }

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
  
  if (!validateCartStockClient()) {
    return;
  }

  if (window.AYLEN_SPAM && window.AYLEN_SPAM.isEnabled && window.AYLEN_SPAM.isEnabled()) {
    var captchaToken = window.AYLEN_SPAM.getToken('orderTurnstile');
    if (!captchaToken) {
      notify('Complete the security check below the form', 'error');
      return;
    }
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
    vipMember: !!(window.__AYLEN_VIP_SHOP_ACTIVE || (currentUser && String(currentUser.card || '').toUpperCase() === 'VIPSTOCK')),
    security: SECURITY.submissionMeta(startedAt, honeypot),
    turnstileToken: window.AYLEN_SPAM && window.AYLEN_SPAM.getToken
      ? window.AYLEN_SPAM.getToken('orderTurnstile')
      : null
  };
  
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/send-order', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  
  xhr.onload = function() {
    try {
      var data = JSON.parse(xhr.responseText);
      if (data.success) {
        if (Array.isArray(data.stockAdjustments)) {
          data.stockAdjustments.forEach(function(adj) {
            if (!adj || !adj.productId) return;
            var idx = window.AYLEN_PRODUCTION
              ? window.AYLEN_PRODUCTION.findProductIndexById(products, adj.productId)
              : products.findIndex(function(p) { return sameId(p.id, adj.productId); });
            if (idx !== -1) products[idx].stock = Number(adj.after || 0);
          });
        }
        if (window.FBDB && window.FBDB.refreshCatalogFirstPage) {
          window.FBDB.refreshCatalogFirstPage().then(function() {
            if (typeof renderProducts === 'function') renderProducts(true);
          }).catch(function() {});
        } else if (typeof renderProducts === 'function') {
          renderProducts(true);
        }
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
        if (data.code === 'stock_unavailable' || xhr.status === 409) {
          if (window.FBDB && window.FBDB.refreshCatalogFirstPage) {
            window.FBDB.refreshCatalogFirstPage().then(function() {
              validateCartStockClient();
              renderProducts(true);
            }).catch(function() {});
          } else {
            validateCartStockClient();
            renderProducts(true);
          }
        }
        notify(data.error || 'Order could not be completed', 'error');
        if (window.AYLEN_SPAM && window.AYLEN_SPAM.resetWidget) {
          window.AYLEN_SPAM.resetWidget('orderTurnstile');
        }
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

var AUCTION_DEPOSIT_GBP = 50;
var auctionDepositConfigCache = null;
var auctionDepositConfigPromise = null;

async function loadAuctionDepositConfig(force) {
  if (!force && auctionDepositConfigCache) return auctionDepositConfigCache;
  if (!force && auctionDepositConfigPromise) return auctionDepositConfigPromise;
  auctionDepositConfigPromise = fetch('/api/auction-deposit-config')
    .then(function(res) { return res.json().catch(function() { return {}; }); })
    .then(function(data) {
      auctionDepositConfigCache = data && data.ok ? data : {
        ok: true,
        depositEnforcement: false,
        depositAmountGbp: AUCTION_DEPOSIT_GBP,
        depositsEnabled: true
      };
      if (Number(auctionDepositConfigCache.depositAmountGbp) > 0) {
        AUCTION_DEPOSIT_GBP = Number(auctionDepositConfigCache.depositAmountGbp);
      }
      return auctionDepositConfigCache;
    })
    .catch(function() {
      auctionDepositConfigCache = {
        ok: true,
        depositEnforcement: false,
        depositAmountGbp: AUCTION_DEPOSIT_GBP,
        depositsEnabled: true
      };
      return auctionDepositConfigCache;
    })
    .finally(function() { auctionDepositConfigPromise = null; });
  return auctionDepositConfigPromise;
}

function getAuctionDepositConfig() {
  return auctionDepositConfigCache || {
    ok: true,
    depositEnforcement: false,
    depositAmountGbp: AUCTION_DEPOSIT_GBP,
    depositsEnabled: true
  };
}

var auctionWinnerPaymentConfigCache = null;
var auctionWinnerPaymentConfigPromise = null;

async function loadAuctionWinnerPaymentConfig(force) {
  if (!force && auctionWinnerPaymentConfigCache) return auctionWinnerPaymentConfigCache;
  if (!force && auctionWinnerPaymentConfigPromise) return auctionWinnerPaymentConfigPromise;
  auctionWinnerPaymentConfigPromise = fetch('/api/auction-payment-config')
    .then(function(res) { return res.json().catch(function() { return {}; }); })
    .then(function(data) {
      auctionWinnerPaymentConfigCache = data && data.ok ? data : {
        ok: true,
        winnerPaymentEnabled: true,
        paymentDeadlineHours: 48
      };
      return auctionWinnerPaymentConfigCache;
    })
    .catch(function() {
      auctionWinnerPaymentConfigCache = { ok: true, winnerPaymentEnabled: true, paymentDeadlineHours: 48 };
      return auctionWinnerPaymentConfigCache;
    })
    .finally(function() { auctionWinnerPaymentConfigPromise = null; });
  return auctionWinnerPaymentConfigPromise;
}

function getAuctionWinnerPaymentConfig() {
  return auctionWinnerPaymentConfigCache || { ok: true, winnerPaymentEnabled: true, paymentDeadlineHours: 48 };
}

function getAuctionWinnerPaymentStatus(auction) {
  var w = auction && auction.winner;
  if (!w) return '';
  return String(w.paymentStatus || 'pending').toLowerCase();
}

function isAuctionWinnerPaymentPaid(auction) {
  return getAuctionWinnerPaymentStatus(auction) === 'paid';
}

function needsAuctionWinnerPayment(auction) {
  if (!auction || getAuctionStatus(auction) !== 'winner_pending') return false;
  if (getAuctionWinnerPaymentConfig().winnerPaymentEnabled === false) return false;
  return !isAuctionWinnerPaymentPaid(auction);
}

function getAuctionHammerAmount(auction) {
  var w = auction && auction.winner;
  return Number((w && (w.hammerAmount || w.amount)) || auction.currentPrice || 0);
}

async function promptAuctionWinnerPayment(auctionId) {
  var auction = findAuctionById(auctionId);
  if (!auction) { notify('Auction not found', 'error'); return; }
  var stored = getStoredBidderContact() || {};
  var phone = stored.phone || (auction.winner && auction.winner.bidderPhone) || '';
  if (!phone) {
    phone = window.prompt('Enter the phone number used when you won this lot:');
    if (!phone) return;
  }
  notify('Opening secure payment…', 'info');
  try {
    var response = await fetch('/api/auction-winner-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auctionId: auction.id,
        phone: phone,
        security: typeof SECURITY !== 'undefined' && SECURITY.submissionMeta
          ? SECURITY.submissionMeta(Date.now() - 3000, '')
          : {}
      })
    });
    var data = await response.json().catch(function() { return {}; });
    if (!response.ok || !data.success || !data.url) {
      notify(data.error || 'Could not start winner payment', 'error');
      return;
    }
    window.location.href = data.url;
  } catch (e) {
    notify('Network error starting payment', 'error');
  }
}

function isAuctionDepositEnforcementActive() {
  try {
    if (sessionStorage.getItem('aylen_deposit_gate_preview') === '1') return true;
  } catch (e) {}
  var cfg = getAuctionDepositConfig();
  return cfg.depositEnforcement === true;
}

function getAuctionDepositAmountGbp() {
  var cfg = getAuctionDepositConfig();
  var amount = Number(cfg.depositAmountGbp || AUCTION_DEPOSIT_GBP);
  return Number.isFinite(amount) && amount > 0 ? amount : AUCTION_DEPOSIT_GBP;
}

function isAuctionBidGated(auction) {
  return isAuctionDepositEnforcementActive() && !hasAuctionDepositPaid(auction);
}

function auctionDepositFirstLabel() {
  return 'Pay £' + getAuctionDepositAmountGbp().toFixed(0) + ' Deposit First';
}

function promptAuctionDepositRequired(auctionId, message) {
  if (typeof notify === 'function') {
    notify(message || auctionDepositFirstLabel(), 'error');
  }
  openAuctionDepositModal(auctionId);
}

function auctionBuyNowPrice(auction) {
  var price = Number(auction && auction.buyNowPrice || 0);
  if (!price || price <= 0) return 0;
  var current = Number(auction.currentPrice || auction.startingPrice || 0);
  if (price <= current) return 0;
  if (getAuctionStatus(auction) !== 'active') return 0;
  return price;
}

function auctionBidderKey(bid) {
  return String(
    (bid && (bid.bidderKey || bid.bidderPhone || bid.bidderName || bid.bidder || bid.id)) || 'anonymous'
  );
}

function buildAnonymousBidderMap(bids) {
  var sorted = (bids || []).slice().sort(function(a, b) {
    return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
  });
  var map = {};
  var counter = 1;
  sorted.forEach(function(b) {
    var key = auctionBidderKey(b);
    if (!map[key]) map[key] = 'Bidder #' + counter++;
  });
  return map;
}

function anonymousBidderLabel(bid, bidderMap) {
  return (bidderMap && bidderMap[auctionBidderKey(bid)]) || 'Bidder';
}

function auctionHighestBidAmount(auction) {
  var highest = highestAuctionBid(auction);
  if (highest) return Number(highest.amount || 0);
  return Number(auction.currentPrice || auction.startingPrice || 0);
}

function hasAuctionDepositPaid(auction) {
  var stored = getStoredBidderContact() || {};
  var phone = String(stored.phone || '').replace(/\D/g, '');
  if (!phone || !auction || !Array.isArray(auction.deposits)) return false;
  return auction.deposits.some(function(d) {
    if (!d || d.status !== 'paid') return false;
    return String(d.bidderPhone || '').replace(/\D/g, '') === phone;
  });
}

function renderAuctionBidHistoryHtml(bids, opts) {
  opts = opts || {};
  var maxRows = opts.maxRows || 8;
  var anonymous = opts.anonymous !== false;
  var sorted = (bids || []).slice().sort(function(a, b) {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });
  if (!sorted.length) return '';
  var bidderMap = anonymous ? buildAnonymousBidderMap(sorted) : null;
  var html = '<details class="bid-history-details bid-history-details--public">';
  html += '<summary><i class="fas fa-history"></i> Bid history (' + sorted.length + ')</summary>';
  html += '<div class="bid-history-list">';
  sorted.slice(0, maxRows).forEach(function(b) {
    var label = anonymous
      ? anonymousBidderLabel(b, bidderMap)
      : escapeHtml(b.bidderName || b.bidder || 'Customer');
    html += '<div class="bid-history-row"><span>' + label + '</span>' +
      '<span>£' + Number(b.amount || 0).toFixed(2) + '</span>' +
      '<span>' + formatAuctionBidTime(b.timestamp) + '</span></div>';
  });
  if (sorted.length > maxRows) {
    html += '<div class="bid-history-more">+' + (sorted.length - maxRows) + ' older bids</div>';
  }
  html += '</div></details>';
  return html;
}

function buildAuctionMarketHtml(a, domKey, ctx) {
  ctx = ctx || {};
  var isEnded = !!ctx.isEnded;
  var timeLeft = ctx.timeLeft;
  var isEnding = !!ctx.isEnding;
  var isAdmin = !!ctx.isAdmin;
  var bidStats = auctionParticipantStats(a);
  var highestBid = highestAuctionBid(a);
  var highAmount = auctionHighestBidAmount(a);
  var bids = (auctionBids[String(a.id)] || a.bids || []).slice();
  var isActive = getAuctionStatus(a) === 'active' && !isEnded;
  var buyNow = auctionBuyNowPrice(a);
  var depositPaid = hasAuctionDepositPaid(a);
  var bidGated = isAuctionBidGated(a);
  var depositAmount = getAuctionDepositAmountGbp();
  var h = '';

  h += '<div class="auction-price-section">';
  h += '<div class="auction-price-label">Current highest bid</div>';
  h += '<div class="auction-current-price">£' + highAmount.toFixed(2) + '</div>';
  h += '<div class="auction-bids">Start £' + Number(a.startingPrice || 0).toFixed(2) +
    ' · ' + (a.bidsCount || bidStats.totalBids || 0) + ' bids</div>';
  if (isAdmin && highestBid) {
    h += '<div class="auction-highest-bid auction-highest-bid--admin"><i class="fas fa-crown" style="color:#f5af02"></i> Leading: <b>' +
      escapeHtml(highestBid.bidderName || highestBid.bidder || 'Customer') + '</b></div>';
  }
  h += '</div>';

  if (!isEnded) {
    h += '<div class="auction-timer auction-timer--visible ' + (isEnding ? 'ending' : '') + '" role="timer" aria-live="polite">';
    h += '<div class="timer-label"><i class="fas fa-hourglass-end"></i> Countdown</div>';
    h += '<div class="timer-display" id="timer-' + domKey + '" aria-atomic="true">' + formatTimeLeft(timeLeft) + '</div>';
    h += '</div>';
  } else {
    h += '<div class="auction-timer ending">';
    h += '<div class="timer-label"><i class="fas fa-check-circle"></i> Auction Ended</div>';
    h += '</div>';
  }

  if (isActive) {
    h += '<div class="auction-card-actions">';
    h += '<div class="bid-input-section">';
    h += '<input type="number" id="bid-amount-' + domKey + '" inputmode="decimal" placeholder="Min £' +
      (Number(a.currentPrice || 0) + 1).toFixed(2) + '" min="' + (Number(a.currentPrice || 0) + 1).toFixed(2) + '" step="0.01"' +
      (bidGated ? ' disabled aria-disabled="true"' : '') + '>';
    if (bidGated) {
      h += '<button type="button" class="auction-btn auction-btn--bid auction-btn--bid-gated" data-action="auction-deposit" data-auction-id="' +
        escapeHtml(String(a.id)) + '"><i class="fas fa-credit-card"></i> ' + escapeHtml(auctionDepositFirstLabel()) + '</button>';
    } else {
      h += '<button type="button" class="auction-btn auction-btn--bid" data-action="open-bid" data-auction-id="' +
        escapeHtml(String(a.id)) + '"><i class="fas fa-gavel"></i> Place Bid</button>';
    }
    h += '</div>';
    if (!bidGated) {
      h += '<button type="button" class="auction-btn auction-btn--deposit' + (depositPaid ? ' is-done' : '') +
        '" data-action="auction-deposit" data-auction-id="' + escapeHtml(String(a.id)) + '"' +
        (depositPaid ? ' disabled' : '') + '><i class="fas fa-credit-card"></i> ' +
        (depositPaid ? 'Deposit paid' : 'Pay £' + depositAmount.toFixed(0) + ' Deposit') + '</button>';
    }
    if (buyNow > 0) {
      h += '<button type="button" class="auction-btn auction-btn--buynow" data-action="auction-buy-now" data-auction-id="' +
        escapeHtml(String(a.id)) + '"><i class="fas fa-bolt"></i> Buy Now · £' + buyNow.toFixed(2) + '</button>';
    }
    h += '</div>';
  }

  if (bids.length) {
    h += renderAuctionBidHistoryHtml(bids, { maxRows: isAdmin ? 12 : 8, anonymous: !isAdmin });
  }

  return h;
}

function findAuctionById(auctionId) {
  return (auctions || []).find(function(a) { return sameId(a.id, auctionId); });
}

function buildAuctionInquiryWhatsAppUrl(auction) {
  var settings = safeMarketplaceSettings();
  var base = resolveWhatsAppUrl(settings.whatsappUrl);
  var msg = 'Hi AYLENSALE! Question about live auction: ' + String(auction.name || 'lot') +
    ' (current £' + Number(auction.currentPrice || 0).toFixed(2) + ').';
  var root = base.split('?')[0];
  if (base.indexOf('text=') !== -1) return base.split('text=')[0] + 'text=' + encodeURIComponent(msg);
  return root + '?text=' + encodeURIComponent(msg);
}

function buildAuctionInquiryTelegramUrl(auction) {
  var settings = safeMarketplaceSettings();
  var tg = String(settings.telegramUrl || 'https://t.me/aylensale').trim();
  var msg = 'Hi AYLENSALE! Question about live auction: ' + String(auction.name || 'lot') +
    ' (current £' + Number(auction.currentPrice || 0).toFixed(2) + ').';
  var userMatch = tg.match(/^https:\/\/t\.me\/([a-z0-9_]{3,64})\/?$/i);
  if (userMatch) return 'https://t.me/' + userMatch[1] + '?text=' + encodeURIComponent(msg);
  return 'https://t.me/share/url?url=' + encodeURIComponent(location.origin + '/#auctions') + '&text=' + encodeURIComponent(msg);
}

function buildAuctionModalInfoHtml(a) {
  var domKey = auctionDomKey(a.id);
  var endTime = new Date(a.endTime);
  var timeLeft = endTime - new Date();
  var isEnded = timeLeft <= 0 || getAuctionStatus(a) !== 'active';
  var isEnding = !isEnded && timeLeft < 3600000;
  var highestBid = highestAuctionBid(a);
  var bidStats = auctionParticipantStats(a);
  var aViews = auctionViewTotals[a.id] != null ? auctionViewTotals[a.id] : Number(a.viewCount || 0);
  var statusLabel = auctionStatusLabel(a);
  var html = '';

  html += '<span class="pdp-auction-badge"><i class="fas fa-gavel"></i> ' + escapeHtml(statusLabel) + '</span>';
  html += '<h3 id="pdpModalTitle">' + escapeHtml(a.name || 'Auction') + '</h3>';
  html += '<p class="pdp-modal__meta">Live auction · <b>' + escapeHtml(bidStats.totalBids) + '</b> bids · ' +
    escapeHtml(bidStats.participants) + ' bidders · ' + escapeHtml(formatViewCount(aViews)) + '</p>';
  var highAmount = auctionHighestBidAmount(a);
  html += '<p class="pdp-modal__price">£' + highAmount.toFixed(2) +
    '<span class="pdp-modal__price-original">Start £' + Number(a.startingPrice || 0).toFixed(2) + '</span></p>';
  html += '<p class="pdp-modal__meta pdp-auction-high-bid"><i class="fas fa-chart-line"></i> Current highest bid</p>';

  if (!isEnded) {
    html += '<div class="pdp-auction-timer pdp-auction-timer--visible' + (isEnding ? ' is-ending' : '') + '" role="timer" aria-live="polite">' +
      '<span><i class="fas fa-hourglass-half"></i> Countdown</span>' +
      '<strong id="pdp-timer-' + domKey + '" aria-atomic="true">' + formatTimeLeft(timeLeft) + '</strong></div>';
  } else {
    html += '<div class="pdp-auction-timer is-ended"><i class="fas fa-flag-checkered"></i> Auction ended</div>';
  }

  if (a.desc) {
    html += '<div class="pdp-modal__desc">' + escapeHtml(a.desc).replace(/\n/g, '<br>') + '</div>';
  }

  var bids = (auctionBids[String(a.id)] || a.bids || []).slice().sort(function(x, y) {
    return new Date(y.timestamp || 0) - new Date(x.timestamp || 0);
  });
  if (bids.length) {
    var bidderMap = buildAnonymousBidderMap(bids);
    html += '<div class="pdp-auction-history"><div class="pdp-auction-history__title"><i class="fas fa-history"></i> Bid history (anonymous)</div>';
    bids.slice(0, 15).forEach(function(b) {
      html += '<div class="pdp-auction-history__row">' +
        '<span>' + escapeHtml(anonymousBidderLabel(b, bidderMap)) + '</span>' +
        '<span>£' + Number(b.amount || 0).toFixed(2) + '</span>' +
        '<span>' + escapeHtml(formatAuctionBidTime(b.timestamp)) + '</span></div>';
    });
    if (bids.length > 15) {
      html += '<p class="pdp-modal__meta" style="margin:8px 0 0">+' + (bids.length - 15) + ' older bids</p>';
    }
    html += '</div>';
  }

  if (a.winner) {
    html += '<p class="pdp-modal__meta"><strong>Winner:</strong> ' + escapeHtml(a.winner.bidderName || 'Unknown') +
      ' · £' + Number(a.winner.amount || a.currentPrice || 0).toFixed(2) + '</p>';
  }

  if (getAuctionStatus(a) === 'active' && !isEnded) {
    var depositPaidModal = hasAuctionDepositPaid(a);
    var bidGatedModal = isAuctionBidGated(a);
    var depositAmountModal = getAuctionDepositAmountGbp();
    var buyNowModal = auctionBuyNowPrice(a);
    if (bidGatedModal) {
      html += '<p class="pdp-auction-deposit-gate"><i class="fas fa-lock"></i> ' +
        escapeHtml(auctionDepositFirstLabel()) + ' to place bids on this lot.</p>';
    }
    html += '<div class="pdp-auction-bid' + (bidGatedModal ? ' pdp-auction-bid--gated' : '') + '">' +
      '<label class="pdp-auction-bid__label" for="bid-amount-modal-' + domKey + '">Your bid (£)</label>' +
      '<div class="pdp-auction-bid__row">' +
        '<input type="number" class="pdp-auction-bid__input" id="bid-amount-modal-' + domKey + '" ' +
          'placeholder="Min £' + (Number(a.currentPrice || 0) + 1).toFixed(2) + '" ' +
          'min="' + (Number(a.currentPrice || 0) + 1).toFixed(2) + '" step="0.01" inputmode="decimal"' +
          (bidGatedModal ? ' disabled aria-disabled="true"' : '') + '>' +
        '<button type="button" class="pdp-modal__btn ' + (bidGatedModal ? 'pdp-modal__btn--deposit' : 'pdp-modal__btn--bid') +
          (bidGatedModal ? ' pdp-modal__btn--bid-gated' : '') + '" data-auction-bid="' + escapeHtml(String(a.id)) + '"' +
          (bidGatedModal ? ' data-auction-deposit="' + escapeHtml(String(a.id)) + '"' : '') + '>' +
          '<i class="fas fa-' + (bidGatedModal ? 'credit-card' : 'gavel') + '"></i> ' +
          (bidGatedModal ? escapeHtml(auctionDepositFirstLabel()) : 'Place Bid') + '</button>' +
      '</div></div>';
    html += '<div class="pdp-auction-pay-row">';
    if (!bidGatedModal) {
      html += '<button type="button" class="pdp-modal__btn pdp-modal__btn--deposit" data-auction-deposit="' +
        escapeHtml(String(a.id)) + '"' + (depositPaidModal ? ' disabled' : '') + '>' +
        '<i class="fas fa-credit-card"></i> ' + (depositPaidModal ? 'Deposit paid' : 'Pay £' + depositAmountModal.toFixed(0) + ' Deposit') + '</button>';
    }
    if (buyNowModal > 0) {
      html += '<button type="button" class="pdp-modal__btn pdp-modal__btn--buynow" data-auction-buy-now="' +
        escapeHtml(String(a.id)) + '"><i class="fas fa-bolt"></i> Buy Now · £' + buyNowModal.toFixed(2) + '</button>';
    }
    html += '</div>';
  }

  if (getAuctionStatus(a) === 'winner_pending' && !a.winnerOrder) {
    if (needsAuctionWinnerPayment(a)) {
      var payStatus = getAuctionWinnerPaymentStatus(a);
      html += '<button type="button" class="pdp-modal__btn pdp-modal__btn--deposit" data-auction-winner-pay="' + escapeHtml(String(a.id)) + '">' +
        '<i class="fas fa-credit-card"></i> Pay hammer price · £' + getAuctionHammerAmount(a).toFixed(2) +
        (payStatus === 'overdue' ? ' (overdue)' : '') + '</button>';
      html += '<p class="pdp-modal__meta">Pay the hammer price to unlock collection. Your £' +
        Number(getAuctionDepositConfig().depositAmountGbp || 50).toFixed(0) + ' deposit is refunded separately.</p>';
    } else if (isAuctionWinnerPaymentPaid(a) || getAuctionWinnerPaymentConfig().winnerPaymentEnabled === false) {
      html += '<button type="button" class="pdp-modal__btn pdp-modal__btn--cart" data-auction-claim="' + escapeHtml(String(a.id)) + '">' +
        '<i class="fas fa-trophy"></i> Claim winning order</button>';
    }
  }

  if (a.winnerOrder) {
    html += '<p class="pdp-modal__meta" style="color:#6ee7b7"><i class="fas fa-check"></i> Winner order sent (' +
      escapeHtml(a.winnerOrder.method || 'Pickup') + ')</p>';
  }

  html += '<div class="pdp-modal__actions pdp-modal__actions--stack">' +
    '<a class="pdp-modal__btn pdp-modal__btn--wa" href="' + escapeHtml(buildAuctionInquiryWhatsAppUrl(a)) + '" target="_blank" rel="noopener noreferrer">' +
      '<i class="fab fa-whatsapp"></i> Ask on WhatsApp</a>' +
    '<a class="pdp-modal__btn pdp-modal__btn--tg" href="' + escapeHtml(buildAuctionInquiryTelegramUrl(a)) + '" target="_blank" rel="noopener noreferrer">' +
      '<i class="fab fa-telegram"></i> Ask on Telegram</a>' +
  '</div>';

  return html;
}

function bindAuctionModalActions(modal, auction) {
  if (!modal || !auction) return;
  var bidBtn = modal.querySelector('[data-auction-bid]');
  if (bidBtn) {
    bidBtn.addEventListener('click', function() {
      if (isAuctionBidGated(auction)) {
        promptAuctionDepositRequired(auction.id);
        return;
      }
      openBidModal(auction.id);
    });
  }
  var claimBtn = modal.querySelector('[data-auction-claim]');
  if (claimBtn) {
    claimBtn.addEventListener('click', function() {
      openWinnerClaimModal(auction.id);
    });
  }
  var winnerPayBtn = modal.querySelector('[data-auction-winner-pay]');
  if (winnerPayBtn) {
    winnerPayBtn.addEventListener('click', function() {
      promptAuctionWinnerPayment(auction.id);
    });
  }
  var depositBtn = modal.querySelector('[data-auction-deposit]');
  if (depositBtn) {
    depositBtn.addEventListener('click', function() {
      openAuctionDepositModal(auction.id);
    });
  }
  var buyNowBtn = modal.querySelector('[data-auction-buy-now]');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', function() {
      openAuctionBuyNowModal(auction.id);
    });
  }
}

function refreshAuctionModalContent(auctionId) {
  var modal = document.getElementById('aylenAuctionModal');
  if (!modal) return;
  var a = findAuctionById(auctionId);
  if (!a) return;
  var info = modal.querySelector('.pdp-modal__info');
  if (!info) return;
  info.innerHTML = buildAuctionModalInfoHtml(a);
  bindAuctionModalActions(modal, a);
}

function openStorefrontAuctionModal(auctionId) {
  var a = findAuctionById(auctionId);
  if (!a) {
    notify('Auction not found', 'error');
    return;
  }
  recordAuctionViewOnce(a.id);
  withLazyPdpModal(function(pdp) {
    var activeIdx = selectedAuctionImage[a.id] !== undefined ? selectedAuctionImage[a.id] : 0;
    pdp.openModal({
      theme: 'storefront',
      modalClass: 'pdp-modal--auction',
      id: 'aylenAuctionModal',
      imgs: a.images || [],
      startIndex: activeIdx,
      infoHtml: buildAuctionModalInfoHtml(a),
      onOpen: function(modal) {
        bindAuctionModalActions(modal, a);
      }
    });
  });
}

function toggleProductDesc(btn) {
  var box = btn && btn.previousElementSibling;
  if (!box) return;
  var expanded = box.classList.toggle('is-expanded');
  btn.textContent = expanded ? 'Show less' : 'Read more';
}

/** Grid card title: max 80 chars; full name in tooltip when truncated. */
function truncateProductCardTitle(text) {
  var s = String(text || '').trim();
  if (!s) return 'Product';
  if (s.length <= PRODUCT_CARD_TITLE_MAX_CHARS) return s;
  return s.slice(0, PRODUCT_CARD_TITLE_MAX_CHARS - 1).trim() + '…';
}

function cartQtyForProduct(id) {
  for (var i = 0; i < cart.length; i++) {
    if (sameId(cart[i].id, id)) return parseInt(cart[i].qty, 10) || 0;
  }
  return 0;
}

function syncProductCardCartBadges() {
  var qtyById = {};
  for (var i = 0; i < cart.length; i++) {
    qtyById[String(cart[i].id)] = parseInt(cart[i].qty, 10) || 0;
  }
  document.querySelectorAll('#products .product-badge--cart[data-product-cart-badge]').forEach(function(btn) {
    if (btn.classList.contains('product-badge--reserve') || btn.disabled) return;
    var id = btn.getAttribute('data-product-cart-badge');
    if (!id) return;
    var qty = qtyById[id] || 0;
    var inCart = qty > 0;
    btn.classList.toggle('product-badge--in-cart', inCart);
    var icon = btn.querySelector('i');
    var qtyEl = btn.querySelector('.product-badge__qty');
    if (inCart) {
      if (icon) icon.className = 'fas fa-check';
      btn.setAttribute('aria-label', qty > 1 ? ('In cart, ' + qty + ' items') : 'In cart');
      btn.setAttribute('title', 'In cart — tap to view');
      btn.setAttribute('onclick', 'event.stopPropagation();openCart(); return false;');
      if (qty > 1) {
        if (!qtyEl) {
          qtyEl = document.createElement('span');
          qtyEl.className = 'product-badge__qty';
          btn.appendChild(qtyEl);
        }
        qtyEl.textContent = String(qty);
      } else if (qtyEl) {
        qtyEl.remove();
      }
    } else {
      if (icon) icon.className = 'fas fa-cart-plus';
      btn.setAttribute('aria-label', 'Add to cart');
      btn.setAttribute('title', 'Add to cart');
      btn.setAttribute('onclick', 'event.stopPropagation();addToCart(' + jsInlineArg(id) + '); return false;');
      if (qtyEl) qtyEl.remove();
    }
  });
}

function renderProductCardCartBadge(p, isComingSoon) {
  if (!p) return '';
  var stock = parseInt(p.stock, 10) || 0;
  var pid = String(p.id);
  if (isComingSoon) {
    return '<button type="button" class="product-badge product-badge--cart product-badge--reserve" data-action="notify" data-action-stop="1" data-product-id="' + escapeHtml(String(p.id)) + '" data-channel="email" aria-label="Reserve" title="Reserve"><i class="fas fa-bell" aria-hidden="true"></i></button>';
  }
  if (stock === 0) {
    return '<button type="button" class="product-badge product-badge--cart product-badge--disabled" disabled aria-label="Out of stock" title="Out of stock"><i class="fas fa-cart-plus" aria-hidden="true"></i></button>';
  }
  var qty = cartQtyForProduct(p.id);
  if (qty > 0) {
    var qtyHtml = qty > 1 ? ('<span class="product-badge__qty">' + qty + '</span>') : '';
    return '<button type="button" class="product-badge product-badge--cart product-badge--in-cart" data-product-cart-badge="' + escapeHtml(pid) + '" data-action="open-cart-modal" data-action-stop="1" aria-label="' + escapeHtml(qty > 1 ? ('In cart, ' + qty + ' items') : 'In cart') + '" title="In cart — tap to view"><i class="fas fa-check" aria-hidden="true"></i>' + qtyHtml + '</button>';
  }
  return '<button type="button" class="product-badge product-badge--cart" data-product-cart-badge="' + escapeHtml(pid) + '" data-action="add-to-cart" data-action-stop="1" data-product-id="' + escapeHtml(String(p.id)) + '" aria-label="Add to cart" title="Add to cart"><i class="fas fa-cart-plus" aria-hidden="true"></i></button>';
}

function useMobileProductScrollGallery() {
  return false;
}

function pickupCardImageSrc(raw) {
  var src = raw && String(raw).trim() ? raw : LOCATION_FALLBACK_IMAGE;
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.pickupCardImageUrl) {
    return window.AYLEN_IMAGES.pickupCardImageUrl(src);
  }
  return productCardImageSrc(src);
}

function productCardEagerImgAttrs(visibleCount, eagerLimit) {
  eagerLimit = eagerLimit || MOBILE_SSR_EAGER_IMAGE_COUNT;
  if (visibleCount > eagerLimit) {
    return window.AYLEN_IMAGES ? window.AYLEN_IMAGES.lazyImgAttrs() : ' loading="lazy" decoding="async" fetchpriority="low"';
  }
  if (visibleCount === 1) {
    return window.AYLEN_IMAGES ? window.AYLEN_IMAGES.eagerMainAttrs() : ' loading="eager" decoding="async" fetchpriority="high"';
  }
  return ' loading="eager" decoding="async" fetchpriority="low"';
}

function productCardImageSrc(raw) {
  var src = raw && String(raw).trim() ? raw : PRODUCT_FALLBACK_IMAGE;
  var host = '';
  try { host = window.location && window.location.hostname ? window.location.hostname : ''; } catch (e) {}
  var localPreview = host === 'localhost' || host === '127.0.0.1';
  if (localPreview && window.AYLEN_IMAGES && window.AYLEN_IMAGES.firebaseMediaUrl) {
    return window.AYLEN_IMAGES.firebaseMediaUrl(src);
  }
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productCardImageUrl) {
    src = window.AYLEN_IMAGES.productCardImageUrl(src);
  }
  return src;
}

function productCardImageFullUrl(raw) {
  var src = raw && String(raw).trim() ? raw : PRODUCT_FALLBACK_IMAGE;
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.firebaseMediaUrl) {
    return window.AYLEN_IMAGES.firebaseMediaUrl(src);
  }
  return src;
}

function renderProductCardImageMedia(p, activeIndex, lazyAttrs, isComingSoon, detailUrl, visibleCount, eagerLimit) {
  var images = (p.images && p.images.length) ? p.images.slice() : [];
  if (!images.length) images = [PRODUCT_FALLBACK_IMAGE];
  var scrollGallery = useMobileProductScrollGallery() && images.length > 1;
  var blur = isComingSoon ? ' style="filter:blur(3px)"' : '';
  var modalClick = 'data-action="product-modal" data-product-id="' + escapeHtml(String(p.id)) + '"';
  var dims = productCardDisplayDims();

  if (scrollGallery) {
    var out = '<a href="' + escapeHtml(detailUrl) + '" class="product-card-media-link product-image-scroll-link" ' + modalClick + ' aria-label="View ' + escapeHtml(p.name || 'product') + '">';
    out += '<div class="product-image-scroll" data-product-scroll="' + escapeHtml(String(p.id)) + '" tabindex="-1" aria-hidden="true">';
    out += '<div class="product-image-scroll-track">';
    for (var j = 0; j < images.length; j++) {
      var src = productCardImageSrc(images[j]);
      var slideAttrs;
      if (j === 0 && visibleCount <= eagerLimit) {
        slideAttrs = productCardEagerImgAttrs(visibleCount, eagerLimit);
      } else if (window.AYLEN_IMAGES) {
        slideAttrs = window.AYLEN_IMAGES.lazyImgAttrs();
      } else {
        slideAttrs = ' loading="lazy" decoding="async" fetchpriority="low"';
      }
      out += '<div class="product-image-slide">';
      if (j > 0) {
        out += '<img data-main-product-image="' + escapeHtml(p.id) + '" data-slide-index="' + j + '" data-deferred-src="' + escapeHtml(src) + '" src="' + DEFERRED_GALLERY_IMG + '" alt="" width="' + dims.w + '" height="' + dims.h + '"' + slideAttrs + antiTheftImageAttrs() + storefrontImageDataAttrs(images[j]) + blur + ' />';
      } else {
        out += productCardPictureHtml(images[j], slideAttrs + antiTheftImageAttrs() + storefrontImageDataAttrs(images[j]) + blur, dims);
      }
      out += '</div>';
    }
    out += '</div></div></a>';
    return out;
  }

  var img = productCardImageSrc(images[activeIndex] || images[0]);
  var single = '<a href="' + escapeHtml(detailUrl) + '" class="product-card-media-link" ' + modalClick + '>';
  single += productCardPictureHtml(images[activeIndex] || images[0], ' data-main-product-image="' + escapeHtml(p.id) + '" alt="' + escapeHtml(p.name) + '"' + lazyAttrs + antiTheftImageAttrs() + storefrontImageDataAttrs(images[activeIndex] || images[0]) + blur, dims);
  single += '<div class="product-card-open-overlay" aria-hidden="true"><span>View product</span></div>';
  single += '</a>';
  return single;
}

function productScrollSlideWidth(scroller) {
  return (scroller && scroller.clientWidth) || 1;
}

function scheduleProductCardScrollGalleries(grid) {
  if (isMobileStorefrontLayout()) return;
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(function() {
      initProductCardScrollGalleries(grid);
    }, { timeout: 2500 });
    return;
  }
  initProductCardScrollGalleries(grid);
}

function initProductCardScrollGalleries(root) {
  var scope = root || document;
  scope.querySelectorAll('.product-image-scroll[data-product-scroll]').forEach(function(scroller) {
    if (scroller.getAttribute('data-scroll-wired') === '1') return;
    scroller.setAttribute('data-scroll-wired', '1');
    var productId = scroller.getAttribute('data-product-scroll');
    var syncTimer;
    function syncScrollIndex() {
      var w = productScrollSlideWidth(scroller);
      var idx = Math.round(scroller.scrollLeft / w);
      var slides = scroller.querySelectorAll('[data-slide-index]');
      idx = Math.max(0, Math.min(idx, slides.length - 1));
      if (productId) selectedProductImage[productId] = idx;
    }
    scroller.addEventListener('scroll', function() {
      hydrateProductScrollGalleryImages(scroller);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncScrollIndex, 48);
    }, { passive: true });
    scroller.addEventListener('touchstart', function() {
      hydrateProductScrollGalleryImages(scroller);
    }, { once: true, passive: true });
    var start = productId && selectedProductImage[productId] ? selectedProductImage[productId] : 0;
    requestAnimationFrame(function() {
      var w = productScrollSlideWidth(scroller);
      if (w > 0) scroller.scrollLeft = start * w;
    });
  });
}

function renderProductCardTitle(p, detailUrl) {
  var full = String((p && p.name) || '').trim() || 'Product';
  var display = truncateProductCardTitle(full);
  var url = detailUrl || (typeof productPageUrl === 'function' ? productPageUrl(p.id) : '#products');
  var titleAttr = ' title="' + escapeHtml(full) + '"';
  return '<h3 class="product-card-title">' +
    '<a href="' + escapeHtml(url) + '" class="product-card-title-link"' + titleAttr +
    ' onclick="openStorefrontProductModal(' + jsInlineArg(p.id) + '); trackProductView(' + jsInlineArg(p.id) + '); return false;">' + escapeHtml(display) + '</a></h3>';
}

/** Grid cards: never embed policy/returns/disclaimer — category line only. */
function productCardPreviewText(p) {
  if (!p) return 'UK warehouse · weekend pickup';
  var desc = String(p.description || p.desc || '').trim().replace(/\s+/g, ' ');
  if (desc) return desc.length > 96 ? desc.slice(0, 96) + '…' : desc;
  var cat = String(p.category || '').trim();
  if (cat) return cat.length > 72 ? cat.slice(0, 72) + '…' : cat;
  return 'UK warehouse · weekend pickup';
}

function renderProductCardSubtitle(p) {
  return '<p class="product-card-subtitle">' + escapeHtml(productCardPreviewText(p)) + '</p>';
}

/** Remove any legacy policy/description nodes if old HTML slipped in. */
function stripHeavyTextFromProductCard(card) {
  if (!card || !card.querySelectorAll) return;
  var selectors = [
    '.listing-policy-box',
    '.listing-policy-title',
    '.listing-policy-text',
    '.listing-policy-disclaimer',
    '.listing-policy-clamp',
    '.product-desc-block',
    '.product-desc-clamp',
    '.product-policy-compact',
    '.product-info > .desc',
    '.product-info p.desc',
    '.desc-toggle-btn'
  ];
  selectors.forEach(function(sel) {
    card.querySelectorAll(sel).forEach(function(el) { el.remove(); });
  });
  card.querySelectorAll('.product-card-body p, .product-info p').forEach(function(p) {
    if (p.classList.contains('product-card-subtitle')) return;
    if (p.closest('.product-stock-row') || p.classList.contains('product-sku-admin')) return;
    if (p.classList.contains('desc') || p.classList.contains('product-desc-clamp')) p.remove();
  });
}

function openStorefrontProductModal(productId) {
  var p = typeof findProductById === 'function' ? findProductById(productId) : null;
  if (!p) {
    notify('Product not found', 'error');
    return;
  }
  withLazyPdpModal(function(pdp) {
    if (pdp.openStorefrontProduct) {
      pdp.openStorefrontProduct(p);
      return;
    }
    openProductCardDetailsModal(productId);
  });
}

function openProductCardDetailsModal(productId) {
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { openProductCardDetailsModal(productId); });
    return;
  }
  var p = typeof findProductById === 'function' ? findProductById(productId) : null;
  if (!p) {
    notify('Product not found', 'error');
    return;
  }
  var policy = (window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.getById)
    ? window.AYLEN_LISTING_POLICIES.getById(p.policyId || p.listingPolicyId)
    : (typeof getListingPolicyById === 'function' ? getListingPolicyById(p.policyId || p.listingPolicyId) : null);
  var desc = String(p.description || p.desc || '').trim();
  var detailUrl = typeof productPageUrl === 'function' ? productPageUrl(p.id) : '/product.html?id=' + encodeURIComponent(p.id);
  var modalId = 'productDetailsModal_' + Date.now();
  var body = '<div class="product-card-modal">';
  body += '<h2 style="margin:0 0 12px;font-size:1.1rem;color:#fff">' + escapeHtml(p.name || 'Product') + '</h2>';
  if (desc) {
    var descClamp = 280;
    var descLong = desc.length > descClamp;
    var descShort = descLong ? desc.slice(0, descClamp).trim() + '…' : desc;
    body += '<h3 class="product-card-modal-label">Description</h3>';
    body += '<div id="productModalDesc" class="product-card-modal-text' + (descLong ? ' is-clamped' : '') + '">' +
      escapeHtml(descShort).replace(/\n/g, '<br>') + '</div>';
    if (descLong) {
      window._aylenModalDescFull = desc;
      body += '<button type="button" class="product-card-modal-expand" onclick="expandProductModalDesc()">Show full description</button>';
    }
  }
  if (policy) {
    body += '<h3 class="product-card-modal-label">Policy &amp; Condition</h3>';
    if (policy.title) body += '<p class="product-card-modal-policy-title"><i class="fas fa-scale-balanced"></i> ' + escapeHtml(policy.title) + '</p>';
    if (policy.conditionText) {
      body += '<p class="product-card-modal-text"><strong>Condition:</strong> ' + escapeHtml(policy.conditionText) + '</p>';
    }
    if (policy.deliveryRules) {
      body += '<p class="product-card-modal-text"><strong>Delivery / Pickup:</strong> ' + escapeHtml(policy.deliveryRules) + '</p>';
    }
    if (policy.returnPolicy) {
      body += '<p class="product-card-modal-text"><strong>Returns:</strong> ' + escapeHtml(policy.returnPolicy) + '</p>';
    }
    if (policy.warrantyText) {
      body += '<p class="product-card-modal-text"><strong>Warranty:</strong> ' + escapeHtml(policy.warrantyText) + '</p>';
    }
    if (policy.ukDisclaimer) {
      body += '<p class="product-card-modal-disclaimer">' + escapeHtml(policy.ukDisclaimer) + '</p>';
    }
  }
  if (!desc && !policy) {
    body += '<p class="product-card-modal-text">No extra details for this listing.</p>';
  }
  body += '<div class="product-card-modal-actions">';
  body += '<a href="' + escapeHtml(detailUrl) + '" class="btn-action primary" style="text-decoration:none;justify-content:center"><i class="fas fa-arrow-up-right-from-square"></i> Open product page</a>';
  body += '<button type="button" class="btn-action secondary" onclick="AYLEN_MODAL.close()" style="width:100%;margin-top:8px">Close</button>';
  body += '</div></div>';

  var html = '<div id="' + modalId + '" class="modal" style="display:flex">' +
    '<div class="modal-content product-card-modal-content">' +
    '<span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>' +
    body +
    '</div></div>';

  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
}

function expandProductModalDesc() {
  var el = document.getElementById('productModalDesc');
  if (!el) return;
  var fullText = window._aylenModalDescFull || '';
  el.classList.remove('is-clamped');
  el.innerHTML = escapeHtml(String(fullText)).replace(/\n/g, '<br>');
  var btn = el.parentNode && el.parentNode.querySelector('.product-card-modal-expand');
  if (btn) btn.remove();
}

function renderProductDescriptionBlock(productId, desc, context) {
  var text = String(desc || '').trim();
  if (!text) return '';
  context = context || 'page';
  if (context === 'page') {
    return '<div class="product-detail-desc-body">' + escapeHtml(text).replace(/\n/g, '<br>') + '</div>';
  }
  return '';
}

function auctionDomKey(auctionId) {
  return safeDomId(auctionId);
}

function auctionCardImageSrc(raw, eager) {
  if (!raw || !String(raw).trim()) return '';
  var url = String(raw).trim();
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.auctionCardImageUrl) {
    url = window.AYLEN_IMAGES.auctionCardImageUrl(url);
  } else if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productCardImageUrl) {
    url = window.AYLEN_IMAGES.productCardImageUrl(url);
  }
  return url;
}

function auctionImageLoaded(img) {
  if (!img) return;
  var wrap = img.closest('.auction-image');
  if (wrap) wrap.classList.remove('is-loading');
  img.classList.add('is-ready');
}

function auctionImageFailed(img) {
  if (!img) return;
  var before = img.src;
  if (typeof aylenProductImageFallback === 'function') aylenProductImageFallback(img);
  if (img.src !== before) {
    img.onload = function() { auctionImageLoaded(img); };
    img.onerror = function() {
      if (typeof aylenProductImageFallback === 'function') aylenProductImageFallback(img);
      if (!img.complete || img.naturalWidth === 0) auctionImageShowPlaceholder(img);
      else auctionImageLoaded(img);
    };
    return;
  }
  auctionImageShowPlaceholder(img);
}

function auctionImageShowPlaceholder(img) {
  if (!img) return;
  var wrap = img.closest('.auction-image');
  if (wrap) wrap.classList.remove('is-loading');
  img.style.display = 'none';
  var ph = wrap && wrap.querySelector('.auction-image-placeholder');
  if (ph) ph.hidden = false;
}

function renderAuctionImageMedia(a, cardIndex, activeImgIdx) {
  var images = (a.images && a.images.length) ? a.images.slice() : [];
  var scrollGallery = useMobileProductScrollGallery() && images.length > 1;

  if (!images.length) {
    return '<div class="auction-image-placeholder" aria-hidden="true"><i class="fas fa-gavel"></i></div>';
  }

  if (scrollGallery) {
    var out = '<div class="auction-image-scroll" data-auction-scroll="' + escapeHtml(String(a.id)) + '" tabindex="0" aria-label="Swipe auction photos">';
    out += '<div class="auction-image-scroll-track" role="group" aria-label="Auction photos">';
    for (var j = 0; j < images.length; j++) {
      var slideRaw = images[j];
      var slideSrc = auctionCardImageSrc(slideRaw, cardIndex === 0 && j === 0);
      var slideLazy = (cardIndex === 0 && j === 0 && window.AYLEN_IMAGES)
        ? window.AYLEN_IMAGES.eagerMainAttrs()
        : (window.AYLEN_IMAGES ? window.AYLEN_IMAGES.lazyImgAttrs() : ' loading="lazy" decoding="async"');
      out += '<div class="auction-image-slide">';
      if (j > 0) {
        out += '<img class="auction-card-img" data-auction-main-image="' + escapeHtml(String(a.id)) + '" data-slide-index="' + j + '" data-deferred-src="' + escapeHtml(slideSrc) + '" src="' + DEFERRED_GALLERY_IMG + '" alt="' + escapeHtml(a.name) + ' — photo ' + (j + 1) + '" width="200" height="112"' + slideLazy + antiTheftImageAttrs() + auctionImageDataAttrs(slideRaw) + ' onload="auctionImageLoaded(this)" onerror="auctionImageFailed(this)">';
      } else {
        out += '<img class="auction-card-img" data-auction-main-image="' + escapeHtml(String(a.id)) + '" data-slide-index="' + j + '" src="' + escapeHtml(slideSrc) + '" alt="' + escapeHtml(a.name) + ' — photo ' + (j + 1) + '" width="200" height="112"' + slideLazy + antiTheftImageAttrs() + auctionImageDataAttrs(slideRaw) + ' onload="auctionImageLoaded(this)" onerror="auctionImageFailed(this)">';
      }
      out += '</div>';
    }
    out += '</div></div>';
    out += '<div class="auction-image-placeholder" hidden aria-hidden="true"><i class="fas fa-gavel"></i></div>';
    return out;
  }

  var imgRaw = images[activeImgIdx] || images[0];
  var img = auctionCardImageSrc(imgRaw, cardIndex === 0);
  var auctionLazy = (cardIndex === 0 && window.AYLEN_IMAGES)
    ? window.AYLEN_IMAGES.eagerMainAttrs()
    : (window.AYLEN_IMAGES ? window.AYLEN_IMAGES.lazyImgAttrs() : ' loading="lazy" decoding="async"');
  return '<img class="auction-card-img" data-auction-main-image="' + escapeHtml(String(a.id)) + '" src="' + escapeHtml(img) + '" alt="' + escapeHtml(a.name) + '" width="200" height="112"' + auctionLazy + antiTheftImageAttrs() + auctionImageDataAttrs(imgRaw) + ' onload="auctionImageLoaded(this)" onerror="auctionImageFailed(this)">' +
    '<div class="auction-image-placeholder" hidden aria-hidden="true"><i class="fas fa-gavel"></i></div>';
}

function initAuctionScrollGalleries(root) {
  var scope = root || document;
  scope.querySelectorAll('.auction-image-scroll[data-auction-scroll]').forEach(function(scroller) {
    if (scroller.getAttribute('data-scroll-wired') === '1') return;
    scroller.setAttribute('data-scroll-wired', '1');
    var auctionId = scroller.getAttribute('data-auction-scroll');
    var syncTimer;
    function syncScrollIndex() {
      var w = productScrollSlideWidth(scroller);
      var idx = Math.round(scroller.scrollLeft / w);
      var slides = scroller.querySelectorAll('[data-slide-index]');
      idx = Math.max(0, Math.min(idx, slides.length - 1));
      if (auctionId) selectedAuctionImage[auctionId] = idx;
      var card = scroller.closest('.auction-card');
      if (card) {
        card.querySelectorAll('[data-auction-thumb]').forEach(function(thumb) {
          var ti = Number(thumb.getAttribute('data-auction-thumb-index') || 0);
          thumb.classList.toggle('active', ti === idx);
        });
      }
    }
    scroller.addEventListener('scroll', function() {
      scroller.querySelectorAll('img[data-deferred-src]').forEach(hydrateDeferredGalleryImage);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncScrollIndex, 48);
    }, { passive: true });
    var start = auctionId && selectedAuctionImage[auctionId] ? selectedAuctionImage[auctionId] : 0;
    requestAnimationFrame(function() {
      var w = productScrollSlideWidth(scroller);
      if (w > 0) scroller.scrollLeft = start * w;
    });
  });
}

function bindAuctionImagesAfterRender() {
  document.querySelectorAll('.auction-card-img').forEach(function(img) {
    if (img.complete && img.naturalWidth > 0) auctionImageLoaded(img);
    else if (img.complete) auctionImageFailed(img);
  });
}

function selectAuctionImage(auctionId, index, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  var a = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!a || !a.images || !a.images.length) return;
  var safeIndex = Math.max(0, Math.min(Number(index) || 0, a.images.length - 1));
  selectedAuctionImage[a.id] = safeIndex;
  updateAuctionCardImage(a.id, safeIndex);
}

function prevAuctionImage(auctionId, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  var a = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!a || !a.images || a.images.length < 2) return;
  var current = selectedAuctionImage[a.id] || 0;
  selectAuctionImage(auctionId, (current - 1 + a.images.length) % a.images.length);
}

function nextAuctionImage(auctionId, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  var a = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!a || !a.images || a.images.length < 2) return;
  var current = selectedAuctionImage[a.id] || 0;
  selectAuctionImage(auctionId, (current + 1) % a.images.length);
}

function updateAuctionCardImage(auctionId, index) {
  var a = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!a || !Array.isArray(a.images) || !a.images.length) return;
  var safeIndex = Math.max(0, Math.min(Number(index) || 0, a.images.length - 1));
  selectedAuctionImage[a.id] = safeIndex;
  var domKey = auctionDomKey(auctionId);
  var card = document.getElementById('auction-' + domKey);
  if (!card) return;
  var scroller = card.querySelector('.auction-image-scroll[data-auction-scroll]');
  if (scroller) {
    var w = productScrollSlideWidth(scroller);
    if (w > 0) scroller.scrollLeft = safeIndex * w;
    card.querySelectorAll('[data-auction-thumb]').forEach(function(thumb) {
      var ti = Number(thumb.getAttribute('data-auction-thumb-index') || 0);
      thumb.classList.toggle('active', ti === safeIndex);
    });
    return;
  }
  var raw = a.images[safeIndex] || a.images[0];
  var src = auctionCardImageSrc(raw, false);
  var wrap = card.querySelector('.auction-image');
  var img = card.querySelector('.auction-card-img');
  if (wrap) wrap.classList.add('is-loading');
  if (img) {
    img.classList.remove('is-ready');
    img.style.display = '';
    img.src = src;
    img.setAttribute('data-full', productCardImageFullUrl(raw));
    img.setAttribute('data-fallback', typeof AUCTION_FALLBACK_IMAGE !== 'undefined' ? AUCTION_FALLBACK_IMAGE : (typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : ''));
    img.onload = function() { auctionImageLoaded(img); };
    img.onerror = function() { auctionImageFailed(img); };
    img.alt = a.name || 'Auction photo';
  }
  card.querySelectorAll('[data-auction-thumb]').forEach(function(thumb) {
    var ti = Number(thumb.getAttribute('data-auction-thumb-index') || 0);
    thumb.classList.toggle('active', ti === safeIndex);
  });
}

function renderAuctionsSectionMeta() {
  var meta = document.getElementById('auctionsLiveMeta');
  if (!meta) return;
  var active = 0;
  var endingSoon = 0;
  var now = Date.now();
  (auctions || []).forEach(function(a) {
    if (getAuctionStatus(a) !== 'active') return;
    active++;
    var end = new Date(a.endTime).getTime();
    if (end - now < 3600000 && end > now) endingSoon++;
  });
  var html = '<span class="auctions-live-pill"><span aria-hidden="true"></span> ' + active + ' live</span>';
  if (endingSoon) {
    html += '<span class="auctions-ending-soon"><i class="fas fa-hourglass-half"></i> ' + endingSoon + ' ending soon</span>';
  }
  meta.innerHTML = html;
  if (active > 0 && window.AYLEN_LAZY && !window.AYLEN_AUCTION_HUB) {
    var idle = window.requestIdleCallback || function(fn) { setTimeout(fn, 1500); };
    idle(function() {
      window.AYLEN_LAZY.ensureAuctionHub().catch(function() {});
    });
  }
}

function auctionsStructuralFingerprint(list) {
  return (list || []).map(function(a) {
    var imgs = Array.isArray(a.images) ? a.images.join(',') : '';
    return String(a.id) + '|' + imgs + '|' + String(a.name || '') + '|' + String(a.desc || '').slice(0, 96);
  }).join(';;');
}

function patchAuctionCardsDynamic(list) {
  (list || []).forEach(function(a) {
    var domKey = auctionDomKey(a.id);
    var card = document.getElementById('auction-' + domKey);
    if (!card) return;
    var endTime = new Date(a.endTime);
    var now = new Date();
    var timeLeft = endTime - now;
    var isEnded = timeLeft <= 0 || getAuctionStatus(a) !== 'active';
    var statusLabel = auctionStatusLabel(a);
    var bidStats = auctionParticipantStats(a);
    var aViews = auctionViewTotals[a.id] != null ? auctionViewTotals[a.id] : Number(a.viewCount || 0);
    var highestBid = highestAuctionBid(a);

    var badgeEl = card.querySelector('.auction-badge');
    if (badgeEl) {
      badgeEl.innerHTML = (a.bidsCount || bidStats.totalBids || 0) + ' bids · ' + bidStats.participants + ' users · ' + formatViewCount(aViews);
    }
    var priceEl = card.querySelector('.auction-current-price');
    if (priceEl) priceEl.textContent = '£' + auctionHighestBidAmount(a).toFixed(2);
    var statusEl = card.querySelector('.auction-status');
    if (statusEl) {
      statusEl.textContent = statusLabel;
      statusEl.style.background = auctionStatusColor(statusLabel);
    }
    var highestEl = card.querySelector('.auction-highest-bid--admin');
    if (highestBid && typeof window.isAdminMode !== 'undefined' && window.isAdminMode) {
      if (!highestEl) {
        var priceSection = card.querySelector('.auction-price-section');
        if (priceSection) {
          priceSection.insertAdjacentHTML('beforeend',
            '<div class="auction-highest-bid auction-highest-bid--admin"><i class="fas fa-crown" style="color:#f5af02"></i> Leading: <b>' +
            escapeHtml(highestBid.bidderName || highestBid.bidder || 'Customer') + '</b></div>');
        }
      } else {
        highestEl.innerHTML = '<i class="fas fa-crown" style="color:#f5af02"></i> Leading: <b>' +
          escapeHtml(highestBid.bidderName || highestBid.bidder || 'Customer') + '</b>';
      }
    } else if (highestEl) {
      highestEl.remove();
    }
    if (!isEnded) {
      updateAuctionTimerDom(a, timeLeft, isEnding, false);
    } else {
      var timerWrap = card.querySelector('.auction-timer');
      if (timerWrap) {
        timerWrap.className = 'auction-timer auction-timer--visible ending';
        timerWrap.innerHTML = '<div class="timer-label"><i class="fas fa-check-circle"></i> Auction Ended</div>';
      }
      var overlay = card.querySelector('.auction-countdown-overlay');
      if (overlay) overlay.remove();
    }
  });
  startAuctionTimers();
}

function renderAuctions() {
  if (window.AYLEN_PERF && window.AYLEN_PERF.shouldSkipStorefrontRender && window.AYLEN_PERF.shouldSkipStorefrontRender()) return;
  var grid = document.getElementById('auctionsGrid');
  if (!grid) return;
  grid.classList.add('auctions-rail');
  var sortedAuctions = auctions.slice().sort(function(a, b) {
    var aActive = getAuctionStatus(a) === 'active' ? 1 : 0;
    var bActive = getAuctionStatus(b) === 'active' ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return new Date(b.createdAt || b.endTime || 0) - new Date(a.createdAt || a.endTime || 0);
  });

  var structuralFp = auctionsStructuralFingerprint(sortedAuctions);
  if (structuralFp === renderAuctionsStructuralFp && grid.querySelector('.auction-card')) {
    patchAuctionCardsDynamic(sortedAuctions);
    renderAuctionsSectionMeta();
    renderEngagementStats();
    return;
  }
  renderAuctionsStructuralFp = structuralFp;
  grid.innerHTML = '';
  renderAuctionsSectionMeta();
  if (!auctions.length) {
    renderAuctionsStructuralFp = '';
    grid.innerHTML = '<div class="auctions-rail-empty">' +
      '<h3 style="color:#fff;margin-bottom:8px">No active auctions</h3>' +
      '<p>Auctions will appear here when they are added in Firestore.</p>' +
    '</div>';
    return;
  }

  for (var i = 0; i < sortedAuctions.length; i++) {
    var a = sortedAuctions[i];
    recordAuctionViewOnce(a.id);
    var domKey = auctionDomKey(a.id);
    var card = document.createElement('div');
    card.className = 'auction-card auction-card--compact';
    card.id = 'auction-' + domKey;
    
    var endTime = new Date(a.endTime);
    var now = new Date();
    var timeLeft = endTime - now;
    var isEnding = timeLeft < 3600000; // Less than 1 hour
    var isEnded = timeLeft <= 0 || getAuctionStatus(a) !== 'active';
    var statusLabel = auctionStatusLabel(a);
    
    var highestBid = highestAuctionBid(a);
    var bidStats = auctionParticipantStats(a);
    var aViews = auctionViewTotals[a.id] != null ? auctionViewTotals[a.id] : Number(a.viewCount || 0);
    var h = '<div class="auction-header">';
    h += '<span><i class="fas fa-fire"></i> ' + (isEnded ? 'AUCTION' : 'LIVE AUCTION') + '</span>';
    h += '<span class="auction-badge">' + (a.bidsCount || bidStats.totalBids || 0) + ' bids · ' + bidStats.participants + ' users · ' + formatViewCount(aViews) + '</span>';
    h += '</div>';
    
    h += '<div class="auction-image is-loading auction-card-hit" onclick="openStorefrontAuctionModal(' + jsInlineArg(a.id) + '); return false;" aria-hidden="true">';
    if (!a.images) a.images = [];
    var activeImgIdx = selectedAuctionImage[a.id] !== undefined ? selectedAuctionImage[a.id] : 0;
    if (activeImgIdx < 0 || activeImgIdx >= a.images.length) activeImgIdx = 0;
    h += '<div class="auction-image-loader" aria-live="polite"><i class="fas fa-spinner fa-spin"></i><span>Loading photo…</span></div>';
    h += renderAuctionImageMedia(a, i, activeImgIdx);
    if (a.images && a.images.length > 1) {
      h += '<span class="auction-photo-count"><i class="fas fa-images"></i> ' + a.images.length + '</span>';
    }
    h += '<div class="auction-status" style="background:' + auctionStatusColor(statusLabel) + '">' + escapeHtml(statusLabel) + '</div>';
    h += renderAuctionCountdownOverlayHtml(domKey, timeLeft, isEnding, isEnded);
    h += '</div>';

    if (a.images.length > 1 && !useMobileProductScrollGallery()) {
      h += '<div class="auction-thumb-strip auction-thumb-strip--below">';
      var maxAT = Math.min(a.images.length, 5);
      for (var aj = 0; aj < maxAT; aj++) {
        var aThumbRaw = a.images[aj] || '';
        var aThumbSrc = productCardImageSrc(aThumbRaw);
        h += '<button type="button" class="auction-thumb' + (aj === activeImgIdx ? ' active' : '') + '" data-auction-thumb="' + escapeHtml(String(a.id)) + '" data-auction-thumb-index="' + aj + '" onclick="selectAuctionImage(' + jsInlineArg(a.id) + ',' + aj + ', event); return false;" aria-label="Photo ' + (aj + 1) + '"><img src="' + escapeHtml(aThumbSrc) + '" alt="" loading="lazy" decoding="async"' + antiTheftImageAttrs() + storefrontImageDataAttrs(aThumbRaw, THUMB_FALLBACK_IMAGE) + '></button>';
      }
      if (a.images.length > maxAT) {
        h += '<span class="auction-thumb-more">+' + (a.images.length - maxAT) + '</span>';
      }
      h += '</div>';
    }
    
    h += '<div class="auction-info">';
    h += '<div class="auction-title" onclick="openStorefrontAuctionModal(' + jsInlineArg(a.id) + ')" role="button" tabindex="0" style="cursor:pointer">' + escapeHtml(a.name || 'Untitled auction') + '</div>';
    if (a.desc) h += '<div class="auction-desc">' + escapeHtml(a.desc.length > 96 ? a.desc.slice(0, 96) + '…' : a.desc) + '</div>';

    var isAdminAuctionCard = typeof window.isAdminMode !== 'undefined' && window.isAdminMode;
    h += buildAuctionMarketHtml(a, domKey, {
      isEnded: isEnded,
      timeLeft: timeLeft,
      isEnding: isEnding,
      isAdmin: isAdminAuctionCard
    });

    h += '<button type="button" class="btn-action secondary auction-card-quick" onclick="openStorefrontAuctionModal(' + jsInlineArg(a.id) + '); return false;"><i class="fas fa-expand"></i> Quick view</button>';

    if (a.winner) {
      h += '<div class="bid-history" style="background:#f8fafc;border-radius:6px;padding:8px;border-top:none">';
      h += '<strong>Winner:</strong> ' + escapeHtml(a.winner.bidderName || 'Unknown') + ' / ' + escapeHtml(maskPhone(a.winner.bidderPhone || ''));
      h += '<br><strong>Final price:</strong> £' + Number(a.winner.amount || a.currentPrice || 0).toFixed(2);
      h += '</div>';
    }

    if (getAuctionStatus(a) === 'winner_pending' && !a.winnerOrder) {
      if (needsAuctionWinnerPayment(a)) {
        h += '<button type="button" class="auction-claim-btn" onclick="promptAuctionWinnerPayment(' + jsInlineArg(a.id) + ')"><i class="fas fa-credit-card" aria-hidden="true"></i> Pay £' +
          getAuctionHammerAmount(a).toFixed(2) + ' to claim</button>';
      } else if (isAuctionWinnerPaymentPaid(a) || getAuctionWinnerPaymentConfig().winnerPaymentEnabled === false) {
        h += '<button type="button" class="auction-claim-btn" onclick="openWinnerClaimModal(' + jsInlineArg(a.id) + ')"><i class="fas fa-trophy" aria-hidden="true"></i> Claim winning order</button>';
      }
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
      h += '<button onclick="adminDuplicateAuction(' + jsInlineArg(a.id) + ')" style="flex:1;min-width:90px;padding:6px;background:#2ecc71;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">Duplicate</button>';
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
  bindAuctionImagesAfterRender();
  initAuctionScrollGalleries(grid);
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

function renderAuctionCountdownOverlayHtml(domKey, timeLeft, isEnding, isEnded) {
  if (isEnded) return '';
  return '<div class="auction-countdown-overlay' + (isEnding ? ' is-ending' : '') + '" aria-live="polite" role="timer">' +
    '<span class="auction-countdown-overlay__label"><i class="fas fa-hourglass-half" aria-hidden="true"></i> Ends in</span>' +
    '<span class="auction-countdown-overlay__time" id="timer-overlay-' + domKey + '" aria-atomic="true">' +
    formatTimeLeft(timeLeft) + '</span></div>';
}

function updateAuctionTimerDom(auction, timeLeft, isEnding, isEnded) {
  if (!auction) return;
  var domKey = auctionDomKey(auction.id);
  var label = formatTimeLeft(timeLeft);
  var cardTimer = document.getElementById('timer-' + domKey);
  var overlayTimer = document.getElementById('timer-overlay-' + domKey);
  var modalTimer = document.getElementById('pdp-timer-' + domKey);
  if (cardTimer) cardTimer.textContent = isEnded ? '00:00:00' : label;
  if (overlayTimer) overlayTimer.textContent = isEnded ? 'ENDED' : label;
  if (modalTimer) modalTimer.textContent = isEnded ? '00:00:00' : label;

  var card = document.getElementById('auction-' + domKey);
  if (!card) return;
  var timerWrap = card.querySelector('.auction-timer');
  var overlay = card.querySelector('.auction-countdown-overlay');
  if (timerWrap && !isEnded) timerWrap.classList.toggle('ending', !!isEnding);
  if (overlay && !isEnded) overlay.classList.toggle('is-ending', !!isEnding);
}

function startAuctionTimers() {
  if (window.auctionTimerInterval) clearInterval(window.auctionTimerInterval);
  if (!window._auctionEndedHandled) window._auctionEndedHandled = {};

  window.auctionTimerInterval = setInterval(function() {
    var now = new Date();
    for (var i = 0; i < auctions.length; i++) {
      var a = auctions[i];
      var domKey = auctionDomKey(a.id);
      var el = document.getElementById('timer-' + domKey);
      var modalEl = document.getElementById('pdp-timer-' + domKey);
      var overlayEl = document.getElementById('timer-overlay-' + domKey);
      if (!el && !modalEl && !overlayEl) continue;

      var endTime = new Date(a.endTime);
      var timeLeft = endTime - now;
      var isEnding = timeLeft > 0 && timeLeft < 3600000;
      var isEnded = timeLeft <= 0;
      updateAuctionTimerDom(a, timeLeft, isEnding, isEnded);

      if (timeLeft <= 0) {
        var aid = String(a.id);
        if (!window._auctionEndedHandled[aid]) {
          window._auctionEndedHandled[aid] = true;
          var adminFinalize = window.FBDB && window.FBDB.isAdmin && window.FBDB.isAdmin();
          if (adminFinalize && !a.finalizedAt && getAuctionStatus(a) === 'ended') {
            (function(auctionId) {
              finalizeAuction(auctionId).then(function() {
                renderAuctions();
                refreshAuctionModalContent(auctionId);
              });
            })(a.id);
          }
        }
      }
    }
  }, 1000);
}

function openBidModal(auctionId) {
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { openBidModal(auctionId); });
    return;
  }
  var a = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!a) { notify('Auction not found!', 'error'); return; }
  if (isAuctionBidGated(a)) {
    promptAuctionDepositRequired(auctionId);
    return;
  }
  var domKey = auctionDomKey(auctionId);
  var inputEl = document.getElementById('bid-amount-' + domKey) ||
    document.getElementById('bid-amount-modal-' + domKey);
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

function openAuctionDepositModal(auctionId) {
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { openAuctionDepositModal(auctionId); });
    return;
  }
  var a = findAuctionById(auctionId);
  if (!a) { notify('Auction not found', 'error'); return; }
  var stored = getStoredBidderContact() || {};
  var modalId = 'auctionDepositModal_' + Date.now();
  var html = '<div id="' + modalId + '" class="modal" style="display:flex">' +
    '<div class="modal-content">' +
      '<span class="close" onclick="AYLEN_MODAL.close()">&times;</span>' +
      '<h2><i class="fas fa-credit-card"></i> Pay £' + getAuctionDepositAmountGbp().toFixed(0) + ' Deposit</h2>' +
      '<p style="margin-bottom:12px;color:#666">Refundable deposit to bid on <b>' + escapeHtml(a.name || 'this lot') + '</b>. Card payment via Stripe.</p>' +
      '<input type="text" id="depName_' + modalId + '" placeholder="Your Name *" value="' + escapeHtml(stored.name || '') + '">' +
      '<input type="tel" id="depPhone_' + modalId + '" placeholder="Phone *" value="' + escapeHtml(stored.phone || '') + '">' +
      '<input type="email" id="depEmail_' + modalId + '" placeholder="Email (optional)" value="">' +
      '<button class="btn-order" onclick="startAuctionDepositCheckout(' + jsInlineArg(auctionId) + ',' + jsInlineArg(modalId) + ')">' +
        '<i class="fas fa-lock"></i> Continue to payment</button>' +
    '</div></div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
}

async function startAuctionDepositCheckout(auctionId, modalId) {
  var nameEl = modalId ? document.getElementById('depName_' + modalId) : null;
  var phoneEl = modalId ? document.getElementById('depPhone_' + modalId) : null;
  var emailEl = modalId ? document.getElementById('depEmail_' + modalId) : null;
  var stored = getStoredBidderContact() || {};
  var name = (nameEl ? nameEl.value : stored.name || '').trim();
  var phone = (phoneEl ? phoneEl.value : stored.phone || '').trim();
  var email = (emailEl ? emailEl.value : '').trim();
  if (!name || name.length < 2) { notify('Name is required', 'error'); return; }
  if (phone.replace(/\D/g, '').length < 8) { notify('Valid phone is required', 'error'); return; }
  saveStoredBidderContact({ name: name, phone: phone, contact: stored.contact || '' });
  notify('Opening secure checkout…', 'info');
  try {
    var response = await fetch('/api/auction-deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auctionId: auctionId, name: name, phone: phone, email: email })
    });
    var data = await response.json();
    if (!response.ok || !data.url) {
      notify(data.error || 'Deposit checkout failed', 'error');
      return;
    }
    window.location.href = data.url;
  } catch (e) {
    notify('Network error — try again', 'error');
  }
}

function openAuctionBuyNowModal(auctionId) {
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { openAuctionBuyNowModal(auctionId); });
    return;
  }
  var a = findAuctionById(auctionId);
  if (!a) { notify('Auction not found', 'error'); return; }
  var price = auctionBuyNowPrice(a);
  if (!price) { notify('Buy now is not available on this lot', 'error'); return; }
  var stored = getStoredBidderContact() || {};
  var modalId = 'auctionBuyNowModal_' + Date.now();
  var html = '<div id="' + modalId + '" class="modal" style="display:flex">' +
    '<div class="modal-content">' +
      '<span class="close" onclick="AYLEN_MODAL.close()">&times;</span>' +
      '<h2><i class="fas fa-bolt"></i> Buy Now</h2>' +
      '<p style="margin-bottom:12px;color:#666">Instant win for <b>' + escapeHtml(a.name || 'this lot') + '</b> at <b>£' + price.toFixed(2) + '</b>. Auction ends immediately.</p>' +
      '<input type="text" id="bnName_' + modalId + '" placeholder="Your Name *" value="' + escapeHtml(stored.name || '') + '">' +
      '<input type="tel" id="bnPhone_' + modalId + '" placeholder="Phone *" value="' + escapeHtml(stored.phone || '') + '">' +
      '<input type="text" id="bnContact_' + modalId + '" placeholder="Telegram / WhatsApp (optional)" value="' + escapeHtml(stored.contact || '') + '">' +
      '<button class="btn-order" onclick="submitAuctionBuyNow(' + jsInlineArg(auctionId) + ',' + jsInlineArg(modalId) + ')">' +
        '<i class="fas fa-bolt"></i> Buy Now · £' + price.toFixed(2) + '</button>' +
    '</div></div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
}

async function submitAuctionBuyNow(auctionId, modalId) {
  if (typeof SECURITY === 'undefined') await ensureStorefrontInteraction();
  var name = document.getElementById('bnName_' + modalId).value.trim();
  var phone = document.getElementById('bnPhone_' + modalId).value.trim();
  var contact = document.getElementById('bnContact_' + modalId).value.trim();
  if (!name || name.length < 2) { notify('Name is required', 'error'); return; }
  if (phone.replace(/\D/g, '').length < 8) { notify('Valid phone is required', 'error'); return; }
  notify('Processing buy now…', 'info');
  try {
    var response = await fetch('/api/auction-buy-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auctionId: auctionId,
        name: name,
        phone: phone,
        contact: contact,
        cardCode: (typeof currentUser !== 'undefined' && currentUser && currentUser.card) ? currentUser.card : ''
      })
    });
    var data = await response.json();
    if (!response.ok || !data.success) {
      notify(data.error || 'Buy now failed', 'error');
      return;
    }
    saveStoredBidderContact({ name: name, phone: phone, contact: contact });
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    notify('You won this lot at £' + Number(data.currentPrice || 0).toFixed(2) + '! Claim your order below.', 'success');
    renderAuctions();
    refreshAuctionModalContent(auctionId);
  } catch (e) {
    notify('Network error — try again', 'error');
  }
}

window.openAuctionDepositModal = openAuctionDepositModal;
window.startAuctionDepositCheckout = startAuctionDepositCheckout;
window.openAuctionBuyNowModal = openAuctionBuyNowModal;
window.submitAuctionBuyNow = submitAuctionBuyNow;

async function submitBid(auctionId, bidAmount, modalId) {
  if (typeof SECURITY === 'undefined') {
    await ensureStorefrontInteraction();
  }
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
  var bidResult = await placeBid(auctionId, bidAmount, { name: name, phone: phone, contact: contact }, {
    startedAt: startedAt,
    honeypot: honeypot
  });
  if (bidResult && bidResult.success) {
    notify('✓ Bid placed! £' + bidAmount.toFixed(2) + ' by ' + name, 'success');
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else {
      var modal = document.getElementById(modalId);
      if (modal) modal.remove();
    }
    renderAuctions();
    refreshAuctionModalContent(auctionId);
  } else if (bidResult && bidResult.code === 'DEPOSIT_REQUIRED') {
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    promptAuctionDepositRequired(auctionId, bidResult.error || auctionDepositFirstLabel());
  } else {
    notify((bidResult && bidResult.error) || 'Error placing bid', 'error');
  }
}

window.isAuctionBidGated = isAuctionBidGated;
window.promptAuctionDepositRequired = promptAuctionDepositRequired;
window.AYLEN_AUCTION_DEPOSIT = {
  load: loadAuctionDepositConfig,
  getConfig: getAuctionDepositConfig,
  isEnforcementActive: isAuctionDepositEnforcementActive,
  isBidGated: isAuctionBidGated,
  depositFirstLabel: auctionDepositFirstLabel
};

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
  if (!window.AYLEN_MODAL) {
    ensureStorefrontInteraction().then(function() { openWinnerClaimModal(auctionId); });
    return;
  }
  var auction = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!auction) { notify('Auction not found', 'error'); return; }
  if (!auction.winner) { notify('Winner is not ready yet', 'error'); return; }
  if (needsAuctionWinnerPayment(auction)) {
    notify('Pay the hammer price first to claim collection.', 'error');
    promptAuctionWinnerPayment(auctionId);
    return;
  }
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
  if (typeof SECURITY === 'undefined') {
    await ensureStorefrontInteraction();
  }
  var auction = auctions.find(function(item) { return sameId(item.id, auctionId); });
  if (!auction || !auction.winner) { notify('Winner not found', 'error'); return; }
  if (needsAuctionWinnerPayment(auction)) {
    notify('Winner payment required before claiming collection.', 'error');
    return;
  }
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
      if (data.code === 'PAYMENT_REQUIRED') {
        notify('Pay the hammer price before claiming collection.', 'error');
        promptAuctionWinnerPayment(auctionId);
        return;
      }
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
    refreshAuctionModalContent(auctionId);
  } catch (error) {
    notify('Winner order failed: ' + error.message, 'error');
  }
}
