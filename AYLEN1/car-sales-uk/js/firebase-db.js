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

function normalizeEbaySettings(raw) {
  var item = raw || {};
  return {
    enabled: item.enabled === true,
    url: typeof item.url === 'string' ? item.url.trim() : '',
    buttonText: item.buttonText || 'Shop on eBay',
    description: item.description || 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.'
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
          ? window.AYLEN_PRODUCTION.findProductIndexById(products, item.id)
          : products.findIndex(function(p) { return String(p.id) === String(item.id); });
        if (idx === -1) products.push(item);
        else products[idx] = item;
      });
    } else {
      products = list;
    }
    if (typeof normalizeCart === 'function') normalizeCart();
    if (typeof renderProducts === 'function') renderProducts();
  } else if (collectionName === 'auctions') {
    auctions = list;
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

function tryInitializeFirebaseFromSdk() {
  if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && !isFirebaseReady) {
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
    console.error('❌ Firebase SDK initialization timeout');
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
      console.error('❌ Firestore SDK not loaded');
    }
    
    // Storage SDK loads on demand (admin uploads) via FBDB.ensureStorageReady

    if (typeof firebase.auth === 'function') {
      fbAuth = firebase.auth(fbApp);
      if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
        fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) {
          console.warn('Auth persistence:', e.message);
        });
      }
      fbAuth.onAuthStateChanged(function(user) {
        window.firebaseAdminUser = user || null;
        window.isAdminAuthenticated = isFirebaseAdminUser(user);
        console.log(window.isAdminAuthenticated ? '✅ Firebase admin authenticated' : 'ℹ️ Firebase admin signed out');
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
      console.log('✅ Firebase Auth initialized');
    } else {
      console.error('❌ Firebase Auth SDK not loaded');
    }
    
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

FBDB.signInAdmin = async function(password, loginId) {
  if (!fbAuth) throw new Error(ADMIN_AUTH_INVALID);
  if (!password || String(password).length < 4) {
    throw new Error(ADMIN_AUTH_INVALID);
  }
  var email = normalizeAdminFirebaseEmail(loginId || 'admin');
  if (!email) throw new Error(ADMIN_AUTH_INVALID);
  try {
    var result = await fbAuth.signInWithEmailAndPassword(email, String(password));
    if (!isFirebaseAdminUser(result.user)) {
      await fbAuth.signOut();
      throw new Error(ADMIN_AUTH_INVALID);
    }
    window.isAdminAuthenticated = true;
    return result.user;
  } catch (err) {
    if (err && err.message === ADMIN_AUTH_INVALID) throw err;
    throw new Error(mapFirebaseAuthError(err));
  }
};

/**
 * Restore Firebase Auth after page reload (sessionStorage from admin login).
 */
FBDB.ensureAdminSession = async function() {
  if (FBDB.isAdmin()) return true;
  var pass = null;
  if (window.AYLEN_ADMIN_SESSION && window.AYLEN_ADMIN_SESSION.getSessionPassword) {
    pass = window.AYLEN_ADMIN_SESSION.getSessionPassword();
  }
  if (!pass) {
    try {
      pass = sessionStorage.getItem('aylen_admin_key');
    } catch (e) {}
  }
  if (!pass) {
    throw new Error(ADMIN_AUTH_INVALID);
  }
  var storedLogin = null;
  if (window.AYLEN_ADMIN_SESSION && window.AYLEN_ADMIN_SESSION.getSessionLogin) {
    storedLogin = window.AYLEN_ADMIN_SESSION.getSessionLogin();
  }
  if (!storedLogin) {
    try {
      storedLogin = sessionStorage.getItem('aylen_admin_login');
    } catch (e) {}
  }
  await FBDB.signInAdmin(pass, storedLogin || 'admin');
  if (!FBDB.isAdmin()) {
    throw new Error(ADMIN_AUTH_INVALID);
  }
  return true;
};

/**
 * Bearer token for VIP preview / admin API calls (uses named Firebase app, not default).
 */
FBDB.getAdminIdToken = async function(forceRefresh) {
  if (!isFirebaseReady) {
    await new Promise(function(resolve, reject) {
      var tries = 0;
      var timer = setInterval(function() {
        tries += 1;
        if (isFirebaseReady) {
          clearInterval(timer);
          resolve();
        } else if (tries > 80) {
          clearInterval(timer);
          reject(new Error('Firebase is still loading — wait a moment and try again'));
        }
      }, 100);
    });
  }
  await FBDB.ensureAdminSession();
  if (!fbAuth || !fbAuth.currentUser) {
    throw new Error('Admin Firebase login required — open Admin CMS and sign in first');
  }
  return fbAuth.currentUser.getIdToken(!!forceRefresh);
};

FBDB.signOutAdmin = async function() {
  if (fbAuth) await fbAuth.signOut();
};

/**
 * FIRESTORE DATABASE OPERATIONS
 * These sync to Firestore (cloud) - visible to all devices
 */

/**
 * Save product to Firestore
 */
FBDB.saveProduct = async function(product) {
  if (!fbDb) {
    throw new Error('Firestore not available. Product was not saved.');
  }
  await FBDB.ensureAdminSession();
  requireAdminAuth('saving products');

  try {
    if (window.AYLEN_INVENTORY && window.AYLEN_INVENTORY.normalizeInventoryFields) {
      product = window.AYLEN_INVENTORY.normalizeInventoryFields(product);
    }
    var productId = resolveProductDocId(product);
    if (!productId) {
      throw new Error('Missing product id for Firestore save.');
    }
    var ref = fbDb.collection('products').doc(productId);
    var existing = await ref.get();
    var data = Object.assign({}, product);
    delete data.id;
    delete data.legacyId;
    var imageFields = mergeProductImageFields(existing.exists ? existing.data() : {}, data);
    data.images = imageFields.images;
    data.photos = imageFields.photos;
    data.isDemo = false;
    data.demo = false;
    data.test = false;
    
    data.updatedAt = new Date().toISOString();
    if (!existing.exists) data.createdAt = data.updatedAt;
    data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
    
    await ref.set(data, { merge: true });
    if (!existing.exists && data.name) {
      FBDB.saveActivity({
        message: 'New pallet added: ' + data.name,
        type: 'new_product',
        productId: productId,
        createdAt: new Date().toISOString(),
        createdAtMs: Date.now()
      }).catch(function(e) {});
    }
    console.log('☁️ Product saved to Firestore:', productId);
    return Object.assign({}, product, { id: productId, images: data.images, photos: data.photos });
  } catch (error) {
    console.error('❌ Error saving product to Firestore:', error.message);
    throw error;
  }
};

FBDB.updateProduct = async function(productId, product) {
  if (!fbDb) {
    throw new Error('Firestore not available. Product was not updated.');
  }
  await FBDB.ensureAdminSession();
  requireAdminAuth('updating products');

  if (window.AYLEN_INVENTORY && window.AYLEN_INVENTORY.normalizeInventoryFields) {
    product = window.AYLEN_INVENTORY.normalizeInventoryFields(product);
  }

  var docId = resolveProductDocId({ id: productId, legacyId: product && product.legacyId });
  if (!docId) {
    throw new Error('Missing productId. Edit mode cannot create a new product.');
  }

  try {
    var ref = fbDb.collection('products').doc(docId);
    var existing = await ref.get();
    if (!existing.exists) {
      throw new Error('Product document not found in Firestore: ' + docId + '. Refusing to create a duplicate — refresh and try again.');
    }

    var data = Object.assign({}, product);
    delete data.id;
    delete data.legacyId;
    var imageFields = mergeProductImageFields(existing.data(), data);
    data.images = imageFields.images;
    data.photos = imageFields.photos;
    data.updatedAt = new Date().toISOString();
    data.lastModified = firebase.firestore.FieldValue.serverTimestamp();

    await ref.update(data);
    console.log('☁️ Product updated in Firestore:', docId);
    return Object.assign({}, product, { id: docId, images: data.images, photos: data.photos });
  } catch (error) {
    console.error('❌ Error updating product in Firestore:', error.message);
    throw error;
  }
};

/**
 * Delete product from Firestore
 */
FBDB.deleteProduct = async function(productId) {
  if (!fbDb) {
    throw new Error('Firestore not available. Product was not deleted.');
  }
  await FBDB.ensureAdminSession();
  requireAdminAuth('deleting products');

  try {
    var docId = String(productId || '').trim();
    if (!docId) throw new Error('Missing productId. Product was not deleted.');
    var snap = await fbDb.collection('products').doc(docId).get();
    if (snap.exists) {
      var data = snap.data() || {};
      var urls = firebaseImageUrls(data.images).concat(firebaseImageUrls(data.photos || []));
      if (data.videoUrl) urls.push(String(data.videoUrl));
      await FBDB.deleteImages(urls);
    }
    await fbDb.collection('products').doc(docId).delete();
    console.log('☁️ Product deleted from Firestore:', docId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting product:', error.message);
    throw error;
  }
};

/**
 * Save auction to Firestore
 */
FBDB.deleteImages = async function(urls) {
  var list = Array.isArray(urls) ? urls : [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var url = String(list[i] || '').trim();
    if (!url || seen[url]) continue;
    seen[url] = true;
    try {
      await FBDB.deleteImage(url);
    } catch (e) {
      console.warn('[deleteImages]', url, e.message);
    }
  }
  return true;
};

FBDB.saveAuction = async function(auction) {
  if (!fbDb) {
    throw new Error('Firestore not available. Auction was not saved.');
  }
  await FBDB.ensureAdminSession();
  requireAdminAuth('saving auctions');

  try {
    var auctionId = firestoreDocId('auction', auction.id || Date.now());
    var data = Object.assign({}, auction);
    delete data.id;
    data.images = firebaseImageUrls(data.images);
    data.photos = firebaseImageUrls(data.photos || data.images);
    data.bids = Array.isArray(data.bids) ? data.bids : [];
    data.bidsCount = Number(data.bidsCount || data.bids.length || 0);
    data.currentPrice = Number(data.currentPrice || data.startingPrice || 0);
    data.status = data.status || 'active';
    data.winner = data.winner || null;
    data.winnerOrder = data.winnerOrder || null;
    data.updatedAt = new Date().toISOString();
    data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
    
    await fbDb.collection('auctions').doc(auctionId).set(data, { merge: true });
    console.log('☁️ Auction saved to Firestore:', auctionId);
    return Object.assign({}, auction, { id: auctionId });
  } catch (error) {
    console.error('❌ Error saving auction:', error.message);
    throw error;
  }
};

/**
 * Delete auction from Firestore
 */
FBDB.deleteAuction = async function(auctionId) {
  if (!fbDb) {
    throw new Error('Firestore not available. Auction was not deleted.');
  }
  await FBDB.ensureAdminSession();
  requireAdminAuth('deleting auctions');

  try {
    var docId = firestoreDocId('auction', auctionId);
    var snap = await fbDb.collection('auctions').doc(docId).get();
    if (snap.exists) {
      var data = snap.data() || {};
      var urls = firebaseImageUrls(data.images).concat(firebaseImageUrls(data.photos || []));
      await FBDB.deleteImages(urls);
    }
    await fbDb.collection('auctions').doc(docId).delete();
    console.log('☁️ Auction deleted from Firestore');
    return true;
  } catch (error) {
    console.error('❌ Error deleting auction:', error.message);
    throw error;
  }
};

/**
 * Save location to Firestore
 */
FBDB.saveLocation = async function(location) {
  if (!fbDb) {
    throw new Error('Firestore not available. Location was not saved.');
  }
  requireAdminAuth('saving pickup locations');

  try {
    var locationId = String(location.id || '').trim();
    if (!locationId) {
      locationId = firestoreDocId('loc', Date.now());
    }
    var data = Object.assign({}, location);
    delete data.id;
    delete data.legacyId;
    data.photoUrl = isFirebaseStorageUrl(data.photoUrl) ? data.photoUrl : '';
    data.imageUrl = isFirebaseStorageUrl(data.imageUrl) ? data.imageUrl : data.photoUrl;
    data.lat = Number(data.lat || 0);
    data.lng = Number(data.lng || data.lon || 0);
    data.lon = data.lng;
    if (window.AYLEN_PICKUP && window.AYLEN_PICKUP.syncPickupStatusFields) {
      window.AYLEN_PICKUP.syncPickupStatusFields(data);
    }
    data.updatedAt = new Date().toISOString();
    data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
    
    await fbDb.collection('locations').doc(locationId).set(data, { merge: true });
    console.log('☁️ Location saved to Firestore:', locationId);
    return Object.assign({}, location, { id: locationId });
  } catch (error) {
    console.error('❌ Error saving location:', error.message);
    throw error;
  }
};

/**
 * Delete location from Firestore
 */
FBDB.deleteLocation = async function(locationId) {
  if (!fbDb) {
    throw new Error('Firestore not available. Location was not deleted.');
  }
  requireAdminAuth('deleting pickup locations');

  try {
    var docId = String(locationId || '').trim();
    if (!docId) throw new Error('Missing locationId. Location was not deleted.');
    await fbDb.collection('locations').doc(docId).delete();
    console.log('☁️ Location deleted from Firestore:', docId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting location:', error.message);
    throw error;
  }
};

FBDB.saveLocationWeather = async function(locationId, weather) {
  if (!FBDB.isAdmin || !FBDB.isAdmin()) return false;
  if (!fbDb) {
    throw new Error('Firestore not available. Weather was not saved.');
  }
  var docId = String(locationId || '').trim();
  if (!docId) throw new Error('Missing locationId. Weather was not saved.');

  var data = {
    saturdayTemp: Number(weather.saturdayTemp || 0),
    sundayTemp: Number(weather.sundayTemp || 0),
    saturdayRainPct: Number(weather.saturdayRainPct || 0),
    sundayRainPct: Number(weather.sundayRainPct || 0),
    weatherStatus: String(weather.weatherStatus || ''),
    weatherDays: weather.weatherDays || null,
    weatherError: String(weather.weatherError || ''),
    lastWeatherUpdate: weather.lastWeatherUpdate || new Date().toISOString(),
    weatherSource: 'open-meteo',
    weatherUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (weather.lat !== undefined) data.lat = Number(weather.lat || 0);
  if (weather.lng !== undefined || weather.lon !== undefined) {
    data.lng = Number(weather.lng || weather.lon || 0);
    data.lon = data.lng;
  }

  var ref = fbDb.collection('locations').doc(docId);
  var existing = await ref.get();
  if (existing.exists) {
    var old = existing.data() || {};
    var oldTime = old.lastWeatherUpdate ? new Date(old.lastWeatherUpdate).getTime() : 0;
    var newTime = new Date(data.lastWeatherUpdate).getTime();
    if (oldTime && newTime && oldTime > newTime) return old;
  }
  await ref.set(data, { merge: true });
  return data;
};

FBDB.saveCard = async function(code, card) {
  var cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('Card code is required');
  }

  if (!fbDb) {
    throw new Error('Firestore not available. Card was not saved.');
  }
  requireAdminAuth('saving discount cards');

  var data = Object.assign({}, card, {
    code: cleanCode,
    discount: Number(card.discount || 0),
    status: ['unused', 'active', 'blocked'].indexOf(card.status) !== -1 ? card.status : (card.active === false ? 'blocked' : 'unused'),
    active: card.status === 'blocked' ? false : card.active !== false,
    updatedAt: new Date().toISOString(),
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  });
  data.note = firebase.firestore.FieldValue.delete();
  if (!data.createdAt) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  await fbDb.collection('cards').doc(cleanCode).set(data, { merge: true });
  console.log('☁️ Discount card saved:', cleanCode);
  return data;
};

FBDB.saveCardsBatch = async function(cardsByCode) {
  if (!fbDb) {
    throw new Error('Firestore not available. Cards were not saved.');
  }
  requireAdminAuth('saving discount cards');
  var codes = Object.keys(cardsByCode || {});
  if (!codes.length) return { saved: 0 };

  var saved = 0;
  var chunkSize = 400;
  for (var i = 0; i < codes.length; i += chunkSize) {
    var batch = fbDb.batch();
    var chunk = codes.slice(i, i + chunkSize);
    chunk.forEach(function(code) {
      var cleanCode = String(code || '').trim().toUpperCase();
      if (!cleanCode) return;
      var card = cardsByCode[code] || {};
      var data = Object.assign({}, card, {
        code: cleanCode,
        discount: Number(card.discount || 0),
        status: ['unused', 'active', 'blocked', 'paused', 'expired'].indexOf(card.status) !== -1
          ? card.status
          : (card.active === false ? 'blocked' : 'unused'),
        active: card.status === 'active' && card.active !== false,
        updatedAt: new Date().toISOString(),
        lastModified: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (!data.createdAt) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      batch.set(fbDb.collection('cards').doc(cleanCode), data, { merge: true });
      saved++;
    });
    await batch.commit();
  }
  console.log('☁️ Discount cards batch saved:', saved);
  return { saved: saved };
};

FBDB.saveCardNote = async function(code, note) {
  var cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) throw new Error('Card code is required');
  if (!fbDb) throw new Error('Firestore not available. Card note was not saved.');
  requireAdminAuth('saving card notes');

  await fbDb.collection('cardNotes').doc(cleanCode).set({
    code: cleanCode,
    note: String(note || '').slice(0, 1000),
    updatedAt: new Date().toISOString(),
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return true;
};

FBDB.loadCardNotes = async function() {
  if (!fbDb) throw new Error('Firestore not available.');
  requireAdminAuth('reading card notes');
  var snapshot = await fbDb.collection('cardNotes').get();
  var notes = {};
  snapshot.forEach(function(doc) {
    var data = doc.data() || {};
    notes[String(data.code || doc.id).toUpperCase()] = data.note || '';
  });
  return notes;
};

FBDB.deleteCard = async function(code) {
  var cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) return true;

  if (!fbDb) {
    throw new Error('Firestore not available. Card was not deleted.');
  }
  requireAdminAuth('deleting discount cards');

  await fbDb.collection('cards').doc(cleanCode).delete();
  try {
    await fbDb.collection('cardNotes').doc(cleanCode).delete();
  } catch (e) {}
  console.log('☁️ Discount card deleted:', cleanCode);
  return true;
};

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

FBDB.loadOrders = async function() {
  if (!fbDb) {
    throw new Error('Firestore not available.');
  }
  requireAdminAuth('reading orders');

  var snapshot = await fbDb.collection('orders').get();
  var data = [];
  snapshot.forEach(function(doc) {
    data.push(normalizeOrderFromFirestore(doc.id, doc.data()));
  });
  data.sort(function(a, b) {
    var ad = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    var bd = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bd - ad;
  });
  return data;
};

FBDB.updateShopOrder = async function(orderId, patch) {
  if (!fbDb) throw new Error('Firestore not available');
  requireAdminAuth('updating shop orders');
  var docId = String(orderId || '').trim();
  if (!docId) throw new Error('Missing order id');
  var data = { updatedAt: new Date().toISOString() };
  if (patch && patch.status != null) data.status = String(patch.status).slice(0, 40);
  if (patch && patch.adminNote != null) data.adminNote = String(patch.adminNote || '').slice(0, 500);
  await fbDb.collection('orders').doc(docId).set(data, { merge: true });
  return true;
};

FBDB.savePriceListItem = async function(item) {
  if (!fbDb) throw new Error('Firestore not available. Price list item was not saved.');
  requireAdminAuth('saving price list items');
  var itemId = String(item.id || '').trim() || ('pli_' + Date.now());
  var data = Object.assign({}, item);
  delete data.id;
  data.images = firebaseImageUrls(data.images || (data.photoUrl ? [data.photoUrl] : []));
  data.photoUrl = data.images[0] || '';
  data.name = String(data.name || 'Price list item').slice(0, 140);
  data.desc = String(data.desc || '').slice(0, 1000);
  data.retailPrice = Number(data.retailPrice || 0);
  data.wholesalePrice = Number(data.wholesalePrice || 0);
  data.minQty = Number(data.minQty || 1);
  data.stockStatus = String(data.stockStatus || 'available').slice(0, 80);
  data.note = String(data.note || '').slice(0, 500);
  data.visible = data.visible !== false;
  data.sortOrder = Number(data.sortOrder || 0);
  data.updatedAt = new Date().toISOString();
  data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
  if (!data.createdAt) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  await fbDb.collection('priceListItems').doc(itemId).set(data, { merge: true });
  return Object.assign({ id: itemId }, data);
};

FBDB.deletePriceListItem = async function(itemId) {
  if (!fbDb) throw new Error('Firestore not available. Price list item was not deleted.');
  requireAdminAuth('deleting price list items');
  var docId = String(itemId || '').trim();
  if (!docId) throw new Error('Missing price list item id.');
  await fbDb.collection('priceListItems').doc(docId).delete();
  return true;
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

FBDB.loadVipAdminMemberPreview = async function() {
  await FBDB.ensureAdminSession();
  if (!fbAuth || !fbAuth.currentUser) {
    throw new Error('Admin Firebase login required for VIP live preview.');
  }
  requireAdminAuth('loading VIP member preview');
  var token = await fbAuth.currentUser.getIdToken();
  var resp = await fetch('/api/vip-admin-member-preview', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token }
  });
  var data = {};
  try {
    data = await resp.json();
  } catch (e) {}
  if (!resp.ok) {
    throw new Error((data && data.error) || ('VIP live preview API failed (' + resp.status + ')'));
  }
  return data;
};

FBDB.loadVipAdminPanelData = async function() {
  if (!fbAuth || !fbAuth.currentUser) {
    throw new Error('Admin Firebase login required for loading VIP admin data.');
  }
  requireAdminAuth('loading VIP admin data');
  var token = await fbAuth.currentUser.getIdToken();
  var resp = await fetch('/api/vip?action=admin-panel', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token }
  });
  var data = {};
  try {
    data = await resp.json();
  } catch (e) {}
  if (!resp.ok) {
    throw new Error((data && data.error) || ('VIP admin API failed (' + resp.status + ')'));
  }
  return {
    subscribers: data.subscribers || [],
    stock: data.stock || [],
    settings: data.settings || {},
    liveStats: data.liveStats || null,
    orders: data.orders || []
  };
};

FBDB.updateVipOrderAdmin = async function(orderId, patch) {
  if (!fbAuth || !fbAuth.currentUser) {
    throw new Error('Admin Firebase login required for updating VIP orders.');
  }
  requireAdminAuth('updating VIP orders');
  var token = await fbAuth.currentUser.getIdToken();
  var resp = await fetch('/api/vip-admin-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      orderId: orderId,
      status: patch && patch.status,
      adminNote: patch && patch.adminNote,
      royalMailTracking: patch && patch.royalMailTracking
    })
  });
  var data = {};
  try {
    data = await resp.json();
  } catch (e) {}
  if (!resp.ok) {
    throw new Error((data && data.error) || ('VIP order update failed (' + resp.status + ')'));
  }
  return data.order || data;
};

