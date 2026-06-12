/**
 * UNIFIED DATA SYSTEM FOR AYLENSALE
 * Single source of truth for all data
 */

var DATA_VERSION = '1.0';

// Global data variables
var products = [];
var auctions = [];
var locations = [];
var cardHolders = {};
var auctionBids = {};
var notifyRequests = [];
var priceListItems = [];
var siteSettings = {
  ebay: {
    enabled: false,
    url: '',
    buttonText: 'Shop on eBay',
    description: 'Prefer eBay? Shop our AYLENSALE store on eBay.co.uk.'
  },
  marketplace: {
    newArrivalsEnabled: false,
    telegramUrl: 'https://t.me/aylensale',
    whatsappUrl: 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!'
  },
  legalContact: {
    published: null,
    draft: null
  }
};
var BIDDER_CONTACT_KEY = 'aylen_bidder_contact';

// Fallback image
var FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="%23999" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';

// Database utility - Firebase primary storage. Products/photos never go to localStorage.
var DB = {
  save: async function(key, data) {
    try {
      if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.isBlockedProductionSaveKey(key)) {
        console.error('Blocked legacy DB.save for production key "' + key + '". Use FBDB.* methods only.');
        throw new Error('Production data must be saved via Firestore APIs only (FBDB), not DB.save("' + key + '").');
      }
      
      // UI-only local storage (notify prefs, etc.)
      localStorage.setItem('aylen_' + key, JSON.stringify(data));
      return true;
    }
    catch (e) { console.error('Failed to save ' + key, e); return false; }
  },
  load: function(key) {
    if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.isBlockedProductionSaveKey(key)) return null;
    if (['products', 'auctions', 'locations', 'cardHolders', 'auctionBids'].includes(key)) return null;
    try { var data = localStorage.getItem('aylen_' + key); return data ? JSON.parse(data) : null; }
    catch (e) { console.error('Failed to load ' + key, e); return null; }
  },
  clear: function(key) {
    try { localStorage.removeItem('aylen_' + key); return true; }
    catch (e) { console.error('Failed to clear ' + key, e); return false; }
  }
};

function initializeSystemIfNeeded() {
  // Production data is seeded only in Firestore, never from browser demo data.
  return true;
}

