/**
 * Customer loyalty snapshot — card + order stats (sanitized for public API).
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import {
  LOYALTY_TIERS,
  tierByIndex,
  suggestedTier,
  tierProgressToNext,
  jarFillHeight
} from './loyalty-tiers.mjs';

function cleanCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}

function cardIsUsable(card) {
  if (!card) return false;
  const status = String(card.status || 'active').toLowerCase();
  if (status === 'blocked' || status === 'paused' || status === 'expired') return false;
  if (status !== 'active' && status !== 'unused') return false;
  if (card.expiryDate) {
    const exp = new Date(String(card.expiryDate).slice(0, 10) + 'T23:59:59');
    if (!isNaN(exp.getTime()) && exp < new Date()) return false;
  }
  if (Number(card.usageLimit || 0) > 0 && Number(card.usageCount || 0) >= Number(card.usageLimit)) {
    return false;
  }
  return true;
}

function normalizeCard(docId, raw) {
  const item = raw || {};
  const status = item.status || (item.active === false ? 'blocked' : 'active');
  const discountType = item.discountType || 'percent';
  const discountValue = Number(
    item.discountValue != null ? item.discountValue : (item.discount != null ? item.discount : 0)
  );
  return {
    code: String(item.code || docId).toUpperCase(),
    name: String(item.name || 'Customer').slice(0, 80),
    discountType,
    discountValue,
    discount: discountType === 'percent' ? discountValue : Number(item.discount || 0),
    expiryDate: item.expiryDate || '',
    usageLimit: Number(item.usageLimit || 0),
    usageCount: Number(item.usageCount || 0),
    status,
    loyaltyTier: Number(item.loyaltyTier != null ? item.loyaltyTier : 0),
    loyaltyOrders: Number(item.loyaltyOrders || 0),
    loyaltySpend: Number(item.loyaltySpend || 0),
    wholesaleAccess: discountType === 'wholesale' || !!item.wholesaleAccess,
    freeDelivery: discountType === 'free_delivery' || !!item.freeDelivery
  };
}

async function loadOrderStats(db, code) {
  let orderCount = 0;
  let totalSpend = 0;
  let lastOrderAt = null;
  const recentOrders = [];

  try {
    const snap = await db.collection('orders')
      .where('card', '==', code)
      .orderBy('createdAt', 'desc')
      .limit(12)
      .get();

    snap.forEach(function(doc) {
      const o = doc.data() || {};
      const total = Number(o.total || 0);
      orderCount++;
      totalSpend += total;
      const createdAt = o.createdAt || o.updatedAt || '';
      if (createdAt && (!lastOrderAt || String(createdAt) > String(lastOrderAt))) {
        lastOrderAt = createdAt;
      }
      if (recentOrders.length < 5) {
        const items = Array.isArray(o.items) ? o.items : [];
        recentOrders.push({
          id: doc.id,
          date: createdAt,
          total: Number(total.toFixed(2)),
          itemsCount: items.reduce(function(sum, it) { return sum + Number(it.qty || 1); }, 0),
          pickup: String(o.pickup || '').slice(0, 80)
        });
      }
    });
  } catch (err) {
    const msg = String(err && err.message || err);
    if (msg.indexOf('index') !== -1 || msg.indexOf('FAILED_PRECONDITION') !== -1) {
      const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(200).get();
      snap.forEach(function(doc) {
        const o = doc.data() || {};
        if (String(o.card || '').toUpperCase() !== code) return;
        const total = Number(o.total || 0);
        orderCount++;
        totalSpend += total;
        const createdAt = o.createdAt || o.updatedAt || '';
        if (createdAt && (!lastOrderAt || String(createdAt) > String(lastOrderAt))) {
          lastOrderAt = createdAt;
        }
        if (recentOrders.length < 5) {
          const items = Array.isArray(o.items) ? o.items : [];
          recentOrders.push({
            id: doc.id,
            date: createdAt,
            total: Number(total.toFixed(2)),
            itemsCount: items.reduce(function(sum, it) { return sum + Number(it.qty || 1); }, 0),
            pickup: String(o.pickup || '').slice(0, 80)
          });
        }
      });
    } else {
      throw err;
    }
  }

  return { orderCount, totalSpend, lastOrderAt, recentOrders };
}

function buildMessage(tierInfo, progress, upgradeReady, name) {
  const first = String(name || 'Customer').split(' ')[0];
  if (upgradeReady) {
    return first + ', your loyalty jar is ready for the next level! Tap below to request your upgraded visit card — we\'ll confirm and send your new discount.';
  }
  if (progress >= 75) {
    return 'Almost there, ' + first + '! You\'re close to unlocking the next discount tier. Keep shopping with AYLENSALE — every order fills your jar.';
  }
  if (tierInfo.tier === 0) {
    return 'Welcome, ' + first + '! Your visit card gives you personal prices on the site. The more you shop, the higher your discount on the next card we print for you.';
  }
  if (tierInfo.tier >= LOYALTY_TIERS.length - 1) {
    return 'Thank you for being a VIP customer, ' + first + '! You have our best wholesale-style discount. We appreciate your loyalty.';
  }
  return 'Hi ' + first + '! You\'re on the ' + tierInfo.label + ' tier with ' + tierInfo.percent + '% off. Watch your jar fill as you order — we upgrade loyal customers automatically.';
}

export async function getCardLoyaltySnapshot(code) {
  code = cleanCode(code);
  if (!code) {
    return { ok: false, error: 'Missing card code' };
  }

  const db = getFirestoreAdmin();
  const doc = await db.collection('cards').doc(code).get();
  if (!doc.exists) {
    return { ok: false, error: 'Unknown discount code' };
  }

  const card = normalizeCard(doc.id, doc.data());
  if (!cardIsUsable(card)) {
    return { ok: false, error: 'This discount code is not active' };
  }

  const stats = await loadOrderStats(db, code);
  const orders = Math.max(card.loyaltyOrders, stats.orderCount);
  const spend = Math.max(card.loyaltySpend, Number(stats.totalSpend.toFixed(2)));
  const tierIndex = Math.max(0, Math.min(LOYALTY_TIERS.length - 1, card.loyaltyTier));
  const tierInfo = tierByIndex(tierIndex);
  const suggested = suggestedTier(orders, spend);
  const progress = tierProgressToNext(orders, spend, tierIndex);
  const upgradeReady = suggested > tierIndex || progress >= 100;
  const nextTier = tierIndex < LOYALTY_TIERS.length - 1 ? tierByIndex(tierIndex + 1) : null;
  const discountPercent = card.discountType === 'percent'
    ? (card.discountValue || card.discount || tierInfo.percent)
    : Number(card.discount || 0);

  let pendingUpgrade = false;
  try {
    const pendingSnap = await db.collection('loyaltyUpgradeRequests')
      .where('code', '==', code)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    pendingUpgrade = !pendingSnap.empty;
  } catch (e) {
    pendingUpgrade = false;
  }

  return {
    ok: true,
    code: card.code,
    name: card.name,
    discountPercent,
    discountType: card.discountType,
    status: card.status,
    loyaltyTier: tierIndex,
    tierLabel: tierInfo.label,
    tierPercent: tierInfo.percent,
    orders,
    spend: Number(spend.toFixed(2)),
    suggestedTier: suggested,
    suggestedTierLabel: tierByIndex(suggested).label,
    suggestedTierPercent: tierByIndex(suggested).percent,
    upgradeReady,
    pendingUpgrade,
    progressToNext: progress,
    jarFill: jarFillHeight(tierIndex, orders, spend),
    nextTier: nextTier ? {
      tier: nextTier.tier,
      label: nextTier.label,
      percent: nextTier.percent,
      ordersNeed: nextTier.orders,
      spendNeed: nextTier.spend
    } : null,
    tiers: LOYALTY_TIERS.map(function(t) {
      return {
        tier: t.tier,
        label: t.label,
        percent: t.percent,
        orders: t.orders,
        spend: t.spend
      };
    }),
    recentOrders: stats.recentOrders,
    lastOrderAt: stats.lastOrderAt,
    expiryDate: card.expiryDate || '',
    usageCount: card.usageCount,
    usageLimit: card.usageLimit,
    wholesaleAccess: card.wholesaleAccess,
    freeDelivery: card.freeDelivery,
    messageFromUs: buildMessage(tierInfo, progress, upgradeReady, card.name)
  };
}
