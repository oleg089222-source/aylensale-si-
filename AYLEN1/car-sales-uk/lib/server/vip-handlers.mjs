/**
 * VIP STOCK — all server handlers (single Vercel function entry via api/vip.js).
 */
import { getStripe, getVipPriceId, getSiteOrigin } from './stripe-client.mjs';
import { notifyAdminNewVipMember, buildWhatsAppWelcomeUrl, notifyAdminVipOrder, sendVipMagicLinkEmail, notifyAdminMagicLinkFallback, notifyMemberVipOrderUpdate, notifyAdminVipOrderPaid } from './vip-notify.mjs';
import { verifyFirebaseAdminToken, getFirestoreAdmin } from './firebase-admin-app.mjs';
import {
  normalizeEmail,
  findSubscriberByEmail,
  findSubscriberByToken,
  findSubscriberByStripeCustomerId,
  publicVipStatus,
  getVipSettings,
  listVipStockItems,
  listAllVipStockItemsAdmin,
  listAllSubscribers,
  listVipAuctionsPreview,
  listVipLocationsPreview,
  markVipWelcomeNotified,
  hasVipAccess,
  upsertSubscriberFromStripe,
  mapStripeSubscriptionStatus,
  VIP_STATUSES,
  getPublicMemberCount,
  getLiveSiteStats,
  DEFAULT_VIP_CAROUSEL,
  DEFAULT_VIP_HUB_CAROUSEL,
  getVipStockItemById,
  createVipOrder,
  assertVipItemOrderable,
  listVipOrdersByEmail,
  listAllVipOrdersAdmin,
  updateVipOrderAdmin,
  placeVipAuctionBid,
  saveVipBidderProfile,
  mapVipOrderPublic,
  VIP_ORDER_STATUSES,
  createVipMagicLink,
  redeemVipMagicLink,
  markVipOrderPaid,
  attachStripeSessionToOrder,
  getVipOrderByStripeSession,
  incrementVipStockView,
  saveVipStockItemAdmin,
  deleteVipStockItemAdmin
} from './vip-store.mjs';
import { markAuctionDepositPaidFromSession, STRIPE_PRODUCT_AUCTION_DEPOSIT } from './auction-deposit.mjs';
import { markWinnerPaidFromSession, STRIPE_PRODUCT_AUCTION_WINNER_PAYMENT, resolveWinnerPaymentFlags } from './auction-payment.mjs';
import { getAuctionSettings, phoneKey } from './auction-engine.mjs';
import { canonicalUkPhoneDigits } from './uk-phone.mjs';

function isTruthy(v) {
  return v === true || v === 'true' || v === '1' || v === 'yes';
}

function vipDisabled() {
  const enabled = process.env.VIP_ENABLED;
  return enabled === 'false' || enabled === '0' || enabled === 'no';
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch (e) {
    return {};
  }
}

function periodEndIso(sub) {
  if (!sub || !sub.current_period_end) return '';
  return new Date(sub.current_period_end * 1000).toISOString();
}

async function maybeNotifyNewVipMember(record, priorRecord) {
  if (!record || String(record.status || '').toLowerCase() !== VIP_STATUSES.ACTIVE) return;
  if (record.welcomeNotifiedAt) return;
  const wasActive = priorRecord && String(priorRecord.status || '').toLowerCase() === VIP_STATUSES.ACTIVE;
  if (wasActive && priorRecord.welcomeNotifiedAt) return;
  try {
    const settings = await getVipSettings();
    await notifyAdminNewVipMember(record, settings);
    await markVipWelcomeNotified(record.id);
  } catch (e) {
    console.error('vip welcome notify:', e.message);
  }
}

async function syncFromSubscription(sub, customerEmail) {
  if (!sub) return null;
  const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || '';
  let email = customerEmail || (sub.metadata && sub.metadata.email) || '';
  const existing = customerId ? await findSubscriberByStripeCustomerId(customerId) : null;
  const prior = existing || (email ? await findSubscriberByEmail(email) : null);
  if (!email && prior) email = prior.email;
  const status = mapStripeSubscriptionStatus(sub);
  const failedCount = status === VIP_STATUSES.PAST_DUE
    ? Number((prior && prior.paymentFailedCount) || 0) + 1
    : 0;

  const record = await upsertSubscriberFromStripe({
    email: email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status: status,
    currentPeriodEnd: periodEndIso(sub),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    amountGbp: 9.99,
    paymentFailedCount: failedCount
  });
  if (status === VIP_STATUSES.ACTIVE) {
    await maybeNotifyNewVipMember(record, prior);
  }
  return record;
}

