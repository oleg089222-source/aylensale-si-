/**
 * One-time helper: extract admin FBDB methods into firebase-db-admin.js
 * Run: node scripts/split-firebase-db-admin.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'js', 'firebase-db.js');
const outPath = path.join(root, 'js', 'firebase-db-admin.js');

const lines = fs.readFileSync(srcPath, 'utf8').split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const adminBody = [
  slice(776, 862),
  slice(872, 1274),
  slice(1312, 1341),
  slice(1343, 1374),
  slice(1425, 1790),
  slice(1804, 1893),
  slice(2185, 2247),
  slice(2261, 2291),
  slice(2318, 2560)
].join('\n\n');

const header = `/**
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

  var requireAdminAuth = function(action) { return c().requireAdminAuth(action); };
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

const footer = `
  FBDB.__adminModuleLoaded = true;
  global.__aylenFbAdminReady = true;
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(outPath, header + adminBody + footer);
console.log('split-firebase-db-admin OK →', outPath, adminBody.length, 'bytes');
