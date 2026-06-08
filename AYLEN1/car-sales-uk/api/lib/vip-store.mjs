/**
 * VIP subscriber persistence (Firestore via Admin SDK).
 */
import crypto from 'crypto';
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import {
  DEFAULT_VIP_PAYWALL_CAROUSEL,
  DEFAULT_VIP_HUB_CAROUSEL,
  resolveVipPaywallCarousel,
  resolveVipHubCarousel
} from './vip-carousel-defaults.mjs';

export const VIP_STATUSES = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  PAST_DUE: 'past_due',
  UNPAID: 'unpaid'
};

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

function vipCollection() {
  return getFirestoreAdmin().collection('vipSubscribers');
}

function vipSettingsRef() {
  return getFirestoreAdmin().collection('siteSettings').doc('vip');
}

function marketplaceSettingsRef() {
  return getFirestoreAdmin().collection('siteSettings').doc('marketplace');
}

const SITE_CONTACT_DEFAULTS = {
  telegramUrl: 'https://t.me/aylensale',
  whatsappUrl: 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!'
};

function pickContactUrl(override, fromMenu, fallback) {
  const o = String(override || '').trim();
  if (o) return o;
  const m = String(fromMenu || '').trim();
  if (m) return m;
  return fallback;
}

function parseFirestoreTime(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value.toDate && typeof value.toDate === 'function') {
    try { return value.toDate().getTime(); } catch (e) { return 0; }
  }
  if (value._seconds != null) return Number(value._seconds) * 1000;
  if (value.seconds != null) return Number(value.seconds) * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function serializeFirestoreTime(value) {
  const ms = parseFirestoreTime(value);
  return ms ? new Date(ms).toISOString() : (typeof value === 'string' ? value : '');
}

function auctionBidFloor(data) {
  const d = data || {};
  const current = Number(d.currentPrice || d.currentBid || d.highestBid || 0);
  const start = Number(d.startingPrice || d.startPrice || d.price || 0);
  return current > 0 ? current : start;
}

function isAuctionOpenForBids(data) {
  const d = data || {};
  const endMs = parseFirestoreTime(d.endTime || d.endsAt);
  if (d.active === false) return false;
  if (endMs && endMs <= Date.now()) return false;
  const status = String(d.status || 'active').toLowerCase();
  return status !== 'completed' && status !== 'order_sent' &&
    status !== 'winner_pending' && status !== 'ended';
}

function mapVipAuctionBidPublic(bid) {
  const b = bid || {};
  return {
    id: String(b.id || ''),
    amount: Number(b.amount || 0),
    bidderName: String(b.bidderName || b.bidder || 'Bidder').slice(0, 80),
    bidderKey: String(b.bidderKey || '').slice(0, 120),
    timestamp: String(b.timestamp || b.createdAt || ''),
    source: String(b.source || 'shop').slice(0, 20)
  };
}

function normalizeBidderKey(params) {
  const email = normalizeEmail(params && (params.contact || params.email) || '');
  if (email) return 'email:' + email;
  const phone = String(params && params.phone || '').replace(/\D/g, '');
  if (phone.length >= 8) return 'phone:' + phone;
  const name = String(params && params.name || '').trim().toLowerCase();
  if (name) return 'name:' + name.slice(0, 40);
  return '';
}

function auctionHighestBid(bids) {
  const list = Array.isArray(bids) ? bids : [];
  if (!list.length) return null;
  return list.reduce(function(best, bid) {
    return Number(bid.amount || 0) > Number(best.amount || 0) ? bid : best;
  }, list[0]);
}

const VIP_BID_COOLDOWN_MS = 45000;

function mapVipAuctionBidsPublic(bids, limit) {
  const raw = Array.isArray(bids) ? bids.slice() : [];
  return raw
    .sort(function(a, b) {
      return (Date.parse(b.timestamp || 0) || 0) - (Date.parse(a.timestamp || 0) || 0);
    })
    .slice(0, limit || 40)
    .map(mapVipAuctionBidPublic);
}

async function getMarketplaceContact() {
  try {
    const snap = await marketplaceSettingsRef().get();
    return snap.exists ? snap.data() : {};
  } catch (e) {
    return {};
  }
}

