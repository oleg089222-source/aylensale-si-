/**
 * Firebase Database Integration v2
 * CLOUD STORAGE - Firestore + Cloud Storage
 * Syncs photos and products across ALL devices
 * 
 * Features:
 * - Products saved to Firestore (primary storage)
 * - Auctions saved to Firestore  
 * - Locations saved to Firestore
 * - Photos uploaded to Firebase Cloud Storage
 * - Real-time sync across all browsers and devices
 * - localStorage is never used for products/photos
 */

// Initialize Firebase (requires firebase-config.js to be loaded first)
var fbApp = null;
var fbDb = null;
var fbStorage = null;
var fbAuth = null;
var isFirebaseReady = false;
var syncInProgress = false;
window.isFirebaseReady = false;
window.isAdminAuthenticated = false;

var FIREBASE_ADMIN_EMAILS = [
  'oleg.yuryevich@gmail.com',
  'admin@aylensale.com'
];
var FIREBASE_ADMIN_EMAIL = FIREBASE_ADMIN_EMAILS[0];

function normalizeAdminFirebaseEmail(loginId) {
  var key = String(loginId || '').trim().toLowerCase();
  if (!key || key === 'admin') return FIREBASE_ADMIN_EMAIL;
  if (FIREBASE_ADMIN_EMAILS.indexOf(key) !== -1) return key;
  return null;
}

function purgeLegacyImageLocalStorage() {
  [
    'aylen_products',
    'aylen_products_cache',
    'aylen_locations',
    'aylen_locations_cache',
    'aylen_auctions',
    'aylen_auctions_cache'
  ].forEach(function(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Could not remove legacy cache:', key, e.message);
    }
  });
}

purgeLegacyImageLocalStorage();

function isFirebaseStorageUrl(url) {
  return typeof url === 'string' &&
    url.indexOf('data:') !== 0 &&
    (
      url.indexOf('firebasestorage.googleapis.com') !== -1 ||
      url.indexOf('storage.googleapis.com') !== -1
    );
}

function isValidProductImageUrl(url) {
  if (typeof url !== 'string') return false;
  var value = url.trim();
  if (!value || value.indexOf('data:') === 0) return false;
  return value.indexOf('https://') === 0 || value.indexOf('http://') === 0;
}

function firebaseImageUrls(urls) {
  return sanitizeProductImageUrls(urls);
}

function sanitizeProductImageUrls(urls) {
  return (Array.isArray(urls) ? urls : []).filter(isValidProductImageUrl);
}

function normalizeProductFromFirestore(docId, raw) {
  var item = raw || {};
  var normalized = Object.assign({}, item);

  // Always use the Firestore document id for edit/delete.
  // Some old documents contain stale numeric ids inside their data.
  normalized.id = docId;
  if (item.id && String(item.id) !== String(docId)) {
    normalized.legacyId = item.id;
  }
  normalized.name = item.name || item.title || 'Untitled product';
  normalized.desc = item.desc || item.description || '';
  normalized.category = item.category || 'other';
  normalized.images = firebaseImageUrls(Array.isArray(item.images)
    ? item.images
    : (Array.isArray(item.photos) ? item.photos : []));
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

  return normalized;
}

function normalizeAuctionFromFirestore(docId, raw) {
  var item = raw || {};
  var normalized = Object.assign({}, item);
  normalized.id = docId;
  if (item.id && String(item.id) !== String(docId)) {
    normalized.legacyId = item.id;
  }
  normalized.name = item.name || item.title || 'Untitled auction';
  normalized.desc = item.desc || item.description || '';
  normalized.images = firebaseImageUrls(Array.isArray(item.images)
    ? item.images
    : (Array.isArray(item.photos) ? item.photos : []));
  normalized.startingPrice = Number(item.startingPrice || item.startPrice || 0);
  normalized.currentPrice = Number(item.currentPrice || item.currentBid || normalized.startingPrice || 0);
  normalized.bids = Array.isArray(item.bids) ? item.bids : [];
  normalized.bidsCount = Number(item.bidsCount || normalized.bids.length || 0);
  normalized.viewCount = Number(item.viewCount || 0);
  normalized.videoUrl = String(item.videoUrl || '').slice(0, 500);
  normalized.status = item.status || 'active';
  normalized.winner = item.winner || null;
  normalized.winnerOrder = item.winnerOrder || null;
  normalized.finalizedAt = item.finalizedAt || null;
  normalized.orderSentAt = item.orderSentAt || null;
  normalized.completedAt = item.completedAt || null;
  normalized.endTime = item.endTime || item.endsAt || new Date(Date.now() + 24 * 3600000).toISOString();
  normalized.createdAt = item.createdAt || item.updatedAt || null;
  normalized.botEnabled = item.botEnabled;
  normalized.botPaused = !!item.botPaused;
  normalized.botMaxTotal = Number(item.botMaxTotal || 0);
  normalized.relistCount = Number(item.relistCount || 0);
  return normalized;
}

function productViewStatsDocId(productId) {
  return String(productId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120) || ('prod_' + Date.now());
}

function normalizeLocationFromFirestore(docId, raw) {
  var item = raw || {};
  var normalized = Object.assign({}, item);
  normalized.id = docId;
  if (item.id && String(item.id) !== String(docId)) {
    normalized.legacyId = item.id;
  }
  normalized.name = item.name || item.title || 'Pickup location';
  normalized.address = item.address || item.postcode || '';
  normalized.postcode = item.postcode || '';
  normalized.day = item.day || item.days || '';
  normalized.days = item.days || item.day || '';
  normalized.time = item.time || '';
  normalized.photoUrl = isFirebaseStorageUrl(item.photoUrl || item.imageUrl || '') ? (item.photoUrl || item.imageUrl) : '';
  normalized.mapLink = item.mapLink || (normalized.address ? 'https://maps.google.com?q=' + encodeURIComponent(normalized.address) : '#');
  normalized.lat = Number(item.lat || 0);
  normalized.lng = Number(item.lng || item.lon || 0);
  normalized.lon = normalized.lng;
  normalized.note = item.note || '';
  normalized.pinned = item.pinned === true;
  normalized.sortOrder = Number(item.sortOrder || 0);
  normalized.useCount = Number(item.useCount || item.goingCount || 0);
  normalized.saturdayTemp = item.saturdayTemp;
  normalized.sundayTemp = item.sundayTemp;
  normalized.saturdayRainPct = item.saturdayRainPct;
  normalized.sundayRainPct = item.sundayRainPct;
  normalized.weatherStatus = item.weatherStatus || '';
  normalized.weatherDays = item.weatherDays || null;
  normalized.weatherError = item.weatherError || '';
  normalized.lastWeatherUpdate = item.lastWeatherUpdate || '';
  normalized.weatherSource = item.weatherSource || '';
  normalized.showOnWebsite = item.showOnWebsite !== false;
  if (typeof window !== 'undefined' && window.AYLEN_PICKUP && window.AYLEN_PICKUP.hydrateLocationRecord) {
    return window.AYLEN_PICKUP.hydrateLocationRecord(normalized);
  }
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
  normalized.goingThisWeekend = normalized.status === 'going';
  return normalized;
}

