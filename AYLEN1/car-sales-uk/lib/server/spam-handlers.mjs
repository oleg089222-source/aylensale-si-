/**
 * Storefront spam / captcha handlers (single serverless entry via /api/spam).
 */
import { isAdminConfigured } from './firestore-admin.mjs';
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import {
  cleanString,
  detectBot,
  guardPublicForm,
  turnstileSiteKey
} from './spam-guard.mjs';
import {
  phoneKey,
  upsertBidderProfile,
  applyAntiSnipeEndTime,
  getAuctionSettings,
  afterRealBid,
  recordAuctionOutcomes
} from './auction-engine.mjs';
import { getStripe, getSiteOrigin } from './stripe-client.mjs';
import {
  STRIPE_PRODUCT_AUCTION_DEPOSIT,
  auctionFirestoreDocId,
  buildPendingDepositEntry,
  hasPaidDeposit,
  markAuctionDepositPaidFromSession,
  publicDepositConfig,
  requirePaidDepositForBid,
  resolveDepositFlags
} from './auction-deposit.mjs';
import { validateBidFields, validateBidAgainstAuction, isUkPhone } from './auction-validation.mjs';
import { evaluateBidFraud, fraudBlockResponse } from './auction-fraud.mjs';

function firestoreDocId(prefix, id) {
  if (prefix === 'auction') return auctionFirestoreDocId(id);
  const raw = String(id || '').trim();
  if (!raw) return prefix + '_' + Date.now();
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export async function handleSpamConfig(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const siteKey = turnstileSiteKey();
  return res.status(200).json({
    turnstileSiteKey: siteKey || null,
    captchaEnabled: !!siteKey
  });
}

export async function handleNotifyRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'Notify service unavailable' });
    }

    const guard = await guardPublicForm(req, {
      scope: 'notify',
      maxAttempts: 8,
      windowMs: 3600000,
      rateMessage: 'Too many notify requests. Please wait before trying again.',
      requireTurnstile: false
    });
    if (!guard.ok) {
      return res.status(guard.status).json({ error: guard.error });
    }

    const { productId, productName, method, contact } = req.body || {};
    const safeProductId = cleanString(productId, 120);
    const safeProductName = cleanString(productName || 'Product', 140);
    const safeMethod = cleanString(method, 20).toLowerCase();
    const safeContact = cleanString(contact, 200);

    if (!safeProductId || !safeContact) {
      return res.status(400).json({ error: 'Missing product or contact' });
    }
    if (['email', 'telegram', 'whatsapp'].indexOf(safeMethod) === -1) {
      return res.status(400).json({ error: 'Invalid notify method' });
    }

    if (safeMethod === 'email' && safeContact.indexOf('@') === -1) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (safeMethod === 'whatsapp' && safeContact.replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: 'Invalid WhatsApp number' });
    }

    if (detectBot(safeContact, safeContact, safeMethod === 'email' ? safeContact : '', safeProductName)) {
      return res.status(400).json({ error: 'Submission blocked.' });
    }

    const db = getFirestoreAdmin();
    const data = {
      productId: safeProductId,
      productName: safeProductName,
      method: safeMethod,
      contact: safeContact,
      notified: false,
      status: 'waiting',
      source: 'out_of_stock',
      createdAt: new Date().toISOString(),
      sessionId: guard.sessionId
    };

    const doc = await db.collection('notifyRequests').add(data);
    return res.status(200).json({ success: true, id: doc.id });
  } catch (err) {
    console.error('[notify-request]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

export async function handleAuctionBid(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'Auction bidding unavailable' });
    }

    const db = getFirestoreAdmin();
    const settings = await getAuctionSettings(db);

    const guard = await guardPublicForm(req, {
      scope: 'auction-bid',
      maxAttempts: 12,
      windowMs: 3600000,
      minimumMs: 1000,
      rateMessage: 'Too many bids. Please wait before bidding again.',
      requireTurnstile: settings.turnstileOnBid === true
    });
    if (!guard.ok) {
      return res.status(guard.status).json({ error: guard.error });
    }

    const { auctionId, bidAmount, name, phone, contact, cardCode } = req.body || {};
    if (!auctionId) {
      return res.status(400).json({ error: 'Invalid auction or bid amount' });
    }

    let fields;
    try {
      fields = validateBidFields({ name, phone, contact, bidAmount });
    } catch (validationErr) {
      return res.status(400).json({
        error: validationErr.message,
        code: validationErr.code || 'VALIDATION_FAILED'
      });
    }

    const safeName = fields.safeName;
    const safePhone = fields.safePhone;
    const safeContact = fields.safeContact;
    const amount = fields.amount;
    const bidderKey = phoneKey(safePhone);

    const docId = firestoreDocId('auction', auctionId);
    const ref = db.collection('auctions').doc(docId);

    const preSnap = await ref.get();
    const preData = preSnap.exists ? preSnap.data() || {} : {};
    const preBids = Array.isArray(preData.bids) ? preData.bids : [];

    const fraud = await evaluateBidFraud(db, {
      settings: settings,
      phoneKey: bidderKey,
      bidderName: safeName,
      bids: preBids,
      auctionDocId: docId
    });
    if (fraud.blocked) {
      const body = fraudBlockResponse(fraud);
      return res.status(403).json(body);
    }

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new Error('Auction not found');
      }
      const data = snap.data() || {};
      const endMs = Date.parse(data.endTime || 0);
      if (endMs && endMs <= Date.now()) {
        throw new Error('Auction has ended');
      }
      const status = String(data.status || 'active');
      if (status === 'completed' || status === 'order_sent') {
        throw new Error('Auction is closed');
      }

      const depositFlags = resolveDepositFlags(settings);
      requirePaidDepositForBid(data.deposits, bidderKey, depositFlags);

      const currentPrice = Number(data.currentPrice || data.startingPrice || data.startPrice || 0);
      const bids = Array.isArray(data.bids) ? data.bids.slice() : [];

      validateBidAgainstAuction({
        name: safeName,
        phone: safePhone,
        contact: safeContact,
        bidAmount: amount,
        currentPrice: currentPrice,
        bids: bids,
        bidderKey: bidderKey
      });

      const realOnly = bids.filter(function(b) {
        return !(b && (b.isBot || b.source === 'bot'));
      });
      const prevHighest = realOnly.length
        ? realOnly.reduce(function(best, b) {
          return Number(b.amount || 0) > Number(best.amount || 0) ? b : best;
        }, realOnly[0])
        : null;

      const bid = {
        id: docId + '_' + Date.now(),
        auctionId: auctionId,
        amount: amount,
        bidder: safeName,
        bidderName: safeName,
        bidderPhone: safePhone,
        bidderContact: safeContact,
        bidderKey: bidderKey,
        cardCode: cleanString(cardCode, 40).toUpperCase() || '',
        source: 'real',
        isBot: false,
        timestamp: new Date().toISOString()
      };
      bids.push(bid);

      const nowMs = Date.now();
      const newEnd = applyAntiSnipeEndTime(data.endTime, settings, nowMs);

      const patch = {
        bids,
        bidsCount: bids.length,
        currentPrice: amount,
        status: 'active',
        updatedAt: new Date().toISOString()
      };
      if (newEnd) {
        patch.endTime = newEnd;
        patch.antiSnipeExtensions = Number(data.antiSnipeExtensions || 0) + 1;
      }

      tx.set(ref, patch, { merge: true });
      return {
        bid: bid,
        bidsCount: bids.length,
        currentPrice: amount,
        endTimeExtended: !!newEnd,
        endTime: newEnd || data.endTime,
        outbid: prevHighest && Number(prevHighest.amount || 0) < amount
          ? {
            name: prevHighest.bidderName || prevHighest.bidder,
            phoneLast4: String(prevHighest.bidderPhone || '').replace(/\D/g, '').slice(-4)
          }
          : null
      };
    });

    try {
      await upsertBidderProfile(db, safePhone, safeName, {
        type: 'bid',
        auctionId: auctionId,
        amount: amount,
        at: new Date().toISOString()
      });
    } catch (profileErr) {
      console.warn('[auction-bid] profile update', profileErr.message || profileErr);
    }

    afterRealBid(db, docId, result.bid, null).catch(function(err) {
      console.warn('[auction-bid] afterRealBid', err.message || err);
    });

    return res.status(200).json({
      success: true,
      bid: result.bid,
      bidsCount: result.bidsCount,
      currentPrice: result.currentPrice,
      endTimeExtended: !!result.endTimeExtended,
      endTime: result.endTime || null,
      outbid: result.outbid || null
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (err.code === 'DEPOSIT_REQUIRED' || msg.includes('deposit before bidding')) {
      return res.status(403).json({
        error: msg,
        code: 'DEPOSIT_REQUIRED',
        depositAmountGbp: Number(err.depositAmountGbp || 0) || undefined
      });
    }
    if (err.code) {
      return res.status(400).json({ error: msg, code: err.code });
    }
    if (msg.includes('not found') || msg.includes('ended') || msg.includes('closed') || msg.includes('higher')) {
      return res.status(400).json({ error: msg });
    }
    console.error('[auction-bid]', err);
    return res.status(500).json({ error: 'Bid could not be saved' });
  }
}

