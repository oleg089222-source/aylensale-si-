#!/usr/bin/env node
/**
 * Staging / Preview — full deposit enforcement E2E (API).
 * Uses `npx vercel curl` for protected preview deployments.
 *
 * Usage:
 *   STAGING_URL=https://xxx.vercel.app AUCTION_ID=auction_... npm run verify:staging-deposit-flow
 *   SESSION_ID=cs_test_...  # optional — skip deposit create if already paid in Stripe
 */
import { execFileSync } from 'node:child_process';
import { loadProjectEnv, projectRoot } from './lib/load-env.mjs';

const scriptRoot = projectRoot;

loadProjectEnv();

const STAGING = (process.env.STAGING_URL || process.env.VERIFY_URL || '').replace(/\/$/, '');
const PROD = (process.env.PRODUCTION_URL || 'https://aylensale.com').replace(/\/$/, '');
const AUCTION_ID = process.env.AUCTION_ID || 'auction_1781110674819_ae6sf';
const QA_PHONE = process.env.QA_PHONE || '07900111222';
const QA_NAME = process.env.QA_NAME || 'Staging QA Bidder';
const SESSION_ID = process.env.SESSION_ID || '';

if (!STAGING) {
  console.error('Set STAGING_URL (preview deployment URL)');
  process.exit(1);
}

let failed = 0;
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail: detail || '' });
  console.log(pass ? '  OK' : ' FAIL', name, detail || '');
  if (!pass) failed++;
}

