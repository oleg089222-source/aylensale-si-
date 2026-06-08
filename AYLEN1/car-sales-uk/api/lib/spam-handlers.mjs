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
import { phoneKey, upsertBidderProfile, applyAntiSnipeEndTime, getAuctionSettings, afterRealBid } from './auction-engine.mjs';

function firestoreDocId(prefix, id) {
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

    const guard = await guardPublicForm(req, {
      scope: 'auction-bid',
      maxAttempts: 12,
      windowMs: 3600000,
      minimumMs: 1000,
      rateMessage: 'Too many bids. Please wait before bidding again.',
      requireTurnstile: false
    });
    if (!guard.ok) {
      return res.status(guard.status).json({ error: guard.error });
    }

    const { auctionId, bidAmount, name, phone, contact, cardCode } = req.body || {};
    const safeName = cleanString(name, 100);
    const safePhone = cleanString(phone, 30);
    const safeContact = cleanString(contact, 200);
    const amount = Number(bidAmount);

    if (!auctionId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid auction or bid amount' });
    }
    if (!safeName || safeName.length < 2) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (safePhone.replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: 'Valid phone is required' });
    }
    if (detectBot(safeName, safePhone, '', safeContact)) {
      return res.status(400).json({ error: 'Submission blocked.' });
    }

    const db = getFirestoreAdmin();
    const docId = firestoreDocId('auction', auctionId);
    const ref = db.collection('auctions').doc(docId);
    const settings = await getAuctionSettings(db);

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

      const currentPrice = Number(data.currentPrice || data.startingPrice || data.startPrice || 0);
      if (amount <= currentPrice) {
        throw new Error('Bid must be higher than current price (£' + currentPrice.toFixed(2) + ')');
      }

      const bids = Array.isArray(data.bids) ? data.bids.slice() : [];
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
        bidderKey: phoneKey(safePhone),
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
    if (msg.includes('not found') || msg.includes('ended') || msg.includes('closed') || msg.includes('higher')) {
      return res.status(400).json({ error: msg });
    }
    console.error('[auction-bid]', err);
    return res.status(500).json({ error: 'Bid could not be saved' });
  }
}