// Load data into memory - Firebase Firestore as primary source
function waitForFirebaseReady(timeoutMs) {
  return new Promise(function(resolve) {
    var started = Date.now();
    var timer = setInterval(function() {
      if (window.FBDB && window.isFirebaseReady) {
        clearInterval(timer);
        resolve(true);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

function applyAuctionBidsFromList(list) {
  auctionBids = {};
  (Array.isArray(list) ? list : []).forEach(function(auction) {
    if (Array.isArray(auction.bids) && auction.bids.length > 0) {
      auctionBids[String(auction.id)] = auction.bids;
    }
  });
}

function applyStorefrontApiPayload(payload) {
  var prodBlock = payload.products || {};
  var items = prodBlock.items || [];
  products = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.dedupeProductionProducts(items)
    : items;
  window.AYLEN_CATALOG_HAS_MORE = !!prodBlock.hasMore;
  window.AYLEN_CATALOG_LAST_ID = prodBlock.lastId || null;
  window.AYLEN_CATALOG_LAST_DOC = null;
  window.AYLEN_CATALOG_FROM_API = true;

  var auctionItems = Array.isArray(payload.auctions) ? payload.auctions : [];
  auctions = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.dedupeProductionAuctions(auctionItems)
    : auctionItems;
  applyAuctionBidsFromList(auctions);

  locations = Array.isArray(payload.locations) ? payload.locations : [];

  if (payload.settings) {
    if (payload.settings.ebay) {
      siteSettings.ebay = Object.assign({}, siteSettings.ebay, payload.settings.ebay);
    }
    if (payload.settings.marketplace) {
      siteSettings.marketplace = Object.assign({}, siteSettings.marketplace, payload.settings.marketplace);
    }
  }
  if (typeof renderEbayPromo === 'function') renderEbayPromo();
  if (typeof renderTelegramLinks === 'function') renderTelegramLinks();

  if (window.AYLEN_PRODUCTION) {
    window.AYLEN_PRODUCTION.markHydrated('products', products.length);
    window.AYLEN_PRODUCTION.markHydrated('auctions', auctions.length);
    window.AYLEN_PRODUCTION.markHydrated('locations', locations.length);
  }
  if (window.AYLEN_SITE_CONTENT && window.AYLEN_SITE_CONTENT.apply) {
    window.AYLEN_SITE_CONTENT.apply();
  }
  if (window.AYLEN_IMAGES && window.AYLEN_IMAGES.preloadFirstCatalogImage) {
    window.AYLEN_IMAGES.preloadFirstCatalogImage(products);
  }
}

function catalogBootstrapHref() {
  var meta = document.querySelector('meta[name="aylen-catalog-bootstrap"]');
  if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
  return '/data/catalog-bootstrap.json';
}

var catalogBootstrapCache = null;
var catalogBootstrapPromise = null;

function readInlineCatalogBootstrap() {
  var el = document.getElementById('aylen-catalog-bootstrap');
  if (!el || !el.textContent) return null;
  try {
    var data = JSON.parse(el.textContent);
    if (data && data.ok === true && data.products) return data;
  } catch (e) {}
  return null;
}

function fetchCatalogBootstrapFile() {
  if (catalogBootstrapCache) return Promise.resolve(catalogBootstrapCache);
  if (catalogBootstrapPromise) return catalogBootstrapPromise;
  if (window.__aylenCatalogPrefetch) {
    catalogBootstrapPromise = window.__aylenCatalogPrefetch.then(function(data) {
      if (data && data.ok === true && data.products) {
        catalogBootstrapCache = data;
        return data;
      }
      return fetch(catalogBootstrapHref(), { credentials: 'same-origin' })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(payload) {
          if (payload && payload.ok === true && payload.products) {
            catalogBootstrapCache = payload;
            return payload;
          }
          return null;
        });
    }).catch(function() {
      return fetch(catalogBootstrapHref(), { credentials: 'same-origin' })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          if (data && data.ok === true && data.products) catalogBootstrapCache = data;
          return data;
        })
        .catch(function() { return null; });
    });
    return catalogBootstrapPromise;
  }
  catalogBootstrapPromise = fetch(catalogBootstrapHref(), { credentials: 'same-origin' })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      if (data && data.ok === true && data.products) {
        catalogBootstrapCache = data;
        return data;
      }
      return null;
    })
    .catch(function() {
      return null;
    });
  return catalogBootstrapPromise;
}

async function readCatalogBootstrap() {
  var inline = readInlineCatalogBootstrap();
  if (inline) return inline;
  return fetchCatalogBootstrapFile();
}

async function hydrateFromStorefrontApi() {
  if (!window.AYLEN_STOREFRONT_CATALOG_API || !window.AYLEN_STOREFRONT_CATALOG_API.isEnabled()) {
    return false;
  }
  try {
    var api = window.AYLEN_STOREFRONT_CATALOG_API;
    var inline = await readCatalogBootstrap();
    var payload = null;

    if (api.getPrefetch) {
      payload = await api.getPrefetch();
    }
    if (!payload && inline) {
      payload = inline;
      console.log('✅ Using catalog bootstrap file');
    }
    if (!payload) {
      var limit = api.DEFAULT_LIMIT || 36;
      payload = await api.fetchCatalog({ limit: limit });
    }
    if (payload) {
      applyStorefrontApiPayload(payload);
      console.log('✅ Loaded storefront catalog (' + products.length + ' products)');
    }
    return products.length > 0;
  } catch (error) {
    var fallback = await readCatalogBootstrap();
    if (fallback) {
      applyStorefrontApiPayload(fallback);
      console.warn('⚠️ Catalog API failed — inline bootstrap fallback:', error.message);
      return true;
    }
    console.warn('⚠️ Storefront catalog API failed, falling back to Firestore:', error.message);
    return false;
  }
}

async function resolveFirestoreCursorFromApiId(lastId) {
  if (!lastId || !window.fbDb) return null;
  try {
    var snap = await window.fbDb.collection('products').doc(String(lastId)).get();
    return snap.exists ? snap : null;
  } catch (error) {
    console.warn('Could not resolve Firestore cursor:', error.message);
    return null;
  }
}

async function loadFirebaseSupplement() {
  if (!window.AYLEN_FIREBASE) return;
  await window.AYLEN_FIREBASE.ensureReady();
  await waitForFirebaseReady(8000);
  if (!window.FBDB) return;

  try {
    if (window.AYLEN_CATALOG_FROM_API && window.AYLEN_CATALOG_LAST_ID && window.AYLEN_CATALOG_LAST_DOC === null) {
      window.AYLEN_CATALOG_LAST_DOC = await resolveFirestoreCursorFromApiId(window.AYLEN_CATALOG_LAST_ID);
    }

    var fbCards = window.FBDB.loadCards ? await window.FBDB.loadCards() : null;
    cardHolders = fbCards || {};
    console.log('✅ Loaded', Object.keys(cardHolders).length, 'discount cards from Firestore');

    var fbSettings = window.FBDB.loadSiteSettings ? await window.FBDB.loadSiteSettings() : null;
    if (fbSettings && fbSettings.ebay) {
      siteSettings.ebay = Object.assign({}, siteSettings.ebay, fbSettings.ebay);
    }
    if (fbSettings && fbSettings.marketplace) {
      siteSettings.marketplace = Object.assign({}, siteSettings.marketplace, fbSettings.marketplace);
    }
    if (fbSettings && fbSettings.legalContact) {
      siteSettings.legalContact = fbSettings.legalContact;
    }
    if (window.AYLEN_SITE_CONTENT && window.AYLEN_SITE_CONTENT.apply) {
      window.AYLEN_SITE_CONTENT.apply();
    }
    if (window.FBDB.loadListingPolicies) {
      await window.FBDB.loadListingPolicies();
    }
    console.log('✅ Firebase supplement loaded (cards, policies, cursor)');
  } catch (error) {
    console.warn('⚠️ Firebase supplement load failed:', error.message);
  }
}

function scheduleFirebaseSupplement() {
  if (window.AYLEN_FIREBASE && window.AYLEN_FIREBASE.scheduleBackgroundLoad) {
    window.AYLEN_FIREBASE.scheduleBackgroundLoad(function() {
      loadFirebaseSupplement();
    });
    return;
  }
  var idle = window.requestIdleCallback || function(cb) { return setTimeout(cb, 30000); };
  idle(function() { loadFirebaseSupplement(); }, { timeout: 30000 });
}

async function loadAllData() {
  try {
    if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.purgeLegacyProductionCaches) {
      window.AYLEN_PRODUCTION.purgeLegacyProductionCaches();
    }

    var apiHydrated = await hydrateFromStorefrontApi();

    if (apiHydrated) {
      scheduleFirebaseSupplement();
    } else {
      window.AYLEN_CATALOG_FROM_API = false;

    if (window.AYLEN_FIREBASE && window.AYLEN_FIREBASE.ensureReady) {
      await window.AYLEN_FIREBASE.ensureReady();
    }

    await waitForFirebaseReady(8000);

    if (window.FBDB) {
      try {
        console.log('🔄 Loading from Firebase Firestore (cloud)...');
        var fbProducts = [];
        if (window.FBDB.loadProductsPage && window.AYLEN_FIREBASE_CATALOG) {
          var firstPage = await window.FBDB.loadProductsPage({ limit: window.AYLEN_FIREBASE_CATALOG.DEFAULT_PAGE || 36 });
          fbProducts = firstPage.items || [];
          window.AYLEN_CATALOG_HAS_MORE = !!firstPage.hasMore;
          window.AYLEN_CATALOG_LAST_DOC = firstPage.lastDoc || null;
        } else {
          fbProducts = await window.FBDB.loadProducts();
        }
        var fbAuctions = await window.FBDB.loadAuctions();
        var fbLocations = await window.FBDB.loadLocations();
        var fbCards = window.FBDB.loadCards ? await window.FBDB.loadCards() : null;
        var fbPriceListItems = window.FBDB.loadPriceListItems
          ? await window.FBDB.loadPriceListItems()
          : [];
        var fbSettings = window.FBDB.loadSiteSettings ? await window.FBDB.loadSiteSettings() : null;
        
        products = window.AYLEN_PRODUCTION
          ? window.AYLEN_PRODUCTION.filterProductionProducts(Array.isArray(fbProducts) ? fbProducts : [])
          : (Array.isArray(fbProducts) ? fbProducts : []);
        if (window.AYLEN_PRODUCTION) window.AYLEN_PRODUCTION.markHydrated('products', products.length);
        console.log('✅ Loaded', products.length, 'products from Firestore');
        
        auctions = Array.isArray(fbAuctions) ? fbAuctions : [];
        if (window.AYLEN_PRODUCTION) window.AYLEN_PRODUCTION.markHydrated('auctions', auctions.length);
        applyAuctionBidsFromList(auctions);
        console.log('✅ Loaded', auctions.length, 'auctions from Firestore');
        
        locations = Array.isArray(fbLocations) ? fbLocations : [];
        if (window.AYLEN_PRODUCTION) window.AYLEN_PRODUCTION.markHydrated('locations', locations.length);
        console.log('✅ Loaded', locations.length, 'locations from Firestore');

        cardHolders = fbCards || {};
        console.log('✅ Loaded', Object.keys(cardHolders).length, 'discount cards from Firestore');
        priceListItems = Array.isArray(fbPriceListItems) ? fbPriceListItems : [];
        console.log('✅ Loaded', priceListItems.length, 'price list items from Firestore');
        if (fbSettings && fbSettings.ebay) {
          siteSettings.ebay = Object.assign({}, siteSettings.ebay, fbSettings.ebay);
        }
        if (fbSettings && fbSettings.marketplace) {
          siteSettings.marketplace = Object.assign({}, siteSettings.marketplace, fbSettings.marketplace);
        }
        if (fbSettings && fbSettings.legalContact) {
          siteSettings.legalContact = fbSettings.legalContact;
        }
        if (window.AYLEN_SITE_CONTENT && window.AYLEN_SITE_CONTENT.apply) {
          window.AYLEN_SITE_CONTENT.apply();
        }
        if (window.FBDB && window.FBDB.loadListingPolicies) {
          await window.FBDB.loadListingPolicies();
        }
        
        console.log('✅ Firebase data loaded successfully - synced across all devices');
      } catch (error) {
        console.warn('⚠️ Firebase Firestore load failed:', error.message);
        if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.productsHydrated) products = [];
        if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.auctionsHydrated) auctions = [];
        if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.locationsHydrated) locations = [];
        cardHolders = {};
      }
    } else {
      console.warn('Firebase not available. Production data cannot be loaded.');
      if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.productsHydrated) products = [];
      if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.auctionsHydrated) auctions = [];
      if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.locationsHydrated) locations = [];
      cardHolders = {};
    }
    }

    notifyRequests = [];
    await finalizeEndedAuctions();

    console.log('✓ Data ready:', products.length, 'products,', auctions.length, 'auctions,', locations.length, 'locations');
    return true;
  } catch (e) { 
    console.error('Error loading data', e); 
    if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.productsHydrated) products = [];
    if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.auctionsHydrated) auctions = [];
    if (!window.AYLEN_PRODUCTION || !window.AYLEN_PRODUCTION.state.locationsHydrated) locations = [];
    cardHolders = {};
    return false; 
  }
}

