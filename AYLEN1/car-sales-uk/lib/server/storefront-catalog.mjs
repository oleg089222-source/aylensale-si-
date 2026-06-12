/**
 * Server-side storefront catalog (Firebase Admin) — first paint without client Firestore.
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';

function isValidImageUrl(url) {
  if (typeof url !== 'string') return false;
  var value = url.trim();
  if (!value || value.indexOf('data:') === 0) return false;
  return value.indexOf('https://') === 0 || value.indexOf('http://') === 0;
}

function sanitizeImages(urls) {
  return (Array.isArray(urls) ? urls : []).filter(isValidImageUrl);
}

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

function normalizeProduct(docId, raw) {
  var item = raw || {};
  var normalized = Object.assign({}, item);
  normalized.id = docId;
  if (item.id && String(item.id) !== String(docId)) normalized.legacyId = item.id;
  normalized.name = item.name || item.title || 'Untitled product';
  normalized.desc = item.desc || item.description || '';
  normalized.category = item.category || 'other';
  normalized.images = sanitizeImages(Array.isArray(item.images) ? item.images : (Array.isArray(item.photos) ? item.photos : []));
  normalized.retail = Number(item.retail || item.retailPrice || item.price || 0);
  normalized.price = Number(item.price || item.retailPrice || normalized.retail || 0);
  normalized.wholesale = Number(item.wholesale || item.wholesalePrice || normalized.price || 0);
  normalized.stock = Number(item.stock || 0);
  normalized.badge = item.badge || '';
  normalized.discount = Number(item.discount || 0);
  normalized.salePrice = Number(item.salePrice || normalized.price || 0);
  normalized.sku = item.sku || '';
  normalized.active = item.active !== false && item.status !== 'hidden';
  normalized.policyId = item.policyId || item.listingPolicyId || '';
  normalized.listingPolicyId = normalized.policyId;
  normalized.viewCount = Number(item.viewCount || 0);
  normalized.videoUrl = String(item.videoUrl || '').slice(0, 500);
  normalized.createdAt = item.createdAt || item.updatedAt || null;
  normalized.updatedAt = item.updatedAt || item.createdAt || null;
  return normalized;
}

function normalizeAuction(docId, raw) {
  var item = raw || {};
  var normalized = Object.assign({}, item);
  normalized.id = docId;
  if (item.id && String(item.id) !== String(docId)) normalized.legacyId = item.id;
  normalized.name = item.name || item.title || 'Untitled auction';
  normalized.desc = item.desc || item.description || '';
  normalized.images = sanitizeImages(Array.isArray(item.images) ? item.images : (Array.isArray(item.photos) ? item.photos : []));
  normalized.startingPrice = Number(item.startingPrice || item.startPrice || 0);
  normalized.currentPrice = Number(item.currentPrice || item.currentBid || normalized.startingPrice || 0);
  normalized.bids = Array.isArray(item.bids) ? item.bids : [];
  normalized.bidsCount = Number(item.bidsCount || normalized.bids.length || 0);
  normalized.viewCount = Number(item.viewCount || 0);
  normalized.status = item.status || 'active';
  normalized.endTime = item.endTime || item.endsAt || new Date(Date.now() + 24 * 3600000).toISOString();
  normalized.createdAt = item.createdAt || item.updatedAt || null;
  return normalized;
}

function normalizeLocation(docId, raw) {
  var item = raw || {};
  var normalized = Object.assign({}, item);
  normalized.id = docId;
  if (item.id && String(item.id) !== String(docId)) normalized.legacyId = item.id;
  normalized.name = item.name || item.title || 'Pickup location';
  normalized.address = item.address || item.postcode || '';
  normalized.postcode = item.postcode || '';
  normalized.day = item.day || item.days || '';
  normalized.days = item.days || item.day || '';
  normalized.time = item.time || '';
  normalized.lat = Number(item.lat || 0);
  normalized.lng = Number(item.lng || item.lon || 0);
  normalized.lon = normalized.lng;
  normalized.note = item.note || '';
  normalized.description = item.description || item.desc || '';
  normalized.desc = normalized.description;
  normalized.showOnWebsite = item.showOnWebsite !== false;
  var rawStatus = String(item.status || '').toLowerCase().replace(/-/g, '_');
  if (rawStatus === 'notconfirmed') rawStatus = 'not_confirmed';
  if (rawStatus === 'going' || rawStatus === 'possible' || rawStatus === 'not_confirmed') {
    normalized.status = rawStatus;
  } else if (item.goingThisWeekend === true || item.active === true) {
    normalized.status = 'going';
  } else {
    normalized.status = 'not_confirmed';
  }
  normalized.active = normalized.status === 'going';
  normalized.mapLink = item.mapLink || (normalized.address ? 'https://maps.google.com?q=' + encodeURIComponent(normalized.address) : '#');
  return normalized;
}

const EBAY_PROMO_DESC_LEGACY = 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.';
const EBAY_PROMO_DESC_DEFAULT = 'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.';

function normalizeEbayDescription(desc) {
  const text = typeof desc === 'string' ? desc.trim() : '';
  if (!text || text === EBAY_PROMO_DESC_LEGACY) return EBAY_PROMO_DESC_DEFAULT;
  return text;
}

function normalizeEbaySettings(raw) {
  var item = raw || {};
  return {
    enabled: item.enabled === true,
    url: typeof item.url === 'string' ? item.url.trim() : '',
    buttonText: item.buttonText || 'Shop on eBay',
    description: normalizeEbayDescription(item.description)
  };
}

function normalizeMarketplaceSettings(raw) {
  var item = raw || {};
  return {
    newArrivalsEnabled: item.newArrivalsEnabled !== false,
    telegramUrl: typeof item.telegramUrl === 'string' && item.telegramUrl.trim() ? item.telegramUrl.trim() : 'https://t.me/aylensale',
    whatsappUrl: typeof item.whatsappUrl === 'string' && item.whatsappUrl.trim()
      ? item.whatsappUrl.trim()
      : 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!'
  };
}

function parseLimit(value, fallback) {
  var n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), 48);
}

var CATALOG_CACHE_TTL_MS = 60000;
var catalogCache = Object.create(null);

function catalogCacheKey(opts) {
  return String(parseLimit(opts.productsLimit, 36)) + '|' + String(opts.productsAfter || '').trim();
}

async function fetchProductPage(db, limit, afterId) {
  var pageSize = limit + 1;
  var afterSnap = null;
  if (afterId) {
    afterSnap = await db.collection('products').doc(afterId).get();
    if (!afterSnap.exists) afterSnap = null;
  }

  try {
    var ordered = db.collection('products').orderBy('updatedAt', 'desc');
    if (afterSnap) ordered = ordered.startAfter(afterSnap);
    return await ordered.limit(pageSize).get();
  } catch (err) {
    var fallback = db.collection('products');
    if (afterSnap) fallback = fallback.startAfter(afterSnap);
    return fallback.limit(pageSize).get();
  }
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
  return Number(candidate.stock || 0) >= Number(incumbent.stock || 0);
}

function dedupeCatalogProducts(list) {
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

export async function getStorefrontCatalog(opts) {
  opts = opts || {};
  var cacheKey = catalogCacheKey(opts);
  var cached = catalogCache[cacheKey];
  if (cached && Date.now() - cached.at < CATALOG_CACHE_TTL_MS) {
    return cached.data;
  }

  var db = getFirestoreAdmin();
  var limit = parseLimit(opts.productsLimit, 36);
  var afterId = String(opts.productsAfter || '').trim().slice(0, 120);

  var productSnap = await fetchProductPage(db, limit, afterId);
  var productDocs = productSnap.docs;
  var hasMore = productDocs.length > limit;
  if (hasMore) productDocs = productDocs.slice(0, limit);

  var products = dedupeCatalogProducts(productDocs
    .map(function(doc) { return normalizeProduct(doc.id, doc.data()); }));

  var lastId = productDocs.length ? productDocs[productDocs.length - 1].id : null;

  var auctionSnap;
  try {
    auctionSnap = await db.collection('auctions').orderBy('updatedAt', 'desc').limit(24).get();
  } catch (err) {
    auctionSnap = await db.collection('auctions').limit(24).get();
  }
  var auctions = [];
  auctionSnap.forEach(function(doc) {
    auctions.push(normalizeAuction(doc.id, doc.data()));
  });

  var locationSnap = await db.collection('locations').limit(48).get();
  var locations = [];
  locationSnap.forEach(function(doc) {
    locations.push(normalizeLocation(doc.id, doc.data()));
  });

  var ebayDoc = await db.collection('siteSettings').doc('ebay').get();
  var marketplaceDoc = await db.collection('siteSettings').doc('marketplace').get();

  var payload = {
    ok: true,
    products: {
      items: products,
      hasMore: hasMore,
      lastId: lastId
    },
    auctions: auctions,
    locations: locations,
    settings: {
      ebay: normalizeEbaySettings(ebayDoc.exists ? ebayDoc.data() : {}),
      marketplace: normalizeMarketplaceSettings(marketplaceDoc.exists ? marketplaceDoc.data() : {})
    }
  };

  catalogCache[cacheKey] = { at: Date.now(), data: payload };

  import('./auction-engine.mjs').then(function(mod) {
    return mod.maybeRunCatalogFinalizeTick(db);
  }).catch(function(err) {
    console.warn('[storefront-catalog] finalize tick', err.message || err);
  });

  return payload;
}