function normalizeCardFromFirestore(docId, raw) {
  var item = raw || {};
  var status = item.status || (item.active === false ? 'blocked' : 'active');
  var discountType = item.discountType || (Number(item.discount || 0) > 0 ? 'percent' : 'percent');
  var discountValue = Number(
    item.discountValue != null ? item.discountValue : (item.discount != null ? item.discount : 0)
  );
  return {
    code: String(item.code || docId).toUpperCase(),
    name: item.name || 'Customer',
    phone: item.phone || '',
    email: item.email || '',
    discountType: discountType,
    discountValue: discountValue,
    discount: discountType === 'percent' ? discountValue : Number(item.discount || 0),
    expiryDate: item.expiryDate || '',
    usageLimit: Number(item.usageLimit || 0),
    usageCount: Number(item.usageCount || 0),
    minOrderValue: Number(item.minOrderValue || 0),
    priceGroup: item.priceGroup || '',
    note: '',
    status: status,
    active: status === 'active' && item.active !== false,
    wholesaleAccess: discountType === 'wholesale' || !!item.wholesaleAccess,
    freeDelivery: discountType === 'free_delivery' || !!item.freeDelivery,
    loyaltyTier: Number(item.loyaltyTier != null ? item.loyaltyTier : 0),
    loyaltyOrders: Number(item.loyaltyOrders || 0),
    loyaltySpend: Number(item.loyaltySpend || 0),
    batchTag: item.batchTag || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null
  };
}

function normalizeOrderFromFirestore(docId, raw) {
  var item = raw || {};
  return Object.assign({}, item, {
    id: docId,
    name: item.name || '',
    phone: item.phone || '',
    pickup: item.pickup || '',
    comment: item.comment || '',
    items: Array.isArray(item.items) ? item.items : [],
    total: Number(item.total || 0),
    card: item.card ? String(item.card).toUpperCase() : '',
    discount: Number(item.discount || 0),
    status: item.status || 'new',
    adminNote: item.adminNote || '',
    vipMember: !!item.vipMember,
    createdAt: item.createdAt || null
  });
}

function normalizePriceListItemFromFirestore(docId, raw) {
  var item = raw || {};
  var images = firebaseImageUrls(Array.isArray(item.images) ? item.images : (item.photoUrl ? [item.photoUrl] : []));
  return {
    id: docId,
    sourceProductId: item.sourceProductId || '',
    name: item.name || item.title || 'Price list item',
    desc: item.desc || item.description || '',
    retailPrice: Number(item.retailPrice || item.retail || item.price || 0),
    wholesalePrice: Number(item.wholesalePrice || item.wholesale || 0),
    minQty: Number(item.minQty || item.minimumQuantity || 1),
    note: item.note || '',
    images: images,
    photoUrl: images[0] || '',
    visible: item.visible !== false,
    stockStatus: String(item.stockStatus || item.status || 'available').slice(0, 20),
    sortOrder: Number(item.sortOrder || 0),
    updatedAt: item.updatedAt || null,
    createdAt: item.createdAt || null
  };
}

var EBAY_PROMO_DESC_LEGACY = 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.';
var EBAY_PROMO_DESC_DEFAULT = 'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.';

function normalizeEbayDescription(desc) {
  var text = typeof desc === 'string' ? desc.trim() : '';
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
    whatsappUrl: typeof item.whatsappUrl === 'string' && item.whatsappUrl.trim() ? item.whatsappUrl.trim() : 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!'
  };
}

function normalizeListingPolicyFromFirestore(docId, raw) {
  if (window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.normalize) {
    return window.AYLEN_LISTING_POLICIES.normalize(docId, raw);
  }
  var item = raw || {};
  return { id: docId, title: item.title || 'Policy' };
}

function clipText(value, max) {
  return String(value || '').slice(0, max);
}

function normalizeLegalPageBlock(raw, fallback) {
  var item = raw || {};
  var base = fallback || {};
  return {
    title: clipText(item.title || base.title || '', 120),
    updated: clipText(item.updated || base.updated || '', 80),
    notice: clipText(item.notice || base.notice || '', 500),
    bodyHtml: clipText(item.bodyHtml || base.bodyHtml || '', 50000)
  };
}

function normalizeLegalContactContent(raw) {
  var defaults = (typeof SITE_LEGAL_DEFAULTS !== 'undefined' && SITE_LEGAL_DEFAULTS.getDefaultLegalContactContent)
    ? SITE_LEGAL_DEFAULTS.getDefaultLegalContactContent()
    : {};
  var item = raw || {};
  var dContact = defaults.contact || {};
  var dBusiness = defaults.business || {};
  var dFooter = defaults.footer || {};
  var dLegal = defaults.legal || {};
  var dCookie = defaults.cookie || {};
  return {
    contact: {
      contactEmail: clipText(item.contact && item.contact.contactEmail || dContact.contactEmail, 120),
      supportEmail: clipText(item.contact && item.contact.supportEmail || dContact.supportEmail, 120),
      telegramUrl: clipText(item.contact && item.contact.telegramUrl || dContact.telegramUrl, 200),
      whatsappUrl: clipText(item.contact && item.contact.whatsappUrl || dContact.whatsappUrl, 300),
      phone: clipText(item.contact && item.contact.phone || dContact.phone, 40),
      regionLabel: clipText(item.contact && item.contact.regionLabel || dContact.regionLabel, 120)
    },
    business: {
      legalName: clipText(item.business && item.business.legalName || dBusiness.legalName, 120),
      companyNumber: clipText(item.business && item.business.companyNumber || dBusiness.companyNumber, 40),
      vatNumber: clipText(item.business && item.business.vatNumber || dBusiness.vatNumber, 40),
      registeredAddress: clipText(item.business && item.business.registeredAddress || dBusiness.registeredAddress, 500),
      businessEmail: clipText(item.business && item.business.businessEmail || dBusiness.businessEmail, 120)
    },
    footer: {
      brandDescription: clipText(item.footer && item.footer.brandDescription || dFooter.brandDescription, 500),
      consumerRightsHtml: clipText(item.footer && item.footer.consumerRightsHtml || dFooter.consumerRightsHtml, 500),
      returnsText: clipText(item.footer && item.footer.returnsText || dFooter.returnsText, 300),
      copyrightName: clipText(item.footer && item.footer.copyrightName || dFooter.copyrightName, 80),
      tagline: clipText(item.footer && item.footer.tagline || dFooter.tagline, 160)
    },
    legal: {
      privacy: normalizeLegalPageBlock(item.legal && item.legal.privacy, dLegal.privacy),
      terms: normalizeLegalPageBlock(item.legal && item.legal.terms, dLegal.terms),
      returns: normalizeLegalPageBlock(item.legal && item.legal.returns, dLegal.returns),
      cookies: normalizeLegalPageBlock(item.legal && item.legal.cookies, dLegal.cookies)
    },
    cookie: {
      bannerTitle: clipText(item.cookie && item.cookie.bannerTitle || dCookie.bannerTitle, 120),
      bannerBodyHtml: clipText(item.cookie && item.cookie.bannerBodyHtml || dCookie.bannerBodyHtml, 2000),
      analyticsLabel: clipText(item.cookie && item.cookie.analyticsLabel || dCookie.analyticsLabel, 160),
      settingsLinkText: clipText(item.cookie && item.cookie.settingsLinkText || dCookie.settingsLinkText, 80)
    }
  };
}