export async function handleConfig(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawEnabled = process.env.VIP_ENABLED;
  const enabled = rawEnabled === undefined || rawEnabled === ''
    ? true
    : isTruthy(rawEnabled);
  let stripeReady = false;
  let priceIdSet = false;

  try {
    if (process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).trim()) {
      getStripe();
      stripeReady = true;
    }
  } catch (e) {}

  try {
    if (process.env.STRIPE_VIP_PRICE_ID && String(process.env.STRIPE_VIP_PRICE_ID).trim()) {
      getVipPriceId();
      priceIdSet = true;
    }
  } catch (e) {}

  const webhookSet = !!(process.env.STRIPE_WEBHOOK_SECRET && String(process.env.STRIPE_WEBHOOK_SECRET).trim());

  let memberCount = 24;
  let foundingMemberLimit = 50;
  let carouselImages = DEFAULT_VIP_CAROUSEL.slice();
  let hubCarouselImages = DEFAULT_VIP_HUB_CAROUSEL.slice();
  try {
    const settings = await getVipSettings();
    foundingMemberLimit = settings.foundingMemberLimit || 50;
    carouselImages = settings.carouselImages || carouselImages;
    hubCarouselImages = settings.hubCarouselImages || hubCarouselImages;
    memberCount = await getPublicMemberCount();
  } catch (e) {}

  return res.status(200).json({
    enabled: enabled,
    checkoutReady: enabled && stripeReady && priceIdSet,
    stripeConfigured: stripeReady && priceIdSet,
    webhookConfigured: webhookSet,
    monthlyPriceGbp: 9.99,
    testMode: !!(process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).includes('_test_')),
    memberCount: memberCount,
    foundingMemberLimit: foundingMemberLimit,
    carouselImages: carouselImages,
    hubCarouselImages: hubCarouselImages
  });
}

function bearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

export async function handleAdminMemberPreview(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded = await verifyFirebaseAdminToken(bearerToken(req));
  if (!decoded) {
    return res.status(403).json({ error: 'Admin Firebase login required' });
  }

  try {
    const settings = await getVipSettings();
    const stock = await listVipStockItems();
    const auctions = await listVipAuctionsPreview(12);
    const locations = await listVipLocationsPreview(12);
    const liveStats = await getLiveSiteStats();
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const adminEmail = String(decoded.email || 'Admin preview');

    return res.status(200).json({
      adminPreview: true,
      vip: {
        active: true,
        status: 'active',
        email: adminEmail,
        currentPeriodEnd: next.toISOString(),
        cancelAtPeriodEnd: false,
        pastDue: false
      },
      locked: false,
      settings: settings,
      stock: stock,
      auctions: auctions,
      locations: locations,
      liveStats: liveStats,
      whatsappWelcomeUrl: buildWhatsAppWelcomeUrl(settings.whatsappUrl, adminEmail)
    });
  } catch (error) {
    console.error('vip admin-member-preview:', error.message);
    return res.status(500).json({ error: error.message || 'Could not load VIP member preview' });
  }
}