export async function getVipSettings() {
  const snap = await vipSettingsRef().get();
  const data = snap.exists ? snap.data() : {};
  const marketplace = await getMarketplaceContact();
  const carouselRaw = data.carouselImages;
  let carouselImagesRaw = [];
  if (Array.isArray(carouselRaw)) {
    carouselImagesRaw = carouselRaw.filter(Boolean).map(String);
  } else if (typeof carouselRaw === 'string' && carouselRaw.trim()) {
    carouselImagesRaw = carouselRaw.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  }
  const hubCarouselRaw = data.hubCarouselImages;
  let hubCarouselImagesRaw = [];
  if (Array.isArray(hubCarouselRaw)) {
    hubCarouselImagesRaw = hubCarouselRaw.filter(Boolean).map(String);
  } else if (typeof hubCarouselRaw === 'string' && hubCarouselRaw.trim()) {
    hubCarouselImagesRaw = hubCarouselRaw.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  }
  const carouselPatch = {
    carouselImages: carouselImagesRaw,
    hubCarouselImages: hubCarouselImagesRaw,
    carouselSchemaVersion: Number(data.carouselSchemaVersion || 0)
  };
  const carouselImages = resolveVipPaywallCarousel(carouselPatch);
  const hubCarouselImages = resolveVipHubCarousel(carouselPatch);
  const telegramOverride = String(data.telegramUrl || '').trim();
  const whatsappOverride = String(data.whatsappUrl || '').trim();
  return {
    discountCode: data.discountCode || 'VIPSTOCK',
    discountPercent: Number(data.discountPercent || 10),
    telegramUrl: pickContactUrl(data.telegramUrl, marketplace.telegramUrl, SITE_CONTACT_DEFAULTS.telegramUrl),
    whatsappUrl: pickContactUrl(data.whatsappUrl, marketplace.whatsappUrl, SITE_CONTACT_DEFAULTS.whatsappUrl),
    telegramOverride: telegramOverride,
    whatsappOverride: whatsappOverride,
    telegramFromMenu: !telegramOverride,
    whatsappFromMenu: !whatsappOverride,
    menuTelegramUrl: pickContactUrl('', marketplace.telegramUrl, SITE_CONTACT_DEFAULTS.telegramUrl),
    menuWhatsappUrl: pickContactUrl('', marketplace.whatsappUrl, SITE_CONTACT_DEFAULTS.whatsappUrl),
    monthlyPriceGbp: Number(data.monthlyPriceGbp || 9.99),
    displayMemberCount: data.displayMemberCount != null && data.displayMemberCount !== ''
      ? Number(data.displayMemberCount)
      : null,
    foundingMemberLimit: Number(data.foundingMemberLimit || 50),
    carouselImages: carouselImages,
    hubVideoUrl: String(data.hubVideoUrl || '').trim(),
    hubCarouselImages: hubCarouselImages,
    carouselSchemaVersion: Number(data.carouselSchemaVersion || 0)
  };
}

export async function saveVipSettings(patch) {
  const ref = vipSettingsRef();
  await ref.set(Object.assign({}, patch, { updatedAt: new Date().toISOString() }), { merge: true });
  return getVipSettings();
}

export function mapStripeSubscriptionStatus(sub) {
  if (!sub) return VIP_STATUSES.UNPAID;
  const status = String(sub.status || '').toLowerCase();
  if (status === 'active' || status === 'trialing') return VIP_STATUSES.ACTIVE;
  if (status === 'past_due') return VIP_STATUSES.PAST_DUE;
  if (status === 'canceled' || status === 'cancelled') return VIP_STATUSES.CANCELLED;
  if (status === 'unpaid' || status === 'incomplete_expired') return VIP_STATUSES.UNPAID;
  return VIP_STATUSES.UNPAID;
}

export function hasVipAccess(record) {
  if (!record) return false;
  const status = String(record.status || '').toLowerCase();
  if (status === VIP_STATUSES.ACTIVE || status === VIP_STATUSES.CANCELLED) {
    const end = record.currentPeriodEnd ? Date.parse(record.currentPeriodEnd) : 0;
    if (end && end > Date.now()) return true;
    if (status === VIP_STATUSES.ACTIVE && !end) return true;
  }
  if (status === VIP_STATUSES.PAST_DUE) {
    const end = record.currentPeriodEnd ? Date.parse(record.currentPeriodEnd) : 0;
    return end && end > Date.now();
  }
  return false;
}

