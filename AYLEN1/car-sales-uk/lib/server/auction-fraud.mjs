/**
 * Auction anti-fraud — blacklist, shill heuristics, bid velocity.
 * fraudEnforceMode: 'log' (default) | 'enforce' — production stays log-only via settings default.
 */
import { createHash } from 'node:crypto';
import { getFirestoreAdmin } from './firebase-admin-app.mjs';
import { cleanString } from './spam-guard.mjs';
import { isBotBid } from './auction-validation.mjs';

export const FRAUD_CODES = Object.freeze({
  BLACKLISTED: 'BLACKLISTED',
  SHILL_NAME_MISMATCH: 'SHILL_NAME_MISMATCH',
  BID_VELOCITY: 'BID_VELOCITY'
});

const BURST_MAX = 3;
const BURST_WINDOW_MS = 60000;
const SHILL_STRIKE_BLOCK = 2;
const memoryBurst = new Map();

function hashRateKey(key) {
  return createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
}

function isEnforceMode(settings) {
  const mode = String(settings?.fraudEnforceMode || 'log').toLowerCase();
  return mode === 'enforce' || mode === 'block';
}

export async function isPhoneBlacklisted(db, phoneKeyValue) {
  const key = String(phoneKeyValue || '').trim();
  if (!key) return false;
  try {
    const snap = await db.collection('auctionBlacklist').doc(key).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    return data.blocked === true || data.active === true;
  } catch (err) {
    console.warn('[auction-fraud] blacklist read failed:', err.message);
    return false;
  }
}

export function detectShillNameMismatch(bids, phoneKeyValue, bidderName) {
  const key = String(phoneKeyValue || '').trim();
  const name = cleanString(bidderName, 100).toLowerCase();
  if (!key || !name) return false;

  const names = new Set();
  (bids || []).forEach(function(b) {
    if (isBotBid(b)) return;
    const bKey = b.bidderKey || '';
    if (bKey !== key) return;
    const n = cleanString(b.bidderName || b.bidder, 100).toLowerCase();
    if (n) names.add(n);
  });

  if (names.size === 0) return false;
  return !names.has(name) || names.size > 1;
}

async function burstRateOk(phoneKeyValue) {
  const key = 'auction-bid-burst:' + String(phoneKeyValue || '');
  const now = Date.now();
  const cutoff = now - BURST_WINDOW_MS;

  try {
    const db = getFirestoreAdmin();
    const ref = db.collection('spamGuard').doc(hashRateKey(key));
    return db.runTransaction(async function(tx) {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() || {} : {};
      const attempts = Array.isArray(data.attempts)
        ? data.attempts.filter(function(t) { return Number(t) > cutoff; })
        : [];
      if (attempts.length >= BURST_MAX) {
        tx.set(ref, { attempts: attempts, updatedAt: now, scope: 'auction-bid-burst' }, { merge: true });
        return false;
      }
      attempts.push(now);
      tx.set(ref, { attempts: attempts, updatedAt: now, scope: 'auction-bid-burst' }, { merge: true });
      return true;
    });
  } catch (err) {
    const prev = (memoryBurst.get(key) || []).filter(function(t) { return t > cutoff; });
    if (prev.length >= BURST_MAX) {
      memoryBurst.set(key, prev);
      return false;
    }
    prev.push(now);
    memoryBurst.set(key, prev);
    return true;
  }
}

async function getFraudStrikes(db, phoneKeyValue) {
  const key = String(phoneKeyValue || '').trim();
  if (!key) return 0;
  try {
    const snap = await db.collection('auctionProfiles').doc(key).get();
    if (!snap.exists) return 0;
    return Number(snap.data()?.fraudStrikes || 0);
  } catch (err) {
    return 0;
  }
}

async function incrementFraudStrike(db, phoneKeyValue, flag) {
  const key = String(phoneKeyValue || '').trim();
  if (!key) return 0;
  const ref = db.collection('auctionProfiles').doc(key);
  return db.runTransaction(async function(tx) {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() || {} : {};
    const strikes = Number(prev.fraudStrikes || 0) + 1;
    const flags = Array.isArray(prev.fraudFlags) ? prev.fraudFlags.slice(0, 19) : [];
    flags.unshift({ code: flag, at: new Date().toISOString() });
    tx.set(ref, {
      fraudStrikes: strikes,
      fraudFlags: flags,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return strikes;
  });
}

export async function appendAuctionFraudLog(db, auctionDocId, entry) {
  const id = String(auctionDocId || '').trim();
  if (!id) return;
  try {
    const ref = db.collection('auctions').doc(id);
    await db.runTransaction(async function(tx) {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() || {};
      const log = Array.isArray(data.fraudLog) ? data.fraudLog.slice(0, 19) : [];
      log.unshift(Object.assign({ at: new Date().toISOString() }, entry));
      tx.set(ref, { fraudLog: log, updatedAt: new Date().toISOString() }, { merge: true });
    });
  } catch (err) {
    console.warn('[auction-fraud] fraud log append failed:', err.message);
  }
}

/**
 * Evaluate bid fraud signals. blocked=true only when enforce mode and rules trigger.
 */
export async function evaluateBidFraud(db, ctx) {
  const settings = ctx?.settings || {};
  const phoneKeyValue = String(ctx?.phoneKey || '').trim();
  const bidderName = ctx?.bidderName || '';
  const bids = Array.isArray(ctx?.bids) ? ctx.bids : [];
  const auctionDocId = ctx?.auctionDocId || '';
  const enforce = isEnforceMode(settings);

  const flags = [];
  let strikes = await getFraudStrikes(db, phoneKeyValue);

  if (await isPhoneBlacklisted(db, phoneKeyValue)) {
    flags.push(FRAUD_CODES.BLACKLISTED);
  }

  if (detectShillNameMismatch(bids, phoneKeyValue, bidderName)) {
    flags.push(FRAUD_CODES.SHILL_NAME_MISMATCH);
    strikes = await incrementFraudStrike(db, phoneKeyValue, FRAUD_CODES.SHILL_NAME_MISMATCH);
  }

  const burstOk = await burstRateOk(phoneKeyValue);
  if (!burstOk) {
    flags.push(FRAUD_CODES.BID_VELOCITY);
  }

  let blocked = false;
  if (flags.includes(FRAUD_CODES.BLACKLISTED)) {
    blocked = enforce;
  }
  if (flags.includes(FRAUD_CODES.BID_VELOCITY)) {
    blocked = enforce || blocked;
  }
  if (flags.includes(FRAUD_CODES.SHILL_NAME_MISMATCH) && strikes >= SHILL_STRIKE_BLOCK) {
    blocked = enforce || blocked;
  }

  if (flags.length) {
    await appendAuctionFraudLog(db, auctionDocId, {
      phoneKey: phoneKeyValue,
      name: cleanString(bidderName, 80),
      flags: flags,
      strikes: strikes,
      enforce: enforce,
      blocked: blocked
    });
  }

  return {
    flags: flags,
    strikes: strikes,
    enforce: enforce,
    blocked: blocked,
    logOnly: !enforce
  };
}

export function fraudBlockResponse(fraudResult) {
  const code = (fraudResult?.flags || [])[0] || 'FRAUD_BLOCKED';
  const messages = {
    BLACKLISTED: 'Bidding is not available for this account.',
    SHILL_NAME_MISMATCH: 'Bidding blocked — identity verification required.',
    BID_VELOCITY: 'Too many bids in a short time. Please wait a minute.'
  };
  return {
    error: messages[code] || 'Bid could not be accepted.',
    code: code,
    fraudFlags: fraudResult?.flags || []
  };
}
