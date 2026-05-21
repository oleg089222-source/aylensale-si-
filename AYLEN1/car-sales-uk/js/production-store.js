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

  function filterProductionProducts(list) {
    return (Array.isArray(list) ? list : []).filter(function(item) {
      return !isDemoCatalogProduct(item);
    });
  }

  function resolveProductDocId(product) {
    var raw = String((product && (product.id || product.legacyId)) || '').trim();
    if (!raw) return '';
    return raw.indexOf('prod_') === 0 ? raw : 'prod_' + raw;
  }

  function findProductIndexById(list, id) {
    var target = String(id || '');
    if (!target) return -1;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      if (String(item.id) === target) return i;
      if (item.legacyId && String(item.legacyId) === target) return i;
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
    resolveProductDocId: resolveProductDocId,
    findProductIndexById: findProductIndexById,
    shouldIgnoreEmptySnapshot: shouldIgnoreEmptySnapshot,
    markHydrated: markHydrated,
    purgeLegacyProductionCaches: purgeLegacyProductionCaches,
    isBlockedProductionSaveKey: isBlockedProductionSaveKey
  };
})(typeof window !== 'undefined' ? window : this);