export async function handleAdminPanel(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded = await verifyFirebaseAdminToken(bearerToken(req));
  if (!decoded) {
    return res.status(403).json({ error: 'Admin Firebase login required' });
  }

  try {
    const [subscribers, stockRaw, settings, liveStats, ordersRaw] = await Promise.all([
      listAllSubscribers(500),
      listAllVipStockItemsAdmin(500),
      getVipSettings(),
      getLiveSiteStats(),
      listAllVipOrdersAdmin(200)
    ]);

    const stock = stockRaw.map(function(row) {
      return {
        id: row.id,
        title: row.title || row.name || 'VIP item',
        name: row.title || row.name || 'VIP item',
        desc: String(row.desc || row.description || '').slice(0, 1000),
        imageUrl: row.imageUrl || row.photoUrl || '',
        photoUrl: row.photoUrl || row.imageUrl || '',
        price: Number(row.price || 0),
        vipPrice: Number(row.vipPrice != null ? row.vipPrice : row.price || 0),
        badge: String(row.badge || 'VIP').slice(0, 40),
        category: String(row.category || 'general').slice(0, 40),
        categoryLabel: String(row.categoryLabel || row.category || 'General').slice(0, 60),
        stockStatus: String(row.stockStatus || 'available').slice(0, 20),
        stock: Number(row.stock != null ? row.stock : 0),
        images: Array.isArray(row.images) ? row.images : (row.imageUrl ? [row.imageUrl] : []),
        videoUrl: String(row.videoUrl || '').slice(0, 500),
        viewCount: Number(row.viewCount || 0),
        royalMailPayEnabled: !!row.royalMailPayEnabled,
        royalMailFeeGbp: Number(row.royalMailFeeGbp || 0),
        visible: row.visible !== false,
        sortOrder: Number(row.sortOrder || 0)
      };
    });

    const subs = subscribers.map(function(row) {
      return {
        id: row.id,
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
      };
    });

    const orders = ordersRaw.map(function(row) {
      return Object.assign(mapVipOrderPublic(Object.assign({ id: row.id }, row)), {
        email: row.email || '',
        shipping: row.shipping || null,
        paymentStatus: row.paymentStatus || '',
        deliveryMethod: row.deliveryMethod || '',
        totalGbp: Number(row.totalGbp != null ? row.totalGbp : row.vipPrice || 0),
        royalMailTracking: row.royalMailTracking || ''
      });
    });

    return res.status(200).json({
      subscribers: subs,
      stock: stock,
      settings: settings,
      liveStats: liveStats,
      orders: orders
    });
  } catch (error) {
    console.error('vip admin-panel:', error.message);
    return res.status(500).json({ error: error.message || 'Could not load VIP admin data' });
  }
}

function buildTelegramContactUrl(telegramUrl, msg) {
  const raw = String(telegramUrl || 'https://t.me/aylensale').trim();
  const userMatch = raw.match(/^https:\/\/t\.me\/([a-z0-9_]{3,64})\/?$/i);
  if (userMatch) {
    return 'https://t.me/' + userMatch[1] + '?text=' + encodeURIComponent(msg);
  }
  return 'https://t.me/share/url?url=' + encodeURIComponent('https://aylensale.com/vip-stock.html') +
    '&text=' + encodeURIComponent(msg);
}

function buildVipOrderContactUrl(channel, settings, order, code) {
  const title = order.itemTitle || 'VIP item';
  const price = order.vipPrice;
  const ref = order.orderNumber || order.id;
  const msg = 'Hi AYLENSALE VIP! Order ' + ref + ' — I want: ' + title +
    (price != null ? ' (VIP £' + Number(price).toFixed(2) + ')' : '') +
    '. Code: ' + String(code || 'VIPSTOCK');
  const ch = String(channel || 'whatsapp').toLowerCase();
  if (ch === 'telegram') {
    return buildTelegramContactUrl(settings && settings.telegramUrl, msg);
  }
  const wa = (settings && settings.whatsappUrl) || 'https://wa.me/447471647771';
  const base = String(wa).split('?')[0];
  return base + '?text=' + encodeURIComponent(msg);
}

export async function handleCreateOrder(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const token = String(body.accessToken || '').trim();
    const itemId = String(body.itemId || '').trim();
    const channel = String(body.channel || 'whatsapp').toLowerCase();

    if (!token) return res.status(400).json({ error: 'accessToken required' });
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    const record = await findSubscriberByToken(token);
    if (!record || !hasVipAccess(record)) {
      return res.status(403).json({ error: 'Active VIP membership required' });
    }

    const item = await getVipStockItemById(itemId);
    if (!item || item.visible === false) {
      return res.status(404).json({ error: 'VIP item not found or unavailable' });
    }
    try {
      assertVipItemOrderable(item);
    } catch (stockErr) {
      return res.status(409).json({ error: stockErr.message || 'Item unavailable' });
    }

    let vipStockAdjustment = null;
    try {
      const { decrementVipStockItem } = await import('./inventory-stock.mjs');
      vipStockAdjustment = await decrementVipStockItem(itemId, body.qty || 1);
    } catch (stockErr) {
      console.error('[vip-order] stock decrement failed:', stockErr.message);
      return res.status(409).json({
        error: stockErr.message || 'VIP item out of stock',
        code: stockErr.code || 'stock_unavailable',
        before: stockErr.before,
        requested: stockErr.requested
      });
    }

    const order = await createVipOrder({
      subscriber: record,
      item: item,
      channel: channel,
      qty: body.qty || 1
    });

    try {
      await notifyAdminVipOrder(order, record);
    } catch (e) {
      console.error('vip order notify:', e.message);
    }

    const settings = await getVipSettings();
    const contactUrl = buildVipOrderContactUrl(channel, settings, order, settings.discountCode);

    return res.status(200).json({
      order: mapVipOrderPublic(order),
      contactUrl: contactUrl,
      stockAdjustment: vipStockAdjustment
    });
  } catch (error) {
    console.error('vip create-order:', error.message);
    return res.status(500).json({ error: error.message || 'Could not create VIP order' });
  }
}

