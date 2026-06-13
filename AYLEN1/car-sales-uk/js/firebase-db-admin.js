/**
 * Firebase admin CRUD + uploads — lazy-loaded (not needed for storefront catalog).
 */
(function(global) {
  'use strict';
  var FBDB = global.FBDB;
  if (!FBDB || FBDB.__adminModuleLoaded) return;
  var ctx = global.__AYLEN_FB_CTX;
  if (!ctx) {
    console.error('firebase-db-admin: __AYLEN_FB_CTX missing');
    return;
  }
  function c() { return ctx(); }
  var fbDb, fbAuth, fbStorage, fbApp, isFirebaseReady;
  function syncRefs() {
    var r = c();
    fbDb = r.getFbDb();
    fbAuth = r.getFbAuth();
    fbStorage = r.getFbStorage();
    fbApp = r.getFbApp();
    isFirebaseReady = r.getIsFirebaseReady();
  }
  syncRefs();
  var requireAdminAuth = function(action) { syncRefs(); return c().requireAdminAuth(action); };
  var isFirebaseAdminUser = function(user) { return c().isFirebaseAdminUser(user); };
  var normalizeAdminFirebaseEmail = function(id) { return c().normalizeAdminFirebaseEmail(id); };
  var mapFirebaseAuthError = function(err) { return c().mapFirebaseAuthError(err); };
  var resolveProductDocId = function(p) { return c().resolveProductDocId(p); };
  var mergeProductImageFields = function(a, b) { return c().mergeProductImageFields(a, b); };
  var firestoreDocId = function(prefix, id) { return c().firestoreDocId(prefix, id); };

  function triggerServerRestockNotify(productId, productName, previousStock, newStock) {
    if (!productId || Number(newStock) <= 0 || Number(previousStock) > 0) return;
    var payload = JSON.stringify({
      productId: productId,
      productName: productName,
      previousStock: previousStock,
      newStock: newStock
    });
    function postWithToken(token) {
      return fetch('/api/process-restock-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: payload
      }).then(function(res) { return res.json(); }).catch(function(err) {
        console.warn('Restock notify API failed:', err.message);
        return null;
      });
    }
    if (fbAuth && fbAuth.currentUser) {
      fbAuth.currentUser.getIdToken().then(postWithToken).catch(function() {});
      return;
    }
    if (FBDB.getAdminIdToken) {
      FBDB.getAdminIdToken().then(function(token) {
        if (token) postWithToken(token);
      }).catch(function() {});
    }
  }
  var firebaseImageUrls = function(urls) { return c().firebaseImageUrls(urls); };
  var isFirebaseStorageUrl = function(url) { return c().isFirebaseStorageUrl(url); };
  var normalizeOrderFromFirestore = function(id, raw) { return c().normalizeOrderFromFirestore(id, raw); };
  var normalizePriceListItemFromFirestore = function(id, raw) { return c().normalizePriceListItemFromFirestore(id, raw); };
  var normalizeListingPolicyFromFirestore = function(id, raw) { return c().normalizeListingPolicyFromFirestore(id, raw); };
  var normalizeNotifyRequestFromFirestore = function(id, raw) { return c().normalizeNotifyRequestFromFirestore(id, raw); };
  var normalizeEbaySettings = function(raw) { return c().normalizeEbaySettings(raw); };
  var normalizeMarketplaceSettings = function(raw) { return c().normalizeMarketplaceSettings(raw); };
  var normalizeLegalContactContent = function(raw) { return c().normalizeLegalContactContent(raw); };
  var normalizeLegalContactDoc = function(raw) { return c().normalizeLegalContactDoc(raw); };
  var normalizeVipStockItemFromFirestore = function(id, raw) { return c().normalizeVipStockItemFromFirestore(id, raw); };
  var initializeFirebaseAuth = function() { return c().initializeFirebaseAuth(); };
  var ADMIN_AUTH_INVALID = 'INVALID_ADMIN_LOGIN';
  var listingPolicies = global.listingPolicies || [];

FBDB.signInAdmin = async function(password, loginId) {
  if (window.AYLEN_FIREBASE && window.AYLEN_FIREBASE.ensureAuth) {
    await window.AYLEN_FIREBASE.ensureAuth();
  }
  syncRefs();
  if (!fbAuth && fbApp) {
    initializeFirebaseAuth();
    syncRefs();
  }
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

    var previousStock = Number((existing.data() || {}).stock || 0);
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
    var saved = Object.assign({}, product, { id: docId, images: data.images, photos: data.photos });
    var newStock = Number(saved.stock || 0);
    if (previousStock <= 0 && newStock > 0) {
      triggerServerRestockNotify(docId, saved.name || saved.title || 'Product', previousStock, newStock);
    }
    return saved;
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
  FBDB.__adminModuleLoaded = true;
  global.__aylenFbAdminReady = true;
})(typeof window !== 'undefined' ? window : globalThis);