function normalizeLegalContactDoc(raw) {
  var item = raw || {};
  return {
    published: normalizeLegalContactContent(item.published || {}),
    draft: normalizeLegalContactContent(item.draft || item.published || {}),
    publishedAt: clipText(item.publishedAt, 40),
    draftUpdatedAt: clipText(item.draftUpdatedAt, 40),
    updatedAt: clipText(item.updatedAt, 40)
  };
}

function normalizeNotifyRequestFromFirestore(docId, raw) {
  var item = raw || {};
  return Object.assign({}, item, {
    id: docId,
    productId: item.productId || '',
    productName: item.productName || 'Product',
    method: item.method || '',
    contact: item.contact || '',
    notified: item.notified === true,
    status: item.status || (item.notified ? 'sent' : 'waiting')
  });
}

function firestoreDocId(prefix, id) {
  var cleanId = String(id || Date.now());
  return cleanId.indexOf(prefix + '_') === 0 ? cleanId : prefix + '_' + cleanId;
}

function resolveProductDocId(product) {
  if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.resolveProductDocId) {
    return window.AYLEN_PRODUCTION.resolveProductDocId(product);
  }
  return firestoreDocId('prod', product && (product.id || product.legacyId) || Date.now());
}

function mergeProductImageFields(existingData, incoming) {
  var hasIncomingImages = incoming && (Array.isArray(incoming.images) || Array.isArray(incoming.photos));
  if (hasIncomingImages) {
    var incomingImages = sanitizeProductImageUrls(incoming.images || incoming.photos || []);
    return { images: incomingImages, photos: incomingImages };
  }
  var existingImages = sanitizeProductImageUrls((existingData && (existingData.images || existingData.photos)) || []);
  return { images: existingImages, photos: existingImages };
}

function applyCatalogSnapshot(collectionName, items, meta) {
  meta = meta || {};
  var list = Array.isArray(items) ? items : [];
  if (window.AYLEN_PRODUCTION) {
    if (collectionName === 'products') {
      list = window.AYLEN_PRODUCTION.filterProductionProducts(list);
    }
    if (window.AYLEN_PRODUCTION.shouldIgnoreEmptySnapshot(collectionName, list.length, meta)) {
      console.warn('⚠️ Ignoring empty cached ' + collectionName + ' snapshot (keeping current data)');
      return false;
    }
    window.AYLEN_PRODUCTION.markHydrated(collectionName, list.length);
  }
  if (collectionName === 'products') {
    if (meta.merge) {
      list.forEach(function(item) {
        var idx = window.AYLEN_PRODUCTION
          ? window.AYLEN_PRODUCTION.findProductIndexById(products, item.id || item.legacyId)
          : products.findIndex(function(p) { return String(p.id) === String(item.id); });
        if (idx === -1) products.push(item);
        else products[idx] = item;
      });
    } else {
      products = list;
    }
    if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.dedupeProductionProducts) {
      products = window.AYLEN_PRODUCTION.dedupeProductionProducts(products);
    }
    if (typeof normalizeCart === 'function') normalizeCart();
    if (typeof renderProducts === 'function') renderProducts();
  } else if (collectionName === 'auctions') {
    if (meta.merge) {
      list.forEach(function(item) {
        var idx = window.AYLEN_PRODUCTION
          ? window.AYLEN_PRODUCTION.findAuctionIndexById(auctions, item.id || item.legacyId)
          : auctions.findIndex(function(a) { return String(a.id) === String(item.id); });
        if (idx === -1) auctions.push(item);
        else auctions[idx] = item;
      });
    } else {
      auctions = list;
    }
    if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.dedupeProductionAuctions) {
      auctions = window.AYLEN_PRODUCTION.dedupeProductionAuctions(auctions);
    }
    auctionBids = {};
    auctions.forEach(function(auction) {
      if (Array.isArray(auction.bids) && auction.bids.length > 0) {
        auctionBids[String(auction.id)] = auction.bids;
      }
    });
    if (typeof renderAuctions === 'function') renderAuctions();
  } else if (collectionName === 'locations') {
    locations = list.map(function(loc) {
      if (window.AYLEN_PICKUP && window.AYLEN_PICKUP.hydrateLocationRecord) {
        return window.AYLEN_PICKUP.hydrateLocationRecord(loc);
      }
      return loc;
    });
    if (typeof renderLocations === 'function') renderLocations();
    if (typeof fillPickup === 'function') fillPickup();
  }
  return true;
}

function firebaseCoreSdkReady() {
  return typeof firebase !== 'undefined' &&
    typeof firebase.firestore === 'function';
}