export async function handleAuctionDeposit(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'Auction deposit unavailable' });
    }

    const guard = await guardPublicForm(req, {
      scope: 'auction-deposit',
      maxAttempts: 8,
      windowMs: 3600000,
      minimumMs: 1200,
      rateMessage: 'Too many deposit attempts. Please wait.',
      requireTurnstile: false
    });
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const { auctionId, name, phone, email } = req.body || {};
    const safeName = cleanString(name, 100);
    const safePhone = cleanString(phone, 30);
    const safeEmail = cleanString(email, 120);
    if (!auctionId) return res.status(400).json({ error: 'Auction required' });
    if (!safeName || safeName.length < 2) return res.status(400).json({ error: 'Name is required' });
    if (!isUkPhone(safePhone)) {
      return res.status(400).json({ error: 'Enter a valid UK phone number (+44 or 07…)', code: 'INVALID_UK_PHONE' });
    }

    const db = getFirestoreAdmin();
    const settings = await getAuctionSettings(db);
    const depositFlags = resolveDepositFlags(settings);
    if (!depositFlags.depositsEnabled) {
      return res.status(503).json({ error: 'Auction deposits are temporarily unavailable' });
    }
    if (!depositFlags.stripeConfigured) {
      return res.status(503).json({ error: 'Deposit payments are not configured yet' });
    }

    const docId = firestoreDocId('auction', auctionId);
    const ref = db.collection('auctions').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Auction not found' });
    const data = snap.data() || {};
    const endMs = Date.parse(data.endTime || 0);
    if (endMs && endMs <= Date.now()) return res.status(400).json({ error: 'Auction has ended' });
    const status = String(data.status || 'active');
    if (status !== 'active') return res.status(400).json({ error: 'Auction is not accepting deposits' });

    const pKey = phoneKey(safePhone);
    const deposits = Array.isArray(data.deposits) ? data.deposits : [];
    if (hasPaidDeposit(deposits, pKey)) {
      return res.status(400).json({ error: 'Deposit already paid for this auction' });
    }

    const stripe = getStripe();
    const origin = getSiteOrigin(req);
    const amountGbp = depositFlags.depositAmountGbp;
    const amountPence = Math.round(amountGbp * 100);
    const lotName = cleanString(data.name || data.title || 'Auction lot', 120);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: amountPence,
          product_data: {
            name: 'AYLENSALE auction deposit — ' + lotName,
            description: 'Refundable £' + amountGbp.toFixed(2) + ' deposit to bid on this lot'
          }
        },
        quantity: 1
      }],
      customer_email: safeEmail || undefined,
      metadata: {
        product: STRIPE_PRODUCT_AUCTION_DEPOSIT,
        auction_id: String(auctionId),
        auction_doc: docId,
        bidder_name: safeName,
        bidder_phone: safePhone,
        phone_key: pKey
      },
      success_url: origin + '/#auctions?auction_deposit=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/#auctions?auction_deposit=cancelled'
    });

    await ref.set({
      deposits: deposits.concat([buildPendingDepositEntry({
        phoneKey: pKey,
        bidderName: safeName,
        bidderPhone: safePhone,
        amount: amountGbp,
        stripeSessionId: session.id
      })]),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.status(200).json({ success: true, url: session.url, sessionId: session.id });
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('STRIPE')) {
      return res.status(503).json({ error: 'Card payments are not configured yet. Message us on WhatsApp.' });
    }
    console.error('[auction-deposit]', err);
    return res.status(500).json({ error: msg || 'Deposit checkout failed' });
  }
}

