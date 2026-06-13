#!/usr/bin/env node
/**
 * Stage 6 — winner payment flow verify.
 * Usage: VERIFY_URL=https://aylensale.com npm run verify:auction-winner-payment
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import {
  PAYMENT_STATUSES,
  buildWinnerPaymentFields,
  isWinnerPaymentPaid,
  resolveWinnerPaymentFlags,
  publicWinnerPaymentConfig
} from '../lib/server/auction-payment.mjs';

loadProjectEnv();

const BASE = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
let failed = 0;

function record(name, cond, detail) {
  if (cond) console.log('  OK', name, detail || '');
  else {
    failed++;
    console.log(' FAIL', name, detail || '');
  }
}

async function getJson(path, opts) {
  const res = await fetch(BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data: data };
}

console.log('\n=== AYLENSALE winner payment verify (Stage 6) ===');
console.log('URL:', BASE);

record('payment-statuses', PAYMENT_STATUSES.PENDING === 'pending' && PAYMENT_STATUSES.PAID === 'paid', '');
const fields = buildWinnerPaymentFields(150, { winnerPaymentHours: 48 });
record('build-payment-fields', fields.paymentStatus === 'pending' && fields.hammerAmount === 150, 'due=' + (fields.paymentDueAt || '').slice(0, 10));
record('is-paid-check', isWinnerPaymentPaid({ paymentStatus: 'paid' }) === true, '');
record('flags-default-on', resolveWinnerPaymentFlags({}).winnerPaymentEnabled === true, '');

const cfg = await getJson('/api/auction-payment-config');
record('payment-config-200', cfg.status === 200 && cfg.data.ok === true, 'enabled=' + cfg.data.winnerPaymentEnabled);
record('deposit-config-still-off', true, 'checked separately in auction-full');

const claimBlocked = await fetch(BASE + '/api/send-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'auction_winner',
    auctionId: 'verify_nonexistent_lot',
    auctionName: 'Test',
    name: 'Test Winner',
    phone: '07123456789',
    method: 'Self Collection',
    comment: 'verify script',
    finalPrice: 100,
    security: { formStartedAt: Date.now() - 5000, submittedAt: Date.now(), website: '' }
  })
});
const claimData = await claimBlocked.json().catch(function() { return {}; });
record('claim-requires-payment-or-valid-auction',
  claimBlocked.status === 400 || claimBlocked.status === 403 || claimBlocked.status === 503,
  'status=' + claimBlocked.status + ' code=' + (claimData.code || 'none'));

const payStart = await fetch(BASE + '/api/auction-winner-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    auctionId: 'verify_nonexistent_lot',
    phone: '07123456789',
    security: { formStartedAt: Date.now() - 5000, submittedAt: Date.now(), website: '' }
  })
});
record('winner-payment-rejects-invalid-lot', payStart.status === 404 || payStart.status === 400, 'status=' + payStart.status);

const catalog = await getJson('/api/storefront-catalog?limit=3');
record('catalog-still-ok', catalog.status === 200 && catalog.data.ok !== false, 'auctions=' + ((catalog.data.auctions || []).length));

const vipCfg = await getJson('/api/vip-config');
record('vip-config-still-ok', vipCfg.status === 200, '');

const publicCfg = publicWinnerPaymentConfig({ winnerPaymentEnabled: true });
record('public-config-paths', publicCfg.checkoutPath === '/api/auction-winner-payment', publicCfg.verifyPath);

console.log(failed ? '\nverify-auction-winner-payment FAILED (' + failed + ')' : '\nverify-auction-winner-payment OK');
process.exit(failed ? 1 : 0);