// Product functions
function sameId(a, b) {
  if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.canonicalProductKey) {
    return window.AYLEN_PRODUCTION.canonicalProductKey(a) === window.AYLEN_PRODUCTION.canonicalProductKey(b);
  }
  var na = String(a || '');
  var nb = String(b || '');
  if (na === nb) return true;
  if (na.indexOf('prod_') === 0) na = na.slice(5);
  if (nb.indexOf('prod_') === 0) nb = nb.slice(5);
  return na === nb;
}

function sameAuctionId(a, b) {
  if (window.AYLEN_PRODUCTION && window.AYLEN_PRODUCTION.canonicalAuctionKey) {
    return window.AYLEN_PRODUCTION.canonicalAuctionKey(a) === window.AYLEN_PRODUCTION.canonicalAuctionKey(b);
  }
  var na = String(a || '');
  var nb = String(b || '');
  if (na === nb) return true;
  if (na.indexOf('auction_') === 0) na = na.slice(8);
  if (nb.indexOf('auction_') === 0) nb = nb.slice(8);
  return na === nb;
}

function getStoredBidderContact() {
  try {
    var raw = localStorage.getItem(BIDDER_CONTACT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveStoredBidderContact(contact) {
  try {
    localStorage.setItem(BIDDER_CONTACT_KEY, JSON.stringify(contact));
  } catch (e) {
    console.warn('Could not cache bidder contact:', e.message);
  }
}

window.addProductFromAiDraft = async function addProductFromAiDraft(payload) {
  if (!payload || !payload.name) throw new Error('Invalid AI product draft');
  var product = Object.assign({
    id: payload.id || ('prod_' + Date.now()),
    createdAt: new Date().toISOString(),
    active: true,
    discount: 0,
    isDemo: false,
    demo: false,
    test: false
  }, payload);
  if (!window.FBDB || !window.FBDB.saveProduct) {
    throw new Error('Firebase is not ready. Product was not saved.');
  }
  var saved = await window.FBDB.saveProduct(product);
  var idx = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.findProductIndexById(products, saved.id)
    : products.findIndex(function(p) { return sameId(p.id, saved.id); });
  if (idx === -1) products.push(saved);
  else products[idx] = saved;
  return saved;
}

async function addProductWithPhotos(name, desc, price, category, imageUrls, stock, wholesale, policyId, productId) {
  var newId = productId || ('prod_' + Date.now());
  var product = {
    id: newId,
    name: name,
    desc: desc,
    category: category,
    price: price,
    retail: price,
    retailPrice: price,
    wholesale: wholesale || price,
    wholesalePrice: wholesale || price,
    stock: stock || 0,
    policyId: policyId || '',
    listingPolicyId: policyId || '',
    images: imageUrls || [],
    photos: imageUrls || [],
    createdAt: new Date().toISOString(),
    badge: '',
    active: true,
    discount: 0,
    salePrice: price,
    sku: 'AYLE-' + String(Date.now()).slice(-5),
    isDemo: false,
    demo: false,
    test: false
  };

  if (!window.FBDB || !window.FBDB.saveProduct) {
    throw new Error('Firebase is not ready. Product was not saved.');
  }

  var saved = await window.FBDB.saveProduct(product);
  var idx = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.findProductIndexById(products, saved.id)
    : products.findIndex(function(p) { return sameId(p.id, saved.id); });
  if (idx === -1) {
    products.push(saved);
  } else {
    products[idx] = saved;
  }
  return saved;
}

function deleteProductById(id) {
  if (!id) {
    notify('Missing productId. Product was not deleted.', 'error');
    return;
  }
  products = products.filter(function(p) { return !sameId(p.id, id); });
  
  // Delete from Firestore
  if (window.FBDB) {
    window.FBDB.deleteProduct(id).catch(function(e) {
      console.error('Error deleting product from Firestore:', e);
    });
  }
}

async function updateProductById(id, updates) {
  var idx = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.findProductIndexById(products, id)
    : products.findIndex(function(p) { return sameId(p.id, id); });
  if (idx === -1) return false;
  var product = products[idx];
  Object.assign(product, updates);
  if (!window.FBDB || !window.FBDB.updateProduct) {
    throw new Error('Firebase is not ready. Product was not updated.');
  }
  var saved = await window.FBDB.updateProduct(product.id, product);
  products[idx] = saved;
  return saved;
}

function generateAuctionId() {
  return 'auction_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// Auction functions — each auction gets a unique Firestore doc id (never overwrite auction_101).
function addAuctionWithPhotos(name, desc, startingPrice, category, imageUrls, durationHours, auctionId) {
  var newId = auctionId || generateAuctionId();
  var endTime = new Date(Date.now() + (durationHours || 24) * 3600000);
  var auction = {
    id: newId,
    name: name,
    desc: desc,
    category: category,
    startingPrice: startingPrice,
    currentPrice: startingPrice,
    endTime: endTime.toISOString(),
    images: imageUrls || [],
    bids: [],
    bidsCount: 0,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  if (window.FBDB && window.FBDB.saveAuction) {
    return window.FBDB.saveAuction(auction).then(function(saved) {
      if (typeof applyCatalogSnapshot === 'function') {
        applyCatalogSnapshot('auctions', [saved], { fromServer: true, merge: true });
      } else {
        var idx = auctions.findIndex(function(a) { return sameAuctionId(a.id, saved.id); });
        if (idx === -1) auctions.push(saved);
        else auctions[idx] = saved;
      }
      return saved;
    }).catch(function(e) {
      console.error('Error saving auction to Firestore:', e);
      throw e;
    });
  }
  auctions.push(auction);
  return Promise.resolve(auction);
}

function deleteAuctionById(id) {
  auctions = auctions.filter(function(a) { return !sameAuctionId(a.id, id); });
  if (auctionBids[String(id)]) delete auctionBids[String(id)];
  
  // Delete from Firestore
  if (window.FBDB) {
    window.FBDB.deleteAuction(id).catch(function(e) {
      console.error('Error deleting auction from Firestore:', e);
    });
  }
}

function duplicateAuctionById(id) {
  var source = auctions.find(function(a) { return sameAuctionId(a.id, id); });
  if (!source) return Promise.resolve(null);
  var durationHours = 24;
  var endMs = new Date(source.endTime || Date.now()).getTime();
  var startMs = new Date(source.createdAt || endMs - durationHours * 3600000).getTime();
  if (endMs > startMs) durationHours = Math.max(1, Math.round((endMs - startMs) / 3600000));
  return addAuctionWithPhotos(
    (source.name || 'Auction') + ' (copy)',
    source.desc || '',
    Number(source.startingPrice || source.currentPrice || 0),
    source.category || '',
    (source.images || []).slice(),
    durationHours
  );
}

function updateAuctionById(id, updates) {
  var auction = auctions.find(function(a) { return sameId(a.id, id); });
  if (auction) { 
    Object.assign(auction, updates);
    if (window.FBDB) {
      window.FBDB.saveAuction(auction).catch(function(e) {
        console.error('Error updating auction in Firestore:', e);
      });
    }
    
    return auction; 
  }
  return null;
}

// Location functions
function addLocation(name, address, day, time, lat, lng, active) {
  var newId = 'loc_' + Date.now();
  var location = {id: newId, name: name, address: address, day: day, time: time, lat: lat || 0, lng: lng || 0, active: active || false};
  locations.push(location);
  
  // Save to Firestore
  if (window.FBDB) {
    window.FBDB.saveLocation(location).catch(function(e) {
      console.error('Error saving location to Firestore:', e);
    });
  }
  
  return location;
}

function deleteLocationById(id) {
  if (!id) {
    notify('Missing locationId. Location was not deleted.', 'error');
    return;
  }
  locations = locations.filter(function(l) { return !sameId(l.id, id); });
  
  // Delete from Firestore
  if (window.FBDB) {
    window.FBDB.deleteLocation(id).catch(function(e) {
      console.error('Error deleting location from Firestore:', e);
    });
  }
}

function updateLocationById(id, updates) {
  var location = locations.find(function(l) { return sameId(l.id, id); });
  if (location) { 
    Object.assign(location, updates);
    
    // Update in Firestore
    if (window.FBDB) {
      window.FBDB.saveLocation(location).catch(function(e) {
        console.error('Error updating location in Firestore:', e);
      });
    }
    
    return location; 
  }
  return null;
}

// Card functions
function addCard(code, name, discount) {
  code = String(code || '').trim().toUpperCase();
  if (!code || cardHolders[code]) return null;
  cardHolders[code] = {name: name, discount: Number(discount || 0), status: 'unused', active: true, note: ''};
  if (window.FBDB && window.FBDB.saveCard) {
    window.FBDB.saveCard(code, cardHolders[code]).catch(function(e) {
      console.error('Error saving discount card:', e);
    });
  }
  return cardHolders[code];
}

function deleteCard(code) {
  code = String(code || '').trim().toUpperCase();
  delete cardHolders[code];
  if (window.FBDB && window.FBDB.deleteCard) {
    window.FBDB.deleteCard(code).catch(function(e) {
      console.error('Error deleting discount card:', e);
    });
  }
}

function updateCard(code, updates) {
  code = String(code || '').trim().toUpperCase();
  if (cardHolders[code]) {
    Object.assign(cardHolders[code], updates);
    cardHolders[code].discount = Number(cardHolders[code].discount || 0);
    if (window.FBDB && window.FBDB.saveCard) {
      window.FBDB.saveCard(code, cardHolders[code]).catch(function(e) {
        console.error('Error updating discount card:', e);
      });
    }
    return cardHolders[code];
  }
  return null;
}

// Bid and winner functions
function getAuctionBids(auction) {
  if (!auction) return [];
  var key = String(auction.id);
  if (Array.isArray(auction.bids) && auction.bids.length > 0) return auction.bids;
  return auctionBids[key] || [];
}

function getHighestBid(auction) {
  var bids = getAuctionBids(auction).filter(function(b) {
    return !(b && (b.isBot || b.source === 'bot'));
  });
  if (!bids.length) return null;
  return bids.reduce(function(best, bid) {
    return Number(bid.amount || 0) > Number(best.amount || 0) ? bid : best;
  }, bids[0]);
}

function getAuctionStatus(auction) {
  if (!auction) return 'active';
  if (auction.status === 'completed') return 'completed';
  if (auction.status === 'order_sent') return 'order_sent';
  if (auction.status === 'winner_pending') return 'winner_pending';
  return new Date(auction.endTime).getTime() <= Date.now() ? 'ended' : 'active';
}

async function saveAuctionState(auction) {
  auctionBids[String(auction.id)] = Array.isArray(auction.bids) ? auction.bids : [];
  if (!window.FBDB) return false;
  if (window.FBDB.isAdmin && window.FBDB.isAdmin() && window.FBDB.saveAuction) {
    await window.FBDB.saveAuction(auction);
    return true;
  }
  if (window.FBDB.saveAuctionPublicState) {
    await window.FBDB.saveAuctionPublicState(auction);
    return true;
  }
  return false;
}

async function placeBid(auctionId, bidAmount, bidderInfo, meta) {
  var auction = auctions.find(function(a) { return sameId(a.id, auctionId); });
  if (!auction) return { success: false, error: 'Auction not found' };
  if (getAuctionStatus(auction) !== 'active') return { success: false, error: 'Auction is not active' };
  var currentPrice = Number(auction.currentPrice || auction.startingPrice || 0);
  if (bidAmount <= currentPrice) return { success: false, error: 'Bid too low' };
  var contact = typeof bidderInfo === 'object' && bidderInfo ? bidderInfo : { name: bidderInfo || 'Anonymous' };
  meta = meta || {};

  try {
    var response = await fetch('/api/auction-bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auctionId: auction.id,
        bidAmount: bidAmount,
        name: contact.name || 'Anonymous',
        phone: contact.phone || '',
        contact: contact.contact || '',
        cardCode: (typeof currentUser !== 'undefined' && currentUser && currentUser.card) ? currentUser.card : '',
        security: typeof SECURITY !== 'undefined' && SECURITY.submissionMeta
          ? SECURITY.submissionMeta(meta.startedAt, meta.honeypot || '')
          : {},
        turnstileToken: meta.turnstileToken || null
      })
    });
    var data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        code: data.code || '',
        error: data.error || 'Bid could not be saved'
      };
    }

    if (data.endTimeExtended && typeof notify === 'function') {
      notify('Anti-snipe: auction extended by 3 minutes!', 'success');
    }
    if (data.endTime && auction.endTime !== data.endTime) {
      auction.endTime = data.endTime;
    }

    var bidKey = String(auction.id);
    if (!auctionBids[bidKey]) auctionBids[bidKey] = [];
    if (data.bid) {
      auctionBids[bidKey].push(data.bid);
      auction.bids = auctionBids[bidKey];
    }
    auction.currentPrice = Number(data.currentPrice || bidAmount);
    auction.bidsCount = Number(data.bidsCount || auction.bids.length || 0);
    auction.status = 'active';
    saveStoredBidderContact(contact);
    if (data.outbid && window.AYLEN_AUCTION_HUB && window.AYLEN_AUCTION_HUB.pushNotif) {
      window.AYLEN_AUCTION_HUB.pushNotif({
        title: 'You were outbid',
        body: (data.outbid.name || 'Another bidder') + ' beat your bid — current ' +
          (typeof formatGBP === 'function' ? formatGBP(data.currentPrice) : ('£' + data.currentPrice))
      });
    }
    if (window.AYLEN_AUCTION_HUB && window.AYLEN_AUCTION_HUB.onBidPlaced) {
      window.AYLEN_AUCTION_HUB.onBidPlaced(auction.id, bidAmount);
    }
    return { success: true };
  } catch (e) {
    console.warn('Auction bid API failed:', e.message || e);
    return { success: false, error: e.message || 'Network error' };
  }
}

