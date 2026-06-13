/**
 * Password-protected P0 audit actions (merged into admin-auth to save serverless slots).
 */
import { verifyAdminPassword } from './admin-password.mjs';
import { isAdminConfigured } from './firestore-admin.mjs';
import {
  readProductStock,
  decrementOrderStock,
  restoreOrderStock
} from './inventory-stock.mjs';
import { processRestockNotifications } from './restock-notify.mjs';
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { verifyFirebaseAdminToken } from './firebase-admin-app.mjs';
import { scrubAuctionBidPii } from './auction-bid-public.mjs';

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body || {};
}

async function authorizeAdmin(req, body) {
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const decoded = await verifyFirebaseAdminToken(authHeader.slice(7).trim());
    if (decoded) return true;
  }
  return verifyAdminPassword(String(body.adminPassword || body.password || ''));
}

export async function handleAdminAudit(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: 'Firestore admin not configured' });
  }

  const body = parseBody(req);
  if (!(await authorizeAdmin(req, body))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = String(body.auditAction || body.action || '').trim();

  try {
    if (action === 'ensure-qa-product') {
      const docId = 'prod_1781126013156';
      const ref = getFirestoreAdmin().collection('products').doc(docId);
      const snap = await ref.get();
      const payload = {
        name: 'QA Audit Test 20260610',
        title: 'QA Audit Test 20260610',
        desc: 'Functional audit test product — safe to delete',
        description: 'Functional audit test product — safe to delete',
        price: 15.99,
        retail: 15.99,
        stock: Number(body.stock != null ? body.stock : 3),
        category: 'electronics',
        active: true,
        status: 'active',
        sku: 'AYLE-50363',
        images: [],
        photos: [],
        isDemo: false,
        demo: false,
        test: false,
        updatedAt: new Date().toISOString()
      };
      if (!snap.exists) payload.createdAt = payload.updatedAt;
      await ref.set(payload, { merge: true });
      return res.status(200).json({ ok: true, productId: docId, created: !snap.exists, stock: payload.stock });
    }

    if (action === 'stock-read') {
      const row = await readProductStock(body.productId);
      return res.status(200).json({ ok: true, product: row });
    }

    if (action === 'stock-decrement') {
      const before = await readProductStock(body.productId);
      const reservationId = String(body.reservationId || ('audit_' + Date.now()));
      const result = await decrementOrderStock(
        [{ id: body.productId, qty: Number(body.qty || 1) }],
        reservationId
      );
      const after = await readProductStock(body.productId);
      return res.status(200).json({
        ok: true,
        before: before?.stock,
        after: after?.stock,
        reservationId,
        adjustments: result.adjustments
      });
    }

    if (action === 'stock-restore') {
      const before = await readProductStock(body.productId);
      const restored = await restoreOrderStock(body.reservationId);
      const after = await readProductStock(body.productId);
      return res.status(200).json({ ok: true, before: before?.stock, after: after?.stock, restored });
    }

    if (action === 'notify-restock') {
      const productId = String(body.productId || '');
      const ref = getFirestoreAdmin().collection('products').doc(
        productId.indexOf('prod_') === 0 ? productId : 'prod_' + productId
      );
      const prev = Number(body.previousStock ?? 0);
      const next = Number(body.newStock ?? 1);
      if (body.setStock != null) {
        const stockVal = Math.max(0, Number(body.setStock));
        const snapBefore = await ref.get();
        const inv = snapBefore.exists && snapBefore.data().inventory
          ? Object.assign({}, snapBefore.data().inventory)
          : {};
        inv.onHand = stockVal;
        if (!inv.channels) inv.channels = {};
        if (!inv.channels.website) inv.channels.website = {};
        inv.channels.website.stock = stockVal;
        inv.updatedAt = new Date().toISOString();
        await ref.update({
          stock: stockVal,
          inventory: inv,
          updatedAt: new Date().toISOString()
        });
      }
      const snap = await ref.get();
      const name = snap.exists ? (snap.data().name || snap.data().title || 'Product') : 'Product';
      const result = await processRestockNotifications({
        productId: ref.id,
        productName: name,
        previousStock: prev,
        newStock: next
      });
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === 'notify-self-test') {
      const productId = String(body.productId || '');
      const ref = getFirestoreAdmin().collection('products').doc(
        productId.indexOf('prod_') === 0 ? productId : 'prod_' + productId
      );
      const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
      if (!chatId) {
        return res.status(503).json({ error: 'TELEGRAM_CHAT_ID not configured for self-test' });
      }
      const snap = await ref.get();
      const name = snap.exists ? (snap.data().name || snap.data().title || 'Product') : 'Product';
      const doc = await getFirestoreAdmin().collection('notifyRequests').add({
        productId: ref.id,
        productName: name,
        method: 'telegram',
        contact: chatId,
        notified: false,
        status: 'waiting',
        source: 'audit_self_test',
        createdAt: new Date().toISOString()
      });
      if (body.setStock != null) {
        const stockVal = Math.max(0, Number(body.setStock));
        await ref.update({ stock: stockVal, updatedAt: new Date().toISOString() });
      }
      const result = await processRestockNotifications({
        productId: ref.id,
        productName: name,
        previousStock: 0,
        newStock: Math.max(1, Number(body.newStock || 1))
      });
      return res.status(200).json({ ok: true, notifyRequestId: doc.id, ...result });
    }

    if (action === 'delete-product') {
      const productId = String(body.productId || '');
      const docId = productId.indexOf('prod_') === 0 ? productId : 'prod_' + productId;
      const ref = getFirestoreAdmin().collection('products').doc(docId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(200).json({ ok: true, deleted: false, reason: 'not_found' });
      await ref.delete();
      return res.status(200).json({ ok: true, deleted: true, productId: docId });
    }

    if (action === 'scrub-auction-bid-pii') {
      const dryRun = body.dryRun !== false && body.dryRun !== 'false';
      const result = await scrubAuctionBidPii(getFirestoreAdmin(), {
        dryRun: dryRun,
        limit: body.limit
      });
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === 'cleanup-qa-activity') {
      const db = getFirestoreAdmin();
      const needle = String(body.needle || 'QA Audit Test').toLowerCase();
      const snap = await db.collection('activityFeed').orderBy('createdAtMs', 'desc').limit(100).get();
      let deleted = 0;
      for (const doc of snap.docs) {
        const msg = String((doc.data() || {}).message || '').toLowerCase();
        if (msg.indexOf(needle) === -1) continue;
        await doc.ref.delete();
        deleted++;
      }
      return res.status(200).json({ ok: true, deleted, needle: body.needle || 'QA Audit Test' });
    }

    return res.status(400).json({ error: 'Unknown audit action' });
  } catch (err) {
    const code = err.code === 'stock_unavailable' ? 409 : 500;
    return res.status(code).json({
      error: err.message || 'Server error',
      code: err.code || null,
      before: err.before,
      requested: err.requested
    });
  }
}

export async function handleProcessRestockNotify(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: 'Firestore admin not configured' });
  }

  const body = parseBody(req);
  if (!(await authorizeAdmin(req, body))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await processRestockNotifications({
      productId: body.productId,
      productName: body.productName,
      previousStock: body.previousStock,
      newStock: body.newStock
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[process-restock-notify]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