FBDB.loadVipSubscribers = async function() {
  if (!fbDb) throw new Error('Firestore not available');
  requireAdminAuth('loading VIP subscribers');
  var snapshot;
  try {
    snapshot = await fbDb.collection('vipSubscribers').orderBy('updatedAt', 'desc').limit(500).get();
  } catch (err) {
    snapshot = await fbDb.collection('vipSubscribers').limit(500).get();
  }
  var data = [];
  snapshot.forEach(function(doc) {
    var row = doc.data() || {};
    data.push({
      id: doc.id,
      email: row.email || '',
      phone: row.phone || '',
      status: row.status || '',
      stripeCustomerId: row.stripeCustomerId || '',
      stripeSubscriptionId: row.stripeSubscriptionId || '',
      currentPeriodEnd: row.currentPeriodEnd || '',
      cancelAtPeriodEnd: !!row.cancelAtPeriodEnd,
      amountGbp: Number(row.amountGbp || 9.99),
      paymentFailedCount: Number(row.paymentFailedCount || 0),
      lastPaymentAt: row.lastPaymentAt || '',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || ''
    });
  });
  data.sort(function(a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  return data;
};

FBDB.loadVipStockItems = async function() {
  if (!fbDb) throw new Error('Firestore not available');
  requireAdminAuth('loading VIP stock items');
  var snapshot = await fbDb.collection('vipStockItems').get();
  var data = [];
  snapshot.forEach(function(doc) {
    data.push(normalizeVipStockItemFromFirestore(doc.id, doc.data()));
  });
  data.sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  return data;
};

FBDB.saveVipStockItem = async function(item) {
  await FBDB.ensureAdminSession();
  requireAdminAuth('saving VIP stock items');

  if (fbAuth && fbAuth.currentUser) {
    var token = await fbAuth.currentUser.getIdToken();
    var resp = await fetch('/api/vip-admin-stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ action: 'save', item: item })
    });
    var data = {};
    try {
      data = await resp.json();
    } catch (e) {}
    if (resp.ok && data.item) {
      return normalizeVipStockItemFromFirestore(data.item.id || item.id, data.item);
    }
    if (resp.ok) {
      return normalizeVipStockItemFromFirestore(item.id, item);
    }
    var apiErr = (data && data.error) || ('VIP stock save failed (' + resp.status + ')');
    if (!fbDb) throw new Error(apiErr);
    console.warn('[VIP stock] API save failed, trying Firestore client:', apiErr);
  }

  if (!fbDb) throw new Error('Firestore not available');
  var itemId = String(item.id || '').trim() || ('vip_' + Date.now());
  var payload = Object.assign({}, item);
  delete payload.id;
  payload.title = String(payload.title || payload.name || 'VIP item').slice(0, 140);
  payload.name = payload.title;
  payload.desc = String(payload.desc || '').slice(0, 1000);
  payload.images = firebaseImageUrls(Array.isArray(payload.images) ? payload.images : (payload.imageUrl ? [payload.imageUrl] : []));
  payload.imageUrl = payload.images[0] || (isValidProductImageUrl(payload.imageUrl) ? payload.imageUrl : '');
  payload.photoUrl = payload.imageUrl;
  payload.videoUrl = String(payload.videoUrl || '').slice(0, 500);
  payload.price = Number(payload.price || 0);
  payload.vipPrice = Number(payload.vipPrice != null ? payload.vipPrice : payload.price || 0);
  payload.badge = String(payload.badge || 'VIP').slice(0, 40);
  payload.category = String(payload.category || 'general').slice(0, 40);
  payload.categoryLabel = String(payload.categoryLabel || payload.category || 'General').slice(0, 60);
  payload.visible = payload.visible !== false;
  payload.stock = Math.max(0, Number(payload.stock != null ? payload.stock : 0));
  payload.stockStatus = String(payload.stockStatus || 'available').slice(0, 20);
  if (payload.stock === 0 && payload.stockStatus === 'available') payload.stockStatus = 'sold';
  payload.royalMailPayEnabled = !!payload.royalMailPayEnabled;
  payload.royalMailFeeGbp = Number(payload.royalMailFeeGbp || 0);
  payload.viewCount = Number(payload.viewCount || 0);
  payload.sortOrder = Number(payload.sortOrder || 0);
  payload.updatedAt = new Date().toISOString();
  payload.lastModified = firebase.firestore.FieldValue.serverTimestamp();
  if (!payload.createdAt) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  await fbDb.collection('vipStockItems').doc(itemId).set(payload, { merge: true });
  return normalizeVipStockItemFromFirestore(itemId, payload);
};

FBDB.deleteVipStockItem = async function(itemId) {
  await FBDB.ensureAdminSession();
  requireAdminAuth('deleting VIP stock items');

  if (fbAuth && fbAuth.currentUser) {
    var token = await fbAuth.currentUser.getIdToken();
    var resp = await fetch('/api/vip-admin-stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ action: 'delete', itemId: itemId })
    });
    var data = {};
    try {
      data = await resp.json();
    } catch (e) {}
    if (resp.ok) return true;
    var apiErr = (data && data.error) || ('VIP stock delete failed (' + resp.status + ')');
    if (!fbDb) throw new Error(apiErr);
    console.warn('[VIP stock] API delete failed, trying Firestore client:', apiErr);
  }

  if (!fbDb) throw new Error('Firestore not available');
  var docId = String(itemId || '').trim();
  if (!docId) throw new Error('Missing VIP stock item id.');
  await fbDb.collection('vipStockItems').doc(docId).delete();
  return true;
};

