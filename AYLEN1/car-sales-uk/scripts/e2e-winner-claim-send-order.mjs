#!/usr/bin/env node
/**
 * E2E probe: POST /api/send-order for paid auction winner lot.
 * Requires Preview Turnstile test keys + TELEGRAM on Preview.
 *
 * Usage:
 *   PREVIEW_URL=https://xxx.vercel.app node scripts/e2e-winner-claim-send-order.mjs
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import { getFirestoreAdmin } from '../lib/server/firebase-admin-app.mjs';
import { isAdminConfigured } from '../lib/server/firestore-admin.mjs';
import { auctionFirestoreDocId } from '../lib/server/auction-deposit.mjs';
import { isWinnerPaymentPaid } from '../lib/server/auction-payment.mjs';

loadProjectEnv();

const BASE = (process.env.PREVIEW_URL || 'https://car-sales-10dbmfbdn-olegyuryevich-5608s-projects.vercel.app').replace(/\/$/, '');
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || 'sjpb0giM5TAIuf1MWpi9xqVoM5EceSf5';
const AUCTION_ID = process.env.E2E_AUCTION_ID || 'auction_101';

async function findPaidLot() {
  if (!isAdminConfigured()) return null;
  const db = getFirestoreAdmin();
  if (process.env.E2E_AUCTION_ID) {
    const docId = auctionFirestoreDocId(AUCTION_ID);
    const snap = await db.collection('auctions').doc(docId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (!isWinnerPaymentPaid(data.winner || {})) return null;
    return { id: AUCTION_ID, data };
  }
  const snap = await db.collection('auctions').where('status', '==', 'winner_pending').limit(20).get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (isWinnerPaymentPaid(data.winner || {})) {
      return { id: data.id || doc.id, data };
    }
  }
  return null;
}

async function main() {
  console.log('\n=== E2E winner send-order probe ===');
  console.log('URL:', BASE);

  const lot = await findPaidLot();
  if (!lot) {
    throw new Error('No paid winner_pending lot found (set E2E_AUCTION_ID)');
  }

  const winner = lot.data.winner || {};
  const phone = String(winner.bidderPhone || '07471647771').trim();
  const name = String(winner.bidderName || 'E2E Winner').trim();
  const now = Date.now();

  const body = {
    type: 'auction_winner',
    auctionId: lot.id,
    auctionName: lot.data.name || 'Auction lot',
    name,
    phone,
    method: 'Self Collection',
    comment: 'E2E test',
    finalPrice: Number(lot.data.currentPrice || winner.amount || 0),
    bidId: winner.bidId || '',
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    security: {
      sessionId: 'e2e-' + now,
      formStartedAt: now - 5000,
      submittedAt: now,
      website: ''
    }
  };

  console.log('Lot:', lot.id, '| phone:', phone, '| paid:', winner.paymentStatus);

  const res = await fetch(BASE + '/api/send-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vercel-protection-bypass': BYPASS
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));

  console.log('\nPOST /api/send-order');
  console.log('  HTTP:', res.status);
  console.log('  Body:', JSON.stringify(data));

  if (res.status === 200 && data.success) {
    console.log('\nE2E PASS — Telegram messageId:', data.messageId);
    return;
  }

  if (data.error === 'Telegram not configured') {
    console.log('\nDIAGNOSIS: Telegram API never called — TELEGRAM_* missing on Preview (redeploy after env fix).');
  } else if (res.status === 429) {
    console.log('\nDIAGNOSIS: Blocked at server rate limit — run reset-winner-rate-limits.mjs');
  } else if (res.status === 400 && String(data.error || '').includes('Captcha')) {
    console.log('\nDIAGNOSIS: Blocked at Turnstile — need real widget token');
  } else if (data.code === 'PAYMENT_REQUIRED') {
    console.log('\nDIAGNOSIS: Blocked at paymentStatus gate');
  }

  process.exit(1);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
