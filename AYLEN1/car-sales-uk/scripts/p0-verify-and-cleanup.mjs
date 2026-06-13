#!/usr/bin/env node
/**
 * P0 verification: stock decrement, notify restock, delete QA product.
 * Requires FIREBASE_SERVICE_ACCOUNT and production URL.
 */
import { readProductStock, decrementOrderStock, restoreOrderStock } from '../lib/server/inventory-stock.mjs';
import { processRestockNotifications } from '../lib/server/restock-notify.mjs';
import { getFirestoreAdmin } from '../lib/server/firebase-admin-app.mjs';

const BASE = (process.env.VERIFY_URL || 'https://aylensale.com/').replace(/\/?$/, '/');
const QA_PRODUCT_ID = 'prod_1781126013156';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '159357Oleg@';

async function fetchCatalog() {
  const res = await fetch(new URL('api/storefront-catalog?limit=50', BASE));
  const data = await res.json();
  return data.products?.items || [];
}

async function placeTestOrder(productId, qty) {
  const startedAt = Date.now() - 5000;
  const res = await fetch(new URL('api/send-order', BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'QA Stock Test',
      phone: '07123456789',
      pickup: 'Dunton Car Boot',
      comment: 'P0 stock decrement audit — safe to ignore',
      items: [{ id: productId, name: 'QA Stock Test Item', qty, price: 15.99 }],
      total: 15.99 * qty,
      security: {
        formStartedAt: startedAt,
        submittedAt: Date.now(),
        sessionId: 'qa-p0-verify'
      }
    })
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function subscribeNotify(productId, productName, email) {
  const res = await fetch(new URL('api/notify-request', BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      productName,
      method: 'email',
      contact: email
    })
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function deleteQaProduct() {
  const db = getFirestoreAdmin();
  const ref = db.collection('products').doc(QA_PRODUCT_ID);
  const snap = await ref.get();
  if (!snap.exists) return { deleted: false, reason: 'not_found' };
  await ref.delete();
  return { deleted: true, id: QA_PRODUCT_ID };
}

async function setProductStock(productId, stock) {
  const db = getFirestoreAdmin();
  const ref = db.collection('products').doc(productId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Product not found: ' + productId);
  const data = snap.data() || {};
  const inv = data.inventory && typeof data.inventory === 'object' ? { ...data.inventory } : {};
  inv.onHand = stock;
  if (!inv.channels) inv.channels = {};
  if (!inv.channels.website) inv.channels.website = {};
  inv.channels.website.stock = stock;
  inv.updatedAt = new Date().toISOString();
  await ref.update({ stock, inventory: inv, updatedAt: new Date().toISOString() });
  return stock;
}

async function main() {
  const report = { ok: true, steps: [] };
  function step(name, ok, detail) {
    report.steps.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) report.ok = false;
    console.log((ok ? '✓' : '✗'), name, '—', JSON.stringify(detail));
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    step('env', false, 'FIREBASE_SERVICE_ACCOUNT required');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // --- STOCK-001: direct server decrement + API order ---
  const beforeDirect = await readProductStock(QA_PRODUCT_ID);
  if (!beforeDirect) {
    step('stock-read', false, 'QA product missing — skip stock tests');
  } else {
    step('stock-before', true, { productId: QA_PRODUCT_ID, stock: beforeDirect.stock });

    const reserved = await decrementOrderStock(
      [{ id: QA_PRODUCT_ID, qty: 1 }],
      'qa_verify_' + Date.now()
    );
    const afterDirect = await readProductStock(QA_PRODUCT_ID);
    const directOk = afterDirect && afterDirect.stock === beforeDirect.stock - 1;
    step('stock-decrement-server', directOk, {
      before: beforeDirect.stock,
      after: afterDirect?.stock,
      adjustments: reserved.adjustments
    });

    // Restore for API test
    if (directOk && reserved.reservationId) {
      await restoreOrderStock(reserved.reservationId);
      const restored = await readProductStock(QA_PRODUCT_ID);
      step('stock-restore', restored?.stock === beforeDirect.stock, {
        before: beforeDirect.stock,
        after: restored?.stock
      });
    }

    const apiBefore = await readProductStock(QA_PRODUCT_ID);
    const orderRes = await placeTestOrder(QA_PRODUCT_ID, 1);
    const apiAfter = await readProductStock(QA_PRODUCT_ID);
    const apiOk = orderRes.status === 200 && orderRes.data.success &&
      Array.isArray(orderRes.data.stockAdjustments) &&
      apiAfter && apiBefore && apiAfter.stock === apiBefore.stock - 1;
    step('stock-order-api', apiOk, {
      http: orderRes.status,
      before: apiBefore?.stock,
      after: apiAfter?.stock,
      adjustments: orderRes.data.stockAdjustments || null,
      error: orderRes.data.error || null
    });

    const catalog = await fetchCatalog();
    const catalogItem = catalog.find((p) => p.id === QA_PRODUCT_ID);
    step('stock-storefront-api', catalogItem && catalogItem.stock === apiAfter?.stock, {
      catalogStock: catalogItem?.stock,
      firestoreStock: apiAfter?.stock
    });
  }

  // --- NTF-001: subscribe + restock notify ---
  const notifyEmail = 'qa-notify-' + Date.now() + '@mailinator.com';
  const sub = await subscribeNotify(QA_PRODUCT_ID, 'QA Audit Test 20260610', notifyEmail);
  step('notify-subscribe', sub.status === 200 && sub.data.success, sub);

  await setProductStock(QA_PRODUCT_ID, 0);
  const notifyResult = await processRestockNotifications({
    productId: QA_PRODUCT_ID,
    productName: 'QA Audit Test 20260610',
    previousStock: 0,
    newStock: 5
  });
  await setProductStock(QA_PRODUCT_ID, 5);
  const notifyOk = !notifyResult.skipped && (notifyResult.sent || 0) >= 1;
  step('notify-restock-auto', notifyOk, notifyResult);

  const db = getFirestoreAdmin();
  const notifySnap = await db.collection('notifyRequests')
    .where('contact', '==', notifyEmail)
    .limit(1)
    .get();
  const notifyDoc = notifySnap.docs[0]?.data();
  step('notify-delivery-status', notifyDoc?.status === 'sent', {
    status: notifyDoc?.status,
    provider: notifyDoc?.provider,
    notified: notifyDoc?.notified
  });

  // --- Cleanup QA product ---
  const deleted = await deleteQaProduct();
  step('qa-product-delete', deleted.deleted, deleted);

  const catalogAfterDelete = await fetchCatalog();
  const stillThere = catalogAfterDelete.some((p) => p.id === QA_PRODUCT_ID);
  step('qa-product-removed-api', !stillThere, { count: catalogAfterDelete.length });

  console.log('\n' + JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