export async function handleVipAuctionBid(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const adminDecoded = await verifyFirebaseAdminToken(bearerToken(req));
    let bidderName = String(body.name || '').trim();
    let bidderPhone = String(body.phone || '').trim();
    let bidderContact = String(body.contact || '').trim();
    let record = null;
    let bidderKey = '';
    let vipMemberId = '';

    if (!adminDecoded) {
      const token = String(body.accessToken || '').trim();
      if (!token) return res.status(400).json({ error: 'accessToken required' });
      record = await findSubscriberByToken(token);
      if (!record || !hasVipAccess(record)) {
        return res.status(403).json({ error: 'Active VIP membership required' });
      }
      vipMemberId = String(record.id || '');
      bidderContact = normalizeEmail(record.email || bidderContact);
      if (!bidderName) bidderName = String(record.bidderDisplayName || '').trim();
      if (!bidderName && record.email) bidderName = record.email.split('@')[0];
      if (!bidderPhone) bidderPhone = String(record.bidderPhone || '').trim();
      if (!bidderName) bidderName = record.email || 'VIP bidder';
      if (canonicalUkPhoneDigits(bidderPhone).length < 10) {
        return res.status(400).json({
          error: 'Valid UK phone required for auction bids (links deposit & winner flow)',
          code: 'PHONE_REQUIRED'
        });
      }
      bidderKey = phoneKey(bidderPhone);
    } else {
      bidderContact = normalizeEmail(adminDecoded.email || bidderContact);
      bidderKey = bidderContact ? ('email:' + bidderContact) : '';
      if (!bidderName) bidderName = adminDecoded.email || 'Admin test bid';
    }

    const result = await placeVipAuctionBid({
      auctionId: body.auctionId,
      amount: body.amount,
      name: bidderName,
      phone: bidderPhone,
      contact: bidderContact,
      bidderKey: bidderKey,
      vipMemberId: vipMemberId,
      source: adminDecoded ? 'vip_admin' : 'vip',
      skipAntiSpam: !!adminDecoded,
      skipDeposit: !!adminDecoded
    });

    if (record && record.id) {
      try {
        await saveVipBidderProfile(record.id, {
          displayName: bidderName,
          phone: bidderPhone
        });
      } catch (profileErr) {
        console.warn('vip bidder profile save:', profileErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      currentPrice: result.currentPrice,
      bidsCount: result.bidsCount,
      bid: result.bid,
      bids: result.bids || []
    });
  } catch (error) {
    console.error('vip auction-bid:', error.message);
    const code = error && error.code;
    if (code === 'DEPOSIT_REQUIRED') {
      return res.status(403).json({
        error: error.message || 'Deposit required before bidding',
        code: 'DEPOSIT_REQUIRED',
        depositAmountGbp: error.depositAmountGbp
      });
    }
    return res.status(400).json({ error: error.message || 'Could not place bid' });
  }
}

export async function handleMemberOrders(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.method === 'POST' ? await parseJsonBody(req) : {};
    const query = req.query || {};
    const token = String(body.accessToken || query.accessToken || '').trim();

    if (!token) return res.status(400).json({ error: 'accessToken required' });

    const record = await findSubscriberByToken(token);
    if (!record || !hasVipAccess(record)) {
      return res.status(403).json({ error: 'Active VIP membership required' });
    }

    const rows = await listVipOrdersByEmail(record.email, 50);
    return res.status(200).json({
      orders: rows.map(function(row) {
        return mapVipOrderPublic(Object.assign({ id: row.id }, row));
      })
    });
  } catch (error) {
    console.error('vip member-orders:', error.message);
    return res.status(500).json({ error: error.message || 'Could not load orders' });
  }
}

