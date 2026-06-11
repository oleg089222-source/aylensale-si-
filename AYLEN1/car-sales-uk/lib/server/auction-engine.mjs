/**
 * Auction engine — bot bidders, auto-relist, finalize, admin analytics.
 */
import crypto from 'crypto';
import { getFirestoreAdmin } from './firebase-admin-app.mjs';

export const SETTINGS_DOC = 'auctionSettings/global';

export const DEFAULT_BOT_NAMES = [
  'James W.', 'Sarah M.', 'Mike T.', 'Emma L.', 'Chris P.',
  'Anna K.', 'David R.', 'Lisa H.', 'Tom B.', 'Kate S.',
  'Ryan G.', 'Sophie N.', 'Ben C.', 'Laura F.', 'Jack D.'
];

export function defaultSettings() {
  return Object.assign({
    siteRevealed: false,
    botGlobalEnabled: true,
    defaultBotMaxTotal: 150,
    botMinIntervalSec: 120,
    botMaxIntervalSec: 480,
    autoRelistZeroBids: true,
    autoRelistHours: 24,
    antiSnipeEnabled: true,
    antiSnipeWindowSec: 180,
    antiSnipeExtendSec: 180,
    botNames: DEFAULT_BOT_NAMES.slice(),
    depositsEnabled: true,
    depositAmountGbp: Number(process.env.AUCTION_DEPOSIT_GBP || 50),
    depositEnforcement: false,
    depositEnforcementEnabled: false,
    depositWebhookEnabled: true,
    depositVerifyFallbackEnabled: true,
    winnerPaymentEnabled: false,
    turnstileOnBid: false,
    fraudEnforceMode: 'log',
    updatedAt: new Date().toISOString()
  });
}

export async function getAuctionSettings(db) {
  const ref = db.collection('auctionSettings').doc('global');
  const snap = await ref.get();
  if (!snap.exists) {
    const defaults = defaultSettings();
    await ref.set(defaults);
    return defaults;
  }
  return Object.assign(defaultSettings(), snap.data() || {});
}

export async function saveAuctionSettings(db, patch) {
  const ref = db.collection('auctionSettings').doc('global');
  const next = Object.assign({}, await getAuctionSettings(db), patch, {
    updatedAt: new Date().toISOString()
  });
  await ref.set(next, { merge: true });
  return next;
}

export function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '';
  return crypto.createHash('sha256').update('aylen_auction_' + digits).digest('hex').slice(0, 24);
}

export function isBotBid(bid) {
  return !!(bid && (bid.isBot || bid.source === 'bot'));
}

export function countRealBids(bids) {
  return (bids || []).filter(function(b) { return !isBotBid(b); }).length;
}

export function getParticipants(bids) {
  const map = {};
  (bids || []).forEach(function(b) {
    if (isBotBid(b)) return;
    const key = b.bidderKey || phoneKey(b.bidderPhone) || String(b.bidderName || b.bidder || '').toLowerCase();
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        key: key,
        name: b.bidderName || b.bidder || 'Bidder',
        phoneLast4: String(b.bidderPhone || '').replace(/\D/g, '').slice(-4),
        bids: 0,
        maxAmount: 0,
        lastAt: b.timestamp || ''
      };
    }
    map[key].bids += 1;
    map[key].maxAmount = Math.max(map[key].maxAmount, Number(b.amount || 0));
    if (b.timestamp && b.timestamp > map[key].lastAt) map[key].lastAt = b.timestamp;
  });
  return Object.values(map).sort(function(a, b) { return b.maxAmount - a.maxAmount; });
}