function initializeFirebaseAuth() {
  if (fbAuth || !fbApp || typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
    return false;
  }
  fbAuth = firebase.auth(fbApp);
  if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) {
      console.warn('Auth persistence:', e.message);
    });
  }
  fbAuth.onAuthStateChanged(function(user) {
    window.firebaseAdminUser = user || null;
    window.isAdminAuthenticated = isFirebaseAdminUser(user);
    syncFirebaseAdminBodyClass();
    if (window.AYLEN_ADMIN_GATE && window.AYLEN_ADMIN_GATE.setGateLoggedIn) {
      window.AYLEN_ADMIN_GATE.setGateLoggedIn(window.isAdminAuthenticated);
    }
    if (window.AYLEN_ADMIN_GATE && typeof window.AYLEN_ADMIN_GATE.onFirebaseAuth === 'function') {
      window.AYLEN_ADMIN_GATE.onFirebaseAuth(user);
    }
    if (typeof syncAdminModeWithFirebaseAuth === 'function') {
      syncAdminModeWithFirebaseAuth(user);
    }
    if (user && typeof mountEnvBannerForAdmin === 'function') mountEnvBannerForAdmin();
  });
  setTimeout(function() {
    if (FBDB.isAdmin && FBDB.isAdmin()) return;
    if (window.AYLEN_ADMIN_SESSION && window.AYLEN_ADMIN_SESSION.hydrateFromRemember) {
      window.AYLEN_ADMIN_SESSION.hydrateFromRemember();
    }
    try {
      var storedPass = window.AYLEN_ADMIN_SESSION && window.AYLEN_ADMIN_SESSION.getSessionPassword
        ? window.AYLEN_ADMIN_SESSION.getSessionPassword()
        : sessionStorage.getItem('aylen_admin_key');
      if (storedPass && FBDB.signInAdmin) {
        var storedLogin = window.AYLEN_ADMIN_SESSION && window.AYLEN_ADMIN_SESSION.getSessionLogin
          ? window.AYLEN_ADMIN_SESSION.getSessionLogin()
          : (function() { try { return sessionStorage.getItem('aylen_admin_login'); } catch (e) { return null; } })();
        FBDB.signInAdmin(storedPass, storedLogin || 'admin').catch(function(err) {
          console.warn('Admin session restore failed:', err.message);
        });
      }
    } catch (e) {}
  }, 800);
  return true;
}

function tryInitializeFirebaseFromSdk() {
  if (firebaseCoreSdkReady() && typeof firebaseConfig !== 'undefined' && !isFirebaseReady) {
    console.log('✅ Firebase SDK detected, initializing...');
    initializeFirebase();
    return true;
  }
  return false;
}

document.addEventListener('aylen-firebase-sdk-ready', tryInitializeFirebaseFromSdk);

// Wait for Firebase SDK to load and initialize (sync pages + deferred loader)
var initCheckRetries = 0;
var checkInitInterval = setInterval(function() {
  initCheckRetries++;

  if (tryInitializeFirebaseFromSdk()) {
    clearInterval(checkInitInterval);
    return;
  }

  if (initCheckRetries > 150) {
    clearInterval(checkInitInterval);
    if (!firebaseCoreSdkReady()) {
      console.warn('Firebase SDK not ready after deferred load — storefront uses API catalog');
    }
  }
}, 100);

function initializeFirebase() {
  if (isFirebaseReady) return; // Already initialized
  
  try {
    // Check if firebaseConfig is available
    if (typeof firebaseConfig === 'undefined') {
      console.error('❌ Firebase config not loaded');
      return;
    }

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK not loaded in index.html');
      return;
    }

    console.log('🔥 Firebase SDK detected, getting app reference...');
    
    // Prefer named app (vip-live-preview), then default (index/admin), then init.
    try {
      fbApp = firebase.app('aylensale-app');
      console.log('✅ Firebase named app reference obtained');
    } catch (eNamed) {
      try {
        fbApp = firebase.app();
        console.log('✅ Firebase default app reference obtained');
      } catch (eDefault) {
        console.log('⚠️ App not initialized yet, initializing now...');
        fbApp = firebase.initializeApp(firebaseConfig, 'aylensale-app');
        console.log('✅ Firebase app initialized');
      }
    }
    
    // Get Firestore reference
    if (typeof firebase.firestore === 'function') {
      fbDb = firebase.firestore(fbApp);
      console.log('✅ Firestore initialized');
    } else {
      console.warn('Firestore SDK not loaded yet');
      return;
    }
    
    // Storage SDK loads on demand (admin uploads) via FBDB.ensureStorageReady
    initializeFirebaseAuth();

    isFirebaseReady = true;
    window.isFirebaseReady = true;
    window.fbDb = fbDb;
    console.log('✅ Firebase READY - All devices will now sync photos!');
    
    // Set up real-time listeners
    setTimeout(setupFirestoreListeners, 500);
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
  }
}

/**
 * Real-time listeners - when ANY device updates data, ALL devices get notified
 */
var firestoreListenersAttached = false;