function vipCarouselDefaults() {
  return global.AYLEN_VIP_CAROUSEL_DEFAULTS || null;
}

function parseVipCarouselField(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  }
  return [];
}

function vipSettingsCarouselPatch(data) {
  return {
    carouselSchemaVersion: Number(data && data.carouselSchemaVersion || 0),
    carouselImages: parseVipCarouselField(data && data.carouselImages),
    hubCarouselImages: parseVipCarouselField(data && data.hubCarouselImages)
  };
}

function resolveVipPaywallCarouselForAdmin(data) {
  var defs = vipCarouselDefaults();
  var patch = vipSettingsCarouselPatch(data);
  if (defs && defs.resolveVipPaywallCarousel) return defs.resolveVipPaywallCarousel(patch);
  return patch.carouselImages.length ? patch.carouselImages : (defs && defs.DEFAULT_VIP_PAYWALL_CAROUSEL) || [];
}

function resolveVipHubCarouselForAdmin(data) {
  var defs = vipCarouselDefaults();
  var patch = vipSettingsCarouselPatch(data);
  if (defs && defs.resolveVipHubCarousel) return defs.resolveVipHubCarousel(patch);
  return patch.hubCarouselImages.length ? patch.hubCarouselImages : (defs && defs.DEFAULT_VIP_HUB_CAROUSEL) || [];
}

