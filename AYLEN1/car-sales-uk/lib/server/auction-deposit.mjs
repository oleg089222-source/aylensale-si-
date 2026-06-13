/**
 * Auction deposit schema helpers — per-lot deposits in auctions/{id}.deposits[].
 * Phase 1: Stripe webhook + verify fallback. Enforcement is flag-gated (depositEnforcement).
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { phoneKey, upsertBidderProfile } from './auction-engine.mjs';

export const STRIPE_PRODUCT_AUCTION_DEPOSIT = 'auction_deposit';

export const DEPOSIT_STATUSES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
  FORFEITED: 'forfeited'
});

export const AUCTION_DEPOSIT_GBP = Number(process.env.AUCTION_DEPOSIT_GBP || 50);

export function auctionFirestoreDocId(id) {
  const raw = String(id || '').trim();
  if (!raw) return 'auction_' + Date.now();
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function stripeConfigured() {
  return !!String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function webhookConfigured() {
  return !!String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}

function isTruthy(v) {
  return v === true || v === 'true' || v === '1' || v === 'yes';
}

/** True on Vercel production (or unknown host without preview env). */
export function isProductionDeploy() {
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
  if (vercelEnv === 'production') return true;
  if (vercelEnv === 'preview' || vercelEnv === 'development') return false;
  // Local / custom host: lock enforcement unless explicitly staging.
  return !isTruthy(process.env.AUCTION_DEPOSIT_ENFORCEMENT);
}

/** Resolve deposit-related flags from auctionSettings/global. */
export function resolveDepositFlags(settings) {
  const s = settings || {};
  const amount = Number(s.depositAmountGbp || AUCTION_DEPOSIT_GBP);
  const envDepositsOff = process.env.AUCTION_DEPOSITS_ENABLED === 'false'
    || process.env.AUCTION_DEPOSITS_ENABLED === '0';
  const production = isProductionDeploy();
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim().toLowerCase() || 'unknown';
  const envForceOff = process.env.AUCTION_DEPOSIT_ENFORCEMENT === 'false'
    || process.env.AUCTION_DEPOSIT_ENFORCEMENT === '0';
  const envForceOn = isTruthy(process.env.AUCTION_DEPOSIT_ENFORCEMENT);
  const settingsEnforcement = s.depositEnforcement === true || s.depositEnforcementEnabled === true;

  let depositEnforcement;
  let depositEnforcementSource;
  if (envForceOff) {
    depositEnforcement = false;
    depositEnforcementSource = 'env_off';
  } else if (production) {
    depositEnforcement = true;
    depositEnforcementSource = 'production_default';
  } else if (envForceOn || settingsEnforcement) {
    depositEnforcement = true;
    depositEnforcementSource = envForceOn ? 'env' : 'settings';
  } else {
    depositEnforcement = false;
    depositEnforcementSource = 'off';
  }

  return {
    depositsEnabled: !envDepositsOff && s.depositsEnabled !== false,
    depositAmountGbp: Number.isFinite(amount) && amount > 0 ? amount : AUCTION_DEPOSIT_GBP,
    depositEnforcement: depositEnforcement,
    depositEnforcementSource: depositEnforcementSource,
    productionLocked: false,
    deployEnvironment: vercelEnv,
    depositWebhookEnabled: s.depositWebhookEnabled !== false,
    depositVerifyFallbackEnabled: s.depositVerifyFallbackEnabled !== false,
    stripeConfigured: stripeConfigured(),
    webhookConfigured: webhookConfigured()
  };
}

/**
 * Server-side bid gate — throws with code DEPOSIT_REQUIRED when enforcement is on.
 * Buy Now must NOT call this (bids only).
 */
export async function requirePaidDepositForBid(db, deposits, phoneKeyValue, depositFlags) {
  const flags = depositFlags || {};
  if (!flags.depositEnforcement) return;
  const pKey = String(phoneKeyValue || '').trim();
  if (await bidderHasBidDeposit(db, deposits, pKey)) return;
  const amount = Number(flags.depositAmountGbp || AUCTION_DEPOSIT_GBP);
  const err = new Error('Pay the £' + amount.toFixed(2) + ' deposit before bidding');
  err.code = 'DEPOSIT_REQUIRED';
  err.depositAmountGbp = amount;
  throw err;
}

