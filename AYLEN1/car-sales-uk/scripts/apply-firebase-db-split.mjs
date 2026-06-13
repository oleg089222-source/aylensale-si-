/**
 * Split firebase-db.js → storefront core + lazy admin module.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'js', 'firebase-db.js');
const adminPath = path.join(root, 'js', 'firebase-db-admin.js');

const lines = fs.readFileSync(srcPath, 'utf8').split('\n');

const REMOVE_RANGES = [
  [776, 862],
  [872, 1274],
  [1312, 1341],
  [1343, 1374],
  [1425, 1790],
  [1804, 1893],
  [2185, 2247],
  [2261, 2291],
  [2318, 2560]
];

const ADMIN_METHODS = [
  'signInAdmin', 'ensureAdminSession', 'getAdminIdToken', 'signOutAdmin',
  'saveProduct', 'updateProduct', 'deleteProduct', 'deleteImages',
  'saveAuction', 'deleteAuction', 'saveLocation', 'deleteLocation', 'saveLocationWeather',
  'saveCard', 'saveCardsBatch', 'saveCardNote', 'loadCardNotes', 'deleteCard',
  'loadOrders', 'updateShopOrder', 'savePriceListItem', 'deletePriceListItem',
  'loadVipAdminMemberPreview', 'loadVipAdminPanelData', 'updateVipOrderAdmin',
  'loadVipSubscribers', 'loadVipStockItems', 'saveVipStockItem', 'deleteVipStockItem',
  'saveVipSettings', 'seedVipStarterStock', 'loadVipSettings', 'loadVipOrdersAdmin',
  'saveEbaySettings', 'saveMarketplaceSettings', 'saveLegalContactDraft', 'publishLegalContact', 'saveAiAuditLog',
  'loadNotifyRequests', 'listenNotifyRequests', 'loadPendingNotifyRequests', 'updateNotifyRequest',
  'saveListingPolicy', 'deleteListingPolicy', 'seedListingPoliciesIfEmpty',
  'ensureStorageReady', 'uploadImage', 'uploadImageWithProgress', 'deleteImage', 'downloadProductionBackup'
];

function shouldRemove(lineNo) {
  return REMOVE_RANGES.some(function(r) {
    return lineNo >= r[0] && lineNo <= r[1];
  });
}

const coreLines = [];
const adminChunks = [];

for (let i = 0; i < lines.length; i++) {
  const lineNo = i + 1;
  if (shouldRemove(lineNo)) {
    adminChunks.push(lines[i]);
  } else {
    coreLines.push(lines[i]);
  }
}

const ctxBlock = `
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
  _fbAdminLoadPromise = loadScript('js/firebase-db-admin.js').catch(function(err) {
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
`;

const stubBlock =
  ADMIN_METHODS.map(function(name) {
    return "FBDB." + name + ' = fbAdminLazy("' + name + '");';
  }).join('\n') + '\n';

const insertAt = coreLines.findIndex(function(l) { return l.indexOf('window.FBDB = FBDB') !== -1; });
if (insertAt === -1) {
  console.error('apply-firebase-db-split: window.FBDB = FBDB not found');
  process.exit(1);
}

coreLines.splice(insertAt, 0, ctxBlock, stubBlock);

const adminHeader = `/**
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
  var firebaseImageUrls = function(urls) { return c().firebaseImageUrls(urls); };
  var isFirebaseStorageUrl = function(url) { return c().isFirebaseStorageUrl(url); };
  var normalizeOrderFromFirestore = function(id, raw) { return c().normalizeOrderFromFirestore(id, raw); };
  var normalizePriceListItemFromFirestore = function(id, raw) { return c().normalizePriceListItemFromFirestore(id, raw); };
  var normalizeListingPolicyFromFirestore = function(id, raw) { return c().normalizeListingPolicyFromFirestore(id, raw); };
  var normalizeNotifyRequestFromFirestore = function(id, raw) { return c().normalizeNotifyRequestFromFirestore(id, raw); };
  var initializeFirebaseAuth = function() { return c().initializeFirebaseAuth(); };
  var ADMIN_AUTH_INVALID = 'INVALID_ADMIN_LOGIN';
  var listingPolicies = global.listingPolicies || [];

`;

const adminFooter = `
  FBDB.__adminModuleLoaded = true;
  global.__aylenFbAdminReady = true;
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(adminPath, adminHeader + adminChunks.join('\n') + adminFooter);
fs.writeFileSync(srcPath, coreLines.join('\n'));
console.log('apply-firebase-db-split OK');
console.log('  core lines:', coreLines.length, 'admin lines:', adminChunks.length);