function sanitizeVipCarouselUrlsForSave(urls, kind) {
  var defs = vipCarouselDefaults();
  var list = parseVipCarouselField(urls);
  if (defs && defs.sanitizeVipCarouselUrls) {
    var fb = kind === 'hub'
      ? (defs.DEFAULT_VIP_HUB_CAROUSEL || defs.DEFAULT_VIP_WAREHOUSE_CAROUSEL)
      : (defs.DEFAULT_VIP_PAYWALL_CAROUSEL || defs.DEFAULT_VIP_WAREHOUSE_CAROUSEL);
    return defs.sanitizeVipCarouselUrls(list, fb);
  }
  return list.slice(0, 12);
}

FBDB.saveVipSettings = async function(settings) {
  if (!fbDb) throw new Error('Firestore not available');
  await FBDB.ensureAdminSession();
  requireAdminAuth('saving VIP settings');
  var tg = String(settings.telegramUrl || '').trim();
  var wa = String(settings.whatsappUrl || '').trim();
  var menuTg = String(settings.menuTelegramUrl || '').trim();
  var menuWa = String(settings.menuWhatsappUrl || '').trim();
  if (menuTg && tg === menuTg) tg = '';
  if (menuWa && wa === menuWa) wa = '';
  var data = {
    discountCode: String(settings.discountCode || 'VIPSTOCK').slice(0, 32).toUpperCase(),
    discountPercent: Number(settings.discountPercent || 10),
    telegramUrl: tg,
    whatsappUrl: wa,
    monthlyPriceGbp: Number(settings.monthlyPriceGbp || 9.99),
    displayMemberCount: settings.displayMemberCount != null && settings.displayMemberCount !== ''
      ? Number(settings.displayMemberCount)
      : null,
    foundingMemberLimit: Number(settings.foundingMemberLimit || 50),
    carouselImages: sanitizeVipCarouselUrlsForSave(
      Array.isArray(settings.carouselImages)
        ? settings.carouselImages
        : String(settings.carouselImages || '').split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean),
      'paywall'
    ),
    hubVideoUrl: String(settings.hubVideoUrl || '').trim().slice(0, 500),
    hubCarouselImages: sanitizeVipCarouselUrlsForSave(
      Array.isArray(settings.hubCarouselImages)
        ? settings.hubCarouselImages
        : String(settings.hubCarouselImages || '').split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean),
      'hub'
    ),
    carouselSchemaVersion: (vipCarouselDefaults() && vipCarouselDefaults().VIP_CAROUSEL_SCHEMA_VERSION) || 4,
    updatedAt: new Date().toISOString()
  };
  await fbDb.collection('siteSettings').doc('vip').set(data, { merge: true });
  return data;
};