async function finalizeAuction(auctionId) {
  var auction = auctions.find(function(a) { return sameId(a.id, auctionId); });
  if (!auction) return false;
  if (!window.FBDB || !window.FBDB.isAdmin || !window.FBDB.isAdmin()) return false;
  if (new Date(auction.endTime).getTime() > Date.now()) return false;
  if (auction.status === 'completed' || auction.status === 'order_sent') return true;

  var winner = getHighestBid(auction);
  auction.status = winner ? 'winner_pending' : 'ended';
  auction.winner = winner ? {
    bidId: winner.id,
    bidderName: winner.bidderName || winner.bidder || 'Anonymous',
    bidderPhone: winner.bidderPhone || '',
    bidderContact: winner.bidderContact || '',
    amount: Number(winner.amount || auction.currentPrice || 0),
    timestamp: winner.timestamp || ''
  } : null;
  auction.currentPrice = winner ? Number(winner.amount || auction.currentPrice || 0) : Number(auction.currentPrice || auction.startingPrice || 0);
  auction.finalizedAt = auction.finalizedAt || new Date().toISOString();
  return await saveAuctionState(auction);
}

async function finalizeEndedAuctions() {
  for (var i = 0; i < auctions.length; i++) {
    var auction = auctions[i];
    if (new Date(auction.endTime).getTime() <= Date.now() && getAuctionStatus(auction) === 'ended' && !auction.finalizedAt) {
      await finalizeAuction(auction.id);
    }
  }
}