export async function handleAdminOrderUpdate(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded = await verifyFirebaseAdminToken(bearerToken(req));
  if (!decoded) {
    return res.status(403).json({ error: 'Admin Firebase login required' });
  }

  try {
    const body = await parseJsonBody(req);
    const orderId = String(body.orderId || '').trim();
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const updated = await updateVipOrderAdmin(orderId, {
      status: body.status,
      adminNote: body.adminNote,
      royalMailTracking: body.royalMailTracking
    });

    try {
      if (updated.email && (body.status != null || body.adminNote != null)) {
        await notifyMemberVipOrderUpdate(updated, updated.email);
      }
    } catch (e) {
      console.warn('vip order member notify:', e.message);
    }

    return res.status(200).json({
      order: mapVipOrderPublic(updated)
    });
  } catch (error) {
    console.error('vip admin-order-update:', error.message);
    return res.status(500).json({ error: error.message || 'Could not update order' });
  }
}

export async function handleAdminStock(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded = await verifyFirebaseAdminToken(bearerToken(req));
  if (!decoded) {
    return res.status(403).json({ error: 'Admin Firebase login required' });
  }

  try {
    const body = await parseJsonBody(req);
    const action = String(body.action || (req.method === 'DELETE' ? 'delete' : 'save')).toLowerCase();

    if (action === 'delete') {
      const itemId = String(body.itemId || body.id || '').trim();
      if (!itemId) return res.status(400).json({ error: 'itemId required' });
      await deleteVipStockItemAdmin(itemId);
      return res.status(200).json({ ok: true, deleted: itemId });
    }

    const item = body.item || body;
    if (!item || !String(item.title || item.name || '').trim()) {
      return res.status(400).json({ error: 'Title required' });
    }
    const saved = await saveVipStockItemAdmin(item);
    return res.status(200).json({ ok: true, item: saved });
  } catch (error) {
    console.error('vip admin-stock:', error.message);
    return res.status(500).json({ error: error.message || 'Could not save VIP stock item' });
  }
}

export async function handleAdminMediaUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded = await verifyFirebaseAdminToken(bearerToken(req));
  if (!decoded) {
    return res.status(403).json({ error: 'Admin Firebase login required' });
  }

  try {
    const body = await parseJsonBody(req);
    if (!body.dataUrl && !body.base64) {
      return res.status(400).json({ error: 'dataUrl or base64 required' });
    }
    const result = await uploadAdminMediaFromDataUrl(body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('vip admin-media-upload:', error.message);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

function validateUkShipping(shipping) {
  const s = shipping || {};
  const name = String(s.name || '').trim();
  const line1 = String(s.line1 || '').trim();
  const city = String(s.city || '').trim();
  const postcode = String(s.postcode || '').trim().toUpperCase();
  if (name.length < 2) throw new Error('Delivery name required');
  if (line1.length < 3) throw new Error('Address line required');
  if (city.length < 2) throw new Error('City required');
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postcode.replace(/\s+/g, ' '))) {
    throw new Error('Valid UK postcode required');
  }
  return { name: name, line1: line1, line2: String(s.line2 || '').trim(), city: city, postcode: postcode };
}