export function analyzeAuction(auction) {
  const bids = Array.isArray(auction.bids) ? auction.bids : [];
  const participants = getParticipants(bids);
  const botBids = bids.filter(isBotBid).length;
  const realBids = bids.length - botBids;
  const endMs = Date.parse(auction.endTime || 0) || 0;
  const now = Date.now();
  const status = String(auction.status || 'active');
  let liveStatus = status;
  if (status === 'active' && endMs && endMs <= now) liveStatus = 'ended';
  const msLeft = Math.max(0, endMs - now);
  const heat = participants.length >= 3 ? 'hot' : (participants.length >= 2 ? 'warm' : (realBids > 0 || botBids > 0 ? 'solo' : 'cold'));

  return {
    id: auction.id,
    name: auction.name || auction.title || 'Auction',
    currentPrice: Number(auction.currentPrice || auction.startingPrice || 0),
    startingPrice: Number(auction.startingPrice || auction.startPrice || 0),
    bidsCount: Number(auction.bidsCount || bids.length || 0),
    botBids: botBids,
    realBids: realBids,
    participants: participants,
    participantCount: participants.length,
    heat: heat,
    status: liveStatus,
    endTime: auction.endTime,
    msLeft: msLeft,
    botEnabled: auction.botEnabled !== false,
    botMaxTotal: Number(auction.botMaxTotal || 0),
    viewCount: Number(auction.viewCount || 0)
  };
}

function pickBotName(settings, auction) {
  const pool = Array.isArray(settings.botNames) && settings.botNames.length
    ? settings.botNames
    : DEFAULT_BOT_NAMES;
  const used = new Set((auction.bids || []).filter(isBotBid).map(function(b) {
    return String(b.bidderName || b.bidder || '');
  }));
  const free = pool.filter(function(n) { return !used.has(n); });
  const list = free.length ? free : pool;
  return list[Math.floor(Math.random() * list.length)];
}

function nextBotAmount(auction, settings) {
  const current = Number(auction.currentPrice || auction.startingPrice || 0);
  const start = Number(auction.startingPrice || auction.startPrice || 1);
  const step = Math.max(1, Math.round(start * (0.02 + Math.random() * 0.04)));
  return Math.round((current + step) * 100) / 100;
}

export function botAllowedForAuction(auction, settings) {
  if (!settings.botGlobalEnabled) return false;
  if (settings.siteRevealed && auction.botEnabled !== true) return false;
  if (auction.botPaused) return false;
  const status = String(auction.status || 'active');
  if (status === 'completed' || status === 'order_sent' || status === 'winner_pending') return false;
  const endMs = Date.parse(auction.endTime || 0);
  if (endMs && endMs <= Date.now()) return false;
  const maxTotal = Number(auction.botMaxTotal || settings.defaultBotMaxTotal || 0);
  const current = Number(auction.currentPrice || auction.startingPrice || 0);
  if (maxTotal > 0 && current >= maxTotal) return false;
  return true;
}

/** Extend end time when bid lands in final window (anti-snipe). */
export function applyAntiSnipeEndTime(currentEndIso, settings, nowMs) {
  if (!settings || settings.antiSnipeEnabled === false) return null;
  const endMs = Date.parse(currentEndIso || 0);
  if (!endMs || endMs <= nowMs) return null;
  const windowMs = Number(settings.antiSnipeWindowSec || 180) * 1000;
  const extendMs = Number(settings.antiSnipeExtendSec || 180) * 1000;
  if (endMs - nowMs > windowMs) return null;
  return new Date(endMs + extendMs).toISOString();
}