FBDB.seedVipStarterStock = async function(force) {
  if (!fbDb) throw new Error('Firestore not available');
  await FBDB.ensureAdminSession();
  requireAdminAuth('seeding VIP stock');
  var existing = await FBDB.loadVipStockItems();
  if (existing.length && !force) {
    throw new Error('VIP stock already has ' + existing.length + ' items. Use force to add starter pack anyway.');
  }
  var builder = global.AYLEN_VIP_SEED && global.AYLEN_VIP_SEED.buildStarterItems;
  if (!builder) throw new Error('VIP seed module not loaded.');
  var items = builder();
  var saved = 0;
  for (var i = 0; i < items.length; i++) {
    await FBDB.saveVipStockItem(items[i]);
    saved++;
  }
  return saved;
};

FBDB.loadVipSettings = async function() {
  if (!fbDb) throw new Error('Firestore not available');
  requireAdminAuth('loading VIP settings');
  var doc = await fbDb.collection('siteSettings').doc('vip').get();
  var data = doc.exists ? doc.data() : {};
  var marketplace = {};
  try {
    var mpDoc = await fbDb.collection('siteSettings').doc('marketplace').get();
    marketplace = mpDoc.exists ? mpDoc.data() : {};
  } catch (e) {}
  var menuTg = (marketplace.telegramUrl && String(marketplace.telegramUrl).trim()) || 'https://t.me/aylensale';
  var menuWa = (marketplace.whatsappUrl && String(marketplace.whatsappUrl).trim()) ||
    'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!';
  var tgOverride = data.telegramUrl ? String(data.telegramUrl).trim() : '';
  var waOverride = data.whatsappUrl ? String(data.whatsappUrl).trim() : '';
  return {
    discountCode: data.discountCode || 'VIPSTOCK',
    discountPercent: Number(data.discountPercent || 10),
    telegramUrl: tgOverride || menuTg,
    whatsappUrl: waOverride || menuWa,
    telegramOverride: tgOverride,
    whatsappOverride: waOverride,
    menuTelegramUrl: menuTg,
    menuWhatsappUrl: menuWa,
    monthlyPriceGbp: Number(data.monthlyPriceGbp || 9.99),
    displayMemberCount: data.displayMemberCount != null && data.displayMemberCount !== ''
      ? Number(data.displayMemberCount)
      : null,
    foundingMemberLimit: Number(data.foundingMemberLimit || 50),
    carouselImages: resolveVipPaywallCarouselForAdmin(data),
    hubVideoUrl: String(data.hubVideoUrl || '').trim(),
    hubCarouselImages: resolveVipHubCarouselForAdmin(data),
    carouselSchemaVersion: Number(data.carouselSchemaVersion || 0)
  };
};

