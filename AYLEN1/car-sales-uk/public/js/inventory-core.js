/**
 * Central inventory model — API-ready for eBay / Vinted / FB / TikTok (future).
 * Firestore product docs use these fields; UI maps to them.
 */
(function(global) {
  function defaultChannels() {
    return {
      website: { enabled: true, stock: 0, externalId: null, lastSyncAt: null },
      ebay: { enabled: false, stock: null, externalId: null, listingId: null, lastSyncAt: null },
      vinted: { enabled: false, stock: null, externalId: null, lastSyncAt: null },
      facebook: { enabled: false, stock: null, externalId: null, lastSyncAt: null },
      tiktok: { enabled: false, stock: null, externalId: null, lastSyncAt: null }
    };
  }

  function buildSku(product) {
    if (product.sku && String(product.sku).trim()) return String(product.sku).trim();
    var stamp = String(product.id || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-8);
    return 'AYLE-' + stamp;
  }

  function normalizeInventoryFields(product) {
    var p = Object.assign({}, product);
    var stock = parseInt(p.stock, 10);
    if (isNaN(stock) || stock < 0) stock = 0;
    p.stock = stock;
    p.sku = buildSku(p);
    if (!p.status) p.status = p.active === false ? 'hidden' : 'active';

    var inv = p.inventory && typeof p.inventory === 'object' ? Object.assign({}, p.inventory) : {};
    if (!inv.channels || typeof inv.channels !== 'object') inv.channels = defaultChannels();
    inv.onHand = typeof inv.onHand === 'number' ? inv.onHand : stock;
    inv.reserved = typeof inv.reserved === 'number' ? inv.reserved : 0;
    if (!inv.channels.website) inv.channels.website = defaultChannels().website;
    inv.channels.website.stock = stock;
    inv.channels.website.enabled = true;
    inv.updatedAt = new Date().toISOString();
    p.inventory = inv;
    return p;
  }

  global.AYLEN_INVENTORY = {
    defaultChannels: defaultChannels,
    buildSku: buildSku,
    normalizeInventoryFields: normalizeInventoryFields
  };
})(window);