function setupFirestoreListeners() {
  if (!fbDb) {
    console.warn('⚠️ Firestore not available - real-time sync disabled');
    return;
  }
  if (firestoreListenersAttached) return;
  firestoreListenersAttached = true;
  
  console.log('📡 Setting up real-time listeners...');
  
  try {
    // Products: paginated fetch (see AYLEN_FIREBASE_CATALOG) — no full-collection listener (saves reads).
    if (window.AYLEN_FIREBASE_CATALOG) {
      window.AYLEN_FIREBASE_CATALOG.attachProductsListener('off');
    }

    fbDb.collection('auctions').onSnapshot(function(snapshot) {
      if (snapshot.metadata.fromCache && snapshot.metadata.hasPendingWrites) return;
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(normalizeAuctionFromFirestore(doc.id, doc.data()));
      });
      var applied = applyCatalogSnapshot('auctions', data, {
        fromCache: snapshot.metadata.fromCache,
        fromServer: !snapshot.metadata.fromCache
      });
      if (applied) {
        console.log('✅ Auctions updated on this device:', data.length, 'items');
      }
    }, function(error) {
      console.warn('⚠️ Auction listener error:', error.message);
    });

    fbDb.collection('locations').onSnapshot({ includeMetadataChanges: true }, function(snapshot) {
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(normalizeLocationFromFirestore(doc.id, doc.data()));
      });
      var applied = applyCatalogSnapshot('locations', data, {
        fromCache: snapshot.metadata.fromCache,
        fromServer: !snapshot.metadata.fromCache
      });
      if (applied) {
        console.log('✅ Locations updated on this device:', data.length, 'items');
      }
    }, function(error) {
      console.warn('⚠️ Location listener error:', error.message);
    });

    fbDb.collection('cards').onSnapshot(function(snapshot) {
      console.log('📡 Discount cards changed in Firestore');
      var data = {};
      snapshot.forEach(function(doc) {
        var card = normalizeCardFromFirestore(doc.id, doc.data());
        data[String(card.code).toUpperCase()] = card;
      });

      cardHolders = data;
      if (typeof validateCurrentUserCard === 'function') validateCurrentUserCard();
      if (typeof recalculateCartPrices === 'function') recalculateCartPrices();
      if (typeof renderCart === 'function') renderCart();
      console.log('✅ Discount cards updated:', Object.keys(data).length);
    }, function(error) {
      console.warn('⚠️ Discount card listener error:', error.message);
    });

    fbDb.collection('priceListItems').onSnapshot({ includeMetadataChanges: true }, function(snapshot) {
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(normalizePriceListItemFromFirestore(doc.id, doc.data()));
      });
      data.sort(function(a, b) {
        return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''));
      });
      if (typeof priceListItems !== 'undefined') {
        priceListItems.length = 0;
        data.forEach(function(item) { priceListItems.push(item); });
      }
      console.log('✅ Price list updated on this device:', data.length, 'items');
    }, function(error) {
      console.warn('⚠️ Price list listener error:', error.message);
    });

    fbDb.collection('siteSettings').doc('ebay').onSnapshot(function(doc) {
      if (typeof siteSettings === 'undefined') return;
      siteSettings.ebay = normalizeEbaySettings(doc.exists ? doc.data() : {});
      if (typeof renderEbayPromo === 'function') renderEbayPromo();
      console.log('✅ eBay settings updated');
    }, function(error) {
      console.warn('⚠️ eBay settings listener error:', error.message);
    });

    fbDb.collection('siteSettings').doc('marketplace').onSnapshot(function(doc) {
      if (typeof siteSettings === 'undefined') return;
      siteSettings.marketplace = normalizeMarketplaceSettings(doc.exists ? doc.data() : {});
      if (typeof renderNewArrivals === 'function') renderNewArrivals();
      if (typeof renderTelegramLinks === 'function') renderTelegramLinks();
      console.log('✅ Marketplace settings updated');
    }, function(error) {
      console.warn('⚠️ Marketplace settings listener error:', error.message);
    });

    fbDb.collection('siteSettings').doc('legalContact').onSnapshot(function(doc) {
      if (typeof siteSettings === 'undefined') return;
      siteSettings.legalContact = normalizeLegalContactDoc(doc.exists ? doc.data() : {});
      if (window.AYLEN_SITE_CONTENT && window.AYLEN_SITE_CONTENT.apply) {
        window.AYLEN_SITE_CONTENT.apply();
      }
      console.log('✅ Legal & contact settings updated');
    }, function(error) {
      console.warn('⚠️ Legal contact listener error:', error.message);
    });

    fbDb.collection('listingPolicies').onSnapshot(function(snapshot) {
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(normalizeListingPolicyFromFirestore(doc.id, doc.data()));
      });
      listingPolicies = data;
      console.log('✅ Listing policies updated:', data.length);
    }, function(error) {
      console.warn('⚠️ Listing policies listener error:', error.message);
    });
    
    console.log('✅ Real-time listeners active - all changes sync instantly!');
  } catch (error) {
    console.warn('⚠️ Could not setup Firestore listeners:', error.message);
  }
}

/**
 * Firebase Database API
 * All methods use Firestore (cloud). Products/photos are never saved to localStorage.
 */
var FBDB = {};

function isFirebaseAdminUser(user) {
  if (!user || !user.email) return false;
  return FIREBASE_ADMIN_EMAILS.indexOf(user.email.toLowerCase()) !== -1;
}

function syncFirebaseAdminBodyClass() {
  var authed = isFirebaseAdminUser(fbAuth ? fbAuth.currentUser : null);
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('firebase-admin-authed', authed);
  }
  try {
    window.dispatchEvent(new CustomEvent('aylen-firebase-admin'));
  } catch (e) {}
}

function requireAdminAuth(action) {
  var user = fbAuth ? fbAuth.currentUser : null;
  if (!isFirebaseAdminUser(user)) {
    throw new Error('Admin Firebase login required for ' + (action || 'this action') + '.');
  }
  return user;
}

FBDB.isAdmin = function() {
  return isFirebaseAdminUser(fbAuth ? fbAuth.currentUser : null);
};

var ADMIN_AUTH_INVALID = 'INVALID_ADMIN_LOGIN';

function mapFirebaseAuthError(err) {
  console.error('Firebase admin sign-in failed:', err);
  return ADMIN_AUTH_INVALID;
}


/**
 * FIRESTORE DATABASE OPERATIONS
 * These sync to Firestore (cloud) - visible to all devices
 */

/**
 * Save product to Firestore
 */

FBDB.saveOrder = async function(order) {
  if (!fbDb) {
    throw new Error('Firestore not available. Order was not saved.');
  }

  var data = {
    name: String(order.name || '').trim().slice(0, 100),
    phone: String(order.phone || '').trim().slice(0, 30),
    pickup: String(order.pickup || '').trim().slice(0, 160),
    comment: String(order.comment || '').trim().slice(0, 500),
    items: Array.isArray(order.items) ? order.items.slice(0, 50).map(function(item) {
      return {
        id: String(item.id || '').slice(0, 120),
        name: String(item.name || '').slice(0, 120),
        qty: Number(item.qty || 0),
        price: Number(item.price || 0)
      };
    }) : [],
    total: Number(order.total || 0),
    card: order.card ? String(order.card).trim().toUpperCase().slice(0, 40) : '',
    discount: Number(order.discount || 0),
    status: String(order.status || 'new').slice(0, 40),
    adminNote: String(order.adminNote || '').slice(0, 500),
    vipMember: !!order.vipMember,
    telegramMessageId: order.telegramMessageId || null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!data.name || !data.phone || !data.items.length) {
    throw new Error('Invalid order data.');
  }

  var doc = await fbDb.collection('orders').add(data);
  return Object.assign({ id: doc.id }, data);
};



FBDB.loadPriceListItems = async function() {
  if (!fbDb) throw new Error('Firestore not available');
  var snapshot = await fbDb.collection('priceListItems').get();
  var data = [];
  snapshot.forEach(function(doc) {
    data.push(normalizePriceListItemFromFirestore(doc.id, doc.data()));
  });
  data.sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''));
  });
  return data;
};

function auctionViewStatsDocId(auctionId) {
  return String(auctionId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120) || ('auc_' + Date.now());
}

function normalizeVipStockItemFromFirestore(docId, raw) {
  var item = raw || {};
  var images = firebaseImageUrls(Array.isArray(item.images)
    ? item.images
    : (item.imageUrl || item.photoUrl ? [item.imageUrl || item.photoUrl] : []));
  return {
    id: docId,
    title: item.title || item.name || 'VIP item',
    name: item.title || item.name || 'VIP item',
    desc: String(item.desc || item.description || '').slice(0, 1000),
    imageUrl: images[0] || '',
    photoUrl: images[0] || '',
    images: images,
    videoUrl: String(item.videoUrl || '').slice(0, 500),
    price: Number(item.price || 0),
    vipPrice: Number(item.vipPrice != null ? item.vipPrice : item.price || 0),
    badge: String(item.badge || 'VIP').slice(0, 40),
    category: String(item.category || 'general').slice(0, 40),
    categoryLabel: String(item.categoryLabel || item.category || 'General').slice(0, 60),
    visible: item.visible !== false,
    stock: Number(item.stock != null ? item.stock : 0),
    stockStatus: String(item.stockStatus || 'available').slice(0, 20),
    royalMailPayEnabled: !!item.royalMailPayEnabled,
    royalMailFeeGbp: Number(item.royalMailFeeGbp || 0),
    viewCount: Number(item.viewCount || 0),
    sortOrder: Number(item.sortOrder || 0),
    updatedAt: item.updatedAt || ''
  };
}