async function saveAuctionWinnerOrder(auctionId, order) {
  var auction = auctions.find(function(a) { return sameId(a.id, auctionId); });
  if (!auction) return false;
  if (!auction.winner) await finalizeAuction(auctionId);
  auction = auctions.find(function(a) { return sameId(a.id, auctionId); });
  if (!auction || !auction.winner) return false;
  auction.winnerOrder = Object.assign({}, order, {
    auctionId: auction.id,
    finalPrice: Number(auction.currentPrice || 0),
    createdAt: new Date().toISOString()
  });
  auction.status = 'order_sent';
  auction.orderSentAt = new Date().toISOString();
  return await saveAuctionState(auction);
}

async function markAuctionCompleted(auctionId) {
  var auction = auctions.find(function(a) { return sameId(a.id, auctionId); });
  if (!auction) return false;
  if (!window.FBDB || !window.FBDB.isAdmin || !window.FBDB.isAdmin()) return false;
  auction.status = 'completed';
  auction.completedAt = new Date().toISOString();
  return await saveAuctionState(auction);
}

async function reopenAuction(auctionId, hours) {
  var auction = auctions.find(function(a) { return sameId(a.id, auctionId); });
  if (!auction) return false;
  if (!window.FBDB || !window.FBDB.isAdmin || !window.FBDB.isAdmin()) return false;
  auction.status = 'active';
  auction.winner = null;
  auction.winnerOrder = null;
  auction.finalizedAt = null;
  auction.orderSentAt = null;
  auction.completedAt = null;
  auction.endTime = new Date(Date.now() + (hours || 24) * 3600000).toISOString();
  return await saveAuctionState(auction);
}

// Notification functions
async function addNotifyRequest(productId, method, contact) {
  var product = getProductById(productId);
  var req = {
    productId: String(productId),
    productName: product ? product.name : 'Product',
    method: String(method || '').toLowerCase(),
    contact: String(contact || '').trim(),
    createdAt: new Date().toISOString(),
    notified: false,
    status: 'waiting'
  };
  if (!window.FBDB || !window.FBDB.saveNotifyRequest) {
    throw new Error('Firebase is not ready. Notify request was not saved.');
  }
  var saved = await window.FBDB.saveNotifyRequest(req);
  notifyRequests.push(saved);
  return saved;
}

// Utility functions
function getProductById(id) { return products.find(function(p) { return sameId(p.id, id); }); }
function getAuctionById(id) { return auctions.find(function(a) { return sameId(a.id, id); }); }
function getLocationById(id) { return locations.find(function(l) { return sameId(l.id, id); }); }
function getBidsForAuction(auctionId) { return auctionBids[String(auctionId)] || []; }
function getAllActiveLocations() { return locations.filter(function(l) { return l.active; }); }