export async function handleVipItemCheckout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const token = String(body.accessToken || '').trim();
    const itemId = String(body.itemId || '').trim();
    if (!token) return res.status(400).json({ error: 'accessToken required' });
    if (!itemId) return res.status(400).json({ error: 'itemId required' });

    const record = await findSubscriberByToken(token);
    if (!record || !hasVipAccess(record)) {
      return res.status(403).json({ error: 'Active VIP membership required' });
    }

    const item = await getVipStockItemById(itemId);
    if (!item || item.visible === false) {
      return res.status(404).json({ error: 'VIP item not found' });
    }
    if (!item.royalMailPayEnabled) {
      return res.status(400).json({ error: 'Card payment + Royal Mail is not enabled for this item' });
    }
    try {
      assertVipItemOrderable(item);
    } catch (stockErr) {
      return res.status(409).json({ error: stockErr.message || 'Item unavailable' });
    }

    const shipping = validateUkShipping(body.shipping);
    const deliveryFee = Number(item.royalMailFeeGbp || 0);
    const unitPrice = Number(item.vipPrice != null ? item.vipPrice : item.price || 0);
    const totalGbp = unitPrice + deliveryFee;
    if (totalGbp < 0.5) {
      return res.status(400).json({ error: 'Invalid item price for checkout' });
    }

    const order = await createVipOrder({
      subscriber: record,
      item: item,
      channel: 'stripe',
      paymentMode: 'stripe',
      deliveryMethod: 'royal_mail',
      paymentStatus: 'pending',
      deliveryFeeGbp: deliveryFee,
      totalGbp: totalGbp,
      shipping: shipping
    });

    const stripe = getStripe();
    const origin = getSiteOrigin(req);
    const amountPence = Math.round(totalGbp * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: amountPence,
          product_data: {
            name: String(item.title || item.name || 'VIP item').slice(0, 120),
            description: 'VIP order ' + order.orderNumber + ' · Royal Mail UK delivery'
          }
        },
        quantity: 1
      }],
      customer_email: record.email || undefined,
      metadata: {
        product: 'vip_item',
        vip_order_id: order.id,
        order_number: order.orderNumber
      },
      success_url: origin + '/vip-stock.html?vip_pay=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/vip-stock.html?vip_pay=cancelled'
    });

    await attachStripeSessionToOrder(order.id, session.id);

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
      order: mapVipOrderPublic(Object.assign({}, order, { stripeSessionId: session.id }))
    });
  } catch (error) {
    console.error('vip item checkout:', error.message);
    return res.status(500).json({ error: error.message || 'Checkout failed' });
  }
}

export async function handleVipItemVerify(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.mode !== 'payment') {
      return res.status(400).json({ error: 'Invalid payment session' });
    }
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const orderId = session.metadata && session.metadata.vip_order_id;
    let order = orderId ? await getVipOrderById(orderId) : await getVipOrderByStripeSession(sessionId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.paymentStatus !== 'paid') {
      order = await markVipOrderPaid(order.id, sessionId);
      try {
        await notifyAdminVipOrderPaid(order);
        await notifyMemberVipOrderUpdate(order, order.email);
      } catch (e) {
        console.warn('vip paid notify:', e.message);
      }
    }

    return res.status(200).json({ order: mapVipOrderPublic(order), paid: true });
  } catch (error) {
    console.error('vip item verify:', error.message);
    return res.status(500).json({ error: error.message || 'Verification failed' });
  }
}

export async function handleVipItemView(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = await parseJsonBody(req);
    const token = String(body.accessToken || '').trim();
    const itemId = String(body.itemId || '').trim();
    if (!token) return res.status(400).json({ error: 'accessToken required' });
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    const record = await findSubscriberByToken(token);
    if (!record || !hasVipAccess(record)) {
      return res.status(403).json({ error: 'Active VIP membership required' });
    }
    const viewCount = await incrementVipStockView(itemId);
    if (viewCount == null) return res.status(404).json({ error: 'Item not found' });
    return res.status(200).json({ ok: true, viewCount: viewCount });
  } catch (error) {
    console.error('vip item view:', error.message);
    return res.status(500).json({ error: error.message || 'Could not record view' });
  }
}

export async function handleMagicLinkRequest(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = await parseJsonBody(req);
    const email = normalizeEmail(body.email);
    if (!email) return res.status(400).json({ error: 'Valid email required' });

    const origin = getSiteOrigin(req);
    const link = await createVipMagicLink(email, origin);
    let emailed = false;
    try {
      emailed = await sendVipMagicLinkEmail(link.email, link.url);
    } catch (e) {
      console.warn('magic link email:', e.message);
    }
    if (!emailed) {
      await notifyAdminMagicLinkFallback(link.email, link.url);
    }
    return res.status(200).json({
      ok: true,
      message: emailed
        ? 'Access link sent to your email.'
        : 'If this email has an active VIP subscription, we sent instructions (check spam or contact support).'
    });
  } catch (error) {
    const msg = error.message || 'Could not send access link';
    if (/no active vip/i.test(msg)) {
      return res.status(404).json({ error: msg });
    }
    return res.status(500).json({ error: msg });
  }
}

export async function handleMagicLinkRedeem(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = await parseJsonBody(req);
    const token = String(body.token || body.vip_magic || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });

    const pack = await redeemVipMagicLink(token);
    return res.status(200).json({
      accessToken: pack.accessToken,
      vip: pack.vip,
      email: pack.email
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid access link' });
  }
}

