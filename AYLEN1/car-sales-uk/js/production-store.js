/**
 * Production data guards — Firestore is the only source of truth.
 * Prevents empty cache snapshots and demo/localStorage from overwriting live catalog.
 */
(function(global) {
  var LEGACY_PRODUCT_KEYS = [
    'aylen_products',
    'aylen_products_cache',
    'aylen_auctions',
    'aylen_auctions_cache',
    'aylen_locations',
    'aylen_locations_cache',
    'aylen_cardHolders',
    'aylen_cardHolders_cache'
  ];

  var state = {
    productsHydrated: false,
    auctionsHydrated: false,
    locationsHydrated: false
  };

  function isDemoCatalogProduct(item) {
    if (!item) return true;
    if (item.isDemo === true || item.demo === true || item.test === true) return true;
    var name = String(item.name || item.title || '').trim().toLowerCase();
    if (!name) return false;
    if (/^test\b/.test(name)) return true;
    if (name.indexOf('demo product') !== -1) return true;
    if (name === 'test' || name === 'test product') return true;
    return false;
  }

  function canonicalProductKey(id) {
    var raw = String(id || '').trim();
    if (!raw) return '';
    if (raw.indexOf('prod_') === 0) return raw.slice(5);
    return raw;
  }

  function shouldPreferCatalogProduct(candidate, incumbent) {
    if (!incumbent) return true;
    if (!candidate) return false;
    var candProd = String(candidate.id || '').indexOf('prod_') === 0;
    var incProd = String(incumbent.id || '').indexOf('prod_') === 0;
    if (candProd && !incProd) return true;
    if (!candProd && incProd) return false;
    var candStock = Number(candidate.stock || 0);
    var incStock = Number(incumbent.stock || 0);
    if (candStock !== incStock) return candStock > incStock;
    var candImages = Array.isArray(candidate.images) ? candidate.images.length : 0;
    var incImages = Array.isArray(incumbent.images) ? incumbent.images.length : 0;
    return candImages >= incImages;
  }

  function dedupeProductionProducts(list) {
    var seen = Object.create(null);
    var result = [];
    (Array.isArray(list) ? list : []).forEach(function(item) {
      if (!item || isDemoCatalogProduct(item)) return;
      var key = canonicalProductKey(item.id);
      if (!key) return;
      var existing = seen[key];
      if (!existing) {
        seen[key] = item;
        result.push(item);
        return;
      }
      if (shouldPreferCatalogProduct(item, existing)) {
        var idx = result.indexOf(existing);
        if (idx !== -1) result[idx] = item;
        seen[key] = item;
      }
    });
    return result;
  }

  function filterProductionProducts(list) {
    return dedupeProductionProducts(list);
  }

  function resolveProductDocId(product) {
    var raw = String((product && (product.id || product.legacyId)) || '').trim();
    if (!raw) return '';
    return raw.indexOf('prod_') === 0 ? raw : 'prod_' + raw;
  }

  function findProductIndexById(list, id) {
    var target = canonicalProductKey(id);
    if (!target) return -1;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      if (canonicalProductKey(item.id) === target) return i;
      if (item.legacyId && canonicalProductKey(item.legacyId) === target) return i;
    }
    return -1;
  }

  function canonicalAuctionKey(id) {
    var raw = String(id || '').trim();
    if (!raw) return '';
    if (raw.indexOf('auction_') === 0) return raw.slice(8);
    return raw;
  }

  function shouldPreferCatalogAuction(candidate, incumbent) {
    if (!incumbent) return true;
    if (!candidate) return false;
    var candAuction = String(candidate.id || '').indexOf('auction_') === 0;
    var incAuction = String(incumbent.id || '').indexOf('auction_') === 0;
    if (candAuction && !incAuction) return true;
    if (!candAuction && incAuction) return false;
    var candBids = Number(candidate.bidsCount || (Array.isArray(candidate.bids) ? candidate.bids.length : 0) || 0);
    var incBids = Number(incumbent.bidsCount || (Array.isArray(incumbent.bids) ? incumbent.bids.length : 0) || 0);
    if (candBids !== incBids) return candBids > incBids;
    var candUpdated = Date.parse(candidate.updatedAt || candidate.createdAt || '') || 0;
    var incUpdated = Date.parse(incumbent.updatedAt || incumbent.createdAt || '') || 0;
    return candUpdated >= incUpdated;
  }

  function dedupeProductionAuctions(list) {
    var seen = Object.create(null);
    var result = [];
    (Array.isArray(list) ? list : []).forEach(function(item) {
      if (!item) return;
      var key = canonicalAuctionKey(item.id);
      if (!key) return;
      var existing = seen[key];
      if (!existing) {
        seen[key] = item;
        result.push(item);
        return;
      }
      if (shouldPreferCatalogAuction(item, existing)) {
        var idx = result.indexOf(existing);
        if (idx !== -1) result[idx] = item;
        seen[key] = item;
      }
    });
    return result;
  }

  function findAuctionIndexById(list, id) {
    var target = canonicalAuctionKey(id);
    if (!target) return -1;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      if (canonicalAuctionKey(item.id) === target) return i;
      if (item.legacyId && canonicalAuctionKey(item.legacyId) === target) return i;
    }
    return -1;
  }

  function shouldIgnoreEmptySnapshot(collectionName, nextLength, meta) {
    meta = meta || {};
    if (nextLength > 0) return false;
    if (meta.fromServer) return false;
    if (collectionName === 'products' && state.productsHydrated) return true;
    if (collectionName === 'auctions' && state.auctionsHydrated) return true;
    if (collectionName === 'locations' && state.locationsHydrated) return true;
    return false;
  }

  function markHydrated(collectionName, count) {
    if (count <= 0) return;
    if (collectionName === 'products') state.productsHydrated = true;
    if (collectionName === 'auctions') state.auctionsHydrated = true;
    if (collectionName === 'locations') state.locationsHydrated = true;
  }

  function purgeLegacyProductionCaches() {
    LEGACY_PRODUCT_KEYS.forEach(function(key) {
      try { global.localStorage.removeItem(key); } catch (e) {}
    });
  }

  function isBlockedProductionSaveKey(key) {
    return ['products', 'auctions', 'locations', 'cardHolders', 'auctionBids'].indexOf(key) !== -1;
  }

  global.AYLEN_PRODUCTION = {
    state: state,
    isDemoCatalogProduct: isDemoCatalogProduct,
    filterProductionProducts: filterProductionProducts,
    dedupeProductionProducts: dedupeProductionProducts,
    canonicalProductKey: canonicalProductKey,
    resolveProductDocId: resolveProductDocId,
    findProductIndexById: findProductIndexById,
    canonicalAuctionKey: canonicalAuctionKey,
    dedupeProductionAuctions: dedupeProductionAuctions,
    findAuctionIndexById: findAuctionIndexById,
    shouldIgnoreEmptySnapshot: shouldIgnoreEmptySnapshot,
    markHydrated: markHydrated,
    purgeLegacyProductionCaches: purgeLegacyProductionCaches,
    isBlockedProductionSaveKey: isBlockedProductionSaveKey
  };
})(typeof window !== 'undefined' ? window : this);