FBDB.loadSiteSettings = async function() {
  if (!fbDb) throw new Error('Firestore not available');
  var settings = {};
  var ebayDoc = await fbDb.collection('siteSettings').doc('ebay').get();
  var marketplaceDoc = await fbDb.collection('siteSettings').doc('marketplace').get();
  var legalDoc = await fbDb.collection('siteSettings').doc('legalContact').get();
  settings.ebay = ebayDoc.exists ? normalizeEbaySettings(ebayDoc.data()) : normalizeEbaySettings({});
  settings.marketplace = marketplaceDoc.exists ? normalizeMarketplaceSettings(marketplaceDoc.data()) : normalizeMarketplaceSettings({});
  settings.legalContact = legalDoc.exists ? normalizeLegalContactDoc(legalDoc.data()) : normalizeLegalContactDoc({});
  return settings;
};


FBDB.savePresence = async function(sessionId, presence) {
  if (!fbDb) return false;
  var cleanId = String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  if (!cleanId) return false;
  var data = {
    sessionId: cleanId,
    currentProductId: String(presence.currentProductId || '').slice(0, 120),
    cartQty: Number(presence.cartQty || 0),
    hasCart: presence.hasCart === true,
    card: String(presence.card || '').slice(0, 40),
    page: String(presence.page || '/').slice(0, 120),
    updatedAt: presence.updatedAt || new Date().toISOString(),
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  };
  await fbDb.collection('presenceSessions').doc(cleanId).set(data, { merge: true });
  return true;
};