function vercelFetch(url, opts) {
  const args = ['vercel', 'curl', url];
  if (opts && opts.method && opts.method !== 'GET') {
    args.push('-X', opts.method);
  }
  if (opts && opts.body) {
    args.push('-H', 'Content-Type: application/json', '--data', JSON.stringify(opts.body));
  }
  const out = execFileSync('npx', args, {
    cwd: scriptRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const trimmed = out.trim();
  try {
    return { status: 200, data: JSON.parse(trimmed) };
  } catch (e) {
    return { status: 200, data: { raw: trimmed } };
  }
}

async function fetchJson(base, path, opts) {
  if (base === STAGING) {
    return vercelFetch(base + path, opts);
  }
  const res = await fetch(base + path, {
    method: (opts && opts.method) || 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {}),
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(function() { return {}; });
  return { status: res.status, data: data };
}

console.log('\n=== AYLENSALE staging deposit flow ===');
console.log('Staging:', STAGING);
console.log('Production:', PROD);
console.log('Auction:', AUCTION_ID);

// —— Config ——
const stagingCfg = await fetchJson(STAGING, '/api/auction-deposit-config');
record('staging-enforcement-on',
  stagingCfg.data.depositEnforcement === true && stagingCfg.data.depositEnforcementSource === 'env',
  'enforcement=' + stagingCfg.data.depositEnforcement + ' source=' + stagingCfg.data.depositEnforcementSource);

const prodCfg = await fetchJson(PROD, '/api/auction-deposit-config');
record('production-enforcement-off',
  prodCfg.data.depositEnforcement === false && prodCfg.data.productionLocked === true,
  'enforcement=' + prodCfg.data.depositEnforcement + ' locked=' + prodCfg.data.productionLocked);

// —— Active auction in catalog ——
const catalog = await fetchJson(STAGING, '/api/storefront-catalog');
const lots = catalog.data.auctions || [];
const lot = lots.find(function(a) { return String(a.id) === AUCTION_ID; });
const active = lots.filter(function(a) {
  const end = Date.parse(a.endTime || 0);
  return (a.status === 'active' || !a.status) && end > Date.now();
});
record('staging-active-auction',
  !!lot && active.some(function(a) { return String(a.id) === AUCTION_ID; }),
  lot ? 'active lots=' + active.length : 'lot missing');

const bidAmount = lot
  ? Number(lot.currentPrice || lot.startingPrice || 1) + 1
  : 2;

// —— Bid without deposit → DEPOSIT_REQUIRED ——
const bidBlocked = await fetchJson(STAGING, '/api/auction-bid', {
  method: 'POST',
  body: {
    auctionId: AUCTION_ID,
    bidAmount: bidAmount,
    name: QA_NAME,
    phone: QA_PHONE,
    contact: ''
  }
});
record('bid-without-deposit-blocked',
  bidBlocked.data.code === 'DEPOSIT_REQUIRED',
  'status implied code=' + (bidBlocked.data.code || 'none') + ' err=' + (bidBlocked.data.error || '').slice(0, 60));

// —— Gated UI strings in bundle ——
const bundleOut = execFileSync('npx', ['vercel', 'curl', STAGING + '/js/storefront-core.bundle.js'], {
  encoding: 'utf8',
  maxBuffer: 15 * 1024 * 1024
});
record('ui-gated-label-in-bundle',
  bundleOut.indexOf('Deposit First') !== -1 && bundleOut.indexOf('isAuctionBidGated') !== -1,
  'Pay £50 Deposit First + isAuctionBidGated');

// —— Deposit checkout ——
let sessionId = SESSION_ID;
if (!sessionId) {
  const dep = await fetchJson(STAGING, '/api/auction-deposit', {
    method: 'POST',
    body: {
      auctionId: AUCTION_ID,
      name: QA_NAME,
      phone: QA_PHONE,
      email: 'staging-qa@aylensale.com'
    }
  });
  record('deposit-checkout-created',
    dep.data.success === true && !!dep.data.url && !!dep.data.sessionId,
    dep.data.sessionId || dep.data.error || '');
  sessionId = dep.data.sessionId || '';
  if (dep.data.url) {
    console.log('\n  → Stripe checkout URL (complete with test card 4242…):');
    console.log('  ', dep.data.url);
  }
}

if (sessionId) {
  const verify = await fetchJson(STAGING, '/api/auction-deposit-verify', {
    method: 'POST',
    body: { sessionId: sessionId }
  });
  const paid = verify.data.ok === true && verify.data.paid === true;
  record('deposit-verify-fallback-paid', paid,
    paid ? 'auctionId=' + verify.data.auctionId : (verify.data.error || 'payment not completed — pay in Stripe test mode first'));
  if (!paid) {
    console.log('\n  ℹ Complete Stripe checkout, then re-run with:');
    console.log('  SESSION_ID=' + sessionId + ' STAGING_URL=' + STAGING + ' npm run verify:staging-deposit-flow');
  } else {
    const bidOk = await fetchJson(STAGING, '/api/auction-bid', {
      method: 'POST',
      body: {
        auctionId: AUCTION_ID,
        bidAmount: bidAmount,
        name: QA_NAME,
        phone: QA_PHONE,
        contact: ''
      }
    });
    record('bid-after-deposit-success',
      bidOk.data.success === true,
      bidOk.data.success ? '£' + bidAmount + ' accepted' : (bidOk.data.error || bidOk.data.code || 'failed'));
  }
} else {
  record('deposit-verify-fallback-paid', false, 'no sessionId');
  record('bid-after-deposit-success', false, 'skipped');
}

// —— Buy Now unchanged (no DEPOSIT_REQUIRED) ——
if (lot && Number(lot.buyNowPrice || 0) > 0) {
  const bn = await fetchJson(STAGING, '/api/auction-buy-now', {
    method: 'POST',
    body: { auctionId: AUCTION_ID, name: QA_NAME, phone: '07900111333', contact: '' }
  });
  record('buynow-not-deposit-gated',
    (bn.data.code || '') !== 'DEPOSIT_REQUIRED',
    'code=' + (bn.data.code || '(none)'));
} else {
  record('buynow-not-deposit-gated', true, 'skipped — no buyNow on lot');
}

console.log('\n--- Summary ---');
console.log(JSON.stringify({
  pass: results.filter(function(r) { return r.pass; }).length,
  fail: failed,
  total: results.length
}, null, 2));

process.exit(failed > 0 ? 1 : 0);