FBDB.loadVipOrdersAdmin = async function(limit) {
  if (!fbDb) throw new Error('Firestore not available');
  requireAdminAuth('loading VIP orders');
  var snap = await fbDb.collection('vipOrders').limit(limit || 200).get();
  return snap.docs.map(function(doc) {
    return Object.assign({ id: doc.id }, doc.data());
  }).sort(function(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
};

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

FBDB.saveEbaySettings = async function(settings) {
  if (!fbDb) throw new Error('Firestore not available. eBay settings were not saved.');
  requireAdminAuth('saving eBay settings');
  var data = normalizeEbaySettings(settings);
  if (data.url && !/^https:\/\/([a-z0-9-]+\.)?ebay\.(co\.uk|com)\//i.test(data.url)) {
    throw new Error('Use a valid https eBay store URL.');
  }
  data.updatedAt = new Date().toISOString();
  data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
  await fbDb.collection('siteSettings').doc('ebay').set(data, { merge: true });
  return data;
};

FBDB.saveMarketplaceSettings = async function(settings) {
  if (!fbDb) throw new Error('Firestore not available. Marketplace settings were not saved.');
  requireAdminAuth('saving marketplace settings');
  var data = normalizeMarketplaceSettings(settings);
  if (data.telegramUrl && !/^https:\/\/t\.me\/[a-z0-9_]{3,64}\/?$/i.test(data.telegramUrl)) {
    throw new Error('Use a valid https://t.me/username link.');
  }
  if (data.whatsappUrl && !/^https:\/\/(wa\.me\/|api\.whatsapp\.com\/send\?)/i.test(data.whatsappUrl)) {
    throw new Error('Use a valid WhatsApp link.');
  }
  data.updatedAt = new Date().toISOString();
  data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
  await fbDb.collection('siteSettings').doc('marketplace').set(data, { merge: true });
  return data;
};

function validateLegalContactUrls(content) {
  var contact = content.contact || {};
  if (contact.telegramUrl && !/^https:\/\/t\.me\/[a-z0-9_]{3,64}\/?$/i.test(contact.telegramUrl)) {
    throw new Error('Use a valid Telegram link like https://t.me/aylensale');
  }
  if (contact.whatsappUrl && !/^https:\/\/(wa\.me\/|api\.whatsapp\.com\/send\?)/i.test(contact.whatsappUrl)) {
    throw new Error('Use a valid WhatsApp link.');
  }
}

FBDB.saveLegalContactDraft = async function(content) {
  if (!fbDb) throw new Error('Firestore not available. Draft was not saved.');
  requireAdminAuth('saving legal contact draft');
  var draft = normalizeLegalContactContent(content);
  validateLegalContactUrls(draft);
  var now = new Date().toISOString();
  await fbDb.collection('siteSettings').doc('legalContact').set({
    draft: draft,
    draftUpdatedAt: now,
    updatedAt: now,
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { draft: draft, draftUpdatedAt: now };
};

FBDB.publishLegalContact = async function(content) {
  if (!fbDb) throw new Error('Firestore not available. Settings were not published.');
  requireAdminAuth('publishing legal contact settings');
  var published = normalizeLegalContactContent(content);
  validateLegalContactUrls(published);
  var now = new Date().toISOString();
  var payload = {
    published: published,
    draft: published,
    publishedAt: now,
    draftUpdatedAt: now,
    updatedAt: now,
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  };
  await fbDb.collection('siteSettings').doc('legalContact').set(payload, { merge: true });
  return normalizeLegalContactDoc(payload);
};

FBDB.saveAiAuditLog = async function(entry) {
  if (!fbDb) return false;
  requireAdminAuth('writing AI audit log');
  var data = {
    action: String(entry.action || 'unknown').slice(0, 80),
    productId: String(entry.productId || '').slice(0, 120),
    productName: String(entry.productName || '').slice(0, 140),
    adminEmail: fbAuth && fbAuth.currentUser ? fbAuth.currentUser.email : '',
    draft: entry.draft || null,
    stockAction: entry.stockAction || null,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now(),
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  };
  var logId = 'ailog_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await fbDb.collection('aiAuditLog').doc(logId).set(data);
  return logId;
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

FBDB.loadNotifyRequests = async function(productId) {
  if (!fbDb) {
    throw new Error('Firestore not available.');
  }
  requireAdminAuth('reading notify requests');

  var query = fbDb.collection('notifyRequests');
  if (productId !== undefined && productId !== null) {
    query = query.where('productId', '==', String(productId));
  }
  var snapshot = await query.get();
  var data = [];
  snapshot.forEach(function(doc) {
    data.push(normalizeNotifyRequestFromFirestore(doc.id, doc.data()));
  });
  data.sort(function(a, b) {
    var ad = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    var bd = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bd - ad;
  });
  return data;
};

FBDB.listenNotifyRequests = function(callback) {
  if (!fbDb) {
    throw new Error('Firestore not available');
  }
  requireAdminAuth('reading notify requests');

  return fbDb.collection('notifyRequests').onSnapshot(function(snapshot) {
    var data = [];
    snapshot.forEach(function(doc) {
      data.push(normalizeNotifyRequestFromFirestore(doc.id, doc.data()));
    });
    data.sort(function(a, b) {
      var ad = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      var bd = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bd - ad;
    });
    callback(data);
  }, function(error) {
    console.warn('⚠️ Notify requests listener error:', error.message);
  });
};

FBDB.loadPendingNotifyRequests = async function(productId) {
  var all = await FBDB.loadNotifyRequests(productId);
  return all.filter(function(item) {
    return item && item.notified !== true && item.status !== 'sent';
  });
};

FBDB.updateNotifyRequest = async function(id, updates) {
  if (!fbDb) {
    throw new Error('Firestore not available.');
  }
  requireAdminAuth('updating notify requests');

  var data = Object.assign({}, updates, {
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await fbDb.collection('notifyRequests').doc(String(id)).set(data, { merge: true });
  return true;
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

FBDB.saveListingPolicy = async function(policy) {
  if (!fbDb) throw new Error('Firestore not available.');
  requireAdminAuth('saving listing policies');
  var policyId = String((policy && policy.id) || ('policy_' + Date.now())).trim();
  var data = Object.assign({}, policy, {
    updatedAt: new Date().toISOString(),
    lastModified: firebase.firestore.FieldValue.serverTimestamp()
  });
  delete data.id;
  await fbDb.collection('listingPolicies').doc(policyId).set(data, { merge: true });
  return normalizeListingPolicyFromFirestore(policyId, data);
};

FBDB.deleteListingPolicy = async function(policyId) {
  if (!fbDb) throw new Error('Firestore not available.');
  requireAdminAuth('deleting listing policies');
  await fbDb.collection('listingPolicies').doc(String(policyId)).delete();
  return true;
};

FBDB.seedListingPoliciesIfEmpty = async function() {
  if (!fbDb) return [];
  requireAdminAuth('seeding listing policies');
  var snapshot = await fbDb.collection('listingPolicies').limit(1).get();
  if (!snapshot.empty) return FBDB.loadListingPolicies();
  var defaults = (window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.defaults) || [];
  for (var i = 0; i < defaults.length; i++) {
    await FBDB.saveListingPolicy(defaults[i]);
  }
  return FBDB.loadListingPolicies();
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

/**
 * CLOUD STORAGE - Photo Upload Functions
 * Photos stored in Firebase Cloud Storage bucket
 * Accessible from ANY device, synced automatically
 */

function readFileAsDataUrl(file) {
  return new Promise(function(resolve, reject) {
    if (!file) {
      reject(new Error('No file'));
      return;
    }
    var reader = new FileReader();
    reader.onload = function(ev) {
      resolve(ev.target && ev.target.result ? ev.target.result : '');
    };
    reader.onerror = function() {
      reject(new Error('Could not read file'));
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImageViaAdminApi(file, entityId, storageFolder, onProgress) {
  if (!fbAuth || !fbAuth.currentUser) return null;
  try {
    await FBDB.ensureAdminSession();
    requireAdminAuth('uploading images');
  } catch (authErr) {
    return { success: false, error: authErr.message };
  }

  try {
    if (file && file.size > 8 * 1024 * 1024) {
      return { success: false, error: 'File too large (max 8MB). Use a smaller image or Fallback URL.' };
    }
    if (typeof onProgress === 'function') onProgress(5);
    var dataUrl = await readFileAsDataUrl(file);
    if (typeof onProgress === 'function') onProgress(15);
    var token = await fbAuth.currentUser.getIdToken();
    var resp = await fetch('/api/admin-media-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        dataUrl: dataUrl,
        entityId: entityId,
        storageFolder: storageFolder || 'products',
        fileName: file && file.name,
        contentType: file && file.type
      })
    });
    var data = {};
    try {
      data = await resp.json();
    } catch (e) {}
    if (typeof onProgress === 'function') onProgress(100);
    if (resp.ok && data.url) {
      return { success: true, url: data.url };
    }
    var apiErr = (data && data.error) || ('Upload API failed (' + resp.status + ')');
    return { success: false, error: apiErr, apiFailed: true };
  } catch (err) {
    return { success: false, error: err.message || 'Upload API error', apiFailed: true };
  }
}

async function ensureFbStorage() {
  if (fbStorage) return fbStorage;
  if (window.AYLEN_FIREBASE && window.AYLEN_FIREBASE.ensureStorage) {
    await window.AYLEN_FIREBASE.ensureStorage();
  }
  if (typeof firebase !== 'undefined' && typeof firebase.storage === 'function' && fbApp) {
    fbStorage = firebase.storage(fbApp);
  }
  return fbStorage;
}

FBDB.ensureStorageReady = ensureFbStorage;

FBDB.uploadImage = async function(file, entityId, storageFolder) {
  var apiRes = await uploadImageViaAdminApi(file, entityId, storageFolder, null);
  if (apiRes && apiRes.success) return apiRes;
  if (apiRes && apiRes.apiFailed) {
    console.warn('[upload] Admin API failed, trying client Storage:', apiRes.error);
  }

  await ensureFbStorage();
  if (!fbStorage) {
    console.warn('❌ Firebase Cloud Storage not available');
    return { success: false, error: (apiRes && apiRes.error) || 'Storage not available' };
  }
  try {
    await FBDB.ensureAdminSession();
    requireAdminAuth('uploading images');
  } catch (authError) {
    return { success: false, error: authError.message };
  }

  try {
    console.log('📤 Uploading image to Cloud Storage...');
    
    var timestamp = Date.now();
    var randomStr = Math.random().toString(36).substring(7);
    var folder = String(storageFolder || 'products').replace(/[^a-zA-Z0-9/_-]/g, '') || 'products';
    var ext = 'jpg';
    if (file && file.name && file.name.indexOf('.') !== -1) {
      ext = String(file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 8);
    }
    if (file && file.type && file.type.indexOf('video/') === 0) {
      ext = ext === 'jpg' ? 'mp4' : ext;
    }
    var fileName = folder + '/' + entityId + '/media_' + timestamp + '_' + randomStr + '.' + ext;
    
    var storageRef = fbStorage.ref(fileName);
    var uploadTask = storageRef.put(file);
    await uploadTask;
    var downloadURL = await storageRef.getDownloadURL();
    console.log('✅ Media uploaded to Cloud Storage:', downloadURL);
    
    return { success: true, url: downloadURL };
  } catch (error) {
    console.error('❌ Error uploading image:', error.message);
    return { success: false, error: error.message };
  }
};

FBDB.uploadImageWithProgress = function(file, entityId, onProgress, storageFolder) {
  return new Promise(async function(resolve) {
    var apiRes = await uploadImageViaAdminApi(file, entityId, storageFolder, onProgress);
    if (apiRes && apiRes.success) {
      resolve(apiRes);
      return;
    }
    if (apiRes && apiRes.apiFailed) {
      console.warn('[upload] Admin API failed, trying client Storage:', apiRes.error);
    }

    await ensureFbStorage();
    if (!fbStorage) {
      resolve({ success: false, error: (apiRes && apiRes.error) || 'Storage not available' });
      return;
    }
    try {
      await FBDB.ensureAdminSession();
      requireAdminAuth('uploading images');
    } catch (authError) {
      resolve({ success: false, error: authError.message });
      return;
    }
    try {
      var timestamp = Date.now();
      var randomStr = Math.random().toString(36).substring(7);
      var folder = String(storageFolder || 'products').replace(/[^a-zA-Z0-9/_-]/g, '') || 'products';
      var ext = 'jpg';
      if (file && file.name && file.name.indexOf('.') !== -1) {
        ext = String(file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 8);
      }
      if (file && file.type && file.type.indexOf('video/') === 0) {
        ext = ext === 'jpg' ? 'mp4' : ext;
      }
      var fileName = folder + '/' + entityId + '/media_' + timestamp + '_' + randomStr + '.' + ext;
      var storageRef = fbStorage.ref(fileName);
      var uploadTask = storageRef.put(file);
      uploadTask.on('state_changed', function(snapshot) {
        var pct = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
        if (typeof onProgress === 'function') onProgress(pct);
      }, function(err) {
        resolve({ success: false, error: err.message || 'Upload failed' });
      }, async function() {
        try {
          var downloadURL = await storageRef.getDownloadURL();
          resolve({ success: true, url: downloadURL });
        } catch (e) {
          resolve({ success: false, error: e.message || 'Could not get download URL' });
        }
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
};

/**
 * Delete image from Cloud Storage
 */
FBDB.deleteImage = async function(imageUrl) {
  if (!imageUrl) return true;
  await ensureFbStorage();
  if (!fbStorage) return true;

  if (
    imageUrl.includes('firebasestorage.googleapis.com') ||
    imageUrl.includes('storage.googleapis.com')
  ) {
    try {
      // Extract file path from URL
      var urlParts = imageUrl.split('/o/')[1];
      if (urlParts) {
        var filePath = decodeURIComponent(urlParts.split('?')[0]);
        var fileRef = fbStorage.ref(filePath);
        await fileRef.delete();
        console.log('✅ Image deleted from Cloud Storage');
      }
    } catch (error) {
      console.warn('⚠️ Could not delete image:', error.message);
    }
  }
  
  return true;
};

FBDB.downloadProductionBackup = async function() {
  if (!fbDb) throw new Error('Firestore not available');
  requireAdminAuth('downloading production backup');
  var listingPolicies = [];
  try {
    if (FBDB.loadListingPolicies) listingPolicies = await FBDB.loadListingPolicies();
  } catch (e) {
    console.warn('Backup: listingPolicies skipped', e.message);
  }
  var payload = {
    exportedAt: new Date().toISOString(),
    products: await FBDB.loadProducts({ full: true }),
    auctions: await FBDB.loadAuctions(),
    locations: await FBDB.loadLocations(),
    cards: await FBDB.loadCards(),
    siteSettings: await FBDB.loadSiteSettings(),
    listingPolicies: listingPolicies
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'aylensale-backup-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return payload;
};

// ============================================
// MAKE FBDB GLOBAL FOR USE IN OTHER SCRIPTS
// ============================================
window.FBDB = FBDB;
console.log('✅ Firebase Database API ready (FBDB)');