async function recordViewViaApi(type, id) {
  var cleanId = String(id || '').slice(0, 120);
  if (!cleanId) return false;
  try {
    var res = await fetch('/api/record-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, id: cleanId }),
      keepalive: true
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

FBDB.recordProductView = async function(productId) {
  if (!productId) return false;
  return recordViewViaApi('product', String(productId));
};

FBDB.loadProductViewStats = async function() {
  if (!fbDb) return {};
  try {
    var snapshot = await fbDb.collection('productViewStats').limit(500).get();
    var map = {};
    snapshot.forEach(function(doc) {
      var item = doc.data() || {};
      var pid = String(item.productId || doc.id);
      map[pid] = Number(item.totalViews || 0);
    });
    return map;
  } catch (error) {
    return {};
  }
};

FBDB.listenProductViewStats = function(callback) {
  if (!fbDb) throw new Error('Firestore not available');
  return fbDb.collection('productViewStats').onSnapshot(function(snapshot) {
    var map = {};
    snapshot.forEach(function(doc) {
      var item = doc.data() || {};
      var pid = String(item.productId || doc.id);
      map[pid] = Number(item.totalViews || 0);
    });
    callback(map);
  }, function(error) {
    if (error && String(error.message || error).indexOf('permission') !== -1) return;
    console.warn('Product view stats listener failed:', error.message || error);
  });
};

FBDB.recordAuctionView = async function(auctionId) {
  if (!auctionId) return false;
  return recordViewViaApi('auction', String(auctionId));
};

FBDB.loadAuctionViewStats = async function() {
  if (!fbDb) return {};
  try {
    var snapshot = await fbDb.collection('auctionViewStats').limit(500).get();
    var map = {};
    snapshot.forEach(function(doc) {
      var item = doc.data() || {};
      var aid = String(item.auctionId || doc.id);
      map[aid] = Number(item.totalViews || 0);
    });
    return map;
  } catch (error) {
    return {};
  }
};

FBDB.listenPresence = function(callback) {
  if (!fbDb) throw new Error('Firestore not available');
  return fbDb.collection('presenceSessions').onSnapshot(function(snapshot) {
    var data = [];
    snapshot.forEach(function(doc) {
      data.push(Object.assign({ id: doc.id }, doc.data() || {}));
    });
    callback(data);
  }, function(error) {
    console.warn('⚠️ Presence listener error:', error.message);
  });
};

FBDB.saveActivity = async function(activity) {
  if (!fbDb) return false;
  var data = {
    message: String(activity.message || '').slice(0, 160),
    type: String(activity.type || 'activity').slice(0, 40),
    productId: String(activity.productId || '').slice(0, 120),
    createdAt: activity.createdAt || new Date().toISOString(),
    createdAtMs: Number(activity.createdAtMs || Date.now())
  };
  if (!data.message) return false;
  await fbDb.collection('activityFeed').add(data);
  return true;
};

FBDB.listenActivityFeed = function(callback) {
  if (!fbDb) throw new Error('Firestore not available');
  return fbDb.collection('activityFeed').orderBy('createdAtMs', 'desc').limit(12).onSnapshot(function(snapshot) {
    var data = [];
    snapshot.forEach(function(doc) {
      data.push(Object.assign({ id: doc.id }, doc.data() || {}));
    });
    callback(data);
  }, function(error) {
    console.warn('⚠️ Activity listener error:', error.message);
  });
};

FBDB.saveWishlist = async function(sessionId, wishlist) {
  if (!fbDb) return false;
  var cleanId = String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  if (!cleanId) return false;
  var productIds = Array.isArray(wishlist.productIds) ? wishlist.productIds.slice(0, 80).map(function(id) {
    return String(id).slice(0, 120);
  }) : [];
  await fbDb.collection('wishlists').doc(cleanId).set({
    sessionId: cleanId,
    productIds: productIds,
    count: productIds.length,
    card: String(wishlist.card || '').slice(0, 40),
    updatedAt: wishlist.updatedAt || new Date().toISOString(),
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return true;
};

/**
 * FIRESTORE LOADER FUNCTIONS
 * Load data from Firestore. No product/photo localStorage cache.
 */

FBDB.loadProducts = async function(opts) {
  if (!fbDb) {
    throw new Error('Firestore not available');
  }
  opts = opts || {};
  if (!opts.full && window.AYLEN_FIREBASE_CATALOG && window.AYLEN_FIREBASE_CATALOG.loadProductsPage) {
    var page = await window.AYLEN_FIREBASE_CATALOG.loadProductsPage({ limit: opts.limit || window.AYLEN_FIREBASE_CATALOG.DEFAULT_PAGE });
    console.log('✅ Loaded', page.items.length, 'products (page)');
    return page.items;
  }
  try {
    console.log('📡 Loading products from Firestore...');
    var snapshot = await fbDb.collection('products').get();
    var data = [];
    snapshot.forEach(function(doc) {
      data.push(normalizeProductFromFirestore(doc.id, doc.data()));
    });
    if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.dedupeProductionProducts) {
      data = window.AYLEN_PRODUCTION.dedupeProductionProducts(data);
    }
    console.log('✅ Loaded', data.length, 'products from Firestore');
    return data;
  } catch (error) {
    console.error('❌ Error loading products:', error.message);
    throw error;
  }
};

FBDB.loadProductsPage = async function(opts) {
  if (!window.AYLEN_FIREBASE_CATALOG) throw new Error('Catalog paging not loaded');
  return window.AYLEN_FIREBASE_CATALOG.loadProductsPage(opts);
};

FBDB.loadProductById = async function(id) {
  if (!window.AYLEN_FIREBASE_CATALOG) throw new Error('Catalog paging not loaded');
  return window.AYLEN_FIREBASE_CATALOG.loadProductById(id);
};

FBDB.refreshCatalogFirstPage = async function() {
  var page = await FBDB.loadProductsPage({ limit: window.AYLEN_FIREBASE_CATALOG ? window.AYLEN_FIREBASE_CATALOG.DEFAULT_PAGE : 36 });
  applyCatalogSnapshot('products', page.items, { fromServer: true, merge: true });
  return page;
};

/** Merge one product into in-memory catalog after save (works with pagination). */
FBDB.mergeProductIntoCatalog = function(saved) {
  if (!saved || !saved.id) return;
  applyCatalogSnapshot('products', [saved], { fromServer: true, merge: true });
};

FBDB.normalizeProductFromFirestore = normalizeProductFromFirestore;
window.applyCatalogSnapshot = applyCatalogSnapshot;

FBDB.loadAuctions = async function() {
  if (!fbDb) {
    throw new Error('Firestore not available');
  }

  try {
    console.log('📡 Loading auctions from Firestore...');
    var snapshot = await fbDb.collection('auctions').get();
    var data = [];
    snapshot.forEach(function(doc) {
      data.push(normalizeAuctionFromFirestore(doc.id, doc.data()));
    });
    if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.dedupeProductionAuctions) {
      data = window.AYLEN_PRODUCTION.dedupeProductionAuctions(data);
    }
    console.log('✅ Loaded', data.length, 'auctions from Firestore');
    return data;
  } catch (error) {
    console.error('❌ Error loading auctions:', error.message);
    throw error;
  }
};

FBDB.loadLocations = async function() {
  if (!fbDb) {
    throw new Error('Firestore not available');
  }

  try {
    console.log('📡 Loading locations from Firestore...');
    var snapshot = await fbDb.collection('locations').get();
    var data = [];
    snapshot.forEach(function(doc) {
      data.push(normalizeLocationFromFirestore(doc.id, doc.data()));
    });
    console.log('✅ Loaded', data.length, 'locations from Firestore');
    return data;
  } catch (error) {
    console.error('❌ Error loading locations:', error.message);
    throw error;
  }
};

FBDB.loadCards = async function() {
  if (!fbDb) {
    throw new Error('Firestore not available');
  }

  try {
    console.log('📡 Loading discount cards from Firestore...');
    var snapshot = await fbDb.collection('cards').get();
    var data = {};
      snapshot.forEach(function(doc) {
        var card = normalizeCardFromFirestore(doc.id, doc.data());
        data[String(card.code).toUpperCase()] = card;
      });
    console.log('✅ Loaded', Object.keys(data).length, 'discount cards from Firestore');
    return data;
  } catch (error) {
    console.error('❌ Error loading discount cards:', error.message);
    throw error;
  }
};

FBDB.saveNotifyRequest = async function(request) {
  if (!fbDb) {
    throw new Error('Firestore not available. Notify request was not saved.');
  }

  var data = {
    productId: String(request.productId || ''),
    productName: String(request.productName || 'Product').slice(0, 140),
    method: String(request.method || '').toLowerCase(),
    contact: String(request.contact || '').trim().slice(0, 200),
    notified: false,
    status: 'waiting',
    source: 'out_of_stock',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!data.productId || !data.contact || ['email', 'telegram', 'whatsapp'].indexOf(data.method) === -1) {
    throw new Error('Invalid notify request.');
  }

  var doc = await fbDb.collection('notifyRequests').add(data);
  return Object.assign({ id: doc.id }, data);
};

FBDB.loadListingPolicies = async function() {
  if (!fbDb) return [];
  var snapshot = await fbDb.collection('listingPolicies').get();
  var data = [];
  snapshot.forEach(function(doc) {
    data.push(normalizeListingPolicyFromFirestore(doc.id, doc.data()));
  });
  listingPolicies = data;
  return data;
};


FBDB.saveAuctionPublicState = async function(auction) {
  if (!fbDb) {
    throw new Error('Firestore not available. Auction bid was not saved.');
  }

  var auctionId = firestoreDocId('auction', auction.id || Date.now());
  var bids = Array.isArray(auction.bids) ? auction.bids : [];
  var data = {
    bids: bids,
    bidsCount: Number(auction.bidsCount || bids.length || 0),
    currentPrice: Number(auction.currentPrice || auction.startingPrice || 0),
    status: auction.status || 'active',
    updatedAt: new Date().toISOString(),
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (auction.winnerOrder) {
    data.winnerOrder = auction.winnerOrder;
    data.status = auction.status || 'order_sent';
  }

  await fbDb.collection('auctions').doc(auctionId).set(data, { merge: true });
  return auction;
};


// ============================================
// MAKE FBDB GLOBAL FOR USE IN OTHER SCRIPTS
// ============================================

window.__AYLEN_FB_CTX = function() {
  return {
    getFbDb: function() { return fbDb; },
    getFbAuth: function() { return fbAuth; },
    getFbStorage: function() { return fbStorage; },
    getFbApp: function() { return fbApp; },
    getIsFirebaseReady: function() { return isFirebaseReady; },
    requireAdminAuth: requireAdminAuth,
    isFirebaseAdminUser: isFirebaseAdminUser,
    normalizeAdminFirebaseEmail: normalizeAdminFirebaseEmail,
    mapFirebaseAuthError: mapFirebaseAuthError,
    resolveProductDocId: resolveProductDocId,
    mergeProductImageFields: mergeProductImageFields,
    firestoreDocId: firestoreDocId,
    firebaseImageUrls: firebaseImageUrls,
    isFirebaseStorageUrl: isFirebaseStorageUrl,
    normalizeOrderFromFirestore: normalizeOrderFromFirestore,
    normalizePriceListItemFromFirestore: normalizePriceListItemFromFirestore,
    normalizeListingPolicyFromFirestore: normalizeListingPolicyFromFirestore,
    normalizeNotifyRequestFromFirestore: normalizeNotifyRequestFromFirestore,
    normalizeEbaySettings: normalizeEbaySettings,
    normalizeMarketplaceSettings: normalizeMarketplaceSettings,
    normalizeLegalContactContent: normalizeLegalContactContent,
    normalizeLegalContactDoc: normalizeLegalContactDoc,
    normalizeVipStockItemFromFirestore: normalizeVipStockItemFromFirestore,
    initializeFirebaseAuth: initializeFirebaseAuth
  };
};

var _fbAdminLoadPromise = null;
function ensureFirebaseDbAdmin() {
  if (window.__aylenFbAdminReady) return Promise.resolve();
  if (_fbAdminLoadPromise) return _fbAdminLoadPromise;
  var loadScript = window.AYLEN_LAZY && window.AYLEN_LAZY.loadScript
    ? window.AYLEN_LAZY.loadScript.bind(window.AYLEN_LAZY)
    : function(src) {
        return new Promise(function(resolve, reject) {
          var el = document.createElement('script');
          el.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + (window.AYLEN_LAZY && window.AYLEN_LAZY.VERSION || Date.now());
          el.defer = true;
          el.onload = resolve;
          el.onerror = reject;
          document.body.appendChild(el);
        });
      };
  _fbAdminLoadPromise = loadScript('js/firebase-db-admin.bundle.js').catch(function() {
    return loadScript('js/firebase-db-admin.js');
  }).catch(function(err) {
    _fbAdminLoadPromise = null;
    throw err;
  });
  return _fbAdminLoadPromise;
}

function fbAdminLazy(name) {
  var fn = function() {
    var args = arguments;
    return ensureFirebaseDbAdmin().then(function() {
      var impl = FBDB[name];
      if (typeof impl !== 'function' || impl.__fbAdminLazy) {
        throw new Error('Admin module missing: ' + name);
      }
      return impl.apply(FBDB, args);
    });
  };
  fn.__fbAdminLazy = true;
  return fn;
}

FBDB.signInAdmin = fbAdminLazy("signInAdmin");
FBDB.ensureAdminSession = fbAdminLazy("ensureAdminSession");
FBDB.getAdminIdToken = fbAdminLazy("getAdminIdToken");
FBDB.signOutAdmin = fbAdminLazy("signOutAdmin");
FBDB.saveProduct = fbAdminLazy("saveProduct");
FBDB.updateProduct = fbAdminLazy("updateProduct");
FBDB.deleteProduct = fbAdminLazy("deleteProduct");
FBDB.deleteImages = fbAdminLazy("deleteImages");
FBDB.saveAuction = fbAdminLazy("saveAuction");
FBDB.deleteAuction = fbAdminLazy("deleteAuction");
FBDB.saveLocation = fbAdminLazy("saveLocation");
FBDB.deleteLocation = fbAdminLazy("deleteLocation");
FBDB.saveLocationWeather = fbAdminLazy("saveLocationWeather");
FBDB.saveCard = fbAdminLazy("saveCard");
FBDB.saveCardsBatch = fbAdminLazy("saveCardsBatch");
FBDB.saveCardNote = fbAdminLazy("saveCardNote");
FBDB.loadCardNotes = fbAdminLazy("loadCardNotes");
FBDB.deleteCard = fbAdminLazy("deleteCard");
FBDB.loadOrders = fbAdminLazy("loadOrders");
FBDB.updateShopOrder = fbAdminLazy("updateShopOrder");
FBDB.savePriceListItem = fbAdminLazy("savePriceListItem");
FBDB.deletePriceListItem = fbAdminLazy("deletePriceListItem");
FBDB.loadVipAdminMemberPreview = fbAdminLazy("loadVipAdminMemberPreview");
FBDB.loadVipAdminPanelData = fbAdminLazy("loadVipAdminPanelData");
FBDB.updateVipOrderAdmin = fbAdminLazy("updateVipOrderAdmin");
FBDB.loadVipSubscribers = fbAdminLazy("loadVipSubscribers");
FBDB.loadVipStockItems = fbAdminLazy("loadVipStockItems");
FBDB.saveVipStockItem = fbAdminLazy("saveVipStockItem");
FBDB.deleteVipStockItem = fbAdminLazy("deleteVipStockItem");
FBDB.saveVipSettings = fbAdminLazy("saveVipSettings");
FBDB.seedVipStarterStock = fbAdminLazy("seedVipStarterStock");
FBDB.loadVipSettings = fbAdminLazy("loadVipSettings");
FBDB.loadVipOrdersAdmin = fbAdminLazy("loadVipOrdersAdmin");
FBDB.saveEbaySettings = fbAdminLazy("saveEbaySettings");
FBDB.saveMarketplaceSettings = fbAdminLazy("saveMarketplaceSettings");
FBDB.saveLegalContactDraft = fbAdminLazy("saveLegalContactDraft");
FBDB.publishLegalContact = fbAdminLazy("publishLegalContact");
FBDB.saveAiAuditLog = fbAdminLazy("saveAiAuditLog");
FBDB.loadNotifyRequests = fbAdminLazy("loadNotifyRequests");
FBDB.listenNotifyRequests = fbAdminLazy("listenNotifyRequests");
FBDB.loadPendingNotifyRequests = fbAdminLazy("loadPendingNotifyRequests");
FBDB.updateNotifyRequest = fbAdminLazy("updateNotifyRequest");
FBDB.saveListingPolicy = fbAdminLazy("saveListingPolicy");
FBDB.deleteListingPolicy = fbAdminLazy("deleteListingPolicy");
FBDB.seedListingPoliciesIfEmpty = fbAdminLazy("seedListingPoliciesIfEmpty");
FBDB.ensureStorageReady = fbAdminLazy("ensureStorageReady");
FBDB.uploadImage = fbAdminLazy("uploadImage");
FBDB.uploadImageWithProgress = fbAdminLazy("uploadImageWithProgress");
FBDB.deleteImage = fbAdminLazy("deleteImage");
FBDB.downloadProductionBackup = fbAdminLazy("downloadProductionBackup");

window.FBDB = FBDB;
console.log('✅ Firebase Database API ready (FBDB)');
