/**
 * Product detail page — /product.html?id=
 */
(function() {
  var MAX_WAIT_MS = 20000;
  var POLL_MS = 200;

  function waitForProduct(productId) {
    return new Promise(function(resolve) {
      var started = Date.now();
      var fetchAttempted = false;

      function tryFetchById() {
        if (fetchAttempted || !productId) return;
        if (!window.FBDB || !window.FBDB.loadProductById) return;
        fetchAttempted = true;
        window.FBDB.loadProductById(productId).then(function(remote) {
          if (remote && remote.id) {
            if (typeof window.FBDB.mergeProductIntoCatalog === 'function') {
              window.FBDB.mergeProductIntoCatalog(remote);
            } else if (typeof products !== 'undefined') {
              var idx = products.findIndex(function(p) { return String(p.id) === String(remote.id); });
              if (idx === -1) products.push(remote);
              else products[idx] = remote;
            }
            resolve(remote);
          }
        }).catch(function() { /* retry poll */ });
      }

      function tick() {
        var p = typeof findProductById === 'function' ? findProductById(productId) : null;
        if (p) {
          resolve(p);
          return;
        }
        if (!fetchAttempted && Date.now() - started > 800) tryFetchById();
        if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.state && window.AYLEN_PRODUCTION.state.productsHydrated) {
          if (!fetchAttempted) tryFetchById();
          if (Date.now() - started >= MAX_WAIT_MS) {
            resolve(typeof findProductById === 'function' ? findProductById(productId) : null);
            return;
          }
        }
        if (Date.now() - started >= MAX_WAIT_MS) {
          resolve(null);
          return;
        }
        setTimeout(tick, POLL_MS);
      }
      tick();
    });
  }

  function renderPricingBlock(p) {
    var retailPrice = parseFloat(p.price || p.retail || 0);
    var wholesalePrice = parseFloat(p.wholesale || 0);
    var hasDiscount = p.discount && p.discount > 0;
    var salePrice = hasDiscount ? parseFloat(p.salePrice || retailPrice) : retailPrice;
    var mode = typeof priceMode !== 'undefined' ? priceMode : 'retail';
    var displayPrice = mode === 'wholesale' ? wholesalePrice : salePrice;
    var h = '<div class="product-detail-pricing">';

    if (typeof currentUser !== 'undefined' && currentUser && currentUser.discount > 0) {
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
      } else if (mode === 'wholesale' && wholesalePrice > 0) {
        h += '<span class="price-main">£' + wholesalePrice.toFixed(2) + '</span>';
        if (retailPrice > 0) h += '<span class="price-secondary">Retail £' + retailPrice.toFixed(2) + '</span>';
      } else {
        h += '<span class="price-main">£' + retailPrice.toFixed(2) + '</span>';
        if (wholesalePrice > 0) h += '<span class="price-secondary">Wholesale £' + wholesalePrice.toFixed(2) + '</span>';
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderGallery(p, activeIndex) {
    if (!p.images) p.images = [];
    if (activeIndex < 0 || activeIndex >= p.images.length) activeIndex = 0;
    var img = (p.images[activeIndex] && String(p.images[activeIndex]).trim()) ? p.images[activeIndex] : PRODUCT_FALLBACK_IMAGE;
    if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.productCardImageUrl) {
      img = window.AYLEN_IMAGES.productCardImageUrl(img);
    }
    var lazyAttrs = window.AYLEN_IMAGES ? window.AYLEN_IMAGES.lazyImgAttrs() : ' loading="lazy" decoding="async"';
    var h = '<div class="product-detail-gallery">';
    h += '<div class="product-detail-main-image">';
    h += '<img data-main-product-image="' + escapeHtml(p.id) + '" src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.name) + '"' + lazyAttrs + antiTheftImageAttrs() + ' onerror="this.src=\'' + PRODUCT_FALLBACK_IMAGE + '\';this.onerror=null;">';
    if (p.images.length > 1) {
      h += '<button type="button" class="product-arrow left" aria-label="Previous" onclick="prevImage(' + jsInlineArg(p.id) + ', event); return false;"><i class="fas fa-chevron-left"></i></button>';
      h += '<button type="button" class="product-arrow right" aria-label="Next" onclick="nextImage(' + jsInlineArg(p.id) + ', event); return false;"><i class="fas fa-chevron-right"></i></button>';
    }
    h += '</div>';
    if (p.images.length > 1) {
      h += '<div class="product-detail-thumbs">';
      for (var j = 0; j < p.images.length; j++) {
        var thumbSrc = (p.images[j] && String(p.images[j]).trim()) ? p.images[j] : THUMB_FALLBACK_IMAGE;
        var activeClass = j === activeIndex ? ' active' : '';
        h += '<button type="button" class="product-detail-thumb' + activeClass + '" onclick="selectProductImage(' + jsInlineArg(p.id) + ',' + j + ', event); return false;">';
        h += '<img src="' + escapeHtml(thumbSrc) + '" alt="Photo ' + (j + 1) + '"' + antiTheftImageAttrs() + ' onerror="this.src=\'' + THUMB_FALLBACK_IMAGE + '\';this.onerror=null;">';
        h += '</button>';
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderDetail(p) {
    var root = document.getElementById('productPageRoot');
    if (!root) return;
    var activeIndex = (typeof selectedProductImage !== 'undefined' && selectedProductImage[p.id] !== undefined)
      ? selectedProductImage[p.id] : 0;
    var desc = p.description || p.desc || '';
    var isComingSoon = p.status === 'coming_soon' || p.stockStatus === 'coming_soon' || p.badge === 'COMING SOON';
    var isSaved = typeof savedItems !== 'undefined' && savedItems.indexOf(p.id) !== -1;
    var liveStockLabel = typeof stockLabel === 'function' ? stockLabel(p) : '';

    document.title = (p.name || 'Product') + ' | AYLENSALE';
    var crumb = document.getElementById('productBreadcrumbName');
    if (crumb) crumb.textContent = p.name || 'Product';
    if (window.AYLEN_SEO && window.AYLEN_SEO.setProductPageMeta) {
      window.AYLEN_SEO.setProductPageMeta(p);
    }

    var h = '<article class="product-detail">';
    h += '<div class="product-detail-layout">';
    h += renderGallery(p, activeIndex);
    h += '<div class="product-detail-main">';
    h += '<div class="product-detail-badges">';
    var autoBadge = isComingSoon ? 'COMING SOON' : (typeof productAutoBadge === 'function' ? productAutoBadge(p) : '');
    if (autoBadge) {
      h += '<span class="product-detail-badge">' + escapeHtml(autoBadge) + '</span>';
    }
    h += '<span id="viewers-' + safeDomId(p.id) + '" class="product-chip product-chip-viewers live-product-viewers" style="display:none"></span>';
    if (liveStockLabel) {
      h += '<span class="product-chip product-chip-stock"><i class="fas fa-fire"></i> ' + escapeHtml(liveStockLabel) + '</span>';
    }
    h += '</div>';
    h += '<h1 class="product-detail-title">' + escapeHtml(p.name) + '</h1>';
    if (p.category) {
      h += '<p class="product-detail-category">' + escapeHtml(p.category) + '</p>';
    }
    h += renderPricingBlock(p);
    h += '<p class="product-detail-stock">Stock: <strong>' + (parseInt(p.stock, 10) || 0) + '</strong></p>';
    if (desc) {
      h += '<div class="product-detail-desc">' + (typeof renderProductDescriptionBlock === 'function'
        ? renderProductDescriptionBlock(p.id, desc, 'page')
        : '<p class="desc">' + escapeHtml(desc).replace(/\n/g, '<br>') + '</p>') + '</div>';
    }
    var policy = (window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.getById)
      ? window.AYLEN_LISTING_POLICIES.getById(p.policyId || p.listingPolicyId)
      : null;
    if (policy && window.AYLEN_LISTING_POLICIES.renderSummary) {
      h += '<div class="product-detail-policy">' + window.AYLEN_LISTING_POLICIES.renderSummary(policy) + '</div>';
    }
    h += '<div class="product-detail-actions">';
    h += '<div class="product-badge' + (isSaved ? ' saved' : '') + '" onclick="toggleSaveProduct(' + jsInlineArg(p.id) + ')" title="Save">' + (isSaved ? '★' : '☆') + '</div>';
    if (isComingSoon) {
      h += '<button type="button" class="btn-action primary" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'email\')"><i class="fas fa-bell"></i> Reserve</button>';
    } else if (parseInt(p.stock, 10) === 0) {
      h += '<span class="out-of-stock">Out of stock</span>';
    } else {
      h += '<button type="button" class="btn-action primary" onclick="addToCart(' + jsInlineArg(p.id) + ')"><i class="fas fa-cart-plus"></i> Add to Cart</button>';
    }
    h += '<a href="/#products" class="btn-action secondary product-detail-back-catalog"><i class="fas fa-grid-2"></i> All products</a>';
    h += '</div>';
    if (parseInt(p.stock, 10) === 0 && !isComingSoon) {
      h += '<div class="product-detail-notify">';
      h += '<p>Notify when back in stock:</p>';
      h += '<div class="notify-line">';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'email\')">Email</button>';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'telegram\')">Telegram</button>';
      h += '<button type="button" class="notify-btn" onclick="requestNotify(' + jsInlineArg(p.id) + ', \'whatsapp\')">WhatsApp</button>';
      h += '</div></div>';
    }
    h += '</div></div></article>';

    root.innerHTML = h;
    if (typeof trackProductView === 'function') trackProductView(p.id);
    if (typeof updateProductViewerBadges === 'function') updateProductViewerBadges();
    if (typeof refreshRevealItems === 'function') refreshRevealItems();
  }

  function renderNotFound(productId) {
    var root = document.getElementById('productPageRoot');
    if (!root) return;
    root.innerHTML =
      '<div class="product-detail-empty">' +
      '<h1>Product not found</h1>' +
      '<p>We could not load product <code>' + escapeHtml(String(productId || '')) + '</code>. It may be sold out or removed.</p>' +
      '<a href="/#products" class="hero-btn primary"><i class="fas fa-box-open"></i> Browse products</a>' +
      '</div>';
  }

  function renderLoading() {
    var root = document.getElementById('productPageRoot');
    if (!root) return;
    root.innerHTML =
      '<div class="product-detail-loading">' +
      '<i class="fas fa-spinner fa-spin"></i> Loading product…' +
      '</div>';
  }

  async function initProductDetailPage() {
    if (!document.body || !document.body.classList.contains('product-page')) return;
    var productId = typeof productIdFromLocation === 'function' ? productIdFromLocation() : '';
    if (!productId) {
      renderNotFound('');
      return;
    }
    renderLoading();
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

})();
