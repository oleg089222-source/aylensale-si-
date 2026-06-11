/**
 * Centralized click delegation for storefront (Phase 2 — fewer inline handlers).
 */
(function(global) {
  'use strict';

  function callFn(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    var fn = global[name];
    if (typeof fn === 'function') return fn.apply(global, args);
    return undefined;
  }

  function productId(el) {
    return String(el.getAttribute('data-product-id') || el.getAttribute('data-id') || '').trim();
  }

  function auctionId(el) {
    return String(el.getAttribute('data-auction-id') || el.getAttribute('data-id') || '').trim();
  }

  var HANDLERS = {
    logout: function() { callFn('logout'); },
    'open-cart': function() { callFn('openCart'); },
    'close-cart': function() { callFn('closeCart'); },
    'open-checkout': function() { callFn('openCheckout'); },
    'close-checkout': function() { callFn('closeCheckout'); },
    'open-price-list': function() { callFn('openPriceList'); },
    'download-price-list': function() { callFn('downloadPriceList'); },
    'print-price-list': function() { callFn('printPriceList'); },
    'download-price-list-csv': function() { callFn('downloadPriceListCsv'); },
    'modal-close': function() {
      if (global.AYLEN_MODAL && global.AYLEN_MODAL.close) global.AYLEN_MODAL.close();
    },
    'add-to-cart': function(el, e) {
      if (e && el.getAttribute('data-action-stop') === '1') e.stopPropagation();
      callFn('addToCart', productId(el));
    },
    'open-cart-modal': function(el, e) {
      if (e) e.stopPropagation();
      callFn('openCart');
    },
    'product-modal': function(el, e) {
      var id = productId(el);
      if (!id) return;
      if (e && e.preventDefault) e.preventDefault();
      callFn('openStorefrontProductModal', id);
      callFn('trackProductView', id);
    },
    'product-details': function(el, e) {
      if (e && e.preventDefault) e.preventDefault();
      callFn('openProductCardDetailsModal', productId(el));
    },
    'carousel-prev': function(el, e) {
      if (e && e.preventDefault) e.preventDefault();
      callFn('prevImage', productId(el), e);
    },
    'carousel-next': function(el, e) {
      if (e && e.preventDefault) e.preventDefault();
      callFn('nextImage', productId(el), e);
    },
    'select-image': function(el, e) {
      if (e && e.preventDefault) e.preventDefault();
      var idx = parseInt(el.getAttribute('data-index') || '0', 10);
      callFn('selectProductImage', productId(el), idx, e);
    },
    notify: function(el) {
      callFn('requestNotify', productId(el), el.getAttribute('data-channel') || 'email');
    },
    'change-qty': function(el) {
      callFn('changeQty', productId(el), parseInt(el.getAttribute('data-delta') || '0', 10));
    },
    'auction-modal': function(el, e) {
      if (e && e.preventDefault) e.preventDefault();
      callFn('openStorefrontAuctionModal', auctionId(el));
    },
    'open-bid': function(el) {
      var id = auctionId(el);
      var auction = typeof global.findAuctionById === 'function' ? global.findAuctionById(id) : null;
      if (typeof global.isAuctionBidGated === 'function' && auction && global.isAuctionBidGated(auction)) {
        if (typeof global.promptAuctionDepositRequired === 'function') {
          global.promptAuctionDepositRequired(id);
        } else {
          callFn('openAuctionDepositModal', id);
        }
        return;
      }
      callFn('openBidModal', id);
    },
    'auction-deposit': function(el) {
      callFn('openAuctionDepositModal', auctionId(el));
    },
    'auction-buy-now': function(el) {
      callFn('openAuctionBuyNowModal', auctionId(el));
    },
    'track-product': function(el, e) {
      if (e && e.preventDefault) e.preventDefault();
      callFn('trackProductView', productId(el));
    }
  };

  function handleClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    if (!action || !HANDLERS[action]) return;
    if (el.tagName === 'A' || el.getAttribute('role') === 'link') {
      if (e.preventDefault) e.preventDefault();
    }
    if (el.getAttribute('data-action-stop') === '1' && e.stopPropagation) {
      e.stopPropagation();
    }
    HANDLERS[action](el, e);
  }

  function init() {
    if (global._aylenStorefrontActionsInit) return;
    global._aylenStorefrontActionsInit = true;
    document.addEventListener('click', handleClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.AYLEN_STOREFRONT_ACTIONS = {
    init: init,
    register: function(action, fn) {
      if (action && typeof fn === 'function') HANDLERS[action] = fn;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