/** Public config for storefront (no secrets). */
export function publicDepositConfig(settings) {
  const flags = resolveDepositFlags(settings);
  return {
    ok: true,
    product: STRIPE_PRODUCT_AUCTION_DEPOSIT,
    depositsEnabled: flags.depositsEnabled,
    depositAmountGbp: flags.depositAmountGbp,
    depositEnforcement: flags.depositEnforcement,
    depositEnforcementSource: flags.depositEnforcementSource,
    productionLocked: flags.productionLocked,
    deployEnvironment: flags.deployEnvironment,
    depositWebhookEnabled: flags.depositWebhookEnabled,
    depositVerifyFallbackEnabled: flags.depositVerifyFallbackEnabled,
    stripeConfigured: flags.stripeConfigured,
    webhookConfigured: flags.webhookConfigured,
    checkoutPath: '/api/auction-deposit',
    verifyPath: '/api/auction-deposit-verify',
    webhookPath: '/api/stripe-webhook'
  };
}

/** Normalize a raw deposit record from Firestore. */
export function normalizeDeposit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    phoneKey: String(raw.phoneKey || ''),
    bidderName: String(raw.bidderName || ''),
    bidderPhone: String(raw.bidderPhone || ''),
    amount: Number(raw.amount || AUCTION_DEPOSIT_GBP),
    status: String(raw.status || DEPOSIT_STATUSES.PENDING),
    stripeSessionId: String(raw.stripeSessionId || ''),
    paidAt: raw.paidAt || null,
    createdAt: raw.createdAt || null,
    source: raw.source || null,
    stripeEventId: raw.stripeEventId || null
  };
}

/** Build a pending deposit entry for Firestore. */
export function buildPendingDepositEntry(opts) {
  const o = opts || {};
  const now = new Date().toISOString();
  return {
    phoneKey: String(o.phoneKey || ''),
    bidderName: String(o.bidderName || ''),
    bidderPhone: String(o.bidderPhone || ''),
    amount: Number(o.amount || AUCTION_DEPOSIT_GBP),
    status: DEPOSIT_STATUSES.PENDING,
    stripeSessionId: String(o.stripeSessionId || ''),
    createdAt: now
  };
}

/** Check if phoneKey has a paid deposit on this lot. */
export function hasPaidDeposit(deposits, phoneKeyValue) {
  const pKey = String(phoneKeyValue || '').trim();
  if (!pKey) return false;
  const list = Array.isArray(deposits) ? deposits : [];
  return list.some(function(d) {
    return d && d.phoneKey === pKey && d.status === DEPOSIT_STATUSES.PAID;
  });
}

/** Cross-auction active deposit via auctionProfiles (one deposit, many lots). */
export async function hasActiveBidderDeposit(db, phoneKeyValue) {
  const pKey = String(phoneKeyValue || '').trim();
  if (!pKey || !db) return false;
  try {
    const snap = await db.collection('auctionProfiles').doc(pKey).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    if (data.depositPaid !== true) return false;
    const status = String(data.depositStatus || 'active').toLowerCase();
    return status !== DEPOSIT_STATUSES.REFUNDED && status !== DEPOSIT_STATUSES.FORFEITED;
  } catch (err) {
    console.warn('[auction-deposit] profile deposit check:', err.message || err);
    return false;
  }
}

/** Lot deposit or global profile deposit. */
export async function bidderHasBidDeposit(db, deposits, phoneKeyValue) {
  if (hasPaidDeposit(deposits, phoneKeyValue)) return true;
  return hasActiveBidderDeposit(db, phoneKeyValue);
}

/** Find deposit index by session id or pending phone key. */
export function findDepositIndex(deposits, opts) {
  const list = Array.isArray(deposits) ? deposits : [];
  const sessionId = String(opts && opts.stripeSessionId || '').trim();
  const pKey = String(opts && opts.phoneKey || '').trim();

  if (sessionId) {
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].stripeSessionId === sessionId) return i;
    }
  }
  if (pKey) {
    for (let j = list.length - 1; j >= 0; j--) {
      const d = list[j];
      if (d && d.phoneKey === pKey && d.status === DEPOSIT_STATUSES.PENDING) return j;
    }
  }
  return -1;
}