export async function findSubscriberByEmail(email) {
  const key = normalizeEmail(email);
  if (!key) return null;
  const snap = await vipCollection().where('email', '==', key).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

export async function findSubscriberByToken(token) {
  const t = String(token || '').trim();
  if (!t || t.length < 20) return null;
  const snap = await vipCollection().where('accessToken', '==', t).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

export async function findSubscriberByStripeCustomerId(customerId) {
  const id = String(customerId || '').trim();
  if (!id) return null;
  const snap = await vipCollection().where('stripeCustomerId', '==', id).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

export async function upsertSubscriberFromStripe(payload) {
  const email = normalizeEmail(payload.email);
  if (!email) throw new Error('VIP subscriber email required');

  let existing = null;
  if (payload.stripeCustomerId) {
    existing = await findSubscriberByStripeCustomerId(payload.stripeCustomerId);
  }
  if (!existing) {
    existing = await findSubscriberByEmail(email);
  }

  const docId = existing ? existing.id : vipCollection().doc().id;
  const ref = vipCollection().doc(docId);
  const now = new Date().toISOString();

  const next = {
    email: email,
    phone: payload.phone ? String(payload.phone).trim() : (existing && existing.phone) || '',
    stripeCustomerId: payload.stripeCustomerId || (existing && existing.stripeCustomerId) || '',
    stripeSubscriptionId: payload.stripeSubscriptionId || (existing && existing.stripeSubscriptionId) || '',
    status: payload.status || VIP_STATUSES.ACTIVE,
    currentPeriodEnd: payload.currentPeriodEnd || (existing && existing.currentPeriodEnd) || '',
    cancelAtPeriodEnd: payload.cancelAtPeriodEnd === true,
    amountGbp: Number(payload.amountGbp || (existing && existing.amountGbp) || 9.99),
    paymentFailedCount: Number(payload.paymentFailedCount != null ? payload.paymentFailedCount : (existing && existing.paymentFailedCount) || 0),
    lastPaymentAt: payload.lastPaymentAt || (existing && existing.lastPaymentAt) || '',
    updatedAt: now
  };

  if (!existing) {
    next.accessToken = generateAccessToken();
    next.createdAt = now;
  } else if (!existing.accessToken) {
    next.accessToken = generateAccessToken();
  }

  await ref.set(next, { merge: true });
  const saved = await ref.get();
  return Object.assign({ id: saved.id }, saved.data());
}

export async function listAllSubscribers(limit) {
  const snap = await vipCollection().orderBy('updatedAt', 'desc').limit(limit || 500).get();
  return snap.docs.map(function(doc) {
    return Object.assign({ id: doc.id }, doc.data());
  });
}

export async function countActiveSubscribers() {
  const rows = await listAllSubscribers(500);
  return rows.filter(function(r) {
    return String(r.status || '').toLowerCase() === VIP_STATUSES.ACTIVE;
  }).length;
}

export async function getPublicMemberCount() {
  const settings = await getVipSettings();
  const realActive = await countActiveSubscribers();
  if (realActive > 0) return realActive;
  if (settings.displayMemberCount != null && !Number.isNaN(settings.displayMemberCount)) {
    return Math.max(0, settings.displayMemberCount);
  }
  return 24;
}

export async function getLiveSiteStats() {
  let onlineVisitors = 0;
  let activeCarts = 0;
  try {
    const snap = await getFirestoreAdmin().collection('presenceSessions').limit(300).get();
    const now = Date.now();
    snap.forEach(function(doc) {
      const row = doc.data() || {};
      let ts = 0;
      if (row.updatedAt && row.updatedAt.toDate) ts = row.updatedAt.toDate().getTime();
      else if (row.updatedAt) ts = Date.parse(row.updatedAt) || 0;
      else if (row.lastSeen) ts = Date.parse(row.lastSeen) || 0;
      if (ts && now - ts < 120000) {
        onlineVisitors += 1;
        if (row.hasCart || row.cartCount > 0) activeCarts += 1;
      }
    });
  } catch (e) {
    console.warn('vip live stats:', e.message);
  }
  const vipActive = await countActiveSubscribers();
  const publicMembers = await getPublicMemberCount();
  return {
    onlineVisitors: onlineVisitors,
    activeCarts: activeCarts,
    vipActive: vipActive,
    publicMemberCount: publicMembers
  };
}

export {
  DEFAULT_VIP_CAROUSEL,
  DEFAULT_VIP_PAYWALL_CAROUSEL,
  DEFAULT_VIP_HUB_CAROUSEL,
  resolveVipPaywallCarousel,
  resolveVipHubCarousel
} from './vip-carousel-defaults.mjs';

export async function listVipStockItems() {
  const snap = await getFirestoreAdmin().collection('vipStockItems').limit(200).get();
  const items = snap.docs.map(function(doc) {
    const row = Object.assign({ id: doc.id }, doc.data());
    if (!Array.isArray(row.images) || !row.images.length) {
      row.images = row.imageUrl || row.photoUrl ? [row.imageUrl || row.photoUrl] : [];
    }
    return row;
  });
  return items
    .filter(function(x) {
      return x.visible !== false && String(x.stockStatus || 'available').toLowerCase() !== 'sold';
    })
    .sort(function(a, b) {
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });
}

export async function incrementVipStockView(itemId) {
  const id = String(itemId || '').trim();
  if (!id) return null;
  const ref = getFirestoreAdmin().collection('vipStockItems').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const prev = Number((snap.data() || {}).viewCount || 0);
  const next = prev + 1;
  await ref.set({ viewCount: next, lastViewedAt: new Date().toISOString() }, { merge: true });
  return next;
}

/** All VIP stock rows for admin panel (includes hidden). */
export async function listAllVipStockItemsAdmin(limit) {
  const snap = await getFirestoreAdmin().collection('vipStockItems').limit(limit || 500).get();
  return snap.docs.map(function(doc) {
    return Object.assign({ id: doc.id }, doc.data());
  }).sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

function normalizeVipStockItemAdminPayload(item) {
  const src = item || {};
  const title = String(src.title || src.name || 'VIP item').slice(0, 140);
  const images = Array.isArray(src.images)
    ? src.images.filter(Boolean).map(String).slice(0, 20)
    : (src.imageUrl ? [String(src.imageUrl)] : []);
  const imageUrl = images[0] || String(src.imageUrl || src.photoUrl || '').slice(0, 500);
  const stock = Math.max(0, Number(src.stock != null ? src.stock : 0));
  let stockStatus = String(src.stockStatus || 'available').slice(0, 20);
  if (stock === 0 && stockStatus === 'available') stockStatus = 'sold';
  return {
    title,
    name: title,
    desc: String(src.desc || src.description || '').slice(0, 1000),
    images,
    imageUrl,
    photoUrl: imageUrl,
    videoUrl: String(src.videoUrl || '').slice(0, 500),
    price: Number(src.price || 0),
    vipPrice: Number(src.vipPrice != null ? src.vipPrice : src.price || 0),
    badge: String(src.badge || 'VIP').slice(0, 40),
    category: String(src.category || 'general').slice(0, 40),
    categoryLabel: String(src.categoryLabel || src.category || 'General').slice(0, 60),
    visible: src.visible !== false,
    stock,
    stockStatus,
    royalMailPayEnabled: !!src.royalMailPayEnabled,
    royalMailFeeGbp: Number(src.royalMailFeeGbp || 0),
    viewCount: Number(src.viewCount || 0),
    sortOrder: Number(src.sortOrder || 0),
    updatedAt: new Date().toISOString()
  };
}

export async function saveVipStockItemAdmin(item) {
  const itemId = String(item && item.id || '').trim() || ('vip_' + Date.now());
  const ref = getFirestoreAdmin().collection('vipStockItems').doc(itemId);
  const existing = await ref.get();
  const data = normalizeVipStockItemAdminPayload(item);
  if (!existing.exists) {
    data.createdAt = new Date().toISOString();
  }
  await ref.set(data, { merge: true });
  return Object.assign({ id: itemId }, existing.exists ? Object.assign({}, existing.data(), data) : data);
}

export async function deleteVipStockItemAdmin(itemId) {
  const id = String(itemId || '').trim();
  if (!id) throw new Error('Missing VIP stock item id');
  await getFirestoreAdmin().collection('vipStockItems').doc(id).delete();
  return true;
}

export async function listVipAuctionsPreview(limit) {
  const snap = await getFirestoreAdmin().collection('auctions').limit(limit || 24).get();
  return snap.docs.map(function(doc) {
    const d = doc.data() || {};
    const endMs = parseFirestoreTime(d.endTime || d.endsAt);
    const images = Array.isArray(d.images) && d.images.length
      ? d.images.filter(Boolean).map(String)
      : (d.imageUrl || d.photoUrl ? [String(d.imageUrl || d.photoUrl)] : []);
    const currentPrice = Number(d.currentPrice || d.currentBid || d.highestBid || 0);
    const startingPrice = Number(d.startingPrice || d.startPrice || d.price || 0);
    const open = isAuctionOpenForBids(d);
    return {
      id: doc.id,
      name: d.name || d.title || 'Auction',
      title: d.name || d.title || 'Auction',
      desc: String(d.desc || d.description || '').slice(0, 2000),
      description: String(d.desc || d.description || '').slice(0, 2000),
      imageUrl: images[0] || d.imageUrl || d.photoUrl || '',
      images: images,
      startPrice: startingPrice,
      startingPrice: startingPrice,
      currentBid: currentPrice,
      currentPrice: currentPrice,
      bidsCount: Number(d.bidsCount || (Array.isArray(d.bids) ? d.bids.length : 0) || 0),
      bids: mapVipAuctionBidsPublic(d.bids, 40),
      category: d.category || 'general',
      endTime: serializeFirestoreTime(d.endTime || d.endsAt),
      viewCount: Number(d.viewCount || 0),
      active: open
    };
  }).filter(function(a) { return a.active; })
    .sort(function(a, b) {
      return (Date.parse(a.endTime || 0) || 0) - (Date.parse(b.endTime || 0) || 0);
    }).slice(0, limit || 12);
}

export async function saveVipBidderProfile(recordId, profile) {
  const id = String(recordId || '').trim();
  if (!id) return null;
  const patch = { bidderProfileUpdatedAt: new Date().toISOString() };
  if (profile && profile.displayName != null) {
    patch.bidderDisplayName = String(profile.displayName || '').slice(0, 80);
  }
  if (profile && profile.phone != null) {
    patch.bidderPhone = String(profile.phone || '').slice(0, 40);
  }
  await vipCollection().doc(id).set(patch, { merge: true });
  return patch;
}

export async function placeVipAuctionBid(params) {
  const auctionId = String(params && params.auctionId || '').trim();
  let amount = Number(params && params.amount);
  let name = String(params && params.name || 'VIP bidder').slice(0, 80);
  const phone = String(params && params.phone || '').slice(0, 40);
  const contact = String(params && params.contact || '').slice(0, 120);
  const bidderKey = String(params && params.bidderKey || '').trim() ||
    normalizeBidderKey({ contact: contact, email: contact, phone: phone, name: name });
  const vipMemberId = String(params && params.vipMemberId || '').trim();
  const skipAntiSpam = !!(params && params.skipAntiSpam);
  if (!auctionId) throw new Error('auctionId required');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid bid amount');
  if (!bidderKey && !skipAntiSpam) throw new Error('Bidder identity required');

  const db = getFirestoreAdmin();
  const ref = db.collection('auctions').doc(auctionId);

  return db.runTransaction(async function(tx) {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Auction not found');
    const d = snap.data() || {};
    if (!isAuctionOpenForBids(d)) throw new Error('Auction is not accepting bids');

    const floor = auctionBidFloor(d);
    if (amount <= floor) {
      throw new Error('Bid must be higher than £' + floor.toFixed(2));
    }

    const bids = Array.isArray(d.bids) ? d.bids.slice() : [];

    if (bidderKey && !skipAntiSpam) {
      const myBids = bids.filter(function(b) { return String(b.bidderKey || '') === bidderKey; });
      const highest = auctionHighestBid(bids);
      if (highest && String(highest.bidderKey || '') === bidderKey) {
        throw new Error('You are already the highest bidder — wait for someone else to bid first');
      }
      const lastMine = myBids.length ? myBids[myBids.length - 1] : null;
      if (lastMine && lastMine.timestamp) {
        const elapsed = Date.now() - (Date.parse(lastMine.timestamp) || 0);
        if (elapsed >= 0 && elapsed < VIP_BID_COOLDOWN_MS) {
          const waitSec = Math.ceil((VIP_BID_COOLDOWN_MS - elapsed) / 1000);
          throw new Error('Please wait ' + waitSec + 's before bidding again');
        }
      }
      const firstMine = myBids[0];
      if (firstMine && firstMine.bidderName && name !== firstMine.bidderName) {
        name = String(firstMine.bidderName).slice(0, 80);
      }
    }

    const bid = {
      id: auctionId + '_' + Date.now(),
      auctionId: auctionId,
      amount: amount,
      bidder: name,
      bidderName: name,
      bidderPhone: phone,
      bidderContact: contact,
      bidderKey: bidderKey,
      vipMemberId: vipMemberId,
      timestamp: new Date().toISOString(),
      source: String(params && params.source || 'vip').slice(0, 20)
    };
    bids.push(bid);
    tx.set(ref, {
      bids: bids,
      bidsCount: bids.length,
      currentPrice: amount,
      currentBid: amount,
      status: 'active',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return {
      bid: mapVipAuctionBidPublic(bid),
      currentPrice: amount,
      bidsCount: bids.length,
      bids: mapVipAuctionBidsPublic(bids, 40)
    };
  });
}

export async function listVipLocationsPreview(limit) {
  const snap = await getFirestoreAdmin().collection('locations').limit(limit || 24).get();
  return snap.docs.map(function(doc) {
    const d = doc.data() || {};
    return {
      id: doc.id,
      name: d.name || d.title || 'Pickup point',
      address: d.address || '',
      postcode: d.postcode || '',
      status: d.status || 'possible',
      day: d.day || d.weekendDay || '',
      note: String(d.note || d.notes || '').slice(0, 160)
    };
  }).filter(function(l) {
    return l.status === 'going' || l.status === 'possible';
  }).sort(function(a, b) {
    const rank = { going: 0, possible: 1, grey: 2 };
    return (rank[a.status] || 9) - (rank[b.status] || 9);
  }).slice(0, limit || 12);
}

export async function markVipWelcomeNotified(recordId) {
  if (!recordId) return;
  await vipCollection().doc(String(recordId)).set({
    welcomeNotifiedAt: new Date().toISOString()
  }, { merge: true });
}

export function publicVipStatus(record) {
  if (!record) {
    return { active: false, status: 'none', email: '', currentPeriodEnd: '', cancelAtPeriodEnd: false };
  }
  return {
    active: hasVipAccess(record),
    status: record.status || 'none',
    email: record.email || '',
    currentPeriodEnd: record.currentPeriodEnd || '',
    cancelAtPeriodEnd: !!record.cancelAtPeriodEnd,
    pastDue: String(record.status).toLowerCase() === VIP_STATUSES.PAST_DUE,
    bidderDisplayName: String(record.bidderDisplayName || '').slice(0, 80),
    bidderPhone: String(record.bidderPhone || '').slice(0, 40)
  };
}

export const VIP_ORDER_STATUSES = {
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  READY: 'ready',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

const VIP_ORDER_STATUS_SET = new Set(Object.values(VIP_ORDER_STATUSES));

function vipOrdersCollection() {
  return getFirestoreAdmin().collection('vipOrders');
}

export function generateVipOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rnd = crypto.randomBytes(2).toString('hex').toUpperCase();
  return 'VIP-' + ts + rnd;
}

export async function getVipStockItemById(itemId) {
  const id = String(itemId || '').trim();
  if (!id) return null;
  const doc = await getFirestoreAdmin().collection('vipStockItems').doc(id).get();
  if (!doc.exists) return null;
  return Object.assign({ id: doc.id }, doc.data());
}

export function assertVipItemOrderable(item) {
  const status = String(item && item.stockStatus || 'available').toLowerCase();
  if (status === 'sold') throw new Error('This item is sold out');
  if (status === 'reserved') throw new Error('This item is reserved — try again in a few minutes');
}

export async function createVipOrder(payload) {
  const record = payload.subscriber;
  const item = payload.item;
  if (!record || !item) throw new Error('VIP order requires subscriber and item');
  assertVipItemOrderable(item);

  const now = new Date().toISOString();
  const orderNumber = generateVipOrderNumber();
  const ref = vipOrdersCollection().doc();
  const unitPrice = Number(item.vipPrice != null ? item.vipPrice : item.price || 0);
  const deliveryFee = Number(payload.deliveryFeeGbp != null ? payload.deliveryFeeGbp : item.royalMailFeeGbp || 0);
  const qty = Math.max(1, Number(payload.qty || 1));
  const totalGbp = Number(payload.totalGbp != null ? payload.totalGbp : (unitPrice * qty) + deliveryFee);
  const paymentMode = String(payload.paymentMode || 'manual').slice(0, 20);
  const deliveryMethod = String(payload.deliveryMethod || 'pickup').slice(0, 20);

  const order = {
    orderNumber: orderNumber,
    subscriberId: String(record.id || ''),
    email: normalizeEmail(record.email),
    itemId: String(item.id || ''),
    itemTitle: String(item.title || item.name || 'VIP item').slice(0, 200),
    itemImageUrl: String(item.imageUrl || item.photoUrl || '').slice(0, 500),
    vipPrice: unitPrice,
    deliveryFeeGbp: deliveryFee,
    totalGbp: totalGbp,
    qty: qty,
    channel: String(payload.channel || 'whatsapp').slice(0, 20),
    paymentMode: paymentMode,
    deliveryMethod: deliveryMethod,
    paymentStatus: String(payload.paymentStatus || (paymentMode === 'stripe' ? 'pending' : '')).slice(0, 20),
    stripeSessionId: String(payload.stripeSessionId || '').slice(0, 120),
    shipping: payload.shipping && typeof payload.shipping === 'object' ? {
      name: String(payload.shipping.name || '').slice(0, 100),
      line1: String(payload.shipping.line1 || '').slice(0, 120),
      line2: String(payload.shipping.line2 || '').slice(0, 120),
      city: String(payload.shipping.city || '').slice(0, 80),
      postcode: String(payload.shipping.postcode || '').slice(0, 16)
    } : null,
    royalMailTracking: '',
    status: paymentMode === 'stripe' ? VIP_ORDER_STATUSES.REQUESTED : VIP_ORDER_STATUSES.REQUESTED,
    adminNote: '',
    paidAt: '',
    createdAt: now,
    updatedAt: now
  };

  await ref.set(order);
  return Object.assign({ id: ref.id }, order);
}

export async function listVipOrdersByEmail(email, limit) {
  const key = normalizeEmail(email);
  if (!key) return [];
  const snap = await vipOrdersCollection()
    .where('email', '==', key)
    .limit(limit || 50)
    .get();
  return snap.docs.map(function(doc) {
    return Object.assign({ id: doc.id }, doc.data());
  }).sort(function(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

export async function listAllVipOrdersAdmin(limit) {
  const snap = await vipOrdersCollection().limit(limit || 200).get();
  return snap.docs.map(function(doc) {
    return Object.assign({ id: doc.id }, doc.data());
  }).sort(function(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

export async function getVipOrderById(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return null;
  const doc = await vipOrdersCollection().doc(id).get();
  if (!doc.exists) return null;
  return Object.assign({ id: doc.id }, doc.data());
}

export async function updateVipOrderAdmin(orderId, patch) {
  const existing = await getVipOrderById(orderId);
  if (!existing) throw new Error('VIP order not found');

  const next = { updatedAt: new Date().toISOString() };
  if (patch.status != null) {
    const status = String(patch.status).toLowerCase();
    if (!VIP_ORDER_STATUS_SET.has(status)) {
      throw new Error('Invalid order status: ' + status);
    }
    next.status = status;
  }
  if (patch.adminNote != null) {
    next.adminNote = String(patch.adminNote || '').slice(0, 500);
  }
  if (patch.royalMailTracking != null) {
    next.royalMailTracking = String(patch.royalMailTracking || '').slice(0, 64);
  }

  await vipOrdersCollection().doc(String(orderId)).set(next, { merge: true });
  return Object.assign({}, existing, next);
}

export async function getVipOrderByStripeSession(sessionId) {
  const sid = String(sessionId || '').trim();
  if (!sid) return null;
  const snap = await vipOrdersCollection().where('stripeSessionId', '==', sid).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return Object.assign({ id: doc.id }, doc.data());
}

export async function markVipOrderPaid(orderId, stripeSessionId) {
  const existing = await getVipOrderById(orderId);
  if (!existing) throw new Error('VIP order not found');
  const now = new Date().toISOString();
  const next = {
    paymentStatus: 'paid',
    status: VIP_ORDER_STATUSES.PAID,
    stripeSessionId: String(stripeSessionId || existing.stripeSessionId || '').slice(0, 120),
    paidAt: now,
    updatedAt: now
  };
  await vipOrdersCollection().doc(String(orderId)).set(next, { merge: true });
  return Object.assign({}, existing, next);
}

export async function attachStripeSessionToOrder(orderId, sessionId) {
  await vipOrdersCollection().doc(String(orderId)).set({
    stripeSessionId: String(sessionId || '').slice(0, 120),
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export function mapVipOrderPublic(row) {
  if (!row) return null;
  var shipping = row.shipping || null;
  return {
    id: row.id,
    orderNumber: row.orderNumber || '',
    itemTitle: row.itemTitle || '',
    itemImageUrl: row.itemImageUrl || '',
    vipPrice: Number(row.vipPrice || 0),
    deliveryFeeGbp: Number(row.deliveryFeeGbp || 0),
    totalGbp: Number(row.totalGbp != null ? row.totalGbp : row.vipPrice || 0),
    qty: Number(row.qty || 1),
    channel: row.channel || '',
    paymentMode: row.paymentMode || 'manual',
    deliveryMethod: row.deliveryMethod || 'pickup',
    paymentStatus: row.paymentStatus || '',
    royalMailTracking: String(row.royalMailTracking || ''),
    shipping: shipping ? {
      name: shipping.name || '',
      city: shipping.city || '',
      postcode: shipping.postcode || ''
    } : null,
    status: row.status || VIP_ORDER_STATUSES.REQUESTED,
    adminNote: String(row.adminNote || ''),
    paidAt: row.paidAt || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || ''
  };
}

function vipMagicLinksCollection() {
  return getFirestoreAdmin().collection('vipMagicLinks');
}

export async function createVipMagicLink(email, origin) {
  const key = normalizeEmail(email);
  if (!key || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    throw new Error('Valid email required');
  }
  const record = await findSubscriberByEmail(key);
  if (!record || !hasVipAccess(record)) {
    throw new Error('No active VIP subscription for this email');
  }
  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  await vipMagicLinksCollection().doc(token).set({
    email: key,
    subscriberId: String(record.id || ''),
    createdAt: new Date(now).toISOString(),
    expiresAt: expiresAt,
    used: false
  });
  const base = String(origin || 'https://aylensale.com').replace(/\/$/, '');
  return {
    token: token,
    url: base + '/vip-stock.html?vip_magic=' + encodeURIComponent(token),
    email: key
  };
}

export async function redeemVipMagicLink(token) {
  const t = String(token || '').trim();
  if (!t || t.length < 20) throw new Error('Invalid access link');
  const ref = vipMagicLinksCollection().doc(t);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Access link expired or invalid');
  const row = doc.data() || {};
  if (row.used) throw new Error('This access link was already used');
  const exp = Date.parse(row.expiresAt || '');
  if (exp && exp < Date.now()) throw new Error('Access link expired — request a new one');

  const subSnap = row.subscriberId
    ? await vipCollection().doc(String(row.subscriberId)).get()
    : null;
  const record = subSnap && subSnap.exists
    ? Object.assign({ id: subSnap.id }, subSnap.data())
    : await findSubscriberByEmail(row.email);
  if (!record || !record.id || !hasVipAccess(record)) {
    throw new Error('VIP subscription is not active');
  }

  await ref.set({ used: true, usedAt: new Date().toISOString() }, { merge: true });
  return {
    accessToken: record.accessToken,
    vip: publicVipStatus(record),
    email: record.email || row.email || ''
  };
}