export async function handleAuctionDepositConfig(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=120');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isAdminConfigured()) {
      return res.status(503).json({ ok: false, error: 'Auction deposit config unavailable' });
    }
    const db = getFirestoreAdmin();
    const settings = await getAuctionSettings(db);
    return res.status(200).json(publicDepositConfig(settings));
  } catch (err) {
    console.error('[auction-deposit-config]', err);
    return res.status(500).json({ ok: false, error: err.message || 'Config unavailable' });
  }
}

export async function handleAuctionDepositVerify(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'Auction deposit verify unavailable' });
    }

    const db = getFirestoreAdmin();
    const settings = await getAuctionSettings(db);
    const depositFlags = resolveDepositFlags(settings);
    if (!depositFlags.depositVerifyFallbackEnabled) {
      return res.status(503).json({ error: 'Deposit verify fallback is disabled' });
    }
    if (!depositFlags.stripeConfigured) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const sessionId = String(body.sessionId || body.session_id || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.metadata?.product !== STRIPE_PRODUCT_AUCTION_DEPOSIT) {
      return res.status(400).json({ error: 'Invalid auction deposit session' });
    }
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(402).json({ error: 'Payment not completed yet' });
    }

    const result = await markAuctionDepositPaidFromSession(session, { source: 'verify' });
    return res.status(200).json({
      ok: true,
      paid: true,
      alreadyPaid: !!result.alreadyPaid,
      auctionId: result.auctionId,
      deposit: result.deposit
    });
  } catch (err) {
    const msg = String(err.message || err);
    console.error('[auction-deposit-verify]', err);
    if (msg.includes('not completed')) return res.status(402).json({ error: msg });
    return res.status(500).json({ error: msg || 'Verification failed' });
  }
}

