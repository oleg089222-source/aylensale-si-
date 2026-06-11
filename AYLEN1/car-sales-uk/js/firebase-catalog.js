/**
 * Firestore catalog paging + listener control (fewer reads).
 */
(function(global) {
  var DEFAULT_PAGE = 36;
  var ADMIN_PAGE = 40;
  var LISTENER_LIMIT = 48;
  var productsUnsubscribe = null;
  var listenerMode = 'off';
  var lastCatalogDoc = null;
  var catalogHasMore = false;

  function getDb() {
    return global.fbDb || null;
  }

  function normalizeList(snapshot) {
    var data = [];
    snapshot.forEach(function(doc) {
      if (global.FBDB && global.FBDB.normalizeProductFromFirestore) {
        data.push(global.FBDB.normalizeProductFromFirestore(doc.id, doc.data()));
      } else {
        data.push(Object.assign({ id: doc.id }, doc.data()));
      }
    });
    if (global.AYLEN_PRODUCTION && global.AYLEN_PRODUCTION.filterProductionProducts) {
      data = global.AYLEN_PRODUCTION.filterProductionProducts(data);
    }
    return data;
  }

  global.AYLEN_FIREBASE_CATALOG = {
    DEFAULT_PAGE: DEFAULT_PAGE,
    ADMIN_PAGE: ADMIN_PAGE,
    lastCatalogDoc: function() { return lastCatalogDoc; },
    hasMore: function() { return catalogHasMore; },

    detachProductsListener: function() {
      if (productsUnsubscribe) {
        productsUnsubscribe();
        productsUnsubscribe = null;
      }
      listenerMode = 'off';
    },

    attachProductsListener: function(mode) {
      var db = getDb();
      if (!db) return;
      global.AYLEN_FIREBASE_CATALOG.detachProductsListener();
      listenerMode = mode || 'lite';
      if (listenerMode === 'off') return;

      var q = db.collection('products');
      if (listenerMode === 'lite') {
        q = q.limit(LISTENER_LIMIT);
      }

      productsUnsubscribe = q.onSnapshot(function(snapshot) {
        if (listenerMode === 'lite' && global.isAdminMode && global.AyelenAdminDashboard && global.AyelenAdminDashboard.isOpen && global.AyelenAdminDashboard.currentPanel() === 'products') {
          return;
        }
        var data = normalizeList(snapshot);
        if (typeof applyCatalogSnapshot === 'function') {
          applyCatalogSnapshot('products', data, { fromServer: true, paged: listenerMode === 'lite' });
        }
      }, function(err) {
        console.warn('Products listener:', err.message);
      });
    },

    loadProductsPage: async function(opts) {
      var db = getDb();
      if (!db) throw new Error('Firestore not ready');
      opts = opts || {};
      var limit = opts.limit || DEFAULT_PAGE;
      var snapshot;
      try {
        var q = db.collection('products').orderBy('updatedAt', 'desc').limit(limit);
        if (opts.startAfterDoc) q = q.startAfter(opts.startAfterDoc);
        snapshot = await q.get();
      } catch (err) {
        var fallback = db.collection('products').limit(limit);
        if (opts.startAfterDoc) fallback = fallback.startAfter(opts.startAfterDoc);
        snapshot = await fallback.get();
      }
      var items = normalizeList(snapshot);
      var lastDoc = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null;
      catalogHasMore = snapshot.docs.length === limit;
      lastCatalogDoc = lastDoc;

      return {
        items: items,
        lastDoc: lastDoc,
        hasMore: catalogHasMore
      };
    },

    loadProductById: async function(id) {
      var db = getDb();
      if (!db || !id) return null;
      var docId = String(id).trim();
      var snap = await db.collection('products').doc(docId).get();
      if (!snap.exists) return null;
      if (global.FBDB && global.FBDB.normalizeProductFromFirestore) {
        return global.FBDB.normalizeProductFromFirestore(snap.id, snap.data());
      }
      return Object.assign({ id: snap.id }, snap.data());
    },

    loadAdminProductsPage: async function(opts) {
      return global.AYLEN_FIREBASE_CATALOG.loadProductsPage({
        limit: opts && opts.limit ? opts.limit : ADMIN_PAGE,
        startAfterDoc: opts && opts.startAfterDoc ? opts.startAfterDoc : null
      });
    }
  };
})(window);
