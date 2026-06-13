/**
 * Increment product / auction view counters (server-side — bypasses client Firestore rules).
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import admin from 'firebase-admin';

function productViewStatsDocId(productId) {
  return String(productId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120) || ('prod_' + Date.now());
}

function auctionViewStatsDocId(auctionId) {
  return String(auctionId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120) || ('auc_' + Date.now());
}

export async function recordProductViewStat(productId) {
  const pid = String(productId || '').slice(0, 120);
  if (!pid) return null;
  const db = getFirestoreAdmin();
  const docId = productViewStatsDocId(pid);
  const ref = db.collection('productViewStats').doc(docId);
  await ref.set({
    productId: pid,
    totalViews: admin.firestore.FieldValue.increment(1),
    lastViewedAt: new Date().toISOString()
  }, { merge: true });
  return docId;
}

export async function recordAuctionViewStat(auctionId) {
  const aid = String(auctionId || '').slice(0, 120);
  if (!aid) return null;
  const db = getFirestoreAdmin();
  const docId = auctionViewStatsDocId(aid);
  const ref = db.collection('auctionViewStats').doc(docId);
  await ref.set({
    auctionId: aid,
    totalViews: admin.firestore.FieldValue.increment(1),
    lastViewedAt: new Date().toISOString()
  }, { merge: true });
  return docId;
}
