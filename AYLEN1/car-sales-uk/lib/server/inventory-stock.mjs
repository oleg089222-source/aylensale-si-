/**
 * Server-side stock reservation and decrement for shop + VIP orders.
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';

export function canonicalProductKey(id) {
  const raw = String(id || '').trim();
  if (!raw) return '';
  return raw.indexOf('prod_') === 0 ? raw.slice(5) : raw;
}

export function resolveProductDocId(id) {
  const raw = String(id || '').trim();
  if (!raw) return '';
  return raw.indexOf('prod_') === 0 ? raw : 'prod_' + raw;
}

function aggregateLineItems(items) {
  const map = new Map();
  for (const item of items || []) {
    const docId = resolveProductDocId(item.id);
    if (!docId) continue;
    const qty = Math.max(1, Math.min(99, Number(item.qty || 1)));
    map.set(docId, (map.get(docId) || 0) + qty);
  }
  return map;
}

function applyStockPatch(data, newStock) {
  const stock = Math.max(0, Number(newStock || 0));
  const inv = data.inventory && typeof data.inventory === 'object'
    ? Object.assign({}, data.inventory)
    : {};
  inv.onHand = stock;
  if (!inv.channels || typeof inv.channels !== 'object') inv.channels = {};
  const website = inv.channels.website && typeof inv.channels.website === 'object'
    ? Object.assign({}, inv.channels.website)
    : { enabled: true, externalId: null, lastSyncAt: null };
  website.stock = stock;
  website.enabled = true;
  website.lastSyncAt = new Date().toISOString();
  inv.channels.website = website;
  inv.updatedAt = new Date().toISOString();
  return {
    stock,
    inventory: inv,
    updatedAt: new Date().toISOString()
  };
}

export async function syncLinkedVipStock(db, productDocId, newStock) {
  const stock = Math.max(0, Number(newStock || 0));
  const stockStatus = stock > 0 ? 'available' : 'sold';
  const ids = [String(productDocId), canonicalProductKey(productDocId)];
  const seen = new Set();
  let synced = 0;
  for (const linkedId of ids) {
    if (!linkedId || seen.has(linkedId)) continue;
    seen.add(linkedId);
    const snap = await db.collection('vipStockItems')
      .where('linkedProductId', '==', linkedId)
      .limit(20)
      .get();
    for (const doc of snap.docs) {
      await doc.ref.update({
        stock,
        stockStatus,
        updatedAt: new Date().toISOString()
      });
      synced++;
    }
  }
  return synced;
}

export async function decrementOrderStock(items, orderId) {
  const db = getFirestoreAdmin();
  const aggregated = aggregateLineItems(items);
  if (!aggregated.size) {
    throw Object.assign(new Error('No valid items to reserve stock'), { code: 'stock_unavailable' });
  }

  const reservationId = String(orderId || ('ord_' + Date.now()));
  const reservationRef = db.collection('stockReservations').doc(reservationId);
  const adjustments = [];

  await db.runTransaction(async (tx) => {
    const existingRes = await tx.get(reservationRef);
    if (existingRes.exists && existingRes.data()?.status === 'committed') {
      return;
    }

    for (const [docId, qty] of aggregated.entries()) {
      const ref = db.collection('products').doc(docId);
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw Object.assign(new Error('Product not found: ' + docId), {
          code: 'stock_unavailable',
          productId: docId
        });
      }
      const data = snap.data() || {};
      const before = Number(data.stock || 0);
      if (before < qty) {
        throw Object.assign(new Error('Insufficient stock for ' + (data.name || docId)), {
          code: 'stock_unavailable',
          productId: docId,
          before,
          requested: qty
        });
      }
      const after = before - qty;
      tx.update(ref, applyStockPatch(data, after));
      adjustments.push({
        productId: docId,
        name: String(data.name || data.title || docId),
        before,
        after,
        qty
      });
    }

    tx.set(reservationRef, {
      orderId: reservationId,
      items: adjustments,
      createdAt: new Date().toISOString(),
      status: 'committed'
    });
  });

  for (const adj of adjustments) {
    try {
      adj.vipSynced = await syncLinkedVipStock(db, adj.productId, adj.after);
    } catch (e) {
      console.warn('[inventory-stock] VIP sync failed:', adj.productId, e.message);
      adj.vipSynced = 0;
    }
  }

  return { reservationId, adjustments };
}

export async function restoreOrderStock(reservationId) {
  const db = getFirestoreAdmin();
  const reservationRef = db.collection('stockReservations').doc(String(reservationId || ''));
  const restored = [];

  await db.runTransaction(async (tx) => {
    const resSnap = await tx.get(reservationRef);
    if (!resSnap.exists) return;
    const res = resSnap.data() || {};
    if (res.status === 'restored') return;

    const items = Array.isArray(res.items) ? res.items : [];
    for (const adj of items) {
      const ref = db.collection('products').doc(adj.productId);
      const snap = await tx.get(ref);
      if (!snap.exists) continue;
      const data = snap.data() || {};
      const before = Number(data.stock || 0);
      const after = before + Number(adj.qty || 0);
      tx.update(ref, applyStockPatch(data, after));
      restored.push({
        productId: adj.productId,
        before,
        after,
        qty: adj.qty
      });
    }
    tx.update(reservationRef, {
      status: 'restored',
      restoredAt: new Date().toISOString()
    });
  });

  for (const adj of restored) {
    try {
      await syncLinkedVipStock(db, adj.productId, adj.after);
    } catch (e) {
      console.warn('[inventory-stock] VIP restore sync failed:', adj.productId, e.message);
    }
  }

  return restored;
}

export async function decrementVipStockItem(itemId, qty) {
  const db = getFirestoreAdmin();
  const id = String(itemId || '').trim();
  const ref = db.collection('vipStockItems').doc(id);
  let result = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw Object.assign(new Error('VIP item not found'), { code: 'stock_unavailable' });
    }
    const data = snap.data() || {};
    const before = Math.max(0, Number(data.stock != null ? data.stock : 1));
    const need = Math.max(1, Number(qty || 1));
    if (before < need) {
      throw Object.assign(new Error('VIP item out of stock'), {
        code: 'stock_unavailable',
        before,
        requested: need
      });
    }
    const after = before - need;
    const stockStatus = after > 0 ? 'available' : 'sold';
    tx.update(ref, {
      stock: after,
      stockStatus,
      updatedAt: new Date().toISOString()
    });
    result = {
      itemId: id,
      title: String(data.title || data.name || 'VIP item'),
      before,
      after,
      qty: need
    };
  });

  return result;
}

export async function readProductStock(productId) {
  const db = getFirestoreAdmin();
  const docId = resolveProductDocId(productId);
  const snap = await db.collection('products').doc(docId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    productId: docId,
    name: String(data.name || data.title || ''),
    stock: Number(data.stock || 0),
    websiteStock: Number(data.inventory?.channels?.website?.stock ?? data.stock ?? 0)
  };
}