export async function recordAuctionOutcomes(db, auctionId, auction, winner) {
  const bids = Array.isArray(auction.bids) ? auction.bids : [];
  const real = bids.filter(function(b) { return !isBotBid(b); });
  const winKey = winner && (winner.bidderKey || phoneKey(winner.bidderPhone));
  const seen = new Set();

  for (const b of real) {
    const key = b.bidderKey || phoneKey(b.bidderPhone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const isWinner = winKey && key === winKey;
    await upsertBidderProfile(db, b.bidderPhone, b.bidderName || b.bidder, {
      type: isWinner ? 'won' : 'lost',
      auctionId: auctionId,
      amount: Number(b.amount || 0),
      at: new Date().toISOString()
    });
  }
}

/** After a real bid: optional bot reply, telegram, ended-lot processing. */
export async function afterRealBid(db, auctionId, bid, auctionSnapshot) {
  const settings = await getAuctionSettings(db);
  const ref = db.collection('auctions').doc(String(auctionId));
  const snap = await ref.get();
  if (!snap.exists) return;
  const auction = Object.assign({ id: auctionId }, snap.data() || {});
  const analysis = analyzeAuction(auction);

  const notifyMod = await import('./auction-notify.mjs');
  await notifyMod.notifyAdminRealBid(auction, bid, analysis).catch(function() {});

  if (analysis.participantCount >= 2 && analysis.realBids >= 2) {
    const hotKey = 'hot_' + auctionId + '_' + analysis.participantCount;
    const recent = auction.lastHotAlertAt;
    const cooldown = Date.parse(recent || 0) + 3600000 > Date.now();
    if (!cooldown) {
      await notifyMod.notifyAdminHotLot(auction, analysis).catch(function() {});
      await ref.set({ lastHotAlertAt: new Date().toISOString() }, { merge: true });
    }
  }

  if (botAllowedForAuction(auction, settings)) {
    await placeBotBid(db, auctionId, auction, settings);
  }

  const ended = Date.parse(auction.endTime || 0) <= Date.now();
  if (ended && String(auction.status || 'active') === 'active') {
    const result = await processEndedAuction(db, auctionId, auction, settings);
    if (result) {
      await notifyMod.notifyAdminAuctionEnded(auction, result).catch(function() {});
      if (result.finalized && result.winner) {
        await recordAuctionOutcomes(db, auctionId, auction, result.winner);
      }
    }
  }
}

export async function placeBotBid(db, auctionId, auction, settings) {
  if (!botAllowedForAuction(auction, settings)) return null;

  const lastTick = Date.parse(auction.botLastTickAt || 0) || 0;
  const minGap = Number(settings.botMinIntervalSec || 120) * 1000;
  if (Date.now() - lastTick < minGap) return null;

  const ref = db.collection('auctions').doc(String(auctionId));
  const name = pickBotName(settings, auction);
  const fakePhone = '07' + String(Math.floor(100000000 + Math.random() * 899999999));

  const result = await db.runTransaction(async function(tx) {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const live = Object.assign({ id: auctionId }, data);
    if (!botAllowedForAuction(live, settings)) return null;

    const amount = nextBotAmount(live, settings);
    const maxTotal = Number(live.botMaxTotal || settings.defaultBotMaxTotal || 0);
    if (maxTotal > 0 && amount > maxTotal) return null;

    const currentPrice = Number(live.currentPrice || live.startingPrice || 0);
    if (amount <= currentPrice) return null;

    const bids = Array.isArray(live.bids) ? live.bids.slice() : [];
    const bid = {
      id: String(auctionId) + '_bot_' + Date.now(),
      auctionId: auctionId,
      amount: amount,
      bidder: name,
      bidderName: name,
      bidderPhone: fakePhone,
      bidderContact: '',
      bidderKey: 'bot_' + name.replace(/\W/g, '').toLowerCase(),
      isBot: true,
      source: 'bot',
      timestamp: new Date().toISOString()
    };
    bids.push(bid);
    tx.set(ref, {
      bids: bids,
      bidsCount: bids.length,
      currentPrice: amount,
      status: 'active',
      botLastTickAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { bid: bid, currentPrice: amount, bidsCount: bids.length };
  });

  return result;
}

export async function relistAuction(db, auctionId, auction, settings, reason) {
  const hours = Number(settings.autoRelistHours || 24);
  const endTime = new Date(Date.now() + hours * 3600000).toISOString();
  const start = Number(auction.startingPrice || auction.startPrice || 0);
  await db.collection('auctions').doc(String(auctionId)).set({
    status: 'active',
    endTime: endTime,
    currentPrice: start,
    bids: [],
    bidsCount: 0,
    winner: null,
    winnerOrder: null,
    finalizedAt: null,
    relistCount: Number(auction.relistCount || 0) + 1,
    lastRelistAt: new Date().toISOString(),
    lastRelistReason: reason || 'zero_bids',
    updatedAt: new Date().toISOString()
  }, { merge: true });
  return { relisted: true, endTime: endTime };
}

export async function finalizeAuctionServer(db, auctionId, auction) {
  const bids = Array.isArray(auction.bids) ? auction.bids : [];
  const real = bids.filter(function(b) { return !isBotBid(b); });
  const winner = real.length
    ? real.reduce(function(best, b) {
      return Number(b.amount || 0) > Number(best.amount || 0) ? b : best;
    }, real[0])
    : null;

  const patch = {
    finalizedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (winner) {
    patch.status = 'winner_pending';
    patch.winner = {
      bidId: winner.id,
      bidderName: winner.bidderName || winner.bidder || 'Winner',
      bidderPhone: winner.bidderPhone || '',
      bidderContact: winner.bidderContact || '',
      bidderKey: winner.bidderKey || phoneKey(winner.bidderPhone),
      amount: Number(winner.amount || auction.currentPrice || 0),
      timestamp: winner.timestamp || ''
    };
    patch.currentPrice = Number(winner.amount || auction.currentPrice || 0);
  } else {
    patch.status = 'ended';
    patch.winner = null;
  }

  await db.collection('auctions').doc(String(auctionId)).set(patch, { merge: true });
  if (winner) {
    await recordAuctionOutcomes(db, auctionId, auction, patch.winner);
  }
  return { finalized: true, winner: patch.winner, status: patch.status };
}

export async function processEndedAuction(db, auctionId, auction, settings) {
  const endMs = Date.parse(auction.endTime || 0);
  if (!endMs || endMs > Date.now()) return null;
  const status = String(auction.status || 'active');
  if (status === 'completed' || status === 'order_sent' || status === 'winner_pending') {
    return { skipped: true, reason: status };
  }

  const bids = Array.isArray(auction.bids) ? auction.bids : [];
  const realCount = countRealBids(bids);

  if (realCount === 0 && settings.autoRelistZeroBids !== false) {
    return relistAuction(db, auctionId, auction, settings, 'zero_real_bids');
  }

  return finalizeAuctionServer(db, auctionId, auction);
}

export async function runAuctionTick(db) {
  const settings = await getAuctionSettings(db);
  const snap = await db.collection('auctions').get();
  const summary = { botBids: 0, finalized: 0, relisted: 0, processed: 0 };

  for (const doc of snap.docs) {
    const auction = Object.assign({ id: doc.id }, doc.data() || {});
    const ended = Date.parse(auction.endTime || 0) <= Date.now();
    const status = String(auction.status || 'active');

    if (ended && status === 'active') {
      const r = await processEndedAuction(db, doc.id, auction, settings);
      summary.processed += 1;
      if (r && r.relisted) summary.relisted += 1;
      if (r && r.finalized) summary.finalized += 1;
      if (r && (r.relisted || r.finalized)) {
        const notifyMod = await import('./auction-notify.mjs');
        await notifyMod.notifyAdminAuctionEnded(auction, r).catch(function() {});
      }
      continue;
    }

    if (!ended && status === 'active' && botAllowedForAuction(auction, settings)) {
      const maybe = Math.random() < 0.35;
      if (maybe) {
        const placed = await placeBotBid(db, doc.id, auction, settings);
        if (placed) summary.botBids += 1;
      }
    }
  }

  return { ok: true, summary: summary, settings: {
    siteRevealed: settings.siteRevealed,
    botGlobalEnabled: settings.botGlobalEnabled
  }};
}

export async function getAdminAuctionDashboard(db) {
  const settings = await getAuctionSettings(db);
  const snap = await db.collection('auctions').get();
  const items = [];
  let active = 0;
  let endingSoon = 0;
  let totalRealBids = 0;
  let totalBotBids = 0;
  let hotLots = 0;
  const now = Date.now();

  snap.docs.forEach(function(doc) {
    const a = analyzeAuction(Object.assign({ id: doc.id }, doc.data() || {}));
    items.push(a);
    if (a.status === 'active') {
      active += 1;
      if (a.msLeft > 0 && a.msLeft < 3600000) endingSoon += 1;
    }
    totalRealBids += a.realBids;
    totalBotBids += a.botBids;
    if (a.heat === 'hot' || a.heat === 'warm') hotLots += 1;
  });

  items.sort(function(x, y) {
    if (x.status === 'active' && y.status !== 'active') return -1;
    if (y.status === 'active' && x.status !== 'active') return 1;
    return (Date.parse(x.endTime || 0) || 0) - (Date.parse(y.endTime || 0) || 0);
  });

  return {
    ok: true,
    settings: settings,
    stats: {
      total: items.length,
      active: active,
      endingSoon: endingSoon,
      totalRealBids: totalRealBids,
      totalBotBids: totalBotBids,
      hotLots: hotLots,
      serverTime: new Date(now).toISOString()
    },
    auctions: items
  };
}

export async function updateAuctionBotSettings(db, auctionId, patch) {
  const ref = db.collection('auctions').doc(String(auctionId));
  const allowed = {};
  if (patch.botEnabled !== undefined) allowed.botEnabled = !!patch.botEnabled;
  if (patch.botPaused !== undefined) allowed.botPaused = !!patch.botPaused;
  if (patch.botMaxTotal !== undefined) allowed.botMaxTotal = Math.max(0, Number(patch.botMaxTotal) || 0);
  allowed.updatedAt = new Date().toISOString();
  await ref.set(allowed, { merge: true });
  const snap = await ref.get();
  return analyzeAuction(Object.assign({ id: auctionId }, snap.data() || {}));
}

export async function getAuctionDetail(db, auctionId) {
  const snap = await db.collection('auctions').doc(String(auctionId)).get();
  if (!snap.exists) return { ok: false, error: 'Not found' };
  const raw = snap.data() || {};
  const analysis = analyzeAuction(Object.assign({ id: snap.id }, raw));
  const bids = (Array.isArray(raw.bids) ? raw.bids : []).slice().sort(function(a, b) {
    return (Date.parse(b.timestamp || 0) || 0) - (Date.parse(a.timestamp || 0) || 0);
  });
  return {
    ok: true,
    auction: Object.assign({}, raw, { id: snap.id }),
    analysis: analysis,
    bids: bids.map(function(b) {
      return {
        id: b.id,
        amount: Number(b.amount || 0),
        bidderName: b.bidderName || b.bidder || 'Bidder',
        isBot: isBotBid(b),
        timestamp: b.timestamp || '',
        phoneLast4: isBotBid(b) ? '****' : String(b.bidderPhone || '').replace(/\D/g, '').slice(-4)
      };
    })
  };
}

export async function upsertBidderProfile(db, phone, name, event) {
  const key = phoneKey(phone);
  if (!key) return null;
  const ref = db.collection('auctionProfiles').doc(key);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() || {} : {};
  const history = Array.isArray(prev.history) ? prev.history.slice(0, 49) : [];
  if (event) history.unshift(event);

  const stats = Object.assign({
    wins: 0,
    losses: 0,
    totalBids: 0,
    activeLeading: 0
  }, prev.stats || {});

  if (event && event.type === 'bid') stats.totalBids += 1;
  if (event && event.type === 'won') stats.wins += 1;
  if (event && event.type === 'lost') stats.losses += 1;

  const doc = {
    displayName: String(name || prev.displayName || 'Bidder').slice(0, 80),
    phoneLast4: String(phone || '').replace(/\D/g, '').slice(-4),
    stats: stats,
    history: history.slice(0, 50),
    notifyPrefs: prev.notifyPrefs || { outbid: true, endingSoon: true, won: true },
    updatedAt: new Date().toISOString()
  };
  await ref.set(doc, { merge: true });
  return { key: key, profile: doc };
}

export async function getBidderProfile(db, phone) {
  const key = phoneKey(phone);
  if (!key) return { ok: false, error: 'Invalid phone' };
  const snap = await db.collection('auctionProfiles').doc(key).get();
  if (!snap.exists) {
    return {
      ok: true,
      profile: {
        displayName: '',
        stats: { wins: 0, losses: 0, totalBids: 0 },
        history: [],
        notifyPrefs: { outbid: true, endingSoon: true, won: true }
      }
    };
  }
  const p = snap.data() || {};
  return {
    ok: true,
    profile: {
      displayName: p.displayName || '',
      phoneLast4: p.phoneLast4 || '',
      stats: p.stats || { wins: 0, losses: 0, totalBids: 0 },
      history: (p.history || []).slice(0, 30),
      notifyPrefs: p.notifyPrefs || { outbid: true, endingSoon: true, won: true }
    }
  };
}
