/**
 * Product detail page — gallery, performance, dark UX (no cart/backend changes).
 */
(function() {
  var MAX_WAIT_MS = 20000;
  var POLL_MS = 200;
  var RECENT_KEY = 'aylen_recent_products';
  var RECENT_MAX = 8;
  var TG_URL = 'https://t.me/OOY999';
  var WA_URL = 'https://wa.me/447471647771';

  var galleryState = {
    product: null,
    index: 0,
    touchStartX: 0,
    keyHandler: null
  };

  function mainUrl(raw) {
    if (!raw || !String(raw).trim()) return typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : '';
    if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productDetailMainUrl) {
      return window.AYLEN_IMAGES.productDetailMainUrl(raw);
    }
    if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productCardImageUrl) {
      return window.AYLEN_IMAGES.productCardImageUrl(raw);
    }
    return raw;
  }

  function thumbUrl(raw) {
    if (!raw || !String(raw).trim()) return typeof THUMB_FALLBACK_IMAGE !== 'undefined' ? THUMB_FALLBACK_IMAGE : mainUrl(raw);
    if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productThumbUrl) {
      return window.AYLEN_IMAGES.productThumbUrl(raw, 96);
    }
    return raw;
  }

  function inquiryText(p) {
    return encodeURIComponent('Hi, question about: ' + (p && p.name ? p.name : 'item') + ' — AYLENSALE');
  }

  function waitForProduct(productId) {
    return new Promise(function(resolve) {
      var started = Date.now();
      var fetchAttempted = false;

      function tryFetchById() {
        if (fetchAttempted || !productId || !window.FBDB || !window.FBDB.loadProductById) return;
        fetchAttempted = true;
        window.FBDB.loadProductById(productId).then(function(remote) {
          if (remote && remote.id) {
            if (window.FBDB.mergeProductIntoCatalog) window.FBDB.mergeProductIntoCatalog(remote);
            resolve(remote);
          }
        }).catch(function() {});
      }

      function tick() {
        var p = typeof findProductById === 'function' ? findProductById(productId) : null;
        if (p) { resolve(p); return; }
        if (!fetchAttempted && Date.now() - started > 600) tryFetchById();
        if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.state && window.AYLEN_PRODUCTION.state.productsHydrated) {
          if (!fetchAttempted) tryFetchById();
          if (Date.now() - started >= MAX_WAIT_MS) {
            resolve(typeof findProductById === 'function' ? findProductById(productId) : null);
            return;
          }
        }
        if (Date.now() - started >= MAX_WAIT_MS) { resolve(null); return; }
        setTimeout(tick, POLL_MS);
      }
      tick();
    });
  }

  function ensureLightbox() {
    var lb = document.getElementById('productLightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'productLightbox';
    lb.className = 'product-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Product image zoom');
    lb.innerHTML =
      '<button type="button" class="product-lightbox-close" aria-label="Close">&times;</button>' +
      '<button type="button" class="pdp-gallery-nav prev product-lightbox-prev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>' +
      '<img class="product-lightbox-img" alt="">' +
      '<button type="button" class="pdp-gallery-nav next product-lightbox-next" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>' +
      '<span class="product-lightbox-counter"></span>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function(e) {
      if (e.target === lb) closeLightbox();
    });
    lb.querySelector('.product-lightbox-close').addEventListener('click', closeLightbox);
    lb.querySelector('.product-lightbox-prev').addEventListener('click', function(e) {
      e.stopPropagation();
      galleryStep(-1);
      syncLightbox();
    });
    lb.querySelector('.product-lightbox-next').addEventListener('click', function(e) {
      e.stopPropagation();
      galleryStep(1);
      syncLightbox();
    });
    return lb;
  }

  function imagesList(p) {
    var list = Array.isArray(p.images) ? p.images.filter(function(u) { return u && String(u).trim(); }) : [];
    if (!list.length) list = [typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : ''];
    return list;
  }

  function galleryStep(delta) {
    var imgs = imagesList(galleryState.product);
    if (imgs.length <= 1) return;
    var next = galleryState.index + delta;
    if (next < 0) next = imgs.length - 1;
    if (next >= imgs.length) next = 0;
    setGalleryIndex(next);
  }

  function setGalleryIndex(idx) {
    var p = galleryState.product;
    if (!p) return;
    var imgs = imagesList(p);
    galleryState.index = Math.max(0, Math.min(idx, imgs.length - 1));
    if (typeof selectedProductImage !== 'undefined') selectedProductImage[p.id] = galleryState.index;

    var stage = document.querySelector('.pdp-gallery-stage');
    if (!stage) return;
    var main = stage.querySelector('.pdp-gallery-main');
    var counter = stage.querySelector('.pdp-gallery-counter');
    var src = mainUrl(imgs[galleryState.index]);
    if (main && main.src !== src) main.src = src;
    if (counter) counter.textContent = (galleryState.index + 1) + ' / ' + imgs.length;

    document.querySelectorAll('.pdp-gallery-thumb').forEach(function(btn, j) {
      btn.classList.toggle('active', j === galleryState.index);
    });

    var prevBtn = stage.querySelector('.pdp-gallery-nav.prev');
    var nextBtn = stage.querySelector('.pdp-gallery-nav.next');
    var multi = imgs.length > 1;
    if (prevBtn) prevBtn.disabled = !multi;
    if (nextBtn) nextBtn.disabled = !multi;
  }

  function syncLightbox() {
    var lb = document.getElementById('productLightbox');
    if (!lb || !lb.classList.contains('open')) return;
    var imgs = imagesList(galleryState.product);
    var img = lb.querySelector('.product-lightbox-img');
    var c = lb.querySelector('.product-lightbox-counter');
    if (img) {
      img.src = mainUrl(imgs[galleryState.index]);
      img.alt = galleryState.product.name || 'Product';
    }
    if (c) c.textContent = (galleryState.index + 1) + ' / ' + imgs.length;
  }

  function openLightbox() {
    var lb = ensureLightbox();
    syncLightbox();
    lb.classList.add('open');
    document.body.classList.add('modal-locked');
  }

  function closeLightbox() {
    var lb = document.getElementById('productLightbox');
    if (!lb) return;
    lb.classList.remove('open');
    if (!document.querySelector('.modal.open') && !(window.AYLEN_MODAL && window.AYLEN_MODAL.getCurrentId && window.AYLEN_MODAL.getCurrentId())) {
      document.body.classList.remove('modal-locked');
    }
  }

  function bindGalleryEvents(stage) {
    var prev = stage.querySelector('.pdp-gallery-nav.prev');
    var next = stage.querySelector('.pdp-gallery-nav.next');
    var main = stage.querySelector('.pdp-gallery-main');

    if (prev) prev.addEventListener('click', function() { galleryStep(-1); });
    if (next) next.addEventListener('click', function() { galleryStep(1); });
    if (main) main.addEventListener('click', openLightbox);

    stage.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) galleryState.touchStartX = e.touches[0].clientX;
    }, { passive: true });

    stage.addEventListener('touchend', function(e) {
      if (!galleryState.touchStartX || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - galleryState.touchStartX;
      galleryState.touchStartX = 0;
      if (Math.abs(dx) < 40) return;
      galleryStep(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.querySelectorAll('.pdp-gallery-thumb').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = Number(btn.getAttribute('data-index') || 0);
        setGalleryIndex(idx);
      });
    });
  }

  function bindKeyboard() {
    if (galleryState.keyHandler) document.removeEventListener('keydown', galleryState.keyHandler);
    galleryState.keyHandler = function(e) {
      var lb = document.getElementById('productLightbox');
      if (e.key === 'Escape') {
        if (lb && lb.classList.contains('open')) closeLightbox();
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); galleryStep(-1); syncLightbox(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); galleryStep(1); syncLightbox(); }
    };
    document.addEventListener('keydown', galleryState.keyHandler);
  }

  function renderGalleryHtml(p, activeIndex) {
    var imgs = imagesList(p);
    if (activeIndex < 0 || activeIndex >= imgs.length) activeIndex = 0;
    galleryState.product = p;
    galleryState.index = activeIndex;

    var eager = window.AYLEN_IMAGES && window.AYLEN_IMAGES.eagerMainAttrs
      ? window.AYLEN_IMAGES.eagerMainAttrs() : ' loading="eager" decoding="async" fetchpriority="high"';
    var lazy = window.AYLEN_IMAGES && window.AYLEN_IMAGES.lazyImgAttrs
      ? window.AYLEN_IMAGES.lazyImgAttrs() : ' loading="lazy" decoding="async"';

    var h = '<div class="pdp-gallery" data-pdp-gallery>';
    h += '<div class="pdp-gallery-stage">';
    h += '<span class="pdp-gallery-counter">' + (activeIndex + 1) + ' / ' + imgs.length + '</span>';
    h += '<img class="pdp-gallery-main" data-main-product-image="' + escapeHtml(p.id) + '" src="' + escapeHtml(mainUrl(imgs[activeIndex])) + '" alt="' + escapeHtml(p.name) + '"' + eager;
    if (typeof antiTheftImageAttrs === 'function') h += antiTheftImageAttrs();
    h += ' onerror="this.onerror=null;this.src=\'' + (typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : '') + '\';">';
    if (imgs.length > 1) {
      h += '<button type="button" class="pdp-gallery-nav prev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>';
      h += '<button type="button" class="pdp-gallery-nav next" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>';
    }
    h += '</div>';
    if (imgs.length > 1) {
      h += '<div class="pdp-gallery-thumbs">';
      for (var j = 0; j < imgs.length; j++) {
        h += '<button type="button" class="pdp-gallery-thumb' + (j === activeIndex ? ' active' : '') + '" data-index="' + j + '">';
        h += '<img src="' + escapeHtml(thumbUrl(imgs[j])) + '" alt="Photo ' + (j + 1) + '"' + lazy;
        if (typeof antiTheftImageAttrs === 'function') h += antiTheftImageAttrs();
        h += ' onerror="this.onerror=null;this.src=\'' + (typeof THUMB_FALLBACK_IMAGE !== 'undefined' ? THUMB_FALLBACK_IMAGE : '') + '\';"></button>';
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderPricingBlock(p) {
    var retailPrice = parseFloat(p.price || p.retail || 0);
    var wholesalePrice = parseFloat(p.wholesale || 0);
    var hasDiscount = p.discount && p.discount > 0;
    var salePrice = hasDiscount ? parseFloat(p.salePrice || retailPrice) : retailPrice;
    var mode = typeof priceMode !== 'undefined' ? priceMode : 'retail';
    var displayPrice = mode === 'wholesale' ? wholesalePrice : salePrice;
    var h = '<div class="product-detail-pricing"><div class="product-prices">';
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.discount > 0) {
      var dp = (displayPrice * (1 - currentUser.discount / 100)).toFixed(2);
      if (hasDiscount) {
        h += '<span class="price-original">£' + retailPrice.toFixed(2) + '</span><span class="price-sale">£' + salePrice.toFixed(2) + '</span>';
        h += '<span class="price-secondary">Your price £' + dp + '</span>';
      } else {
        h += '<span class="price-main">£' + displayPrice.toFixed(2) + '</span><span class="price-secondary">Your price £' + dp + '</span>';
      }
    } else if (hasDiscount) {
      h += '<span class="price-original">£' + retailPrice.toFixed(2) + '</span><span class="price-sale">£' + salePrice.toFixed(2) + '</span>';
      h += '<span class="price-badge-discount">-' + p.discount + '%</span>';
    } else if (mode === 'wholesale' && wholesalePrice > 0) {
      h += '<span class="price-main">£' + wholesalePrice.toFixed(2) + '</span>';
      if (retailPrice > 0) h += '<span class="price-secondary">Retail £' + retailPrice.toFixed(2) + '</span>';
    } else {
      h += '<span class="price-main">£' + retailPrice.toFixed(2) + '</span>';
      if (wholesalePrice > 0) h += '<span class="price-secondary">Wholesale £' + wholesalePrice.toFixed(2) + '</span>';
    }
    h += '</div></div>';
    return { html: h, displayPrice: displayPrice };
  }

  function pushRecentlyViewed(id) {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      list = list.filter(function(x) { return String(x) !== String(id); });
      list.unshift(String(id));
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch (e) { /* ignore */ }
  }

  function getRecentlyViewed(excludeId) {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return list.filter(function(id) { return String(id) !== String(excludeId); }).slice(0, 6);
    } catch (e) {
      return [];
    }
  }

  function relatedProducts(p, limit) {
    limit = limit || 4;
    var list = typeof products !== 'undefined' ? products : [];
    var cat = String(p.category || '');
    var out = list.filter(function(x) {
      if (!x || String(x.id) === String(p.id)) return false;
      if (x.active === false && !window.isAdminMode) return false;
      if (cat && String(x.category || '') === cat) return true;
      return false;
    });
    if (out.length < limit) {
      list.forEach(function(x) {
        if (out.length >= limit) return;
        if (!x || String(x.id) === String(p.id)) return;
        if (x.active === false && !window.isAdminMode) return;
        if (out.some(function(o) { return String(o.id) === String(x.id); })) return;
        out.push(x);
      });
    }
    return out.slice(0, limit);
  }

  function renderProductCards(items, title) {
    if (!items.length) return '';
    var h = '<section class="product-page-section"><h2>' + escapeHtml(title) + '</h2><div class="product-related-grid">';
    items.forEach(function(item) {
      var url = typeof productPageUrl === 'function' ? productPageUrl(item.id) : '/product.html?id=' + encodeURIComponent(item.id);
      var img = (item.images && item.images[0]) ? thumbUrl(item.images[0]) : (typeof PRODUCT_FALLBACK_IMAGE !== 'undefined' ? PRODUCT_FALLBACK_IMAGE : '');
      h += '<a class="product-related-card" href="' + escapeHtml(url) + '">';
      h += '<img src="' + escapeHtml(img) + '" alt="" loading="lazy" decoding="async">';
      h += '<span>' + escapeHtml(item.name || 'Product') + '</span></a>';
    });
    h += '</div></section>';
    return h;
  }

  function updateStickyBar(displayPrice, p, canAdd) {
    var bar = document.getElementById('productStickyBar');
    if (!bar) return;
    if (!canAdd) {
      bar.classList.remove('is-visible');
      bar.setAttribute('aria-hidden', 'true');
      return;
    }
    bar.classList.add('is-visible');
    bar.setAttribute('aria-hidden', 'false');
    var priceEl = bar.querySelector('.product-sticky-price');
    if (priceEl) priceEl.textContent = '£' + Number(displayPrice).toFixed(2);
    var btn = bar.querySelector('[data-sticky-add]');
    if (btn) btn.onclick = function() { if (typeof addToCart === 'function') addToCart(p.id); };
  }

  function renderDetail(p) {
    var root = document.getElementById('productPageRoot');
    if (!root) return;

    var activeIndex = (typeof selectedProductImage !== 'undefined' && selectedProductImage[p.id] !== undefined)
      ? selectedProductImage[p.id] : 0;
    var desc = p.description || p.desc || '';
    var isComingSoon = p.status === 'coming_soon' || p.stockStatus === 'coming_soon' || p.badge === 'COMING SOON';
    var isSaved = typeof savedItems !== 'undefined' && savedItems.some(function(sid) {
      return typeof sameId === 'function' ? sameId(sid, p.id) : String(sid) === String(p.id);
    });
    var liveStockLabel = typeof stockLabel === 'function' ? stockLabel(p) : '';
    var pricing = renderPricingBlock(p);
    var canAdd = !isComingSoon && (parseInt(p.stock, 10) || 0) > 0;
    var msg = inquiryText(p);

    document.documentElement.classList.add('product-page-ready');
    document.title = (p.name || 'Product') + ' | AYLENSALE';
    var crumb = document.getElementById('productBreadcrumbName');
    if (crumb) crumb.textContent = p.name || 'Product';
    if (window.AYLEN_SEO && window.AYLEN_SEO.setProductPageMeta) window.AYLEN_SEO.setProductPageMeta(p);

    pushRecentlyViewed(p.id);

    var h = '<article class="product-detail">';
    h += '<a href="/#products" class="btn-action secondary product-detail-back-top"><i class="fas fa-arrow-left"></i> Back to products</a>';
    h += '<div class="product-detail-layout">';
    h += '<div class="product-detail-gallery-wrap">' + renderGalleryHtml(p, activeIndex) + '</div>';
    h += '<div class="product-detail-main">';
    h += '<div class="product-detail-badges">';
    var autoBadge = isComingSoon ? 'COMING SOON' : (typeof productAutoBadge === 'function' ? productAutoBadge(p) : '');
    if (autoBadge) h += '<span class="product-detail-badge">' + escapeHtml(autoBadge) + '</span>';
    h += '<span id="viewers-' + safeDomId(p.id) + '" class="product-chip product-chip-viewers live-product-viewers" style="display:none"></span>';
    if (liveStockLabel) h += '<span class="product-chip product-chip-stock"><i class="fas fa-fire"></i> ' + escapeHtml(liveStockLabel) + '</span>';
    h += '</div>';
    h += '<h1 class="product-detail-title">' + escapeHtml(p.name) + '</h1>';
    if (p.category) h += '<p class="product-detail-category">' + escapeHtml(p.category) + '</p>';
    h += pricing.html;
    h += '<p class="product-detail-stock">Stock: <strong>' + (parseInt(p.stock, 10) || 0) + '</strong></p>';
    h += '<div class="product-detail-inquiry">';
    h += '<a class="product-inquiry-btn product-inquiry-btn--tg" href="' + TG_URL + '?text=' + msg + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-telegram"></i> Telegram inquiry</a>';
    h += '<a class="product-inquiry-btn product-inquiry-btn--wa" href="' + WA_URL + '?text=' + msg + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> WhatsApp inquiry</a>';
    h += '</div>';
    if (desc) {
      h += '<div class="product-detail-desc">' + (typeof renderProductDescriptionBlock === 'function'
        ? renderProductDescriptionBlock(p.id, desc, 'page')
        : '<div class="product-detail-desc-body">' + escapeHtml(desc).replace(/\n/g, '<br>') + '</div>') + '</div>';
    }
    var policy = window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.getById
      ? window.AYLEN_LISTING_POLICIES.getById(p.policyId || p.listingPolicyId) : null;
    if (policy && window.AYLEN_LISTING_POLICIES.renderSummary) {
      h += '<div class="product-detail-policy">' + window.AYLEN_LISTING_POLICIES.renderSummary(policy) + '</div>';
    }
    h += '<div class="product-detail-actions" id="productDetailActions">';
    h += '<div class="product-badge' + (isSaved ? ' saved' : '') + '" onclick="toggleSaveProduct(' + jsInlineArg(p.id) + ')" title="Save">' + (isSaved ? '★' : '☆') + '</div>';
    if (isComingSoon) {
      h += '<button type="button" class="btn-action primary" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'email\')"><i class="fas fa-bell"></i> Reserve</button>';
    } else if (!canAdd) {
      h += '<span class="out-of-stock">Out of stock</span>';
    } else {
      h += '<button type="button" class="btn-action primary" onclick="addToCart(' + jsInlineArg(p.id) + ')"><i class="fas fa-cart-plus"></i> Add to Cart</button>';
    }
    h += '<a href="/#products" class="btn-action secondary"><i class="fas fa-grid-2"></i> All products</a>';
    h += '</div>';
    if (!canAdd && !isComingSoon) {
      h += '<div class="product-detail-notify"><p>Notify when back:</p><div class="notify-line">';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'email\')">Email</button>';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'telegram\')">Telegram</button>';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'whatsapp\')">WhatsApp</button>';
      h += '</div></div>';
    }
    h += '</div></div></article>';

    var recentIds = getRecentlyViewed(p.id);
    var recentItems = recentIds.map(function(id) { return typeof findProductById === 'function' ? findProductById(id) : null; }).filter(Boolean);
    h += renderProductCards(relatedProducts(p), 'Related products');
    h += renderProductCards(recentItems, 'Recently viewed');

    root.innerHTML = h;

    var stage = root.querySelector('.pdp-gallery-stage');
    if (stage) bindGalleryEvents(stage);
    bindKeyboard();

    window.AYLEN_PRODUCT_GALLERY = {
      productId: p.id,
      setIndex: setGalleryIndex
    };

    updateStickyBar(pricing.displayPrice, p, canAdd);
    if (typeof trackProductView === 'function') trackProductView(p.id);
    if (typeof updateProductViewerBadges === 'function') updateProductViewerBadges();
  }

  function renderNotFound(productId) {
    var root = document.getElementById('productPageRoot');
    if (!root) return;
    document.documentElement.classList.add('product-page-ready');
    root.innerHTML =
      '<div class="product-detail-empty">' +
      '<h1>Product not found</h1>' +
      '<p>We could not load this product. It may have been removed.</p>' +
      '<a href="/#products" class="btn-action primary"><i class="fas fa-arrow-left"></i> Back to products</a>' +
      '</div>';
  }

  async function initProductDetailPage() {
    if (!document.body || !document.body.classList.contains('product-page')) return;
    var productId = typeof productIdFromLocation === 'function' ? productIdFromLocation() : '';
    if (!productId) {
      renderNotFound('');
      return;
    }
    var product = await waitForProduct(productId);
    if (!product) {
      renderNotFound(productId);
      return;
    }
    renderDetail(product);
  }

  window.initProductDetailPage = initProductDetailPage;
  window.refreshProductDetailPage = function() {
    var id = typeof productIdFromLocation === 'function' ? productIdFromLocation() : '';
    var p = typeof findProductById === 'function' ? findProductById(id) : null;
    if (p) renderDetail(p);
  };
  window.closeLightbox = closeLightbox;
})();