/**
 * Mark deposit paid from Stripe Checkout session (idempotent).
 * Used by webhook and verify fallback.
 */
export async function markAuctionDepositPaidFromSession(session, opts) {
  opts = opts || {};
  const meta = (session && session.metadata) || {};
  if (meta.product !== STRIPE_PRODUCT_AUCTION_DEPOSIT) {
    throw new Error('Not an auction deposit session');
  }

  const paymentStatus = String(session.payment_status || '');
  const sessionStatus = String(session.status || '');
  if (paymentStatus !== 'paid' && sessionStatus !== 'complete') {
    throw new Error('Payment not completed');
  }

  const auctionDoc = String(meta.auction_doc || meta.auction_id || '').trim();
  const pKey = String(meta.phone_key || '').trim();
  const sessionId = String(session.id || '').trim();
  const bidderName = String(meta.bidder_name || '').trim();
  const bidderPhone = String(meta.bidder_phone || '').trim();
  const auctionId = String(meta.auction_id || auctionDoc);

  if (!auctionDoc) throw new Error('Missing auction_doc in session metadata');
  if (!sessionId) throw new Error('Missing session id');

  const db = getFirestoreAdmin();
  const ref = db.collection('auctions').doc(auctionDoc);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Auction not found');

  const data = snap.data() || {};
  const deposits = Array.isArray(data.deposits) ? data.deposits.slice() : [];
  const now = new Date().toISOString();
  const source = String(opts.source || 'webhook');
  const eventId = String(opts.eventId || '').trim();

  let matchIdx = findDepositIndex(deposits, { stripeSessionId: sessionId, phoneKey: pKey });

  if (matchIdx >= 0 && deposits[matchIdx].status === DEPOSIT_STATUSES.PAID) {
    return {
      ok: true,
      alreadyPaid: true,
      auctionId: auctionId,
      auctionDoc: auctionDoc,
      phoneKey: deposits[matchIdx].phoneKey || pKey,
      deposit: normalizeDeposit(deposits[matchIdx])
    };
  }

  if (matchIdx < 0) {
    deposits.push({
      phoneKey: pKey || phoneKey(bidderPhone),
      bidderName: bidderName,
      bidderPhone: bidderPhone,
      amount: Number(meta.deposit_amount || AUCTION_DEPOSIT_GBP),
      status: DEPOSIT_STATUSES.PAID,
      stripeSessionId: sessionId,
      paidAt: now,
      createdAt: now,
      source: source,
      stripeEventId: eventId || null
    });
    matchIdx = deposits.length - 1;
  } else {
    deposits[matchIdx] = Object.assign({}, deposits[matchIdx], {
      status: DEPOSIT_STATUSES.PAID,
      paidAt: now,
      stripeSessionId: sessionId,
      source: source,
      stripeEventId: eventId || deposits[matchIdx].stripeEventId || null
    });
  }

  await ref.set({
    deposits: deposits,
    updatedAt: now
  }, { merge: true });

  const entry = deposits[matchIdx];
  const resolvedKey = entry.phoneKey || pKey;
  const resolvedPhone = entry.bidderPhone || bidderPhone;
  const resolvedName = entry.bidderName || bidderName;

  try {
    await upsertBidderProfile(db, resolvedPhone, resolvedName, {
      type: 'deposit_paid',
      auctionId: auctionId,
      amount: Number(entry.amount || AUCTION_DEPOSIT_GBP),
      at: now
    });
    if (resolvedKey) {
      await db.collection('auctionProfiles').doc(resolvedKey).set({
        depositPaid: true,
        depositStatus: 'active',
        lastDepositPaidAt: now,
        lastDepositAuctionId: auctionId,
        lastDepositSessionId: sessionId,
        updatedAt: now
      }, { merge: true });
    }
  } catch (profileErr) {
    console.warn('[auction-deposit] profile update:', profileErr.message || profileErr);
  }

  return {
    ok: true,
    alreadyPaid: false,
    auctionId: auctionId,
    auctionDoc: auctionDoc,
    phoneKey: resolvedKey,
    deposit: normalizeDeposit(entry)
  };
}

/** @deprecated alias — use markAuctionDepositPaidFromSession */
export async function markAuctionDepositPaid(db, session) {
  void db;
  return markAuctionDepositPaidFromSession(session, { source: 'legacy' });
}
