/**
 * Auction winner payment — hammer price only, no premium, deposit not deducted.
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { getStripe, getSiteOrigin } from './stripe-client.mjs';
import { phoneKey } from './auction-engine.mjs';
import { auctionFirestoreDocId } from './auction-deposit.mjs';

export const STRIPE_PRODUCT_AUCTION_WINNER_PAYMENT = 'auction_winner_payment';

export const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue'
});

export const WINNER_PAYMENT_HOURS_DEFAULT = 48;

function isTruthy(v) {
  return v === true || v === 'true' || v === '1' || v === 'yes';
}

export function resolveWinnerPaymentFlags(settings) {
  const s = settings || {};
  const envOff = process.env.AUCTION_WINNER_PAYMENT === 'false'
    || process.env.AUCTION_WINNER_PAYMENT === '0';
  const hours = Number(s.winnerPaymentHours || process.env.AUCTION_WINNER_PAYMENT_HOURS || WINNER_PAYMENT_HOURS_DEFAULT);
  return {
    winnerPaymentEnabled: !envOff && s.winnerPaymentEnabled !== false,
    paymentDeadlineHours: Number.isFinite(hours) && hours > 0 ? hours : WINNER_PAYMENT_HOURS_DEFAULT,
    stripeConfigured: !!String(process.env.STRIPE_SECRET_KEY || '').trim(),
    webhookConfigured: !!String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  };
}

export function publicWinnerPaymentConfig(settings) {
  const flags = resolveWinnerPaymentFlags(settings);
  return {
    ok: true,
    winnerPaymentEnabled: flags.winnerPaymentEnabled,
    paymentDeadlineHours: flags.paymentDeadlineHours,
    stripeConfigured: flags.stripeConfigured,
    checkoutPath: '/api/auction-winner-payment',
    verifyPath: '/api/auction-payment-verify'
  };
}

export function buildWinnerPaymentFields(hammerAmount, settings) {
  const flags = resolveWinnerPaymentFlags(settings);
  const hours = flags.paymentDeadlineHours;
  const now = Date.now();
  return {
    hammerAmount: Number(hammerAmount || 0),
    paymentStatus: PAYMENT_STATUSES.PENDING,
    paymentDueAt: new Date(now + hours * 3600000).toISOString(),
    stripeSessionId: null,
    paidAt: null
  };
}

export function normalizeWinnerPayment(winner) {
  if (!winner || typeof winner !== 'object') return null;
  return {
    paymentStatus: String(winner.paymentStatus || PAYMENT_STATUSES.PENDING),
    paymentDueAt: winner.paymentDueAt || null,
    stripeSessionId: String(winner.stripeSessionId || ''),
    paidAt: winner.paidAt || null,
    hammerAmount: Number(winner.hammerAmount || winner.amount || 0)
  };
}

export function isWinnerPaymentPaid(winner) {
  return normalizeWinnerPayment(winner)?.paymentStatus === PAYMENT_STATUSES.PAID;
}

export async function verifyWinnerPaymentForClaim(auctionId, phone) {
  const db = getFirestoreAdmin();
  const docId = auctionFirestoreDocId(auctionId);
  const snap = await db.collection('auctions').doc(docId).get();
  if (!snap.exists) return { ok: false, error: 'Auction not found' };
  const data = snap.data() || {};
  const winner = data.winner || {};
  const pKey = phoneKey(phone);
  const winnerKey = winner.bidderKey || phoneKey(winner.bidderPhone);
  if (!pKey || pKey !== winnerKey) {
    return { ok: false, error: 'Phone does not match auction winner', code: 'NOT_WINNER' };
  }
  if (String(data.status || '') !== 'winner_pending') {
    return { ok: false, error: 'Auction is not awaiting winner collection', code: 'INVALID_STATUS' };
  }
  if (!isWinnerPaymentPaid(winner)) {
    return {
      ok: false,
      error: 'Winner payment required before claiming collection',
      code: 'PAYMENT_REQUIRED',
      paymentStatus: winner.paymentStatus || PAYMENT_STATUSES.PENDING
    };
  }
  return { ok: true, auctionId: String(auctionId), docId: docId };
}

export async function createWinnerPaymentSession(db, auctionId, opts) {
  opts = opts || {};
  const flags = resolveWinnerPaymentFlags(opts.settings);
  if (!flags.winnerPaymentEnabled) {
    return { skipped: true, reason: 'winner_payment_disabled' };
  }
  if (!flags.stripeConfigured) {
    return { skipped: true, reason: 'stripe_not_configured' };
  }

  const docId = auctionFirestoreDocId(auctionId);
  const ref = db.collection('auctions').doc(docId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Auction not found');
  const data = snap.data() || {};
  const winner = data.winner || {};
  if (String(data.status || '') !== 'winner_pending' || !winner.bidderName) {
    return { skipped: true, reason: 'not_winner_pending' };
  }
  if (isWinnerPaymentPaid(winner)) {
    return { skipped: true, reason: 'already_paid', paymentStatus: PAYMENT_STATUSES.PAID };
  }

  const hammer = Number(winner.hammerAmount || winner.amount || data.currentPrice || 0);
  if (!Number.isFinite(hammer) || hammer <= 0) {
    return { skipped: true, reason: 'invalid_hammer_amount' };
  }

  const pKey = winner.bidderKey || phoneKey(winner.bidderPhone);
  const existingSessionId = String(winner.stripeSessionId || '').trim();
  const stripe = getStripe();

  if (existingSessionId && winner.paymentStatus === PAYMENT_STATUSES.PENDING) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(existingSessionId);
      if (existing && existing.status === 'open' && existing.url) {
        return { ok: true, url: existing.url, sessionId: existing.id, reused: true };
      }
    } catch (err) {
      console.warn('[auction-payment] existing session retrieve:', err.message);
    }
  }

  const origin = opts.origin || 'https://aylensale.com';
  const lotName = String(data.name || data.title || 'Auction lot').slice(0, 120);
  const amountPence = Math.round(hammer * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'link'],
    line_items: [{
      price_data: {
        currency: 'gbp',
        unit_amount: amountPence,
        product_data: {
          name: 'AYLENSALE auction lot — ' + lotName,
          description: 'Hammer price £' + hammer.toFixed(2) + ' (deposit refunded separately)'
        }
      },
      quantity: 1
    }],
    metadata: {
      product: STRIPE_PRODUCT_AUCTION_WINNER_PAYMENT,
      auction_id: String(auctionId),
      auction_doc: docId,
      phone_key: pKey,
      hammer_amount: hammer.toFixed(2),
      bidder_name: String(winner.bidderName || '').slice(0, 80)
    },
    success_url: origin + '/#auctions?auction_payment=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/#auctions?auction_payment=cancelled'
  });

  const paymentFields = Object.assign({}, buildWinnerPaymentFields(hammer, opts.settings), {
    stripeSessionId: session.id,
    hammerAmount: hammer
  });

  await ref.set({
    winner: Object.assign({}, winner, paymentFields),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return { ok: true, url: session.url, sessionId: session.id, hammerAmount: hammer };
}

export async function markWinnerPaidFromSession(session, opts) {
  opts = opts || {};
  const meta = (session && session.metadata) || {};
  if (meta.product !== STRIPE_PRODUCT_AUCTION_WINNER_PAYMENT) {
    throw new Error('Not an auction winner payment session');
  }

  const paymentStatus = String(session.payment_status || '');
  const sessionStatus = String(session.status || '');
  if (paymentStatus !== 'paid' && sessionStatus !== 'complete') {
    throw new Error('Payment not completed');
  }

  const auctionDoc = String(meta.auction_doc || meta.auction_id || '').trim();
  const sessionId = String(session.id || '').trim();
  const pKey = String(meta.phone_key || '').trim();
  if (!auctionDoc || !sessionId) throw new Error('Missing session metadata');

  const db = getFirestoreAdmin();
  const ref = db.collection('auctions').doc(auctionDoc);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Auction not found');

  const data = snap.data() || {};
  const winner = Object.assign({}, data.winner || {});
  const now = new Date().toISOString();

  if (winner.paymentStatus === PAYMENT_STATUSES.PAID) {
    return {
      ok: true,
      alreadyPaid: true,
      auctionId: meta.auction_id || auctionDoc,
      paymentStatus: PAYMENT_STATUSES.PAID
    };
  }

  const hammer = Number(meta.hammer_amount || winner.hammerAmount || winner.amount || 0);
  winner.paymentStatus = PAYMENT_STATUSES.PAID;
  winner.paidAt = now;
  winner.stripeSessionId = sessionId;
  winner.hammerAmount = hammer;
  if (!winner.paymentDueAt) {
    winner.paymentDueAt = winner.paidAt;
  }

  await ref.set({
    winner: winner,
    updatedAt: now,
    winnerPaymentEvent: {
      at: now,
      source: String(opts.source || 'webhook'),
      eventId: String(opts.eventId || '').trim() || null,
      sessionId: sessionId,
      phoneKey: pKey
    }
  }, { merge: true });

  return {
    ok: true,
    paid: true,
    alreadyPaid: false,
    auctionId: meta.auction_id || auctionDoc,
    paymentStatus: PAYMENT_STATUSES.PAID,
    hammerAmount: hammer
  };
}

export async function processOverdueWinnerPayments(db, settings) {
  const flags = resolveWinnerPaymentFlags(settings);
  if (!flags.winnerPaymentEnabled) return { checked: 0, overdue: 0 };

  const snap = await db.collection('auctions')
    .where('status', '==', 'winner_pending')
    .limit(40)
    .get();

  const now = Date.now();
  let overdue = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const winner = data.winner || {};
    if (winner.paymentStatus !== PAYMENT_STATUSES.PENDING) continue;
    const dueMs = Date.parse(winner.paymentDueAt || 0);
    if (!dueMs || dueMs > now) continue;

    await doc.ref.set({
      winner: Object.assign({}, winner, { paymentStatus: PAYMENT_STATUSES.OVERDUE }),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    overdue += 1;
  }

  return { checked: snap.size, overdue: overdue };
}

export async function maybeCreateWinnerPaymentAfterFinalize(db, auctionId, settings, origin) {
  try {
    const result = await createWinnerPaymentSession(db, auctionId, { settings: settings, origin: origin });
    if (result && result.ok && !result.reused) {
      const notifyMod = await import('./auction-notify.mjs');
      const snap = await db.collection('auctions').doc(auctionFirestoreDocId(auctionId)).get();
      const auction = Object.assign({ id: auctionId }, snap.data() || {});
      await notifyMod.notifyAdminWinnerPaymentPending(auction, result).catch(function() {});
    }
    return result;
  } catch (err) {
    console.warn('[auction-payment] auto session after finalize:', err.message);
    return { error: err.message };
  }
}