export async function handleCheckout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (vipDisabled()) {
    return res.status(503).json({ error: 'VIP subscriptions are temporarily unavailable.' });
  }

  try {
    const body = await parseJsonBody(req);
    const email = normalizeEmail(body.email);
    const hasEmail = !!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    const stripe = getStripe();
    const priceId = getVipPriceId();
    const origin = getSiteOrigin(req);

    const meta = { product: 'vip_stock' };
    if (hasEmail) meta.email = email;

    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ['card', 'link'],
      success_url: origin + '/vip-stock.html?checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/vip-stock.html?checkout=cancelled',
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      metadata: meta,
      subscription_data: { metadata: Object.assign({}, meta) }
    };
    if (hasEmail) {
      sessionParams.customer_email = email;
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeErr) {
      const stripeMsg = String(stripeErr.message || '');
      console.error('vip checkout stripe:', stripeMsg);
      if (stripeMsg.indexOf('No such price') !== -1) {
        return res.status(503).json({
          error: 'VIP price not found in Stripe. Check STRIPE_VIP_PRICE_ID in Vercel (must be price_… from live mode).'
        });
      }
      if (stripeMsg.indexOf('permission') !== -1 || stripeMsg.indexOf('api_key') !== -1) {
        return res.status(503).json({
          error: 'Stripe key lacks permission for Checkout. Use sk_live_… or grant Checkout Sessions Write on your restricted key.'
        });
      }
      throw stripeErr;
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('vip checkout:', error.message);
    const msg = String(error.message || 'Checkout failed');
    if (msg.indexOf('not configured') !== -1) {
      return res.status(503).json({ error: 'VIP payments are not configured yet. Contact support.' });
    }
    return res.status(500).json({ error: msg });
  }
}

export async function handleVerify(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    });

    if (session.mode === 'payment') {
      return res.status(400).json({ error: 'Not a VIP subscription checkout session' });
    }

    if (session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Invalid checkout session mode' });
    }

    const meta = session.metadata || {};
    const hasSubscription = !!session.subscription;
    if (meta.product !== 'vip_stock' && !hasSubscription) {
      return res.status(400).json({ error: 'Not a VIP subscription checkout session' });
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(402).json({ error: 'Payment not completed yet' });
    }

    let sub = session.subscription && typeof session.subscription === 'object'
      ? session.subscription
      : null;
    if (!sub && hasSubscription) {
      sub = await stripe.subscriptions.retrieve(String(session.subscription));
    }
    if (!sub) {
      return res.status(400).json({ error: 'No subscription found for this session' });
    }

    const periodEnd = periodEndIso(sub);
    const mappedStatus = mapStripeSubscriptionStatus(sub);
    if (mappedStatus === VIP_STATUSES.ACTIVE && !periodEnd) {
      return res.status(400).json({ error: 'Subscription billing period not available yet' });
    }

    const email = String(
      session.customer_details && session.customer_details.email ||
      meta.email ||
      session.customer_email ||
      ''
    ).trim().toLowerCase();

    const prior = email ? await findSubscriberByEmail(email) : null;
    const record = await syncFromSubscription(sub, email);
    if (!record) {
      return res.status(500).json({ error: 'Could not sync VIP subscription' });
    }

    await maybeNotifyNewVipMember(record, prior);

    return res.status(200).json({
      accessToken: record.accessToken,
      vip: publicVipStatus(record),
      welcome: true
    });
  } catch (error) {
    console.error('vip verify:', error.message);
    return res.status(500).json({ error: error.message || 'Verification failed' });
  }
}

export async function handleStatus(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.method === 'POST' ? await parseJsonBody(req) : {};
    const query = req.query || {};
    const token = String(body.accessToken || query.accessToken || '').trim();

    if (!token) {
      return res.status(200).json({
        vip: publicVipStatus(null),
        settings: { monthlyPriceGbp: 9.99 }
      });
    }

    const record = await findSubscriberByToken(token);
    const vip = publicVipStatus(record);

    if (!record || !hasVipAccess(record)) {
      return res.status(200).json({
        accessToken: token,
        vip: vip,
        locked: true,
        message: vip.pastDue
          ? 'Please update your payment method to restore VIP access.'
          : 'VIP access required. Subscribe to unlock this stock.'
      });
    }

    const settings = await getVipSettings();
    const stock = await listVipStockItems();
    const auctions = await listVipAuctionsPreview(12);
    const locations = await listVipLocationsPreview(12);
    const liveStats = await getLiveSiteStats();
    const memberEmail = record.email || '';
    const whatsappWelcomeUrl = buildWhatsAppWelcomeUrl(settings.whatsappUrl, memberEmail);

    return res.status(200).json({
      accessToken: token,
      vip: vip,
      locked: false,
      settings: settings,
      stock: stock,
      auctions: auctions,
      locations: locations,
      liveStats: liveStats,
      whatsappWelcomeUrl: whatsappWelcomeUrl
    });
  } catch (error) {
    console.error('vip status:', error.message);
    return res.status(500).json({ error: error.message || 'Status check failed' });
  }
}