export async function handleAuctionBuyNow(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'Buy now unavailable' });
    }

    const guard = await guardPublicForm(req, {
      scope: 'auction-buy-now',
      maxAttempts: 6,
      windowMs: 3600000,
      minimumMs: 1500,
      rateMessage: 'Too many buy-now attempts. Please wait.',
      requireTurnstile: false
    });
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const { auctionId, name, phone, contact, cardCode } = req.body || {};
    const safeName = cleanString(name, 100);
    const safePhone = cleanString(phone, 30);
    const safeContact = cleanString(contact, 200);
    if (!auctionId) return res.status(400).json({ error: 'Auction required' });
    if (!safeName || safeName.length < 2) return res.status(400).json({ error: 'Name is required' });
    if (!isUkPhone(safePhone)) {
      return res.status(400).json({ error: 'Enter a valid UK phone number (+44 or 07…)', code: 'INVALID_UK_PHONE' });
    }
    if (detectBot(safeName, safePhone, '', safeContact)) {
      return res.status(400).json({ error: 'Submission blocked.' });
    }

    const db = getFirestoreAdmin();
    const docId = firestoreDocId('auction', auctionId);
    const ref = db.collection('auctions').doc(docId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Auction not found');
      const data = snap.data() || {};
      const endMs = Date.parse(data.endTime || 0);
      if (endMs && endMs <= Date.now()) throw new Error('Auction has ended');
      const status = String(data.status || 'active');
      if (status !== 'active') throw new Error('Auction is closed');

      const buyNow = Number(data.buyNowPrice || 0);
      if (!buyNow || buyNow <= 0) throw new Error('Buy now is not offered on this lot');
      const currentPrice = Number(data.currentPrice || data.startingPrice || data.startPrice || 0);
      if (buyNow <= currentPrice) throw new Error('Buy now is no longer available');

      const bids = Array.isArray(data.bids) ? data.bids.slice() : [];
      const bid = {
        id: docId + '_buynow_' + Date.now(),
        auctionId: auctionId,
        amount: buyNow,
        bidder: safeName,
        bidderName: safeName,
        bidderPhone: safePhone,
        bidderContact: safeContact,
        bidderKey: phoneKey(safePhone),
        cardCode: cleanString(cardCode, 40).toUpperCase() || '',
        source: 'buy_now',
        isBot: false,
        timestamp: new Date().toISOString()
      };
      bids.push(bid);

      const winner = {
        bidId: bid.id,
        bidderName: safeName,
        bidderPhone: safePhone,
        bidderContact: safeContact,
        bidderKey: phoneKey(safePhone),
        amount: buyNow,
        timestamp: bid.timestamp,
        via: 'buy_now'
      };

      const patch = {
        bids: bids,
        bidsCount: bids.length,
        currentPrice: buyNow,
        status: 'winner_pending',
        endTime: new Date().toISOString(),
        finalizedAt: new Date().toISOString(),
        winner: winner,
        buyNowUsed: true,
        updatedAt: new Date().toISOString()
      };
      tx.set(ref, patch, { merge: true });
      return { bid: bid, winner: winner, currentPrice: buyNow };
    });

    try {
      await upsertBidderProfile(db, safePhone, safeName, {
        type: 'buy_now',
        auctionId: auctionId,
        amount: result.currentPrice,
        at: new Date().toISOString()
      });
      await recordAuctionOutcomes(db, docId, { id: auctionId }, result.winner);
    } catch (profileErr) {
      console.warn('[auction-buy-now] profile/outcome', profileErr.message || profileErr);
    }

    return res.status(200).json({
      success: true,
      bid: result.bid,
      winner: result.winner,
      currentPrice: result.currentPrice,
      status: 'winner_pending'
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('not found') || msg.includes('ended') || msg.includes('closed') || msg.includes('Buy now')) {
      return res.status(400).json({ error: msg });
    }
    console.error('[auction-buy-now]', err);
    return res.status(500).json({ error: 'Buy now could not be completed' });
  }
}
