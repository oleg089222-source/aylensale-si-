#!/usr/bin/env node
/**
 * Stage 2 — deposit enforcement gate tests.
 * Usage:
 *   npm run verify:auction-deposit-enforcement
 *   VERIFY_URL=https://aylensale.com npm run verify:auction-deposit-enforcement
 */
import { loadProjectEnv } from './lib/load-env.mjs';
import {
  DEPOSIT_STATUSES,
  hasPaidDeposit,
  isProductionDeploy,
  requirePaidDepositForBid,
  resolveDepositFlags
} from '../lib/server/auction-deposit.mjs';

loadProjectEnv();

const BASE = (process.env.VERIFY_URL || 'https://aylensale.com').replace(/\/$/, '');
let failed = 0;

function pass(name, detail) {
  console.log('  OK', name, detail || '');
}

function fail(name, detail) {
  failed++;
  console.log(' FAIL', name, detail || '');
}

function record(name, cond, detail) {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

async function getJson(path, opts) {
  const res = await fetch(BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data: data };
}

console.log('\n=== AYLENSALE deposit enforcement verify (Stage 2) ===');
console.log('URL:', BASE);

// —— Unit: production lock ——
const savedVercel = process.env.VERCEL_ENV;
const savedEnforce = process.env.AUCTION_DEPOSIT_ENFORCEMENT;

process.env.VERCEL_ENV = 'production';
delete process.env.AUCTION_DEPOSIT_ENFORCEMENT;
const prodFlags = resolveDepositFlags({ depositEnforcement: true, depositEnforcementEnabled: true });
record('unit-production-default-on', prodFlags.depositEnforcement === true, 'source=' + prodFlags.depositEnforcementSource);
record('unit-production-not-locked', prodFlags.productionLocked === false, '');

process.env.AUCTION_DEPOSIT_ENFORCEMENT = 'false';
const prodOff = resolveDepositFlags({ depositEnforcementEnabled: true });
record('unit-production-env-off', prodOff.depositEnforcement === false, 'source=' + prodOff.depositEnforcementSource);
delete process.env.AUCTION_DEPOSIT_ENFORCEMENT;

process.env.VERCEL_ENV = 'preview';
process.env.AUCTION_DEPOSIT_ENFORCEMENT = 'true';
const previewFlags = resolveDepositFlags({ depositEnforcement: false });
record('unit-preview-env-on', previewFlags.depositEnforcement === true, 'source=' + previewFlags.depositEnforcementSource);

process.env.VERCEL_ENV = 'preview';
delete process.env.AUCTION_DEPOSIT_ENFORCEMENT;
const previewOff = resolveDepositFlags({ depositEnforcement: false });
record('unit-preview-env-off', previewOff.depositEnforcement === false, '');

// —— Unit: bid gate throws DEPOSIT_REQUIRED ——
let gateErr = null;
try {
  await requirePaidDepositForBid(null, [], 'phonekey_test', { depositEnforcement: true, depositAmountGbp: 50 });
} catch (e) {
  gateErr = e;
}
record('unit-gate-blocks-no-deposit', gateErr && gateErr.code === 'DEPOSIT_REQUIRED', gateErr && gateErr.message);
record('unit-gate-amount', gateErr && gateErr.depositAmountGbp === 50, '');

let gatePass = false;
try {
  await requirePaidDepositForBid(
    null,
    [{ phoneKey: 'phonekey_ok', status: DEPOSIT_STATUSES.PAID, amount: 50 }],
    'phonekey_ok',
    { depositEnforcement: true, depositAmountGbp: 50 }
  );
  gatePass = true;
} catch (e) {
  gatePass = false;
}
record('unit-gate-allows-paid-deposit', gatePass === true, '');
record('unit-has-paid-deposit', hasPaidDeposit(
  [{ phoneKey: 'k1', status: DEPOSIT_STATUSES.PAID }],
  'k1'
) === true, '');

// restore env
if (savedVercel === undefined) delete process.env.VERCEL_ENV;
else process.env.VERCEL_ENV = savedVercel;
if (savedEnforce === undefined) delete process.env.AUCTION_DEPOSIT_ENFORCEMENT;
else process.env.AUCTION_DEPOSIT_ENFORCEMENT = savedEnforce;

// —— Live API: production config ——
const config = await getJson('/api/auction-deposit-config');
record('live-config-ok', config.status === 200 && config.data.ok === true, '');
record('live-production-enforcement-on', config.data.depositEnforcement === true,
  'enforcement=' + config.data.depositEnforcement + ' source=' + (config.data.depositEnforcementSource || 'n/a'));

const settings = await getJson('/api/spam?action=auction-engine&sub=settings');
record('live-firestore-enforcement-enabled',
  settings.data.settings && settings.data.settings.depositEnforcementEnabled === true,
  'Firestore depositEnforcementEnabled=' + (settings.data.settings && settings.data.settings.depositEnforcementEnabled));

// —— Live API: bid without deposit must NOT return DEPOSIT_REQUIRED on production ——
const catalog = await getJson('/api/storefront-catalog');
const items = catalog.data.auctions?.items || catalog.data.auctions || [];
const active = items.find(function(a) {
  const end = Date.parse(a.endTime || 0);
  return (a.status === 'active' || !a.status) && end > Date.now();
});
const target = active || items[0];
const bidAmount = target
  ? Number(target.currentPrice || target.startingPrice || 10) + 5
  : 99;

const bidRes = await getJson('/api/auction-bid', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    auctionId: target ? target.id : 'nonexistent_lot',
    bidAmount: bidAmount,
    name: 'Enforcement QA',
    phone: '07900000001',
    contact: ''
  })
});

const bidCode = bidRes.data.code || '';
record('live-bid-deposit-required', bidCode === 'DEPOSIT_REQUIRED',
  'status=' + bidRes.status + ' code=' + (bidCode || '(none)') + ' error=' + (bidRes.data.error || '').slice(0, 60));

// —— Live API: buy-now must NOT return DEPOSIT_REQUIRED ——
if (target && Number(target.buyNowPrice || 0) > 0) {
  const bnRes = await getJson('/api/auction-buy-now', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auctionId: target.id,
      name: 'BN QA',
      phone: '07900000002',
      contact: ''
    })
  });
  record('live-buynow-not-deposit-required', (bnRes.data.code || '') !== 'DEPOSIT_REQUIRED',
    'status=' + bnRes.status + ' code=' + (bnRes.data.code || '(none)'));
} else {
  pass('live-buynow-not-deposit-required', 'skipped — no buyNow lot in catalog');
}

console.log('\nProduction: deposit enforcement ON by default (disable with AUCTION_DEPOSIT_ENFORCEMENT=false).');

console.log('\n--- Summary ---');
console.log('Failed:', failed);
process.exit(failed > 0 ? 1 : 0);