export async function handlePortal(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const token = String(body.accessToken || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'accessToken required' });
    }

    const record = await findSubscriberByToken(token);
    if (!record || !record.stripeCustomerId) {
      return res.status(404).json({ error: 'No billing account found for this VIP session' });
    }

    const stripe = getStripe();
    const origin = getSiteOrigin(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: record.stripeCustomerId,
      return_url: origin + '/vip-stock.html'
    });

    return res.status(200).json({ url: portal.url });
  } catch (error) {
    console.error('vip portal:', error.message);
    return res.status(500).json({ error: error.message || 'Portal unavailable' });
  }
}

export async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET missing');
    return res.status(500).send('Webhook not configured');
  }

  let event;
  try {
    const stripe = getStripe();
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('vip webhook signature:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          const email = session.customer_details && session.customer_details.email || session.metadata && session.metadata.email || session.customer_email;
          await syncFromSubscription(sub, email);
        } else if (session.mode === 'payment' && session.metadata && session.metadata.product === STRIPE_PRODUCT_AUCTION_DEPOSIT) {
          if (session.payment_status === 'paid') {
            await markAuctionDepositPaidFromSession(session, { eventId: event.id, source: 'webhook' });
          }
        } else if (session.mode === 'payment' && session.metadata && session.metadata.product === STRIPE_PRODUCT_AUCTION_WINNER_PAYMENT) {
          const db = getFirestoreAdmin();
          const payFlags = resolveWinnerPaymentFlags(await getAuctionSettings(db));
          if (payFlags.winnerPaymentEnabled && (session.payment_status === 'paid' || session.status === 'complete')) {
            await markWinnerPaidFromSession(session, { eventId: event.id, source: 'webhook' });
          }
        } else if (session.mode === 'payment' && session.metadata && session.metadata.product === 'vip_item') {
          const orderId = session.metadata.vip_order_id;
          if (orderId) {
            const order = await markVipOrderPaid(orderId, session.id);
            try {
              await notifyAdminVipOrderPaid(order);
              await notifyMemberVipOrderUpdate(order, order.email);
            } catch (e) {
              console.warn('vip item webhook notify:', e.message);
            }
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await syncFromSubscription(sub, sub.metadata && sub.metadata.email);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(String(invoice.subscription));
          const customerId = typeof sub.customer === 'string' ? sub.customer : '';
          const existing = customerId ? await findSubscriberByStripeCustomerId(customerId) : null;
          const record = await syncFromSubscription(sub, invoice.customer_email);
          if (record) {
            const failCount = Number((existing && existing.paymentFailedCount) || 0) + 1;
            await upsertSubscriberFromStripe({
              email: record.email,
              stripeCustomerId: record.stripeCustomerId,
              stripeSubscriptionId: record.stripeSubscriptionId,
              status: failCount >= 3 ? VIP_STATUSES.UNPAID : VIP_STATUSES.PAST_DUE,
              currentPeriodEnd: record.currentPeriodEnd,
              cancelAtPeriodEnd: record.cancelAtPeriodEnd,
              paymentFailedCount: failCount
            });
          }
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(String(invoice.subscription));
          const record = await syncFromSubscription(sub, invoice.customer_email);
          if (record) {
            await upsertSubscriberFromStripe({
              email: record.email,
              stripeCustomerId: record.stripeCustomerId,
              stripeSubscriptionId: record.stripeSubscriptionId,
              status: VIP_STATUSES.ACTIVE,
              currentPeriodEnd: record.currentPeriodEnd,
              cancelAtPeriodEnd: record.cancelAtPeriodEnd,
              paymentFailedCount: 0,
              lastPaymentAt: new Date().toISOString()
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('vip webhook handler:', error.message);
    return res.status(500).send('Webhook handler failed');
  }

  return res.status(200).json({ received: true });
}
